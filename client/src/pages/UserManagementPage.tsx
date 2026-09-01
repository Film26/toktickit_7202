import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import {
  fetchUsers,
  createUser,
  updateUser,
  setUserStatus,
  resetUserPassword,
  type ManagedUser,
} from '../api/users'
import type { Role } from '../api/auth'
import { ApiError } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorAlert from '../components/ErrorAlert'
import EmptyState from '../components/EmptyState'

const ROLES: Role[] = ['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR']

function roleLabel(role: Role) {
  return role
    .toLowerCase()
    .split('_')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}

function UserManagementPage() {
  const { token } = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const [newEmail, setNewEmail] = useState('')
  const [newFullName, setNewFullName] = useState('')
  const [newRole, setNewRole] = useState<Role>('REQUESTER')
  const [isCreating, setIsCreating] = useState(false)
  const [lastTemporaryPassword, setLastTemporaryPassword] = useState<{ email: string; password: string } | null>(
    null,
  )

  const load = useCallback(() => {
    if (!token) return
    setIsLoading(true)
    setError(null)
    fetchUsers(token, { q: query || undefined })
      .then(setUsers)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Unable to load users.'))
      .finally(() => setIsLoading(false))
  }, [token, query])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !newEmail.trim() || !newFullName.trim()) return
    setActionError(null)
    setIsCreating(true)
    try {
      const result = await createUser(token, { email: newEmail.trim(), fullName: newFullName.trim(), role: newRole })
      setLastTemporaryPassword({ email: result.user.email, password: result.temporaryPassword })
      setNewEmail('')
      setNewFullName('')
      setNewRole('REQUESTER')
      load()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Unable to create user.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleRoleChange = async (user: ManagedUser, role: Role) => {
    if (!token) return
    setActionError(null)
    try {
      await updateUser(token, user.id, { role })
      load()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Unable to update role.')
    }
  }

  const handleToggleStatus = async (user: ManagedUser) => {
    if (!token) return
    setActionError(null)
    try {
      await setUserStatus(token, user.id, !user.isActive)
      load()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Unable to update status.')
    }
  }

  const handleResetPassword = async (user: ManagedUser) => {
    if (!token) return
    setActionError(null)
    try {
      const result = await resetUserPassword(token, user.id)
      setLastTemporaryPassword({ email: user.email, password: result.temporaryPassword })
      load()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Unable to reset password.')
    }
  }

  return (
    <div className="container py-4">
      <h1 className="h3 mb-4">User Management</h1>

      {actionError && <ErrorAlert message={actionError} />}

      {lastTemporaryPassword && (
        <div className="alert alert-success" role="alert">
          Temporary password for <strong>{lastTemporaryPassword.email}</strong>:{' '}
          <code>{lastTemporaryPassword.password}</code> - share this with the user; it won&apos;t be shown again.
        </div>
      )}

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h2 className="h6 mb-3">Create User</h2>
          <form onSubmit={handleCreate} className="row g-2 align-items-end">
            <div className="col-md-4">
              <label htmlFor="newFullName" className="form-label small text-muted mb-1">
                Full name
              </label>
              <input
                id="newFullName"
                type="text"
                className="form-control"
                value={newFullName}
                onChange={(event) => setNewFullName(event.target.value)}
                required
              />
            </div>
            <div className="col-md-4">
              <label htmlFor="newEmail" className="form-label small text-muted mb-1">
                Email
              </label>
              <input
                id="newEmail"
                type="email"
                className="form-control"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                required
              />
            </div>
            <div className="col-md-2">
              <label htmlFor="newRole" className="form-label small text-muted mb-1">
                Role
              </label>
              <select id="newRole" className="form-select" value={newRole} onChange={(event) => setNewRole(event.target.value as Role)}>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <button type="submit" className="btn btn-primary w-100" disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="mb-3" style={{ maxWidth: 320 }}>
        <input
          type="search"
          className="form-control"
          placeholder="Search by name or email"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {error && <ErrorAlert message={error} />}

      <div className="card shadow-sm">
        <div className="card-body">
          {isLoading ? (
            <LoadingSpinner />
          ) : users.length === 0 ? (
            <EmptyState message="No users found." />
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Password</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.fullName}</td>
                      <td>{user.email}</td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          style={{ width: 'auto' }}
                          value={user.role}
                          onChange={(event) => handleRoleChange(user, event.target.value as Role)}
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {roleLabel(role)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className={`badge rounded-pill ${user.isActive ? 'text-bg-success' : 'text-bg-secondary'}`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        {user.mustChangePassword ? (
                          <span className="badge text-bg-warning">Change required</span>
                        ) : (
                          <span className="text-muted small">OK</span>
                        )}
                      </td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          <button type="button" className="btn btn-outline-secondary" onClick={() => handleResetPassword(user)}>
                            Reset Password
                          </button>
                          <button
                            type="button"
                            className={`btn ${user.isActive ? 'btn-outline-danger' : 'btn-outline-success'}`}
                            onClick={() => handleToggleStatus(user)}
                          >
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UserManagementPage
