import type { ActionStatus, TicketAction } from '../api/tickets'

// Action Taken form model shared by ActionForm and its tests. Mirrors the
// server rules (BR-06/07/09) for fast feedback; the server stays the
// authority.

export const DESCRIPTION_MAX = 2000
export const TEXT_MAX = 2000
export const ATTACHMENT_NOTES_MAX = 500

export type FormValues = {
  actionAt: string
  description: string
  status: ActionStatus
  result: string
  assigneeId: string
  followUpRequired: boolean
  followUpNote: string
  attachmentNotes: string
}

export type FieldName = keyof FormValues
export type FieldErrors = Partial<Record<FieldName, string>>

// <input type="datetime-local"> works in local time without a zone.
export function toLocalInputValue(iso: string | Date) {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function initialValues(action: TicketAction | null, currentUserId: number): FormValues {
  if (!action) {
    return {
      actionAt: toLocalInputValue(new Date()),
      description: '',
      status: 'PLANNED',
      result: '',
      assigneeId: String(currentUserId),
      followUpRequired: false,
      followUpNote: '',
      attachmentNotes: '',
    }
  }
  return {
    actionAt: toLocalInputValue(action.actionAt),
    description: action.description,
    status: action.status,
    result: action.result ?? '',
    assigneeId: action.assignee ? String(action.assignee.id) : '',
    followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote ?? '',
    attachmentNotes: action.attachmentNotes ?? '',
  }
}

export function validateActionForm(values: FormValues): FieldErrors {
  const errors: FieldErrors = {}
  if (!values.actionAt || Number.isNaN(new Date(values.actionAt).getTime())) errors.actionAt = 'Action Date/Time is required'
  if (!values.description.trim()) errors.description = 'Action Description is required'
  else if (values.description.trim().length > DESCRIPTION_MAX) errors.description = `At most ${DESCRIPTION_MAX} characters`
  if (values.status === 'COMPLETED' && !values.result.trim()) errors.result = 'Result is required to complete an action'
  else if (values.result.length > TEXT_MAX) errors.result = `At most ${TEXT_MAX} characters`
  if (values.followUpRequired && !values.followUpNote.trim()) errors.followUpNote = 'Follow-Up Note is required when follow-up is needed'
  else if (values.followUpNote.length > TEXT_MAX) errors.followUpNote = `At most ${TEXT_MAX} characters`
  if (values.attachmentNotes.length > ATTACHMENT_NOTES_MAX) errors.attachmentNotes = `At most ${ATTACHMENT_NOTES_MAX} characters`
  if (!values.assigneeId) errors.assigneeId = 'Choose who the action is assigned to'
  return errors
}

