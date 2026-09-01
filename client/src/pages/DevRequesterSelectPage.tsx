import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { fetchActiveRequesters, devSelectRequester, type ActiveRequester } from '../api/requesters'
import { ApiError } from '../api/client'
import ErrorAlert from '../components/ErrorAlert'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'

function DevRequesterSelectPage() {
  const { user, applySession } = useAuth()
  const navigate = useNavigate()

  const [requesters, setRequesters] = useState<ActiveRequester[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchActiveRequesters()
      .then((data) => {
        if (cancelled) return
        setRequesters(data)
        if (data.length > 0) setSelectedId(String(data[0].id))
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Unable to load Development Requesters.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (user) return <Navigate to="/dashboard" replace />

  const selected = requesters.find((r) => String(r.id) === selectedId)

  const handleContinue = async () => {
    if (!selected) return
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const response = await devSelectRequester(selected.id)
      applySession(response.token, response.user)
      navigate('/dashboard')
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Unable to continue as this Development Requester.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container" style={{ maxWidth: 480 }}>
      <div className="py-5">
        <h1 className="text-center mb-1">TokTickIT</h1>
        <p className="text-center text-muted mb-4">Select Development Requester</p>

        <div className="card p-4 shadow-sm">
          <p className="text-muted small">
            Select a Development Requester to test requester-specific ticket behavior. This is not a login
            screen: no password is collected or checked, and only active Requester accounts are offered.
            Authentication and role-based access will be introduced in Lab 3.
          </p>

          {loadError && <ErrorAlert message={loadError} />}
          {submitError && <ErrorAlert message={submitError} />}

          {isLoading ? (
            <LoadingSpinner />
          ) : loadError ? null : requesters.length === 0 ? (
            <EmptyState message="No active Development Requesters are available." />
          ) : (
            <>
              <div className="mb-3">
                <label htmlFor="requester" className="form-label">
                  Development Requester
                </label>
                <select
                  id="requester"
                  className="form-select"
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  {requesters.map((requester) => (
                    <option key={requester.id} value={requester.id}>
                      {requester.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="btn btn-primary w-100"
                disabled={!selected || isSubmitting}
                onClick={handleContinue}
              >
                {isSubmitting ? 'Continuing...' : 'Continue'}
              </button>
            </>
          )}

          <hr className="my-4" />
          <p className="text-muted small mb-0 text-center">
            Not testing as a Requester? <Link to="/login">Sign in normally</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}

export default DevRequesterSelectPage
