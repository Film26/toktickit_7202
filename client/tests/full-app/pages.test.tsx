import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/auth/AuthContext'
import RequesterDashboardPage from '../../src/pages/RequesterDashboardPage'
import CreateTicketPage from '../../src/pages/CreateTicketPage'
import ItStaffDashboardPage from '../../src/pages/ItStaffDashboardPage'
import TicketDetailView from '../../src/components/TicketDetailView'

const REQUESTER = {
  id: 3,
  email: 'requester@toktickit.dev',
  fullName: 'Rachel Requester',
  role: 'REQUESTER',
  mustChangePassword: false,
}

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

function mockFetchImpl(responses: Record<string, unknown>) {
  return vi.fn((url: string) => {
    const path = url.replace('http://localhost:4000', '')
    const matchedKey = Object.keys(responses)
      .sort((a, b) => b.length - a.length)
      .find((key) => path.startsWith(key))
    if (matchedKey) {
      return Promise.resolve(jsonResponse(responses[matchedKey]))
    }
    return Promise.resolve(jsonResponse([]))
  })
}

describe('RequesterDashboardPage', () => {
  beforeEach(() => {
    localStorage.setItem('toktickit.token', 'fake-token')
  })
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('renders the requester’s ticket list from the API', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchImpl({
        '/api/auth/me': { user: REQUESTER },
        '/api/tickets/mine': {
          tickets: [
            {
              id: 1,
              ticketNumber: 'TKT-2026-000001',
              summary: 'Test ticket',
              status: 'NEW',
              requestedPriority: 'MEDIUM',
              itPriority: null,
              createdAt: new Date().toISOString(),
              category: { id: 1, name: 'Hardware' },
              owner: null,
            },
          ],
          pagination: { page: 1, pageSize: 10, totalCount: 1, totalPages: 1 },
        },
      }),
    )

    render(
      <MemoryRouter>
        <AuthProvider>
          <RequesterDashboardPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('TKT-2026-000001')).toBeInTheDocument()
    })
  })

  it('re-fetches and re-renders when the status filter changes', async () => {
    const fetchMock = vi.fn((url: string) => {
      const path = url.replace('http://localhost:4000', '')
      if (path.startsWith('/api/auth/me')) return Promise.resolve(jsonResponse({ user: REQUESTER }))
      if (path.includes('status=RESOLVED')) {
        return Promise.resolve(
          jsonResponse({
            tickets: [
              {
                id: 2,
                ticketNumber: 'TKT-2026-000002',
                summary: 'Resolved ticket',
                status: 'RESOLVED',
                requestedPriority: 'LOW',
                itPriority: null,
                createdAt: new Date().toISOString(),
                category: { id: 1, name: 'Hardware' },
                owner: null,
              },
            ],
            pagination: { page: 1, pageSize: 10, totalCount: 1, totalPages: 1 },
          }),
        )
      }
      return Promise.resolve(
        jsonResponse({
          tickets: [
            {
              id: 1,
              ticketNumber: 'TKT-2026-000001',
              summary: 'New ticket',
              status: 'NEW',
              requestedPriority: 'MEDIUM',
              itPriority: null,
              createdAt: new Date().toISOString(),
              category: { id: 1, name: 'Hardware' },
              owner: null,
            },
          ],
          pagination: { page: 1, pageSize: 10, totalCount: 1, totalPages: 1 },
        }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter>
        <AuthProvider>
          <RequesterDashboardPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('TKT-2026-000001')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: 'Resolved' }))

    await waitFor(() => {
      expect(screen.getByText('TKT-2026-000002')).toBeInTheDocument()
    })
    expect(screen.queryByText('TKT-2026-000001')).not.toBeInTheDocument()
  })

  it('shows a distinct message when a filter matches nothing, vs. having no tickets at all', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchImpl({
        '/api/auth/me': { user: REQUESTER },
        '/api/tickets/mine': { tickets: [], pagination: { page: 1, pageSize: 10, totalCount: 0, totalPages: 1 } },
      }),
    )

    render(
      <MemoryRouter>
        <AuthProvider>
          <RequesterDashboardPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    // no filter active - the "you have zero tickets" message
    expect(await screen.findByText("You don't have any tickets yet. Create one to get started.")).toBeInTheDocument()

    // activate a status filter - the message must change to the no-results variant
    await userEvent.click(screen.getByRole('button', { name: 'Resolved' }))
    expect(await screen.findByText('No tickets match your search or filter.')).toBeInTheDocument()
  })
})

