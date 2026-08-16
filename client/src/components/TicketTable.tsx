import { useNavigate } from 'react-router-dom'
import type { TicketSummary } from '../api/tickets'
import PriorityBadge from './PriorityBadge'
import StatusBadge from './StatusBadge'
import EmptyState from './EmptyState'

type TicketTableProps = {
  tickets: TicketSummary[]
  showRequester?: boolean
}

function TicketTable({ tickets, showRequester = false }: TicketTableProps) {
  const navigate = useNavigate()

  if (tickets.length === 0) {
    return <EmptyState message="No tickets to show." />
  }

  return (
    <div className="table-responsive">
      <table className="table table-hover align-middle">
        <thead>
          <tr>
            <th>Ticket No.</th>
            <th>Summary</th>
            <th>Category</th>
            {showRequester && <th>Requester</th>}
            <th>Owner</th>
            <th>Requested Priority</th>
            <th>IT Priority</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id} role="button" onClick={() => navigate(`/tickets/${ticket.id}`)}>
              <td className="text-nowrap">{ticket.ticketNumber}</td>
              <td>{ticket.summary}</td>
              <td>{ticket.category.name}</td>
              {showRequester && <td>{ticket.requester?.fullName ?? '-'}</td>}
              <td>{ticket.owner?.fullName ?? <span className="text-muted">Unassigned</span>}</td>
              <td>
                <PriorityBadge priority={ticket.requestedPriority} />
              </td>
              <td>
                <PriorityBadge priority={ticket.itPriority} />
              </td>
              <td>
                <StatusBadge status={ticket.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default TicketTable
