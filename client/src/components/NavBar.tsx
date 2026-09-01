import { flushSync } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

function NavBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  // logout() and navigate() are both async state updates; without flushSync,
  // ProtectedRoute can render (with the freshly-cleared user) before our
  // explicit navigate() commits, and its own "redirect to /login when
  // logged out" logic races with - and can override - the destination we
  // actually want (most visibly for Change Requester, which must not land
  // on /login).
  const handleLogout = () => {
    flushSync(() => logout())
    navigate('/login')
  }

  const handleChangeRequester = () => {
    flushSync(() => logout())
    navigate('/dev-requester-select')
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
          {user.role === 'REQUESTER' && (
            <button type="button" className="btn btn-outline-light btn-sm" onClick={handleChangeRequester}>
              Change Requester
            </button>
          )}
          <button type="button" className="btn btn-outline-light btn-sm" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>
    </nav>
  )
}

export default NavBar
