import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { fetchActiveRequesters, type ActiveRequester } from '../api/requesters'
import { ApiError } from '../api/client'
import ErrorAlert from '../components/ErrorAlert'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'

// Lab 2's seeded Requester test accounts and their known (non-secret) local
// dev passwords - see server/prisma/seed.ts and the root README. This lets
// the selector sign a chosen Requester in through the app's real
// authentication (POST /api/auth/login) rather than bypassing it: there is
// no separate "fake session" mechanism, no new backend auth path, and no
// endpoint that hands out credentials. If an account isn't in this map (e.g.
// a Requester an Administrator created later, with an unknown generated
// password), it simply can't be auto-signed-in here - the note below the
// dropdown says so, and the real Login page is always the fallback.
const DEV_REQUESTER_CREDENTIALS: Record<string, string> = {
  'requester@toktickit.dev': 'Requester123!',
}

function DevRequesterSelectPage() {
  const { user, login } = useAuth()
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
  const knownPassword = selected ? DEV_REQUESTER_CREDENTIALS[selected.email] : undefined

  const handleContinue = async () => {
    if (!selected || !knownPassword) return
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      await login(selected.email, knownPassword)
      navigate('/dashboard')
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Unable to sign in as this Development Requester.')
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
            Choose a Development Requester to test requester-specific ticket behavior. This is a testing
            convenience: selecting a Requester signs you in through the same secure sign-in as the rest of the
            app (using that seeded account's credentials), not a separate mechanism.
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

              {selected && !knownPassword && (
                <p className="text-muted small">
                  No stored test credentials for this account. Use the <Link to="/login">Login page</Link> directly
                  instead.
                </p>
              )}

              <button
                type="button"
                className="btn btn-primary w-100"
                disabled={!selected || !knownPassword || isSubmitting}
                onClick={handleContinue}
              >
                {isSubmitting ? 'Signing in...' : 'Continue'}
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
