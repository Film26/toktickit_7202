import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/auth/AuthContext'
import RequesterDashboardPage from '../../src/pages/RequesterDashboardPage'

const REQUESTER = {
  id: 3,
  email: 'requester@toktickit.dev',
  fullName: 'Rachel Requester',
  role: 'REQUESTER',
  mustChangePassword: false,
}

function jsonResponse(body: unknown) {
  return {
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => body,
  }
}

function ticket(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    ticketNumber: 'TKT-2026-000001',
    summary: 'Test ticket',
    status: 'NEW',
    requestedPriority: 'MEDIUM',
    itPriority: null,
    createdAt: new Date().toISOString(),
    category: { id: 1, name: 'Hardware' },
    owner: null,
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <RequesterDashboardPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('RequesterDashboardPage / My Tickets (Lab 2)', () => {
  beforeEach(() => {
    localStorage.setItem('toktickit.token', 'fake-token')
  })
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('renders the ticket list from the API, including ticket number, summary, and status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const path = url.replace('http://localhost:4000', '')
        if (path === '/api/auth/me') return Promise.resolve(jsonResponse({ user: REQUESTER }))
        if (path.startsWith('/api/tickets/mine')) {
          return Promise.resolve(
            jsonResponse({
              tickets: [ticket()],
              pagination: { page: 1, pageSize: 10, totalCount: 1, totalPages: 1 },
            }),
          )
        }
        return Promise.resolve(jsonResponse([]))
      }),
    )

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('TKT-2026-000001')).toBeInTheDocument()
    })
    expect(screen.getByText('Test ticket')).toBeInTheDocument()
  })

  it('sends the search text as a query param, debounced, and re-renders the filtered result', async () => {
    const fetchMock = vi.fn((url: string) => {
      const path = url.replace('http://localhost:4000', '')
      if (path === '/api/auth/me') return Promise.resolve(jsonResponse({ user: REQUESTER }))
      if (path.includes('search=printer')) {
        return Promise.resolve(
          jsonResponse({
            tickets: [ticket({ id: 2, ticketNumber: 'TKT-2026-000002', summary: 'Printer jam' })],
            pagination: { page: 1, pageSize: 10, totalCount: 1, totalPages: 1 },
          }),
        )
      }
      if (path.startsWith('/api/tickets/mine')) {
        return Promise.resolve(
          jsonResponse({ tickets: [ticket()], pagination: { page: 1, pageSize: 10, totalCount: 1, totalPages: 1 } }),
        )
      }
      return Promise.resolve(jsonResponse([]))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('TKT-2026-000001')).toBeInTheDocument()
    })

    await userEvent.type(screen.getByLabelText('Search tickets'), 'printer')

    await waitFor(
      () => {
        expect(screen.getByText('TKT-2026-000002')).toBeInTheDocument()
      },
      { timeout: 2000 },
    )
    expect(screen.queryByText('TKT-2026-000001')).not.toBeInTheDocument()

    const sawSearchParam = fetchMock.mock.calls.some(([url]) => String(url).includes('search=printer'))
    expect(sawSearchParam).toBe(true)
  })

  it('re-fetches with the status filter applied when a status button is clicked', async () => {
    const fetchMock = vi.fn((url: string) => {
      const path = url.replace('http://localhost:4000', '')
      if (path === '/api/auth/me') return Promise.resolve(jsonResponse({ user: REQUESTER }))
      if (path.includes('status=CLOSED')) {
        return Promise.resolve(
          jsonResponse({
            tickets: [ticket({ id: 3, ticketNumber: 'TKT-2026-000003', status: 'CLOSED' })],
            pagination: { page: 1, pageSize: 10, totalCount: 1, totalPages: 1 },
          }),
        )
      }
      return Promise.resolve(
        jsonResponse({ tickets: [ticket()], pagination: { page: 1, pageSize: 10, totalCount: 1, totalPages: 1 } }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('TKT-2026-000001')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: 'Closed' }))

    await waitFor(() => {
      expect(screen.getByText('TKT-2026-000003')).toBeInTheDocument()
    })
    expect(screen.queryByText('TKT-2026-000001')).not.toBeInTheDocument()
  })

  it('shows the zero-tickets empty state when the account has no tickets', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const path = url.replace('http://localhost:4000', '')
        if (path === '/api/auth/me') return Promise.resolve(jsonResponse({ user: REQUESTER }))
        return Promise.resolve(
          jsonResponse({ tickets: [], pagination: { page: 1, pageSize: 10, totalCount: 0, totalPages: 1 } }),
        )
      }),
    )

    renderPage()

    expect(await screen.findByText("You don't have any tickets yet. Create one to get started.")).toBeInTheDocument()
  })
})
