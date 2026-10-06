import type { TicketStatus } from '../api/tickets'
import { STATUS_LABELS } from '../lib/ticketWorkflow'

const STATUS_CLASSES: Record<TicketStatus, string> = {
  NEW: 'text-bg-primary',
  OPEN: 'border border-primary text-primary bg-white',
  IN_PROGRESS: 'text-bg-info',
  WAITING_FOR_REQUESTER: 'text-bg-warning',
  RESOLVED: 'text-bg-success',
  CLOSED: 'text-bg-secondary',
  REOPENED: 'text-bg-warning',
  CANCELLED: 'text-bg-dark text-decoration-line-through',
}

function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`badge rounded-pill ${STATUS_CLASSES[status]}`}>{STATUS_LABELS[status]}</span>
}

export default StatusBadge
