import { useState } from 'react'

type CheckState = 'idle' | 'loading' | 'success' | 'error'

type HealthResponse = {
  status: string
  service: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

function App() {
  const [checkState, setCheckState] = useState<CheckState>('idle')
  const [health, setHealth] = useState<HealthResponse | null>(null)

  const checkSystem = async () => {
    setCheckState('loading')
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`)
      if (!response.ok) {
        throw new Error(`Unexpected response: ${response.status}`)
      }
      const data: HealthResponse = await response.json()
      setHealth(data)
      setCheckState('success')
    } catch {
      setHealth(null)
      setCheckState('error')
    }
  }

  return (
    <div className="container py-5">
      <h1 className="mb-3">TokTickIT</h1>
      <p className="text-muted">IT Service Desk</p>
      <button
        type="button"
        className="btn btn-primary"
        onClick={checkSystem}
        disabled={checkState === 'loading'}
      >
        Check System
      </button>

      {checkState === 'loading' && <p className="mt-3">⏳ Loading...</p>}

      {checkState === 'success' && health && (
        <p className="mt-3">
          System Status: <strong>{health.status === 'ok' ? 'Online' : health.status}</strong>
        </p>
      )}

      {checkState === 'error' && (
        <div className="mt-3">
          <p className="mb-1">
            System Status: <strong>Offline</strong>
          </p>
          <p className="text-danger">Unable to connect to TokTickIT API</p>
        </div>
      )}
    </div>
  )
}

export default App