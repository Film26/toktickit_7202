import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { fetchMyTickets, type TicketStatus, type TicketSummary } from '../api/tickets'
import { ApiError } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorAlert from '../components/ErrorAlert'
import TicketTable from '../components/TicketTable'

const STATUS_FILTERS: Array<{ label: string; value: TicketStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'New', value: 'NEW' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Closed', value: 'CLOSED' },
  { label: 'Reopened', value: 'REOPENED' },
]

function RequesterDashboardPage() {
  const { token } = useAuth()
  const [tickets, setTickets] = useState<TicketSummary[]>([])
  const [status, setStatus] = useState<TicketStatus | 'ALL'>('ALL')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false

    setIsLoading(true)
    setError(null)
    fetchMyTickets(token, status === 'ALL' ? undefined : status)
      .then((data) => {
        if (!cancelled) setTickets(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Unable to load your tickets.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token, status])

  return (
    <div className="container py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
        <h1 className="h3 mb-0">My Tickets</h1>
        <Link to="/tickets/new" className="btn btn-primary">
          + Create Ticket
        </Link>
      </div>

      <div className="btn-group mb-3 flex-wrap" role="group" aria-label="Filter by status">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={`btn btn-sm ${status === filter.value ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setStatus(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {error && <ErrorAlert message={error} />}

      <div className="card shadow-sm">
        <div className="card-body">
          {isLoading ? <LoadingSpinner /> : <TicketTable tickets={tickets} />}
        </div>
      </div>
    </div>
  )
}

export default RequesterDashboardPage
