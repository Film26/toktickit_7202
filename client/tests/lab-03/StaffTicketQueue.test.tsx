import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/auth/AuthContext'
import ItStaffDashboardPage from '../../src/pages/ItStaffDashboardPage'

// Covers Issue #44 (IT Staff Ticket Queue: sort + pagination parity) --
// client-side: sort control wired to a re-fetch with sort/order query
// params, and pagination controls appear/work when there is more than one
// page.

const IT_STAFF = {
  id: 2,
  email: 'itstaff@toktickit.dev',
  fullName: 'Ivy ITStaff',
  role: 'IT_STAFF',
  mustChangePassword: false,
}

function jsonResponse(body: unknown) {
  return {
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => body,
  }
}

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    ticketNumber: 'TKT-2026-000001',
    summary: 'Sample ticket',
    status: 'NEW',
    requestedPriority: 'MEDIUM',
    itPriority: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    category: { id: 1, name: 'Hardware' },
    owner: null,
    requester: { id: 3, fullName: 'Rachel Requester' },
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ItStaffDashboardPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('ItStaffDashboardPage - sort and pagination (Issue #44)', () => {
  beforeEach(() => {
    localStorage.setItem('toktickit.token', 'fake-token')
  })
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('selecting a sort option re-fetches with the matching sort/order query params', async () => {
    const fetchMock = vi.fn((url: string) => {
      const path = url.replace('http://localhost:4000', '')
      if (path.startsWith('/api/auth/me')) return Promise.resolve(jsonResponse({ user: IT_STAFF }))
      if (path.startsWith('/api/categories')) return Promise.resolve(jsonResponse([{ id: 1, name: 'Hardware' }]))
      if (path.startsWith('/api/tickets')) {
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

    await userEvent.selectOptions(screen.getByLabelText('Sort tickets'), 'IT Priority (A-Z)')

    await waitFor(() => {
      const calledWithSort = fetchMock.mock.calls.some(
        ([url]: [string]) =>
          typeof url === 'string' &&
          url.includes('/api/tickets') &&
          url.includes('sort=itPriority') &&
          url.includes('order=asc'),
      )
      expect(calledWithSort).toBe(true)
    })
  })

  it('shows pagination controls and requests the next page on click', async () => {
    const fetchMock = vi.fn((url: string) => {
      const path = url.replace('http://localhost:4000', '')
      if (path.startsWith('/api/auth/me')) return Promise.resolve(jsonResponse({ user: IT_STAFF }))
      if (path.startsWith('/api/categories')) return Promise.resolve(jsonResponse([]))
      if (path.startsWith('/api/tickets')) {
        return Promise.resolve(
          jsonResponse({ tickets: [ticket()], pagination: { page: 1, pageSize: 10, totalCount: 25, totalPages: 3 } }),
        )
      }
      return Promise.resolve(jsonResponse([]))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderPage()

    const nextButton = await screen.findByRole('button', { name: /Next/ })
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled()

    await userEvent.click(nextButton)

    await waitFor(() => {
      const calledWithPage2 = fetchMock.mock.calls.some(
        ([url]: [string]) => typeof url === 'string' && url.includes('/api/tickets') && url.includes('page=2'),
      )
      expect(calledWithPage2).toBe(true)
    })
  })

  it('does not show pagination controls when everything fits on one page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const path = url.replace('http://localhost:4000', '')
        if (path.startsWith('/api/auth/me')) return Promise.resolve(jsonResponse({ user: IT_STAFF }))
        if (path.startsWith('/api/categories')) return Promise.resolve(jsonResponse([]))
        if (path.startsWith('/api/tickets')) {
          return Promise.resolve(
            jsonResponse({ tickets: [ticket()], pagination: { page: 1, pageSize: 10, totalCount: 1, totalPages: 1 } }),
          )
        }
        return Promise.resolve(jsonResponse([]))
      }),
    )

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('TKT-2026-000001')).toBeInTheDocument()
    })
    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument()
  })

  it('shows the no-filter empty message when the queue is genuinely empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const path = url.replace('http://localhost:4000', '')
        if (path.startsWith('/api/auth/me')) return Promise.resolve(jsonResponse({ user: IT_STAFF }))
        if (path.startsWith('/api/categories')) return Promise.resolve(jsonResponse([]))
        if (path.startsWith('/api/tickets')) {
          return Promise.resolve(jsonResponse({ tickets: [], pagination: { page: 1, pageSize: 10, totalCount: 0, totalPages: 1 } }))
        }
        return Promise.resolve(jsonResponse([]))
      }),
    )

    renderPage()

    expect(await screen.findByText('No tickets in the queue.')).toBeInTheDocument()
  })
})
