import { Link } from 'react-router-dom'

function AccessDeniedPage() {
  return (
    <div className="container text-center py-5">
      <h1 className="display-6 mb-3">Access Denied</h1>
      <p className="text-muted mb-4">You don&apos;t have permission to view this page.</p>
      <Link to="/dashboard" className="btn btn-primary">
        Back to Dashboard
      </Link>
    </div>
  )
}

export default AccessDeniedPage
