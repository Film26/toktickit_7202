import type { RequestHandler } from 'express'
import fs from 'node:fs'
import { z } from 'zod'
import type { Response } from 'express'
import type { TicketStatus } from '@prisma/client'
import prisma from '../db'
import { formatTicketNumber } from '../lib/ticketNumber'
import { loadTicketForUser, serializeTicket, userCanAccessTicket } from '../lib/ticketAccess'
import { MAX_ACTIVE_ATTACHMENTS_PER_TICKET, sanitizeOriginalFilename } from '../lib/attachmentStorage'
import {
  RESOLUTION_GATE_MESSAGE,
  WorkflowError,
  applyGuardedUpdate,
  applyTransition,
  evaluateResolutionGate,
  workflowErrorStatus,
} from '../lib/ticketWorkflow'

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
const STATUSES = [
  'NEW',
  'OPEN',
  'IN_PROGRESS',
  'WAITING_FOR_REQUESTER',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
  'CANCELLED',
] as const
const SORTABLE_FIELDS = [
  'createdAt',
  'ticketNumber',
  'summary',
  'status',
  'requestedPriority',
  'itPriority',
  'updatedAt',
] as const
type SortableField = (typeof SORTABLE_FIELDS)[number]
const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 50

function parseId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== 'string') return null
  const id = Number(raw)
  return Number.isInteger(id) ? id : null
}

