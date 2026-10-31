import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/client'

// Loads a dashboard payload with loading / error / refresh states shared by
// both role dashboards (docs/lab-04/ui-spec.md sections 3-4).
export function useDashboard<T>(token: string | null, fetcher: (token: string) => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<{ message: string; status?: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!token) return
      if (mode === 'initial') setIsLoading(true)
      else setIsRefreshing(true)
      setError(null)
      try {
        setData(await fetcher(token))
      } catch (err) {
        setError(
          err instanceof ApiError
            ? { message: err.status === 403 ? 'You do not have access to this dashboard.' : err.message, status: err.status }
            : { message: 'Unable to load the dashboard. Check your connection and try again.' },
        )
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [token, fetcher],
  )

  useEffect(() => {
    void load('initial')
  }, [load])

  return { data, error, isLoading, isRefreshing, refresh: () => load('refresh') }
}
