import { useState } from 'react'

type CheckState = 'idle' | 'loading' | 'success' | 'error'

type HealthResponse = {
  status: string
  service: string
}

type Category = {
  id: number
  name: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

function App() {
  const [checkState, setCheckState] = useState<CheckState>('idle')
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [categories, setCategories] = useState<Category[]>([])

  const checkSystem = async () => {
    setCheckState('loading')
    try {
      const [healthResponse, categoriesResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/health`),
        fetch(`${API_BASE_URL}/api/categories`),
      ])

      if (!healthResponse.ok || !categoriesResponse.ok) {
        throw new Error('Unexpected response')
      }

      const healthData: HealthResponse = await healthResponse.json()
      if (healthData.status !== 'ok') {
        throw new Error(`Unexpected status: ${healthData.status}`)
      }

      const categoriesData: Category[] = await categoriesResponse.json()

      setHealth(healthData)
      setCategories(categoriesData)
      setCheckState('success')
    } catch {
      setHealth(null)
      setCategories([])
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
        <div className="mt-3">
          <p>
            System Status: <strong>Online</strong>
          </p>
          <p className="mb-1">Supported Request Categories:</p>
          <ul>
            {categories.map((category) => (
              <li key={category.id}>{category.name}</li>
            ))}
          </ul>
        </div>
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
