import prisma from '../db'
import type { AuthenticatedUser } from '../middleware/requireAuth'

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
      actionsTaken: { include: { author: { select: PARTICIPANT_SELECT } }, orderBy: { createdAt: 'asc' } },
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
  if (viewerRole === 'REQUESTER') {
    const { internalNotes: _internalNotes, ...rest } = ticket
    return rest
  }
  return ticket
}

export async function userCanAccessTicket(ticketId: number, user: AuthenticatedUser): Promise<boolean> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { requesterId: true } })
  if (!ticket) return false
  if (user.role === 'REQUESTER' && ticket.requesterId !== user.id) return false
  return true
}
