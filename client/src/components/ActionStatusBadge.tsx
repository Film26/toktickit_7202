import type { ActionStatus } from '../api/tickets'
import { ACTION_STATUS_LABELS } from '../lib/ticketWorkflow'

// docs/lab-04/ui-spec.md section 2: every action status has a text label and a
// symbol, so it never relies on colour alone.
const ACTION_STATUS_CLASSES: Record<ActionStatus, string> = {
  PLANNED: 'border border-primary text-primary bg-white',
  IN_PROGRESS: 'text-bg-info',
  COMPLETED: 'text-bg-success',
  CANCELLED: 'text-bg-dark text-decoration-line-through',
}

const ACTION_STATUS_SYMBOLS: Record<ActionStatus, string> = {
  PLANNED: '◷',
  IN_PROGRESS: '▶',
  COMPLETED: '✓',
  CANCELLED: '✕',
}

function ActionStatusBadge({ status }: { status: ActionStatus }) {
  return (
    <span className={`badge rounded-pill ${ACTION_STATUS_CLASSES[status]}`}>
      <span aria-hidden="true">{ACTION_STATUS_SYMBOLS[status]} </span>
      {ACTION_STATUS_LABELS[status]}
    </span>
  )
}

export default ActionStatusBadge
