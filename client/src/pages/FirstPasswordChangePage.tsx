import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { changePassword } from '../api/auth'
import { ApiError } from '../api/client'
import ErrorAlert from '../components/ErrorAlert'

function FirstPasswordChangePage() {
  const { token, user, setUser } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }
    if (!token || !user) return

    setIsSubmitting(true)
    try {
      await changePassword(token, currentPassword, newPassword)
      setUser({ ...user, mustChangePassword: false })
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to change password.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="py-5">
        <h1 className="mb-1">Set a New Password</h1>
        <p className="text-muted mb-4">You must change your temporary password before continuing.</p>

        <form onSubmit={handleSubmit} className="card p-4 shadow-sm">
          {error && <ErrorAlert message={error} />}

          <div className="mb-3">
            <label htmlFor="currentPassword" className="form-label">
              Current (temporary) password
            </label>
            <input
              id="currentPassword"
              type="password"
              className="form-control"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="newPassword" className="form-label">
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              className="form-control"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="confirmPassword" className="form-label">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              className="form-control"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary w-100" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default FirstPasswordChangePage
