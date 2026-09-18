import type { TicketStatus } from '../api/tickets'

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

const STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: 'New',
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  WAITING_FOR_REQUESTER: 'Waiting for Requester',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
  CANCELLED: 'Cancelled',
}

function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`badge rounded-pill ${STATUS_CLASSES[status]}`}>{STATUS_LABELS[status]}</span>
}

export default StatusBadge
