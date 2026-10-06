import type { ActionStatus, TicketStatus } from '@prisma/client'

// Pure Action Taken business rules (docs/lab-04/specification.md BR-06..BR-11),
// kept free of Prisma/Express so they can be unit-tested directly and shared
// by the create and edit handlers.

export const DESCRIPTION_MAX = 2000
export const RESULT_MAX = 2000
export const FOLLOW_UP_NOTE_MAX = 2000
export const ATTACHMENT_NOTES_MAX = 500
export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000

// BR-08: Completed and Cancelled are terminal. Staying in the same status is
// allowed so a field-only edit can resend the current status.
const ALLOWED_ACTION_MOVES: Record<ActionStatus, ActionStatus[]> = {
  PLANNED: ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}

export const CREATABLE_ACTION_STATUSES: ActionStatus[] = ['PLANNED', 'IN_PROGRESS', 'COMPLETED']

export function isTerminalActionStatus(status: ActionStatus) {
  return status === 'COMPLETED' || status === 'CANCELLED'
}

export function canMoveAction(from: ActionStatus, to: ActionStatus) {
  return ALLOWED_ACTION_MOVES[from].includes(to)
}

// BR-11: actions are read-only once the Ticket has a formal outcome.
const ACTION_EDITABLE_TICKET_STATUSES: TicketStatus[] = ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED']

export function ticketAcceptsActions(status: TicketStatus) {
  return ACTION_EDITABLE_TICKET_STATUSES.includes(status)
}

export type ActionFields = {
  actionAt: Date
  description: string
  result: string | null
  status: ActionStatus
  followUpRequired: boolean
  followUpNote: string | null
  attachmentNotes: string | null
}

export type FieldErrors = Partial<Record<keyof ActionFields, string>>

function isBlank(value: string | null) {
  return value === null || value.trim() === ''
}

// Validates the final state an action would have after a create or edit
// (stored values merged with the request), so a partial PATCH can't sneak an
// action into an invalid combination, e.g. followUpRequired without a note.
export function validateActionFields(fields: ActionFields, ticketCreatedAt: Date, now = new Date()): FieldErrors {
  const errors: FieldErrors = {}

  if (isBlank(fields.description)) errors.description = 'Action Description is required'
  else if (fields.description.trim().length > DESCRIPTION_MAX) errors.description = `Action Description must be at most ${DESCRIPTION_MAX} characters`

  if (fields.result !== null && fields.result.length > RESULT_MAX) errors.result = `Result must be at most ${RESULT_MAX} characters`
  else if (fields.status === 'COMPLETED' && isBlank(fields.result)) errors.result = 'Result is required to complete an action'

  if (fields.followUpNote !== null && fields.followUpNote.length > FOLLOW_UP_NOTE_MAX) {
    errors.followUpNote = `Follow-Up Note must be at most ${FOLLOW_UP_NOTE_MAX} characters`
  } else if (fields.followUpRequired && isBlank(fields.followUpNote)) {
    errors.followUpNote = 'Follow-Up Note is required when follow-up is needed'
  }

  if (fields.attachmentNotes !== null && fields.attachmentNotes.length > ATTACHMENT_NOTES_MAX) {
    errors.attachmentNotes = `Attachment Notes must be at most ${ATTACHMENT_NOTES_MAX} characters`
  }

  if (Number.isNaN(fields.actionAt.getTime())) {
    errors.actionAt = 'Action Date/Time is invalid'
  } else if (fields.actionAt.getTime() < ticketCreatedAt.getTime()) {
    errors.actionAt = 'Action Date/Time cannot be before the ticket was created'
  } else if (fields.status !== 'PLANNED' && fields.actionAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    errors.actionAt = 'Only a Planned action can be dated in the future'
  }

  return errors
}

// Normalizes free-text inputs: trims, turns blank into null, and clears the
// follow-up note when no follow-up is needed (BR-07).
export function normalizeActionFields(fields: ActionFields): ActionFields {
  const clean = (value: string | null) => (value === null || value.trim() === '' ? null : value.trim())
  return {
    ...fields,
    description: fields.description.trim(),
    result: clean(fields.result),
    followUpNote: fields.followUpRequired ? clean(fields.followUpNote) : null,
    attachmentNotes: clean(fields.attachmentNotes),
  }
}
