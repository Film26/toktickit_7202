import type { Prisma, Ticket, TicketStatus } from '@prisma/client'
import prisma from '../db'

// Ticket workflow core (docs/lab-04/specification.md section 7, BR-15,
// BR-17..BR-19). Every status change goes through applyTransition so that
// (1) the move is conditional on the expected current status (and version,
// when the client sent one), so two simultaneous changes can't both win, and
// (2) exactly one append-only history row is written in the same transaction.

export type WorkflowErrorCode = 'NOT_FOUND' | 'STALE_UPDATE' | 'INVALID_TRANSITION' | 'RESOLUTION_GATE'

export class WorkflowError extends Error {
  code: WorkflowErrorCode
  details: Record<string, unknown>

  constructor(code: WorkflowErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.code = code
    this.details = details
  }
}

export function workflowErrorStatus(code: WorkflowErrorCode) {
  return code === 'NOT_FOUND' ? 404 : 409
}

// BR-15, as a pure function so it can be unit-tested and shown in the UI.
export function evaluateResolutionGate(counts: { open: number; completed: number }) {
  return { allowed: counts.open === 0 && counts.completed > 0, ...counts }
}

export const RESOLUTION_GATE_MESSAGE =
  'Complete or cancel all open Actions Taken and record at least one Completed action before resolving'

type TransitionInput = {
  ticketId: number
  from: TicketStatus[]
  to: TicketStatus
  actorId: number
  version?: number
  data?: Prisma.TicketUncheckedUpdateManyInput
  // Optional extra precondition, e.g. ownership for Requester actions.
  where?: Prisma.TicketWhereInput
  // Runs inside the transaction after the guarded update, before history.
  before?: (tx: Prisma.TransactionClient) => Promise<void>
  invalidMessage?: string
}

export async function applyTransition(input: TransitionInput): Promise<Ticket> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.ticket.findFirst({ where: { id: input.ticketId, ...input.where } })
    if (!current) throw new WorkflowError('NOT_FOUND', 'Ticket not found')
    if (input.version !== undefined && current.version !== input.version) {
      throw new WorkflowError('STALE_UPDATE', 'This ticket was changed by someone else. Reload to see the latest version.', {
        currentVersion: current.version,
        currentStatus: current.status,
      })
    }
    if (!input.from.includes(current.status)) {
      throw new WorkflowError(
        'INVALID_TRANSITION',
        input.invalidMessage ?? `Cannot transition from ${current.status} to ${input.to}`,
      )
    }

    if (input.before) await input.before(tx)

    // The WHERE re-checks status + version at write time. If another request
    // committed first, count is 0 and this one fails instead of overwriting.
    const { count } = await tx.ticket.updateMany({
      where: { id: input.ticketId, status: current.status, version: current.version },
      data: { ...input.data, status: input.to, version: { increment: 1 } },
    })
    if (count === 0) {
      throw new WorkflowError('STALE_UPDATE', 'This ticket was changed by someone else. Reload to see the latest version.')
    }

    await tx.ticketStatusChange.create({
      data: { ticketId: input.ticketId, fromStatus: current.status, toStatus: input.to, changedById: input.actorId },
    })
    return tx.ticket.findUniqueOrThrow({ where: { id: input.ticketId } })
  })
}

// Non-status workflow writes (owner, IT Priority): same version guard, no history row.
export async function applyGuardedUpdate(ticketId: number, version: number | undefined, data: Prisma.TicketUncheckedUpdateManyInput) {
  const where: Prisma.TicketWhereInput = { id: ticketId, ...(version !== undefined ? { version } : {}) }
  const { count } = await prisma.ticket.updateMany({ where, data: { ...data, version: { increment: 1 } } })
  if (count === 0) {
    const exists = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { version: true } })
    if (!exists) throw new WorkflowError('NOT_FOUND', 'Ticket not found')
    throw new WorkflowError('STALE_UPDATE', 'This ticket was changed by someone else. Reload to see the latest version.', {
      currentVersion: exists.version,
    })
  }
  return prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
}
