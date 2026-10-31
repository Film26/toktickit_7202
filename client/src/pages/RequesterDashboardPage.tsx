import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { fetchRequesterDashboard } from '../api/dashboard'
import { useDashboard } from '../lib/useDashboard'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorAlert from '../components/ErrorAlert'
import MetricCard from '../components/MetricCard'
import DashboardTicketList from '../components/DashboardTicketList'

// Requester Dashboard (handout 8.2, docs/lab-04/ui-spec.md section 3). Only
// the signed-in Requester's tickets -- enforced by the backend (BR-23).
function RequesterDashboardPage() {
  const { token, user } = useAuth()
  const { data, error, isLoading, isRefreshing, refresh } = useDashboard(token, fetchRequesterDashboard)
  const firstName = user?.fullName.split(' ')[0] ?? ''

  return (
    <div className="container py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-4">
        <div>
          <h1 className="h3 mb-1">Welcome, {firstName}!</h1>
          <p className="text-muted mb-0">Here&apos;s the latest on your requests.</p>
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
          <div className="row row-cols-2 row-cols-md-3 row-cols-xl-5 g-3 mb-4">
            {data.metrics.map((metric) => (
              <div className="col" key={metric.key}>
                <MetricCard metric={metric} />
              </div>
            ))}
          </div>

          <div className="row g-3">
            <div className="col-lg-8">
              <DashboardTicketList
                title="My Recent Tickets"
                tickets={data.recentTickets}
                viewAllTo="/tickets"
                emptyMessage="You haven't created any tickets yet."
              />
              <DashboardTicketList
                title="Needs Your Attention"
                tickets={data.attentionRequired}
                viewAllTo="/tickets?status=WAITING_FOR_REQUESTER"
                emptyMessage="Nothing needs your attention right now."
              />
            </div>
            <div className="col-lg-4">
              <section className="card shadow-sm mb-3" aria-labelledby="requester-quick-actions">
                <div className="card-header bg-white">
                  <h2 className="h6 mb-0" id="requester-quick-actions">
                    Quick Actions
                  </h2>
                </div>
                <div className="card-body d-grid gap-2">
                  <Link to="/tickets/new" className="btn btn-outline-primary text-start quick-action">
                    <span className="fw-semibold d-block">+ Create Ticket</span>
                    <span className="small">Submit a new request</span>
                  </Link>
                  <Link to="/tickets" className="btn btn-outline-primary text-start quick-action">
                    <span className="fw-semibold d-block">View My Tickets</span>
                    <span className="small">Track existing requests</span>
                  </Link>
                </div>
              </section>
              <DashboardTicketList
                title="Recently Resolved"
                tickets={data.recentlyResolved}
                viewAllTo="/tickets?status=RESOLVED"
                emptyMessage="No tickets resolved in the last 7 days."
                dateField="resolvedAt"
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default RequesterDashboardPage
