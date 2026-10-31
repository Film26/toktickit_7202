import type { Role } from '../api/auth'
import type { ActionStatus, TicketAction, TicketStatus } from '../api/tickets'

// Client copy of the transition matrix in docs/lab-04/specification.md
// section 7, so the UI only ever offers transitions the API accepts for this
// role and status. The backend remains the authority (handout 8.4).

export type WorkflowCommand =
  | { kind: 'status'; to: TicketStatus; label: string; variant: string }
  | { kind: 'cancel' | 'close' | 'confirm' | 'reject' | 'reopen'; label: string; variant: string }

const STAFF_COMMANDS: Partial<Record<TicketStatus, WorkflowCommand[]>> = {
  NEW: [
    { kind: 'status', to: 'IN_PROGRESS', label: 'Start Progress', variant: 'btn-primary' },
    { kind: 'status', to: 'OPEN', label: 'Acknowledge', variant: 'btn-outline-primary' },
    { kind: 'cancel', label: 'Cancel Ticket', variant: 'btn-outline-danger' },
  ],
  OPEN: [
    { kind: 'status', to: 'IN_PROGRESS', label: 'Start Progress', variant: 'btn-primary' },
    { kind: 'cancel', label: 'Cancel Ticket', variant: 'btn-outline-danger' },
  ],
  IN_PROGRESS: [{ kind: 'status', to: 'WAITING_FOR_REQUESTER', label: 'Mark Waiting', variant: 'btn-outline-warning' }],
  WAITING_FOR_REQUESTER: [{ kind: 'status', to: 'IN_PROGRESS', label: 'Resume Progress', variant: 'btn-outline-primary' }],
  RESOLVED: [{ kind: 'close', label: 'Close Ticket', variant: 'btn-outline-secondary' }],
  REOPENED: [
    { kind: 'status', to: 'IN_PROGRESS', label: 'Start Progress', variant: 'btn-primary' },
    { kind: 'status', to: 'OPEN', label: 'Acknowledge', variant: 'btn-outline-primary' },
  ],
}

const REQUESTER_COMMANDS: Partial<Record<TicketStatus, WorkflowCommand[]>> = {
  RESOLVED: [
    { kind: 'confirm', label: 'Confirm Resolution', variant: 'btn-success' },
    { kind: 'reject', label: 'Reject Resolution', variant: 'btn-outline-danger' },
  ],
  CLOSED: [{ kind: 'reopen', label: 'Request Reopening', variant: 'btn-outline-warning' }],
}

export function allowedCommands(status: TicketStatus, role: Role): WorkflowCommand[] {
  const table = role === 'REQUESTER' ? REQUESTER_COMMANDS : STAFF_COMMANDS
  return table[status] ?? []
}

export function canResolve(status: TicketStatus, role: Role) {
  return role !== 'REQUESTER' && (status === 'IN_PROGRESS' || status === 'WAITING_FOR_REQUESTER')
}

// BR-15, for guidance only -- the server re-checks.
export function resolutionGate(actions: TicketAction[]) {
  const open = actions.filter((a) => a.status === 'PLANNED' || a.status === 'IN_PROGRESS').length
  const completed = actions.filter((a) => a.status === 'COMPLETED').length
  const reasons: string[] = []
  if (open > 0) reasons.push(`${open} action${open === 1 ? ' is' : 's are'} still open`)
  if (completed === 0) reasons.push('no action has been completed yet')
  return { allowed: reasons.length === 0, open, completed, reasons }
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: 'New',
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  WAITING_FOR_REQUESTER: 'Waiting for Requester',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
  CANCELLED: 'Cancelled',
}

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  PLANNED: 'Planned',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}
