import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { fetchAllTickets, type TicketStatus, type TicketSummary } from '../api/tickets'
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

function ItStaffDashboardPage() {
  const { token } = useAuth()
  const [tickets, setTickets] = useState<TicketSummary[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [status, setStatus] = useState<TicketStatus | 'ALL'>('ALL')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    if (!token) return
    let cancelled = false

    setIsLoading(true)
    setError(null)
    fetchAllTickets(token, {
      status: status === 'ALL' ? undefined : status,
      ownerId: ownerFilter || undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      q: query || undefined,
    })
      .then((data) => {
        if (!cancelled) setTickets(data)
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
  }, [token, status, ownerFilter, categoryId, query])

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
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {error && <ErrorAlert message={error} />}

      <div className="card shadow-sm">
        <div className="card-body">
          {isLoading ? <LoadingSpinner /> : <TicketTable tickets={tickets} showRequester />}
        </div>
      </div>
    </div>
  )
}

export default ItStaffDashboardPage
