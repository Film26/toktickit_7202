import type { Priority } from '../api/tickets'

const PRIORITY_CLASSES: Record<Priority, string> = {
  LOW: 'text-bg-secondary',
  MEDIUM: 'text-bg-info',
  HIGH: 'text-bg-warning',
  URGENT: 'text-bg-danger',
}

const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
}

function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) {
    return <span className="badge text-bg-light text-muted border">Not set</span>
  }
  return <span className={`badge rounded-pill ${PRIORITY_CLASSES[priority]}`}>{PRIORITY_LABELS[priority]}</span>
}

export default PriorityBadge
