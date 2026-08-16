import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App'

type FetchResult = { ok: boolean; json: () => Promise<unknown> }

function mockFetch(overrides: { health?: FetchResult; categories?: FetchResult } = {}) {
  const health = overrides.health ?? {
    ok: true,
    json: async () => ({ status: 'ok', service: 'TokTickIT API' }),
  }
  const categories = overrides.categories ?? {
    ok: true,
    json: async () => [],
  }

  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.includes('/api/categories')) return Promise.resolve(categories)
      return Promise.resolve(health)
    }),
  )
}

describe('Check System', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the backend status after a successful health check', async () => {
    mockFetch()

    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Check System' }))

    await waitFor(() => {
      expect(screen.getByText(/System Status:/)).toBeInTheDocument()
      expect(screen.getByText('Online')).toBeInTheDocument()
    })
  })

  it('shows a loading state while the check is in progress', async () => {
    let resolveHealth: (value: FetchResult) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<FetchResult>((resolve) => {
            resolveHealth = resolve
          }),
      ),
    )

    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Check System' }))

    expect(screen.getByText(/Loading/)).toBeInTheDocument()

    resolveHealth({ ok: true, json: async () => ({ status: 'ok', service: 'TokTickIT API' }) })
  })

  it('shows a useful error message when the backend is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Check System' }))

    await waitFor(() => {
      expect(screen.getByText('Offline')).toBeInTheDocument()
      expect(screen.getByText('Unable to connect to TokTickIT API')).toBeInTheDocument()
    })
  })

  it('treats a 200 response with a non-ok status as offline', async () => {
    mockFetch({
      health: { ok: true, json: async () => ({ status: 'degraded', service: 'TokTickIT API' }) },
    })

    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Check System' }))

    await waitFor(() => {
      expect(screen.getByText('Offline')).toBeInTheDocument()
      expect(screen.queryByText('Online')).not.toBeInTheDocument()
    })
  })
})

describe('Category list', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the categories returned by the API, not hard-coded values', async () => {
    mockFetch({
      categories: {
        ok: true,
        json: async () => [
          { id: 1, name: 'Account and Access' },
          { id: 2, name: 'Hardware' },
          { id: 3, name: 'Software' },
          { id: 4, name: 'Network' },
        ],
      },
    })

    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Check System' }))

    await waitFor(() => {
      expect(screen.getByText('Account and Access')).toBeInTheDocument()
      expect(screen.getByText('Hardware')).toBeInTheDocument()
      expect(screen.getByText('Software')).toBeInTheDocument()
      expect(screen.getByText('Network')).toBeInTheDocument()
    })
  })

  it('shows the offline state and no category list when the categories request fails', async () => {
    mockFetch({ categories: { ok: false, json: async () => ({}) } })

    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Check System' }))

    await waitFor(() => {
      expect(screen.getByText('Offline')).toBeInTheDocument()
      expect(screen.queryByText('Supported Request Categories:')).not.toBeInTheDocument()
    })
  })
})
