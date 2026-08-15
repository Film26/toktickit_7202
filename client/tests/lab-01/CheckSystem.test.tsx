import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App'

describe('Check System', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the backend status after a successful health check', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok', service: 'TokTickIT API' }),
      }),
    )

    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Check System' }))

    await waitFor(() => {
      expect(screen.getByText(/System Status:/)).toBeInTheDocument()
      expect(screen.getByText('Online')).toBeInTheDocument()
    })
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
})