describe('CreateTicketPage', () => {
  beforeEach(() => {
    localStorage.setItem('toktickit.token', 'fake-token')
  })
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('renders the form with categories loaded from the API', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchImpl({
        '/api/auth/me': { user: REQUESTER },
        '/api/categories': [{ id: 1, name: 'Hardware' }],
        '/api/related-systems': [{ id: 1, name: 'Corporate Laptop' }],
      }),
    )

    render(
      <MemoryRouter>
        <AuthProvider>
          <CreateTicketPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Hardware' })).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Summary')).toBeInTheDocument()
  })
})

describe('ItStaffDashboardPage', () => {
  beforeEach(() => {
    localStorage.setItem('toktickit.token', 'fake-token')
  })
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('renders the all-tickets list including the requester column', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchImpl({
        '/api/auth/me': { user: IT_STAFF },
        '/api/categories': [{ id: 1, name: 'Hardware' }],
        '/api/tickets': [
          {
            id: 1,
            ticketNumber: 'TKT-2026-000001',
            summary: 'Test ticket',
            status: 'NEW',
            requestedPriority: 'MEDIUM',
            itPriority: null,
            createdAt: new Date().toISOString(),
            category: { id: 1, name: 'Hardware' },
            owner: null,
            requester: { id: 3, fullName: 'Rachel Requester' },
          },
        ],
      }),
    )

    render(
      <MemoryRouter>
        <AuthProvider>
          <ItStaffDashboardPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('TKT-2026-000001')).toBeInTheDocument()
    })
    expect(screen.getByText('Rachel Requester')).toBeInTheDocument()
  })
})

describe('TicketDetailView', () => {
  beforeEach(() => {
    localStorage.setItem('toktickit.token', 'fake-token')
  })
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('renders ticket details, comments, and actions for an IT staff viewer', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchImpl({
        '/api/auth/me': { user: IT_STAFF },
        '/api/users': [{ id: 2, email: 'itstaff@toktickit.dev', fullName: 'Ivy ITStaff', role: 'IT_STAFF', isActive: true, mustChangePassword: false, createdAt: '' }],
        '/api/tickets/1': {
          id: 1,
          ticketNumber: 'TKT-2026-000001',
          summary: 'Laptop battery drains quickly',
          description: 'Battery drains fast.',
          status: 'IN_PROGRESS',
          requestedPriority: 'MEDIUM',
          itPriority: 'HIGH',
          resolutionSummary: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          resolvedAt: null,
          closedAt: null,
          requester: { id: 3, fullName: 'Rachel Requester', email: 'requester@toktickit.dev' },
          owner: { id: 2, fullName: 'Ivy ITStaff', email: 'itstaff@toktickit.dev' },
          category: { id: 1, name: 'Hardware' },
          relatedSystem: { id: 1, name: 'Corporate Laptop' },
          publicComments: [
            { id: 1, body: 'A public comment', createdAt: new Date().toISOString(), author: { id: 3, fullName: 'Rachel Requester', role: 'REQUESTER' } },
          ],
          internalNotes: [],
          actionsTaken: [],
          attachments: [],
        },
      }),
    )

    render(
      <MemoryRouter initialEntries={['/tickets/1']}>
        <AuthProvider>
          <Routes>
            <Route path="/tickets/:id" element={<TicketDetailView backTo="/dashboard" backLabel="All Tickets" />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('TKT-2026-000001')).toBeInTheDocument()
    })
    expect(screen.getByText('A public comment')).toBeInTheDocument()
  })
})
