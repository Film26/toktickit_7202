import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { changePassword } from '../api/auth'
import { ApiError } from '../api/client'
import { hasMinLength, hasNumberAndSpecialChar, hasUpperAndLowerCase, isPasswordValid } from '../lib/passwordPolicy'
import ErrorAlert from '../components/ErrorAlert'
import PasswordInput from '../components/PasswordInput'
import { CheckIcon } from '../components/icons'

function RequirementItem({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <li className={`d-flex align-items-center gap-2 ${met ? 'text-success' : 'text-muted'}`}>
      <span
        className={`d-inline-flex align-items-center justify-content-center rounded-circle ${met ? 'bg-success text-white' : 'border'}`}
        style={{ width: 18, height: 18, flexShrink: 0 }}
      >
        {met && <CheckIcon />}
      </span>
      {children}
    </li>
  )
}

function FirstPasswordChangePage() {
  const { token, user, setUser } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const meetsLength = hasMinLength(newPassword)
  const meetsCase = hasUpperAndLowerCase(newPassword)
  const meetsNumberAndSpecial = hasNumberAndSpecialChar(newPassword)
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword
  const canSubmit = isPasswordValid(newPassword) && passwordsMatch

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!isPasswordValid(newPassword)) {
      setError('New password does not meet the requirements below.')
      return
    }
    if (!passwordsMatch) {
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

          <PasswordInput
            id="currentPassword"
            label="Current (temporary) password"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
            required
          />

          <PasswordInput
            id="newPassword"
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            required
          />

          <PasswordInput
            id="confirmPassword"
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            required
          />

          <div className="alert alert-light border mb-3">
            <p className="fw-semibold mb-2">Password must:</p>
            <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
              <RequirementItem met={meetsLength}>Be at least 8 characters</RequirementItem>
              <RequirementItem met={meetsCase}>Include upper and lower case letters</RequirementItem>
              <RequirementItem met={meetsNumberAndSpecial}>Include a number and a special character</RequirementItem>
            </ul>
          </div>

          <button type="submit" className="btn btn-primary w-100" disabled={isSubmitting || !canSubmit}>
            {isSubmitting ? 'Saving...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default FirstPasswordChangePage
