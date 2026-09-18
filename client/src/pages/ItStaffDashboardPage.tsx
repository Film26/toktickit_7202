import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { fetchAllTickets, type SortField, type SortOrder, type TicketStatus, type TicketSummary } from '../api/tickets'
import { fetchCategories, type Category } from '../api/categories'
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

const OWNER_FILTERS: Array<{ label: string; value: string }> = [
  { label: 'All', value: '' },
  { label: 'My Tickets', value: 'me' },
  { label: 'Unassigned', value: 'unassigned' },
]

const SORT_OPTIONS: Array<{ label: string; sort: SortField; order: SortOrder }> = [
  { label: 'Newest first', sort: 'createdAt', order: 'desc' },
  { label: 'Oldest first', sort: 'createdAt', order: 'asc' },
  { label: 'Ticket No. (A-Z)', sort: 'ticketNumber', order: 'asc' },
  { label: 'Requested Priority (A-Z)', sort: 'requestedPriority', order: 'asc' },
  { label: 'IT Priority (A-Z)', sort: 'itPriority', order: 'asc' },
  { label: 'Status (A-Z)', sort: 'status', order: 'asc' },
  { label: 'Recently updated', sort: 'updatedAt', order: 'desc' },
]

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 300

function ItStaffDashboardPage() {
  const { token } = useAuth()
  const [tickets, setTickets] = useState<TicketSummary[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [categories, setCategories] = useState<Category[]>([])
  const [status, setStatus] = useState<TicketStatus | 'ALL'>('ALL')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [sortIndex, setSortIndex] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    const handle = setTimeout(() => setQuery(queryInput.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [queryInput])

  useEffect(() => {
    setPage(1)
  }, [status, ownerFilter, categoryId, query, sortIndex])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    const { sort, order } = SORT_OPTIONS[sortIndex]

    setIsLoading(true)
    setError(null)
    fetchAllTickets(token, {
      status: status === 'ALL' ? undefined : status,
      ownerId: ownerFilter || undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      q: query || undefined,
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
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Unable to load tickets.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token, status, ownerFilter, categoryId, query, sortIndex, page])

  const hasActiveFilter = status !== 'ALL' || ownerFilter !== '' || categoryId !== '' || query !== ''

  return (
    <div className="container py-4">
      <h1 className="h3 mb-4">All Tickets</h1>

      <div className="d-flex flex-wrap gap-3 align-items-end mb-3">
        <div className="btn-group flex-wrap" role="group" aria-label="Filter by status">
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

        <div className="btn-group flex-wrap" role="group" aria-label="Filter by owner">
          {OWNER_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={`btn btn-sm ${ownerFilter === filter.value ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setOwnerFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <select
          className="form-select form-select-sm"
          style={{ width: 'auto' }}
          aria-label="Filter by category"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <input
          type="search"
          className="form-control form-control-sm"
          style={{ width: 220 }}
          placeholder="Search summary or ticket #"
          aria-label="Search tickets"
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
        />

        <select
          className="form-select form-select-sm"
          style={{ width: 'auto' }}
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

      {error && <ErrorAlert message={error} />}

      <div className="card shadow-sm">
        <div className="card-body">
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <TicketTable
              tickets={tickets}
              showRequester
              emptyMessage={hasActiveFilter ? 'No tickets match your filters.' : 'No tickets in the queue.'}
            />
          )}
        </div>
      </div>

      {!isLoading && totalPages > 1 && (
        <nav className="d-flex justify-content-between align-items-center mt-3" aria-label="All Tickets pagination">
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

export default ItStaffDashboardPage
