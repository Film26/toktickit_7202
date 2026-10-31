import { Link } from 'react-router-dom'
import type { DashboardTicketCard } from '../api/dashboard'
import StatusBadge from './StatusBadge'
import EmptyState from './EmptyState'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

type DashboardTicketListProps = {
  title: string
  tickets: DashboardTicketCard[]
  viewAllTo: string
  emptyMessage: string
  dateField?: 'updatedAt' | 'resolvedAt'
}

// Up to five summary rows linking to Ticket Detail (ui-spec section 2).
function DashboardTicketList({ title, tickets, viewAllTo, emptyMessage, dateField = 'updatedAt' }: DashboardTicketListProps) {
  const headingId = `dash-list-${title.toLowerCase().replace(/\W+/g, '-')}`
  return (
    <section className="card shadow-sm mb-3" aria-labelledby={headingId}>
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <h2 className="h6 mb-0" id={headingId}>
          {title}
        </h2>
        <Link to={viewAllTo} className="small" aria-label={`View all: ${title}`}>
          View all
        </Link>
      </div>
      {tickets.length === 0 ? (
        <div className="card-body py-0">
          <EmptyState message={emptyMessage} />
        </div>
      ) : (
        <ul className="list-group list-group-flush">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="list-group-item d-flex flex-wrap align-items-center gap-2">
              <div className="flex-grow-1 min-w-0" style={{ minWidth: 0 }}>
                <Link to={`/tickets/${ticket.id}`} className="fw-semibold small text-decoration-none">
                  {ticket.ticketNumber}
                </Link>
                <div className="small text-muted text-truncate">{ticket.summary}</div>
              </div>
              <StatusBadge status={ticket.status} />
              <span className="small text-muted text-nowrap">{formatDateTime((dateField === 'resolvedAt' && ticket.resolvedAt) || ticket.updatedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default DashboardTicketList
