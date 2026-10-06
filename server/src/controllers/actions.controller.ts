import type { RequestHandler } from 'express'
import { z } from 'zod'
import { Prisma, type ActionStatus } from '@prisma/client'
import prisma from '../db'
import { userCanAccessTicket } from '../lib/ticketAccess'
import {
  CREATABLE_ACTION_STATUSES,
  canMoveAction,
  isTerminalActionStatus,
  normalizeActionFields,
  ticketAcceptsActions,
  validateActionFields,
  type ActionFields,
} from '../lib/actionRules'
import { ACTION_INCLUDE, serializeAction } from '../lib/actionSerializer'

// Actions Taken (docs/lab-04/api-spec.md "Actions Taken"; BR-01..BR-13).

const ACTION_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const

function parseId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== 'string') return null
  const id = Number(raw)
  return Number.isInteger(id) ? id : null
}

// Shape-only checks; business rules (required-when, date window, lengths)
// live in validateActionFields so they apply to the merged result on edit.
const editableFieldsSchema = z.object({
  actionAt: z.string().optional(),
  description: z.string().optional(),
  result: z.string().nullable().optional(),
  status: z.enum(ACTION_STATUSES).optional(),
  assigneeId: z.number().int().optional(),
  followUpRequired: z.boolean().optional(),
  followUpNote: z.string().nullable().optional(),
  attachmentNotes: z.string().nullable().optional(),
})

const createSchema = editableFieldsSchema.extend({
  description: z.string(),
  clientRequestId: z.string().min(8).max(100).optional(),
})

const updateSchema = editableFieldsSchema.extend({ version: z.number().int() })

function validationError(res: Parameters<RequestHandler>[1], fields: Record<string, string>) {
  res.status(400).json({ error: 'Please correct the highlighted fields', code: 'VALIDATION_ERROR', fields })
}

// BR-05: the assignee must be an active IT Staff or Administrator.
async function assigneeIsValid(assigneeId: number) {
  const user = await prisma.user.findUnique({ where: { id: assigneeId }, select: { role: true, isActive: true } })
  return !!user && user.isActive && (user.role === 'IT_STAFF' || user.role === 'ADMINISTRATOR')
}

const INVALID_ASSIGNEE = { assigneeId: 'Assigned To must be an active IT Staff or Administrator user' }

export const listActions: RequestHandler = async (req, res) => {
  const ticketId = parseId(req.params.id)
  if (ticketId === null) {
    res.status(400).json({ error: 'Invalid ticket id' })
    return
  }
  if (!(await userCanAccessTicket(ticketId, req.user!))) {
    res.status(404).json({ error: 'Ticket not found' })
    return
  }

  const actions = await prisma.actionTaken.findMany({
    where: { ticketId },
    include: ACTION_INCLUDE,
    orderBy: [{ actionAt: 'asc' }, { id: 'asc' }],
  })
  res.status(200).json(actions.map(serializeAction))
}

export const createAction: RequestHandler = async (req, res) => {
  const ticketId = parseId(req.params.id)
  if (ticketId === null) {
    res.status(400).json({ error: 'Invalid ticket id' })
    return
  }
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    validationError(res, Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0] ?? 'body'), 'Invalid value'])))
    return
  }
  const body = parsed.data

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { status: true, createdAt: true } })
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' })
    return
  }

  // BR-13: a retried request returns what the first attempt created.
  if (body.clientRequestId) {
    const existing = await prisma.actionTaken.findUnique({
      where: { ticketId_clientRequestId: { ticketId, clientRequestId: body.clientRequestId } },
      include: ACTION_INCLUDE,
    })
    if (existing) {
      res.status(200).json(serializeAction(existing))
      return
    }
  }

  if (!ticketAcceptsActions(ticket.status)) {
    res.status(409).json({ error: 'Actions Taken are read-only once a ticket is Resolved, Closed or Cancelled', code: 'TICKET_LOCKED' })
    return
  }

  const status: ActionStatus = body.status ?? 'PLANNED'
  if (!CREATABLE_ACTION_STATUSES.includes(status)) {
    validationError(res, { status: 'A new action can only be Planned, In Progress or Completed' })
    return
  }

  const fields = normalizeActionFields({
    actionAt: body.actionAt ? new Date(body.actionAt) : new Date(),
    description: body.description,
    result: body.result ?? null,
    status,
    followUpRequired: body.followUpRequired ?? false,
    followUpNote: body.followUpNote ?? null,
    attachmentNotes: body.attachmentNotes ?? null,
  })
  const errors = validateActionFields(fields, ticket.createdAt)
  if (Object.keys(errors).length > 0) {
    validationError(res, errors)
    return
  }

  // BR-03 / BR-05: Performed By is always the caller; Assigned To defaults to them.
  const assigneeId = body.assigneeId ?? req.user!.id
  if (!(await assigneeIsValid(assigneeId))) {
    validationError(res, INVALID_ASSIGNEE)
    return
  }

  try {
    const action = await prisma.actionTaken.create({
      data: {
        ...fields,
        ticketId,
        authorId: req.user!.id,
        assigneeId,
        clientRequestId: body.clientRequestId,
        completedAt: status === 'COMPLETED' ? new Date() : null,
      },
      include: ACTION_INCLUDE,
    })
    res.status(201).json(serializeAction(action))
  } catch (error) {
    // Two copies of the same retried request raced past the lookup above;
    // the unique index let exactly one through, so return that one.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && body.clientRequestId) {
      const existing = await prisma.actionTaken.findUnique({
        where: { ticketId_clientRequestId: { ticketId, clientRequestId: body.clientRequestId } },
        include: ACTION_INCLUDE,
      })
      if (existing) {
        res.status(200).json(serializeAction(existing))
        return
      }
    }
    throw error
  }
}

