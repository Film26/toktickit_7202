import { useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import type { Role } from '../api/auth'

// Role navigation (docs/lab-04/ui-spec.md section 1). Links are a convenience
// only; every destination is still authorized by ProtectedRoute and the API.
const LINKS: Record<Role, Array<{ to: string; label: string; end?: boolean }>> = {
  REQUESTER: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/tickets', label: 'My Tickets', end: true },
    { to: '/tickets/new', label: 'Create Ticket' },
  ],
  IT_STAFF: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/queue', label: 'Ticket Queue' },
  ],
  ADMINISTRATOR: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/queue', label: 'Ticket Queue' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/reference-data', label: 'Reference Data' },
  ],
}

const ROLE_LABELS: Record<Role, string> = {
  REQUESTER: 'Requester',
  IT_STAFF: 'IT Staff',
  ADMINISTRATOR: 'Administrator',
}

function NavBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)

  if (!user) return null

  // logout() and navigate() are both async state updates; without flushSync,
  // ProtectedRoute can render (with the freshly-cleared user) before our
  // explicit navigate() commits and race it to a different redirect.
  const handleLogout = () => {
    flushSync(() => logout())
    navigate('/login')
  }

  return (
    <nav className="navbar navbar-expand-md navbar-dark bg-primary px-3 mb-4 app-navbar" aria-label="Main">
      <div className="container-fluid">
        <Link className="navbar-brand fw-semibold d-flex align-items-center gap-2" to="/dashboard">
          <span aria-hidden="true" className="brand-icon">
            ◷
          </span>
          TokTickIT
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          aria-controls="main-nav"
          aria-expanded={isOpen}
          aria-label="Menu"
          onClick={() => setIsOpen((open) => !open)}
        >
          <span className="navbar-toggler-icon" />
        </button>
        <div className={`collapse navbar-collapse ${isOpen ? 'show' : ''}`} id="main-nav">
          <ul className="navbar-nav me-auto gap-md-2">
            {LINKS[user.role].map((link) => (
              <li className="nav-item" key={link.to}>
                <NavLink className="nav-link" to={link.to} end={link.end} onClick={() => setIsOpen(false)}>
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="d-flex align-items-center gap-3 flex-wrap py-2 py-md-0">
            <span className="text-white small">
              {user.fullName} <span className="text-white-50">({ROLE_LABELS[user.role]})</span>
            </span>
            <button type="button" className="btn btn-outline-light btn-sm" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default NavBar
