import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/auth/AuthContext'
import RequesterTicketDetailPage from '../../src/pages/RequesterTicketDetailPage'

// Covers Issue #43 ("Problem Appears Resolved") client-side requirements:
// the toggle's visibility to the owning Requester only, and that it is
// visually distinct from (does not replace) Confirm/Reject Resolution.

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

function baseTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    ticketNumber: 'TKT-2026-000001',
    summary: 'Laptop battery drains quickly',
    description: 'Battery drains fast even when idle.',
    status: 'IN_PROGRESS',
    requestedPriority: 'MEDIUM',
    itPriority: 'HIGH',
    resolutionSummary: null,
    createdAt: new Date('2026-01-15T10:00:00Z').toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: null,
    closedAt: null,
    requesterAppearsResolvedAt: null,
    requester: { id: 3, fullName: 'Rachel Requester', email: 'requester@toktickit.dev' },
    owner: { id: 2, fullName: 'Ivy ITStaff', email: 'itstaff@toktickit.dev' },
    category: { id: 1, name: 'Hardware' },
    relatedSystem: { id: 1, name: 'Corporate Laptop' },
    publicComments: [],
    actionsTaken: [],
    attachments: [],
    ...overrides,
  }
}

function mockFetchImpl(responses: Record<string, unknown>) {
  return vi.fn((url: string, options?: { method?: string }) => {
    const path = url.replace('http://localhost:4000', '')
    const method = (options?.method ?? 'GET').toUpperCase()
    const matchedKey = Object.keys(responses)
      .sort((a, b) => b.length - a.length)
      .find((key) => path.startsWith(key))
    if (!matchedKey) return Promise.resolve(jsonResponse([]))

    let body = responses[matchedKey]
    if (body && typeof body === 'object' && !Array.isArray(body) && method in (body as Record<string, unknown>)) {
      body = (body as Record<string, unknown>)[method]
    }
    return Promise.resolve(jsonResponse(body))
  })
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/tickets/1']}>
      <AuthProvider>
        <Routes>
          <Route path="/tickets/:id" element={<RequesterTicketDetailPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('RequesterTicketDetailPage - Problem Appears Resolved (Issue #43)', () => {
  beforeEach(() => {
    localStorage.setItem('toktickit.token', 'fake-token')
  })
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('shows "Mark as Appears Resolved" on an open ticket, separate from Confirm/Reject Resolution', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchImpl({
        '/api/auth/me': { user: REQUESTER },
        '/api/tickets/1': { GET: baseTicket() },
      }),
    )

    renderPage()

    expect(await screen.findByRole('button', { name: 'Mark as Appears Resolved' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm Resolution' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reject Resolution' })).not.toBeInTheDocument()
  })

  it('does not show the toggle once the ticket is formally Resolved', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchImpl({
        '/api/auth/me': { user: REQUESTER },
        '/api/tickets/1': { GET: baseTicket({ status: 'RESOLVED', resolutionSummary: 'Fixed.' }) },
      }),
    )

    renderPage()

    expect(await screen.findByRole('button', { name: 'Confirm Resolution' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark as Appears Resolved' })).not.toBeInTheDocument()
  })

  it('toggling the flag calls the appears-resolved endpoint and flips the button label', async () => {
    let flagged = false
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, options?: { method?: string }) => {
        const path = url.replace('http://localhost:4000', '')
        const method = (options?.method ?? 'GET').toUpperCase()
        if (path === '/api/auth/me') return Promise.resolve(jsonResponse({ user: REQUESTER }))
        if (path === '/api/tickets/1/requester-appears-resolved' && method === 'PATCH') {
          flagged = true
          return Promise.resolve(jsonResponse(baseTicket({ requesterAppearsResolvedAt: new Date().toISOString() })))
        }
        if (path === '/api/tickets/1') {
          return Promise.resolve(
            jsonResponse(flagged ? baseTicket({ requesterAppearsResolvedAt: new Date().toISOString() }) : baseTicket()),
          )
        }
        return Promise.resolve(jsonResponse([]))
      }),
    )

    renderPage()

    const toggle = await screen.findByRole('button', { name: 'Mark as Appears Resolved' })
    await userEvent.click(toggle)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Undo Appears Resolved' })).toBeInTheDocument()
    })
    expect(screen.getByText('Appears Resolved')).toBeInTheDocument()
  })
})
