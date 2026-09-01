import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <div className="container text-center py-5">
      <h1 className="display-6 mb-3">Page Not Found</h1>
      <p className="text-muted mb-4">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link to="/dashboard" className="btn btn-primary">
        Back to Dashboard
      </Link>
    </div>
  )
}

export default NotFoundPage
