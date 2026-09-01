import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/auth/AuthContext'
import DevRequesterSelectPage from '../../src/pages/DevRequesterSelectPage'

function jsonResponse(body: unknown) {
  return {
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => body,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/dev-requester-select']}>
      <AuthProvider>
        <Routes>
          <Route path="/dev-requester-select" element={<DevRequesterSelectPage />} />
          <Route path="/dashboard" element={<div>Dashboard loaded</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('DevRequesterSelectPage', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('loads active Development Requesters and signs in through the real login endpoint on Continue', async () => {
    const loginCalls: Array<{ email: string; password: string }> = []

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, options?: { method?: string; body?: string }) => {
        const path = url.replace('http://localhost:4000', '')
        if (path === '/api/requesters') {
          return Promise.resolve(
            jsonResponse([{ id: 3, fullName: 'Rachel Requester', email: 'requester@toktickit.dev' }]),
          )
        }
        if (path === '/api/auth/login' && options?.method === 'POST') {
          const body = JSON.parse(options.body ?? '{}')
          loginCalls.push(body)
          return Promise.resolve(
            jsonResponse({
              token: 'fake-token',
              user: { id: 3, email: body.email, fullName: 'Rachel Requester', role: 'REQUESTER', mustChangePassword: false },
            }),
          )
        }
        return Promise.resolve(jsonResponse({}))
      }),
    )

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Rachel Requester' })).toBeInTheDocument()
    })

    const continueButton = screen.getByRole('button', { name: 'Continue' })
    expect(continueButton).not.toBeDisabled()

    await userEvent.click(continueButton)

    await waitFor(() => {
      expect(screen.getByText('Dashboard loaded')).toBeInTheDocument()
    })

    expect(loginCalls).toEqual([{ email: 'requester@toktickit.dev', password: 'Requester123!' }])
  })

  it('shows an empty state when no active Development Requesters exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const path = url.replace('http://localhost:4000', '')
        if (path === '/api/requesters') return Promise.resolve(jsonResponse([]))
        return Promise.resolve(jsonResponse({}))
      }),
    )

    renderPage()

    expect(await screen.findByText('No active Development Requesters are available.')).toBeInTheDocument()
  })

  it('shows a safe failure state when the requester list fails to load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const path = url.replace('http://localhost:4000', '')
        if (path === '/api/requesters') {
          return Promise.resolve({
            ok: false,
            status: 500,
            headers: { get: () => 'application/json' },
            json: async () => ({ error: 'Something went wrong' }),
          })
        }
        return Promise.resolve(jsonResponse({}))
      }),
    )

    renderPage()

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
  })
})
