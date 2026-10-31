import prisma from '../db'
import type { AuthenticatedUser } from '../middleware/requireAuth'
import { ACTION_INCLUDE, serializeAction } from './actionSerializer'

const PARTICIPANT_SELECT = { id: true, fullName: true, role: true } as const

export async function loadTicketForUser(ticketId: number, user: AuthenticatedUser) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      requester: { select: { id: true, fullName: true, email: true } },
      owner: { select: { id: true, fullName: true, email: true } },
      category: { select: { id: true, name: true } },
      relatedSystem: { select: { id: true, name: true } },
      publicComments: { include: { author: { select: PARTICIPANT_SELECT } }, orderBy: { createdAt: 'asc' } },
      internalNotes: { include: { author: { select: PARTICIPANT_SELECT } }, orderBy: { createdAt: 'asc' } },
      actionsTaken: { include: ACTION_INCLUDE, orderBy: [{ actionAt: 'asc' }, { id: 'asc' }] },
      statusChanges: { include: { changedBy: { select: PARTICIPANT_SELECT } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      attachments: {
        include: { uploader: { select: PARTICIPANT_SELECT }, removedBy: { select: PARTICIPANT_SELECT } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!ticket) return null
  if (user.role === 'REQUESTER' && ticket.requesterId !== user.id) return null

  return ticket
}

export function serializeTicket(
  ticket: NonNullable<Awaited<ReturnType<typeof loadTicketForUser>>>,
  viewerRole: AuthenticatedUser['role'],
) {
  // Requesters see every Action Taken (handout 8.3) but never Internal Notes.
  const { statusChanges, ...base } = ticket
  const withActions = { ...base, actionsTaken: ticket.actionsTaken.map(serializeAction), statusHistory: statusChanges }
  if (viewerRole === 'REQUESTER') {
    const { internalNotes: _internalNotes, ...rest } = withActions
    return rest
  }
  return withActions
}

export async function userCanAccessTicket(ticketId: number, user: AuthenticatedUser): Promise<boolean> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { requesterId: true } })
  if (!ticket) return false
  if (user.role === 'REQUESTER' && ticket.requesterId !== user.id) return false
  return true
}
