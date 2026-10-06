import type { Prisma } from '@prisma/client'

const PARTICIPANT_SELECT = { id: true, fullName: true, role: true } as const

export const ACTION_INCLUDE = {
  author: { select: PARTICIPANT_SELECT },
  assignee: { select: PARTICIPANT_SELECT },
} satisfies Prisma.ActionTakenInclude

type ActionWithPeople = Prisma.ActionTakenGetPayload<{ include: typeof ACTION_INCLUDE }>

// The API calls the stored author "performedBy" (handout 4.1 "Performed by
// (auto)"), and never exposes the idempotency key.
export function serializeAction(action: ActionWithPeople) {
  const { author, authorId: _authorId, clientRequestId: _clientRequestId, ...rest } = action
  return { ...rest, performedBy: author }
}
