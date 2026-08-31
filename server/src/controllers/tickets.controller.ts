import type { RequestHandler } from 'express'
import fs from 'node:fs'
import { z } from 'zod'
import type { TicketStatus } from '@prisma/client'
import prisma from '../db'
import { formatTicketNumber } from '../lib/ticketNumber'
import { loadTicketForUser, serializeTicket, userCanAccessTicket } from '../lib/ticketAccess'
import { MAX_ACTIVE_ATTACHMENTS_PER_TICKET, sanitizeOriginalFilename } from '../lib/attachmentStorage'

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
const STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED'] as const

function parseId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== 'string') return null
  const id = Number(raw)
  return Number.isInteger(id) ? id : null
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
      const created = await tx.ticket.create({
        data: {
          ticketNumber: `PENDING-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          requesterId: req.user!.id,
          categoryId: parsed.data.categoryId,
          relatedSystemId: parsed.data.relatedSystemId,
          summary: parsed.data.summary,
          description: parsed.data.description,
          requestedPriority: parsed.data.requestedPriority ?? 'MEDIUM',
        },
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
  const { status } = req.query
  const where: { requesterId: number; status?: TicketStatus } = { requesterId: req.user!.id }
  if (typeof status === 'string' && (STATUSES as readonly string[]).includes(status)) {
    where.status = status as TicketStatus
  }

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      category: { select: { id: true, name: true } },
      owner: { select: { id: true, fullName: true } },
    },
  })
  res.status(200).json(tickets)
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

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      category: { select: { id: true, name: true } },
      owner: { select: { id: true, fullName: true } },
      requester: { select: { id: true, fullName: true } },
    },
  })
  res.status(200).json(tickets)
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

export const confirmResolution: RequestHandler = async (req, res) => {
  const id = parseId(req.params.id)
  if (id === null) {
    res.status(400).json({ error: 'Invalid ticket id' })
    return
  }

  const ticket = await prisma.ticket.findUnique({ where: { id } })
  if (!ticket || ticket.requesterId !== req.user!.id) {
    res.status(404).json({ error: 'Ticket not found' })
    return
  }
  if (ticket.status !== 'RESOLVED') {
    res.status(409).json({ error: 'Only a Resolved ticket can be confirmed' })
    return
  }

  const updated = await prisma.ticket.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date() } })
  res.status(200).json(updated)
}

export const rejectResolution: RequestHandler = async (req, res) => {
  const id = parseId(req.params.id)
  if (id === null) {
    res.status(400).json({ error: 'Invalid ticket id' })
    return
  }

  const ticket = await prisma.ticket.findUnique({ where: { id } })
  if (!ticket || ticket.requesterId !== req.user!.id) {
    res.status(404).json({ error: 'Ticket not found' })
    return
  }
  if (ticket.status !== 'RESOLVED') {
    res.status(409).json({ error: 'Only a Resolved ticket can be rejected' })
    return
  }

  const updated = await prisma.ticket.update({ where: { id }, data: { status: 'REOPENED', resolvedAt: null } })
  res.status(200).json(updated)
}

export const requestReopen: RequestHandler = async (req, res) => {
  const id = parseId(req.params.id)
  if (id === null) {
    res.status(400).json({ error: 'Invalid ticket id' })
    return
  }

  const ticket = await prisma.ticket.findUnique({ where: { id } })
  if (!ticket || ticket.requesterId !== req.user!.id) {
    res.status(404).json({ error: 'Ticket not found' })
    return
  }
  if (ticket.status !== 'CLOSED') {
    res.status(409).json({ error: 'Only a Closed ticket can be reopened' })
    return
  }

  const updated = await prisma.ticket.update({ where: { id }, data: { status: 'REOPENED' } })
  res.status(200).json(updated)
}

// -- IT staff / administrator actions ------------------------------------

const ownerBodySchema = z.object({ ownerId: z.number().int().nullable() })

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

  try {
    const updated = await prisma.ticket.update({ where: { id }, data: { ownerId: parsed.data.ownerId } })
    res.status(200).json(updated)
  } catch {
    res.status(404).json({ error: 'Ticket not found' })
  }
}

const itPriorityBodySchema = z.object({ itPriority: z.enum(PRIORITIES) })

export const updateTicketItPriority: RequestHandler = async (req, res) => {
  const id = parseId(req.params.id)
  const parsed = itPriorityBodySchema.safeParse(req.body)
  if (id === null || !parsed.success) {
    res.status(400).json({ error: 'Invalid request' })
    return
  }

  try {
    const updated = await prisma.ticket.update({ where: { id }, data: { itPriority: parsed.data.itPriority } })
    res.status(200).json(updated)
  } catch {
    res.status(404).json({ error: 'Ticket not found' })
  }
}

const statusBodySchema = z.object({ status: z.enum(STATUSES) })
const ALLOWED_DIRECT_TRANSITIONS: Partial<Record<TicketStatus, TicketStatus[]>> = {
  NEW: ['IN_PROGRESS'],
  REOPENED: ['IN_PROGRESS'],
}

export const updateTicketStatus: RequestHandler = async (req, res) => {
  const id = parseId(req.params.id)
  const parsed = statusBodySchema.safeParse(req.body)
  if (id === null || !parsed.success) {
    res.status(400).json({ error: 'Invalid request' })
    return
  }

  const ticket = await prisma.ticket.findUnique({ where: { id } })
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' })
    return
  }

  const allowed = ALLOWED_DIRECT_TRANSITIONS[ticket.status] ?? []
  if (!allowed.includes(parsed.data.status)) {
    res.status(409).json({ error: `Cannot transition from ${ticket.status} to ${parsed.data.status} via this endpoint` })
    return
  }

  const updated = await prisma.ticket.update({ where: { id }, data: { status: parsed.data.status } })
  res.status(200).json(updated)
}

const resolveSchema = z.object({ resolutionSummary: z.string().min(1) })

export const resolveTicket: RequestHandler = async (req, res) => {
  const id = parseId(req.params.id)
  const parsed = resolveSchema.safeParse(req.body)
  if (id === null || !parsed.success) {
    res.status(400).json({ error: 'resolutionSummary is required' })
    return
  }

  const ticket = await prisma.ticket.findUnique({ where: { id } })
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' })
    return
  }
  if (ticket.status !== 'IN_PROGRESS') {
    res.status(409).json({ error: 'Only an In Progress ticket can be resolved' })
    return
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: { status: 'RESOLVED', resolutionSummary: parsed.data.resolutionSummary, resolvedAt: new Date() },
  })
  res.status(200).json(updated)
}

export const closeTicket: RequestHandler = async (req, res) => {
  const id = parseId(req.params.id)
  if (id === null) {
    res.status(400).json({ error: 'Invalid ticket id' })
    return
  }

  const ticket = await prisma.ticket.findUnique({ where: { id } })
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' })
    return
  }
  if (ticket.status !== 'RESOLVED') {
    res.status(409).json({ error: 'Only a Resolved ticket can be closed' })
    return
  }

  const updated = await prisma.ticket.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date() } })
  res.status(200).json(updated)
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

const descriptionSchema = z.object({ description: z.string().min(1) })

export const addAction: RequestHandler = async (req, res) => {
  const ticketId = parseId(req.params.id)
  const parsed = descriptionSchema.safeParse(req.body)
  if (ticketId === null || !parsed.success) {
    res.status(400).json({ error: 'description is required' })
    return
  }

  try {
    const action = await prisma.actionTaken.create({
      data: { ticketId, authorId: req.user!.id, description: parsed.data.description },
      include: { author: { select: { id: true, fullName: true, role: true } } },
    })
    res.status(201).json(action)
  } catch {
    res.status(404).json({ error: 'Ticket not found' })
  }
}

export const updateAction: RequestHandler = async (req, res) => {
  const actionId = parseId(req.params.actionId)
  const parsed = descriptionSchema.safeParse(req.body)
  if (actionId === null || !parsed.success) {
    res.status(400).json({ error: 'description is required' })
    return
  }

  try {
    const action = await prisma.actionTaken.update({
      where: { id: actionId },
      data: { description: parsed.data.description },
      include: { author: { select: { id: true, fullName: true, role: true } } },
    })
    res.status(200).json(action)
  } catch {
    res.status(404).json({ error: 'Action not found' })
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
