import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { fetchMyTickets, type SortField, type SortOrder, type TicketStatus, type TicketSummary } from '../api/tickets'
import { ApiError } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorAlert from '../components/ErrorAlert'
import TicketTable from '../components/TicketTable'
import DrillDownChip from '../components/DrillDownChip'
import { isTicketStatus } from '../lib/ticketWorkflow'

const STATUS_FILTERS: Array<{ label: string; value: TicketStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'New', value: 'NEW' },
  { label: 'Open', value: 'OPEN' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Waiting for Requester', value: 'WAITING_FOR_REQUESTER' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Closed', value: 'CLOSED' },
  { label: 'Reopened', value: 'REOPENED' },
  { label: 'Cancelled', value: 'CANCELLED' },
]

const SORT_OPTIONS: Array<{ label: string; sort: SortField; order: SortOrder }> = [
  { label: 'Newest first', sort: 'createdAt', order: 'desc' },
  { label: 'Oldest first', sort: 'createdAt', order: 'asc' },
  { label: 'Ticket No. (A-Z)', sort: 'ticketNumber', order: 'asc' },
  { label: 'Summary (A-Z)', sort: 'summary', order: 'asc' },
  { label: 'Priority (A-Z)', sort: 'requestedPriority', order: 'asc' },
]

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 300

// My Tickets list (Lab 2), at /tickets since Lab 4. Reads the dashboard
// drill-down filters (status, statusGroup) from the URL -- docs/lab-04 FR-14.
function MyTicketsPage() {
  const { token } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tickets, setTickets] = useState<TicketSummary[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const initialStatus = searchParams.get('status')
  const [status, setStatus] = useState<TicketStatus | 'ALL'>(isTicketStatus(initialStatus) ? initialStatus : 'ALL')
  const [statusGroup, setStatusGroup] = useState<'open' | undefined>(
    searchParams.get('statusGroup') === 'open' && !isTicketStatus(initialStatus) ? 'open' : undefined,
  )
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sortIndex, setSortIndex] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [status, statusGroup, search, sortIndex])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    const { sort, order } = SORT_OPTIONS[sortIndex]

    setIsLoading(true)
    setError(null)
    fetchMyTickets(token, {
      status: status === 'ALL' ? undefined : status,
      statusGroup,
      search: search || undefined,
      sort,
      order,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((data) => {
        if (cancelled) return
        setTickets(data.tickets)
        setTotalPages(data.pagination.totalPages)
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
  }, [token, status, statusGroup, search, sortIndex, page])

  return (
    <div className="container py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
        <h1 className="h3 mb-0">My Tickets</h1>
        <Link to="/tickets/new" className="btn btn-primary">
          + Create Ticket
        </Link>
      </div>

      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <div className="btn-group flex-wrap" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={`btn btn-sm ${status === filter.value ? 'btn-primary' : 'btn-outline-primary'}`}
              aria-pressed={status === filter.value && !statusGroup}
              onClick={() => {
                setStatus(filter.value)
                setStatusGroup(undefined)
                setSearchParams({}, { replace: true })
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <input
          type="search"
          className="form-control form-control-sm"
          style={{ maxWidth: 240 }}
          placeholder="Search summary or ticket #..."
          aria-label="Search tickets"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />

        <select
          className="form-select form-select-sm"
          style={{ maxWidth: 200 }}
          aria-label="Sort tickets"
          value={sortIndex}
          onChange={(event) => setSortIndex(Number(event.target.value))}
        >
          {SORT_OPTIONS.map((option, index) => (
            <option key={option.label} value={index}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {statusGroup && (
        <DrillDownChip
          description="open tickets (New, Open, In Progress, Waiting for Requester, Reopened)"
          onClear={() => {
            setStatusGroup(undefined)
            setStatus('ALL')
            setSearchParams({}, { replace: true })
          }}
        />
      )}

      {error && <ErrorAlert message={error} />}

      <div className="card shadow-sm">
        <div className="card-body">
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <TicketTable
              tickets={tickets}
              emptyMessage={
                status !== 'ALL' || statusGroup || search
                  ? 'No tickets match your search or filter.'
                  : "You don't have any tickets yet. Create one to get started."
              }
            />
          )}
        </div>
      </div>

      {!isLoading && totalPages > 1 && (
        <nav className="d-flex justify-content-between align-items-center mt-3" aria-label="My Tickets pagination">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            &larr; Previous
          </button>
          <span className="text-muted small">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next &rarr;
          </button>
        </nav>
      )}
    </div>
  )
}

export default MyTicketsPage