export const updateAction: RequestHandler = async (req, res) => {
  const ticketId = parseId(req.params.id)
  const actionId = parseId(req.params.actionId)
  if (ticketId === null || actionId === null) {
    res.status(400).json({ error: 'Invalid id' })
    return
  }
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    validationError(res, Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0] ?? 'body'), 'Invalid value'])))
    return
  }
  const body = parsed.data

  const current = await prisma.actionTaken.findUnique({
    where: { id: actionId },
    include: { ...ACTION_INCLUDE, ticket: { select: { status: true, createdAt: true } } },
  })
  if (!current || current.ticketId !== ticketId) {
    res.status(404).json({ error: 'Action not found' })
    return
  }

  if (current.version !== body.version) {
    res.status(409).json({
      error: 'This action was changed by someone else. Reload to see the latest version.',
      code: 'STALE_UPDATE',
      current: serializeAction(current),
    })
    return
  }
  if (!ticketAcceptsActions(current.ticket.status)) {
    res.status(409).json({ error: 'Actions Taken are read-only once a ticket is Resolved, Closed or Cancelled', code: 'TICKET_LOCKED' })
    return
  }
  if (isTerminalActionStatus(current.status)) {
    res.status(409).json({ error: `A ${current.status === 'COMPLETED' ? 'Completed' : 'Cancelled'} action can no longer be edited`, code: 'INVALID_TRANSITION' })
    return
  }

  const nextStatus = body.status ?? current.status
  if (!canMoveAction(current.status, nextStatus)) {
    res.status(409).json({ error: `Cannot move an action from ${current.status} to ${nextStatus}`, code: 'INVALID_TRANSITION' })
    return
  }

  const merged: ActionFields = normalizeActionFields({
    actionAt: body.actionAt !== undefined ? new Date(body.actionAt) : current.actionAt,
    description: body.description ?? current.description,
    result: body.result !== undefined ? body.result : current.result,
    status: nextStatus,
    followUpRequired: body.followUpRequired ?? current.followUpRequired,
    followUpNote: body.followUpNote !== undefined ? body.followUpNote : current.followUpNote,
    attachmentNotes: body.attachmentNotes !== undefined ? body.attachmentNotes : current.attachmentNotes,
  })
  const errors = validateActionFields(merged, current.ticket.createdAt)
  if (Object.keys(errors).length > 0) {
    validationError(res, errors)
    return
  }

  if (body.assigneeId !== undefined && body.assigneeId !== current.assigneeId && !(await assigneeIsValid(body.assigneeId))) {
    validationError(res, INVALID_ASSIGNEE)
    return
  }

  // Conditional on the version we validated against: if another edit landed
  // in between, count is 0 and nothing is overwritten (BR-12).
  const { count } = await prisma.actionTaken.updateMany({
    where: { id: actionId, version: body.version },
    data: {
      ...merged,
      ...(body.assigneeId !== undefined ? { assigneeId: body.assigneeId } : {}),
      completedAt: nextStatus === 'COMPLETED' ? new Date() : null,
      cancelledAt: nextStatus === 'CANCELLED' ? new Date() : null,
      version: { increment: 1 },
    },
  })

  const latest = await prisma.actionTaken.findUniqueOrThrow({ where: { id: actionId }, include: ACTION_INCLUDE })
  if (count === 0) {
    res.status(409).json({
      error: 'This action was changed by someone else. Reload to see the latest version.',
      code: 'STALE_UPDATE',
      current: serializeAction(latest),
    })
    return
  }
  res.status(200).json(serializeAction(latest))
}