function parsePagination(query: Record<string, unknown>) {
  const rawPage = Number(query.page)
  const rawPageSize = Number(query.pageSize)
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const pageSize = Number.isInteger(rawPageSize) && rawPageSize > 0 ? Math.min(rawPageSize, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE
  return { page, pageSize }
}

function parseSort(query: Record<string, unknown>): { field: SortableField; order: 'asc' | 'desc' } {
  const { sort, order } = query
  const field: SortableField = typeof sort === 'string' && (SORTABLE_FIELDS as readonly string[]).includes(sort) ? (sort as SortableField) : 'createdAt'
  return { field, order: order === 'asc' ? 'asc' : 'desc' }
}

// -- create / list / detail -------------------------------------------------

const createTicketSchema = z.object({
  categoryId: z.number().int(),
  relatedSystemId: z.number().int().optional(),
  summary: z.string().min(1).max(200),
  description: z.string().min(1),
  requestedPriority: z.enum(PRIORITIES).optional(),
})

export const createTicket: RequestHandler = async (req, res) => {
  const parsed = createTicketSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'categoryId, summary, and description are required' })
    return
  }

  try {
    const ticket = await prisma.$transaction(async (tx) => {
      const requestedPriority = parsed.data.requestedPriority ?? 'MEDIUM'
      const created = await tx.ticket.create({
        data: {
          ticketNumber: `PENDING-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          requesterId: req.user!.id,
          categoryId: parsed.data.categoryId,
          relatedSystemId: parsed.data.relatedSystemId,
          summary: parsed.data.summary,
          description: parsed.data.description,
          requestedPriority,
          // IT Priority starts as a copy of Requested Priority (handout section 4.5 / FR-14);
          // IT Staff/Administrator may change it independently afterward.
          itPriority: requestedPriority,
        },
      })
      // BR-18: the history starts with the ticket's creation.
      await tx.ticketStatusChange.create({
        data: { ticketId: created.id, fromStatus: null, toStatus: 'NEW', changedById: req.user!.id },
      })
      return tx.ticket.update({
        where: { id: created.id },
        data: { ticketNumber: formatTicketNumber(created.id) },
      })
    })
    res.status(201).json(ticket)
  } catch {
    res.status(400).json({ error: 'Unable to create ticket - check categoryId/relatedSystemId are valid' })
  }
}

export const listMyTickets: RequestHandler = async (req, res) => {
  const { status, search } = req.query
  const where: {
    requesterId: number
    status?: TicketStatus
    OR?: Array<{ summary?: { contains: string; mode: 'insensitive' }; ticketNumber?: { contains: string; mode: 'insensitive' } }>
  } = { requesterId: req.user!.id }

  if (typeof status === 'string' && (STATUSES as readonly string[]).includes(status)) {
    where.status = status as TicketStatus
  }
  if (typeof search === 'string' && search.trim()) {
    where.OR = [
      { summary: { contains: search, mode: 'insensitive' } },
      { ticketNumber: { contains: search, mode: 'insensitive' } },
    ]
  }

  const { field: sortField, order: sortOrder } = parseSort(req.query as Record<string, unknown>)
  const { page, pageSize } = parsePagination(req.query as Record<string, unknown>)

  const [tickets, totalCount] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true } },
      },
    }),
    prisma.ticket.count({ where }),
  ])

  res.status(200).json({
    tickets,
    pagination: { page, pageSize, totalCount, totalPages: Math.max(1, Math.ceil(totalCount / pageSize)) },
  })
}

export const listTickets: RequestHandler = async (req, res) => {
  const { status, ownerId, categoryId, q } = req.query
  const where: {
    status?: TicketStatus
    categoryId?: number
    ownerId?: number | null
    OR?: Array<{ summary?: { contains: string; mode: 'insensitive' }; ticketNumber?: { contains: string; mode: 'insensitive' } }>
  } = {}

  if (typeof status === 'string' && (STATUSES as readonly string[]).includes(status)) {
    where.status = status as TicketStatus
  }
  if (typeof categoryId === 'string' && Number.isInteger(Number(categoryId))) {
    where.categoryId = Number(categoryId)
  }
  if (typeof ownerId === 'string') {
    if (ownerId === 'me') where.ownerId = req.user!.id
    else if (ownerId === 'unassigned') where.ownerId = null
    else if (Number.isInteger(Number(ownerId))) where.ownerId = Number(ownerId)
  }
  if (typeof q === 'string' && q.trim()) {
    where.OR = [
      { summary: { contains: q, mode: 'insensitive' } },
      { ticketNumber: { contains: q, mode: 'insensitive' } },
    ]
  }

  const { field: sortField, order: sortOrder } = parseSort(req.query as Record<string, unknown>)
  const { page, pageSize } = parsePagination(req.query as Record<string, unknown>)

  const [tickets, totalCount] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true } },
        requester: { select: { id: true, fullName: true } },
      },
    }),
    prisma.ticket.count({ where }),
  ])

  res.status(200).json({
    tickets,
    pagination: { page, pageSize, totalCount, totalPages: Math.max(1, Math.ceil(totalCount / pageSize)) },
  })
}

// IT Staff need this to populate the owner-reassignment dropdown (FR-12,
// BR-10: owner must be an active IT_STAFF/ADMINISTRATOR), but GET /api/users
// is Administrator-only (AC-15) - so a plain IT Staff session can never call
// it. This staff-gated endpoint returns just enough to populate that
// dropdown without exposing the full user-management listing.
export const listAssignableOwners: RequestHandler = async (_req, res) => {
  const owners = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['IT_STAFF', 'ADMINISTRATOR'] } },
    select: { id: true, fullName: true },
    orderBy: { fullName: 'asc' },
  })
  res.status(200).json(owners)
}

export const getTicket: RequestHandler = async (req, res) => {
  const id = parseId(req.params.id)
  if (id === null) {
    res.status(400).json({ error: 'Invalid ticket id' })
    return
  }

  const ticket = await loadTicketForUser(id, req.user!)
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' })
    return
  }

  res.status(200).json(serializeTicket(ticket, req.user!.role))
}

// -- requester actions --------------------------------------------------

const priorityBodySchema = z.object({ requestedPriority: z.enum(PRIORITIES) })

export const updateTicketPriority: RequestHandler = async (req, res) => {
  const id = parseId(req.params.id)
  const parsed = priorityBodySchema.safeParse(req.body)
  if (id === null || !parsed.success) {
    res.status(400).json({ error: 'Invalid request' })
    return
  }

  const ticket = await prisma.ticket.findUnique({ where: { id } })
  if (!ticket || ticket.requesterId !== req.user!.id) {
    res.status(404).json({ error: 'Ticket not found' })
    return
  }
  if (ticket.status !== 'NEW' && ticket.status !== 'IN_PROGRESS') {
    res.status(409).json({ error: 'Requested priority can only be changed while the ticket is New or In Progress' })
    return
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: { requestedPriority: parsed.data.requestedPriority },
  })
  res.status(200).json(updated)
}

// BR-05 / FR-20: an informal signal from the Requester that the problem
// appears resolved. Distinct from confirmResolution/rejectResolution below,
// which only apply once IT Staff has already formally moved the ticket to
// RESOLVED -- this endpoint is usable any time before that, and never
// changes `status` itself.
const appearsResolvedBodySchema = z.object({ appearsResolved: z.boolean() })

export const updateRequesterAppearsResolved: RequestHandler = async (req, res) => {
  const id = parseId(req.params.id)
  const parsed = appearsResolvedBodySchema.safeParse(req.body)
  if (id === null || !parsed.success) {
    res.status(400).json({ error: 'appearsResolved (boolean) is required' })
    return
  }

  const ticket = await prisma.ticket.findUnique({ where: { id } })
  if (!ticket || ticket.requesterId !== req.user!.id) {
    res.status(404).json({ error: 'Ticket not found' })
    return
  }
  if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
    res.status(409).json({ error: 'A Resolved or Closed ticket already has a formal resolution' })
    return
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: { requesterAppearsResolvedAt: parsed.data.appearsResolved ? new Date() : null },
  })
  res.status(200).json(updated)
}

// -- workflow helpers (docs/lab-04 BR-18, BR-19) ---------------------------

// Every workflow endpoint accepts the client's last-seen Ticket version.
const versionOnlySchema = z.object({ version: z.number().int().optional() })

function sendWorkflowError(res: Response, error: unknown) {
  if (!(error instanceof WorkflowError)) throw error
  const body: Record<string, unknown> = { error: error.message, ...error.details }
  if (error.code !== 'NOT_FOUND') body.code = error.code
  res.status(workflowErrorStatus(error.code)).json(body)
}

async function respondWithTransition(res: Response, run: () => Promise<unknown>) {
  try {
    res.status(200).json(await run())
  } catch (error) {
    sendWorkflowError(res, error)
  }
}

// Requester post-resolution actions: own tickets only (anyone else's -> 404).
function requesterTransition(
  from: TicketStatus,
  to: TicketStatus,
  invalidMessage: string,
  data: () => Record<string, unknown> = () => ({}),
): RequestHandler {
  return async (req, res) => {
    const id = parseId(req.params.id)
    const parsed = versionOnlySchema.safeParse(req.body ?? {})
    if (id === null || !parsed.success) {
      res.status(400).json({ error: 'Invalid ticket id' })
      return
    }
    await respondWithTransition(res, () =>
      applyTransition({
        ticketId: id,
        from: [from],
        to,
        actorId: req.user!.id,
        version: parsed.data.version,
        where: { requesterId: req.user!.id },
        data: data(),
        invalidMessage,
      }),
    )
  }
}

export const confirmResolution = requesterTransition('RESOLVED', 'CLOSED', 'Only a Resolved ticket can be confirmed', () => ({
  closedAt: new Date(),
}))
export const rejectResolution = requesterTransition('RESOLVED', 'REOPENED', 'Only a Resolved ticket can be rejected', () => ({
  resolvedAt: null,
}))
export const requestReopen = requesterTransition('CLOSED', 'REOPENED', 'Only a Closed ticket can be reopened')

// -- IT staff / administrator actions ------------------------------------

const ownerBodySchema = z.object({ ownerId: z.number().int().nullable(), version: z.number().int().optional() })

export const updateTicketOwner: RequestHandler = async (req, res) => {
  const id = parseId(req.params.id)
  const parsed = ownerBodySchema.safeParse(req.body)
  if (id === null || !parsed.success) {
    res.status(400).json({ error: 'Invalid request' })
    return
  }

  if (parsed.data.ownerId !== null) {
    const owner = await prisma.user.findUnique({ where: { id: parsed.data.ownerId } })
    if (!owner || (owner.role !== 'IT_STAFF' && owner.role !== 'ADMINISTRATOR') || !owner.isActive) {
      res.status(400).json({ error: 'ownerId must be an active IT Staff or Administrator user' })
      return
    }
  }

  await respondWithTransition(res, () => applyGuardedUpdate(id, parsed.data.version, { ownerId: parsed.data.ownerId }))
}

const itPriorityBodySchema = z.object({ itPriority: z.enum(PRIORITIES), version: z.number().int().optional() })

export const updateTicketItPriority: RequestHandler = async (req, res) => {
  const id = parseId(req.params.id)
  const parsed = itPriorityBodySchema.safeParse(req.body)
  if (id === null || !parsed.success) {
    res.status(400).json({ error: 'Invalid request' })
    return
  }
  await respondWithTransition(res, () => applyGuardedUpdate(id, parsed.data.version, { itPriority: parsed.data.itPriority }))
}

const statusBodySchema = z.object({ status: z.enum(STATUSES), version: z.number().int().optional() })

// Transition matrix per docs/lab-04/specification.md section 7 (unchanged from
// Lab 3). Resolve/Close/Cancel/Confirm/Reject/Request-Reopen have their own
// endpoints with their own preconditions (e.g. the resolution gate) and are
// intentionally not reachable through this generic status endpoint.
const ALLOWED_DIRECT_TRANSITIONS: Partial<Record<TicketStatus, TicketStatus[]>> = {
  NEW: ['OPEN', 'IN_PROGRESS'],
  OPEN: ['IN_PROGRESS'],
  IN_PROGRESS: ['WAITING_FOR_REQUESTER'],
  WAITING_FOR_REQUESTER: ['IN_PROGRESS'],
  REOPENED: ['OPEN', 'IN_PROGRESS'],
}

export const updateTicketStatus: RequestHandler = async (req, res) => {
  const id = parseId(req.params.id)
  const parsed = statusBodySchema.safeParse(req.body)
  if (id === null || !parsed.success) {
    res.status(400).json({ error: 'Invalid request' })
    return
  }
  const to = parsed.data.status
  const from = (Object.keys(ALLOWED_DIRECT_TRANSITIONS) as TicketStatus[]).filter((status) =>
    ALLOWED_DIRECT_TRANSITIONS[status]!.includes(to),
  )

  try {
    res.status(200).json(await applyTransition({ ticketId: id, from, to, actorId: req.user!.id, version: parsed.data.version }))
  } catch (error) {
    if (error instanceof WorkflowError && error.code === 'INVALID_TRANSITION') {
      const current = await prisma.ticket.findUnique({ where: { id }, select: { status: true } })
      res.status(409).json({ error: `Cannot transition from ${current?.status} to ${to} via this endpoint`, code: 'INVALID_TRANSITION' })
      return
    }
    sendWorkflowError(res, error)
  }
}

const resolveSchema = z.object({ resolutionSummary: z.string().trim().min(1), version: z.number().int().optional() })

export const resolveTicket: RequestHandler = async (req, res) => {
  const id = parseId(req.params.id)
  const parsed = resolveSchema.safeParse(req.body)
  if (id === null || !parsed.success) {
    res.status(400).json({ error: 'resolutionSummary is required' })
    return
  }

  await respondWithTransition(res, () =>
    applyTransition({
      ticketId: id,
      from: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER'],
      to: 'RESOLVED',
      actorId: req.user!.id,
      version: parsed.data.version,
      data: { resolutionSummary: parsed.data.resolutionSummary, resolvedAt: new Date() },
      invalidMessage: 'Only an In Progress or Waiting for Requester ticket can be resolved',
      // BR-15 resolution gate, inside the transaction so it holds even when a
      // client calls this endpoint directly.
      before: async (tx) => {
        const [open, completed] = await Promise.all([
          tx.actionTaken.count({ where: { ticketId: id, status: { in: ['PLANNED', 'IN_PROGRESS'] } } }),
          tx.actionTaken.count({ where: { ticketId: id, status: 'COMPLETED' } }),
        ])
        if (!evaluateResolutionGate({ open, completed }).allowed) {
          throw new WorkflowError('RESOLUTION_GATE', RESOLUTION_GATE_MESSAGE, { openActions: open, completedActions: completed })
        }
      },
    }),
  )
}

export const cancelTicket: RequestHandler = async (req, res) => {
  const id = parseId(req.params.id)
  const parsed = versionOnlySchema.safeParse(req.body ?? {})
  if (id === null || !parsed.success) {
    res.status(400).json({ error: 'Invalid ticket id' })
    return
  }

  await respondWithTransition(res, () =>
    applyTransition({
      ticketId: id,
      from: ['NEW', 'OPEN'],
      to: 'CANCELLED',
      actorId: req.user!.id,
      version: parsed.data.version,
      invalidMessage: 'Only a New or Open ticket can be cancelled',
      // BR-17: a cancelled ticket leaves no open work behind.
      before: async (tx) => {
        await tx.actionTaken.updateMany({
          where: { ticketId: id, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
          data: { status: 'CANCELLED', cancelledAt: new Date(), version: { increment: 1 } },
        })
      },
    }),
  )
}

export const closeTicket: RequestHandler = async (req, res) => {
  const id = parseId(req.params.id)
  const parsed = versionOnlySchema.safeParse(req.body ?? {})
  if (id === null || !parsed.success) {
    res.status(400).json({ error: 'Invalid ticket id' })
    return
  }

  await respondWithTransition(res, () =>
    applyTransition({
      ticketId: id,
      from: ['RESOLVED'],
      to: 'CLOSED',
      actorId: req.user!.id,
      version: parsed.data.version,
      data: { closedAt: new Date() },
      invalidMessage: 'Only a Resolved ticket can be closed',
    }),
  )
}

// -- child entities -------------------------------------------------------

const bodyTextSchema = z.object({ body: z.string().min(1) })

export const addComment: RequestHandler = async (req, res) => {
  const ticketId = parseId(req.params.id)
  const parsed = bodyTextSchema.safeParse(req.body)
  if (ticketId === null || !parsed.success) {
    res.status(400).json({ error: 'body is required' })
    return
  }

  const hasAccess = await userCanAccessTicket(ticketId, req.user!)
  if (!hasAccess) {
    res.status(404).json({ error: 'Ticket not found' })
    return
  }

  const comment = await prisma.publicComment.create({
    data: { ticketId, authorId: req.user!.id, body: parsed.data.body },
    include: { author: { select: { id: true, fullName: true, role: true } } },
  })
  res.status(201).json(comment)
}

export const addNote: RequestHandler = async (req, res) => {
  const ticketId = parseId(req.params.id)
  const parsed = bodyTextSchema.safeParse(req.body)
  if (ticketId === null || !parsed.success) {
    res.status(400).json({ error: 'body is required' })
    return
  }

  try {
    const note = await prisma.internalNote.create({
      data: { ticketId, authorId: req.user!.id, body: parsed.data.body },
      include: { author: { select: { id: true, fullName: true, role: true } } },
    })
    res.status(201).json(note)
  } catch {
    res.status(404).json({ error: 'Ticket not found' })
  }
}

export const addAttachment: RequestHandler = async (req, res) => {
  const ticketId = parseId(req.params.id)
  if (ticketId === null) {
    res.status(400).json({ error: 'Invalid ticket id' })
    return
  }
  if (!req.file) {
    res.status(400).json({ error: 'A file is required (field name "file")' })
    return
  }

  const hasAccess = await userCanAccessTicket(ticketId, req.user!)
  if (!hasAccess) {
    await fs.promises.unlink(req.file.path).catch(() => {})
    res.status(404).json({ error: 'Ticket not found' })
    return
  }

  const activeCount = await prisma.attachment.count({ where: { ticketId, isActive: true } })
  if (activeCount >= MAX_ACTIVE_ATTACHMENTS_PER_TICKET) {
    await fs.promises.unlink(req.file.path).catch(() => {})
    res.status(409).json({ error: `A ticket may have at most ${MAX_ACTIVE_ATTACHMENTS_PER_TICKET} active attachments` })
    return
  }

  const attachment = await prisma.attachment.create({
    data: {
      ticketId,
      uploaderId: req.user!.id,
      filename: sanitizeOriginalFilename(req.file.originalname),
      storedFilename: req.file.filename,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
    },
    include: { uploader: { select: { id: true, fullName: true, role: true } } },
  })
  res.status(201).json(attachment)
}
