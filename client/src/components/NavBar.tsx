import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

function NavBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="navbar navbar-dark bg-primary px-3 mb-4">
      <div className="container-fluid flex-wrap">
        <Link className="navbar-brand fw-semibold" to="/dashboard">
          TokTickIT
        </Link>
        <div className="d-flex align-items-center gap-3 flex-wrap">
          {user.role === 'REQUESTER' && (
            <Link className="nav-link text-white" to="/tickets/new">
              Create Ticket
            </Link>
          )}
          {user.role === 'ADMINISTRATOR' && (
            <>
              <Link className="nav-link text-white" to="/admin/users">
                Users
              </Link>
              <Link className="nav-link text-white" to="/admin/reference-data">
                Reference Data
              </Link>
            </>
          )}
          <span className="text-white-50 small">
            {user.fullName} ({user.role})
          </span>
          <button type="button" className="btn btn-outline-light btn-sm" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>
    </nav>
  )
}

export default NavBar
