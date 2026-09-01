import type { TicketStatus } from '../api/tickets'

const STATUS_CLASSES: Record<TicketStatus, string> = {
  NEW: 'text-bg-primary',
  IN_PROGRESS: 'text-bg-info',
  RESOLVED: 'text-bg-success',
  CLOSED: 'text-bg-secondary',
  REOPENED: 'text-bg-warning',
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: 'New',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
}

function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`badge rounded-pill ${STATUS_CLASSES[status]}`}>{STATUS_LABELS[status]}</span>
}

export default StatusBadge
