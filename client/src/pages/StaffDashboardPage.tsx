import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { fetchStaffDashboard } from '../api/dashboard'
import { useDashboard } from '../lib/useDashboard'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorAlert from '../components/ErrorAlert'
import EmptyState from '../components/EmptyState'
import MetricCard from '../components/MetricCard'
import DashboardTicketList from '../components/DashboardTicketList'
import PriorityBadge from '../components/PriorityBadge'
import ActionStatusBadge from '../components/ActionStatusBadge'

// IT Staff / Administrator Dashboard (handout 8.1, docs/lab-04/ui-spec.md
// section 4). Administrators additionally get the User Accounts card.

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const QUICK_ACTIONS = [
  { to: '/queue', icon: '☰', label: 'Ticket Queue' },
  { to: '/queue?ownerId=unassigned&statusGroup=open', icon: '⚑', label: 'Unassigned' },
  { to: '/queue?ownerId=me&statusGroup=open', icon: '★', label: 'My Queue' },
]

function StaffDashboardPage() {
  const { token, user } = useAuth()
  const { data, error, isLoading, isRefreshing, refresh } = useDashboard(token, fetchStaffDashboard)
  const firstName = user?.fullName.split(' ')[0] ?? ''

  return (
    <div className="container py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-4">
        <div>
          <h1 className="h3 mb-1">Welcome back, {firstName}!</h1>
          <p className="text-muted mb-0">Here&apos;s what&apos;s happening with your queue today.</p>
        </div>
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => void refresh()} disabled={isLoading || isRefreshing}>
          {isRefreshing ? 'Refreshing...' : '↻ Refresh'}
        </button>
      </div>

      {isLoading && <LoadingSpinner label="Loading dashboard..." />}

      {error && (
        <div>
          <ErrorAlert message={error.message} />
          {error.status !== 403 && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void refresh()}>
              Retry
            </button>
          )}
        </div>
      )}

      {data && !error && (
        <>
          <div className="row row-cols-2 row-cols-md-3 row-cols-xl-6 g-3 mb-4">
            {data.metrics.map((metric) => (
              <div className="col" key={metric.key}>
                <MetricCard metric={metric} />
              </div>
            ))}
          </div>

          <div className="row g-3">
            <div className="col-lg-7">
              <DashboardTicketList
                title="My Recent Tickets"
                tickets={data.recentTickets}
                viewAllTo="/queue?ownerId=me"
                emptyMessage="No tickets are assigned to you yet."
              />

              <section className="card shadow-sm mb-3" aria-labelledby="my-open-actions">
                <div className="card-header bg-white d-flex justify-content-between align-items-center">
                  <h2 className="h6 mb-0" id="my-open-actions">
                    My Open Actions Taken <span className="badge rounded-pill text-bg-secondary ms-1">{data.myOpenActions.total}</span>
                  </h2>
                </div>
                {data.myOpenActions.items.length === 0 ? (
                  <div className="card-body py-0">
                    <EmptyState message="You have no open Actions Taken." />
                  </div>
                ) : (
                  <ul className="list-group list-group-flush">
                    {data.myOpenActions.items.map((action) => (
                      <li key={action.id} className="list-group-item d-flex flex-wrap align-items-center gap-2">
                        <div className="flex-grow-1" style={{ minWidth: 0 }}>
                          <Link to={`/tickets/${action.ticketId}`} className="fw-semibold small text-decoration-none">
                            {action.ticketNumber}
                          </Link>
                          <div className="small text-muted text-truncate">{action.description}</div>
                        </div>
                        <ActionStatusBadge status={action.status} />
                        <span className="small text-muted text-nowrap">{formatDateTime(action.actionAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <div className="col-lg-5">
              <section className="card shadow-sm mb-3" aria-labelledby="staff-quick-actions">
                <div className="card-header bg-white">
                  <h2 className="h6 mb-0" id="staff-quick-actions">
                    Quick Actions
                  </h2>
                </div>
                <div className="card-body">
                  <div className="row row-cols-3 g-2">
                    {QUICK_ACTIONS.map((action) => (
                      <div className="col" key={action.label}>
                        <Link to={action.to} className="btn btn-outline-primary w-100 h-100 py-3 quick-action">
                          <span className="d-block fs-4" aria-hidden="true">
                            {action.icon}
                          </span>
                          <span className="small">{action.label}</span>
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="card shadow-sm mb-3" aria-labelledby="by-priority">
                <div className="card-header bg-white">
                  <h2 className="h6 mb-0" id="by-priority">
                    Open Tickets by IT Priority
                  </h2>
                </div>
                <ul className="list-group list-group-flush">
                  {data.byItPriority.map((row) => (
                    <li key={row.priority} className="list-group-item d-flex justify-content-between align-items-center">
                      <PriorityBadge priority={row.priority === 'unset' ? null : row.priority} />
                      <Link to={row.drillDown} className="fw-semibold" aria-label={`${row.value} open tickets with IT Priority ${row.priority === 'unset' ? 'not set' : row.priority.toLowerCase()}`}>
                        {row.value}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              {data.userCounts && (
                <section className="card shadow-sm mb-3" aria-labelledby="user-accounts">
                  <div className="card-header bg-white d-flex justify-content-between align-items-center">
                    <h2 className="h6 mb-0" id="user-accounts">
                      User Accounts
                    </h2>
                    <Link to="/admin/users" className="small">
                      Manage users
                    </Link>
                  </div>
                  <dl className="card-body row mb-0 small">
                    <dt className="col-8 fw-normal text-muted">Active Requesters</dt>
                    <dd className="col-4 text-end fw-semibold">{data.userCounts.activeRequesters}</dd>
                    <dt className="col-8 fw-normal text-muted">Active IT Staff</dt>
                    <dd className="col-4 text-end fw-semibold">{data.userCounts.activeItStaff}</dd>
                    <dt className="col-8 fw-normal text-muted">Active Administrators</dt>
                    <dd className="col-4 text-end fw-semibold">{data.userCounts.activeAdministrators}</dd>
                    <dt className="col-8 fw-normal text-muted">Inactive accounts</dt>
                    <dd className="col-4 text-end fw-semibold mb-0">{data.userCounts.inactive}</dd>
                  </dl>
                </section>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default StaffDashboardPage
