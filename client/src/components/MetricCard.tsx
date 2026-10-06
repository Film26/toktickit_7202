import { Link } from 'react-router-dom'
import type { DashboardMetric } from '../api/dashboard'

// Concise dashboard metric (docs/lab-04/ui-spec.md section 2): label, value,
// optional "+N today", and one accessible drill-down link.
function MetricCard({ metric }: { metric: DashboardMetric }) {
  return (
    <div className="card shadow-sm h-100 metric-card">
      <div className="card-body d-flex flex-column">
        <h2 className="h6 text-muted fw-normal mb-2">{metric.label}</h2>
        <p className="fs-2 fw-semibold mb-1 lh-1" data-testid={`metric-${metric.key}`}>
          {metric.value}
        </p>
        {metric.todayDelta !== null ? (
          <p className={`small mb-2 ${metric.todayDelta > 0 ? 'text-success' : 'text-muted'}`}>
            {metric.todayDelta > 0 ? (
              <>
                <span aria-hidden="true">▲ </span>+{metric.todayDelta} today
              </>
            ) : (
              'No change today'
            )}
          </p>
        ) : (
          <p className="small text-muted mb-2">{metric.value === 0 ? 'Nothing here' : '\u00a0'}</p>
        )}
        <Link to={metric.drillDown} className="small mt-auto" aria-label={`View all ${metric.label} tickets`}>
          View all
        </Link>
      </div>
    </div>
  )
}

export default MetricCard
