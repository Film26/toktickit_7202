import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/auth/AuthContext'
import RequesterTicketDetailPage from '../../src/pages/RequesterTicketDetailPage'

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

const TICKET_DETAIL = {
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
  requester: { id: 3, fullName: 'Rachel Requester', email: 'requester@toktickit.dev' },
  owner: { id: 2, fullName: 'Ivy ITStaff', email: 'itstaff@toktickit.dev' },
  category: { id: 1, name: 'Hardware' },
  relatedSystem: { id: 1, name: 'Corporate Laptop' },
  publicComments: [],
  actionsTaken: [],
  attachments: [],
}

function mockFetchImpl(responses: Record<string, unknown>) {
  return vi.fn((url: string) => {
    const path = url.replace('http://localhost:4000', '')
    const matchedKey = Object.keys(responses)
      .sort((a, b) => b.length - a.length)
      .find((key) => path.startsWith(key))
    if (matchedKey) return Promise.resolve(jsonResponse(responses[matchedKey]))
    return Promise.resolve(jsonResponse([]))
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

describe('RequesterTicketDetailPage (Lab 2 - read-only fields)', () => {
  beforeEach(() => {
    localStorage.setItem('toktickit.token', 'fake-token')
  })
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('renders the ticket number, category, related system, requester, summary, and description', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchImpl({
        '/api/auth/me': { user: REQUESTER },
        '/api/tickets/1': TICKET_DETAIL,
      }),
    )

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('TKT-2026-000001')).toBeInTheDocument()
    })
    expect(screen.getByText('Hardware')).toBeInTheDocument()
    expect(screen.getByText('Corporate Laptop')).toBeInTheDocument()
    expect(screen.getByText('Rachel Requester')).toBeInTheDocument()
    expect(screen.getByText('Laptop battery drains quickly')).toBeInTheDocument()
    expect(screen.getByText('Battery drains fast even when idle.')).toBeInTheDocument()
    expect(screen.getByText('Ivy ITStaff')).toBeInTheDocument()
  })

  it('never renders an Internal Notes tab for the requester (staff-only field is absent from the payload)', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchImpl({
        '/api/auth/me': { user: REQUESTER },
        '/api/tickets/1': TICKET_DETAIL, // no internalNotes key, matching the real requester-facing API response
      }),
    )

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('TKT-2026-000001')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /Internal Notes/ })).not.toBeInTheDocument()
  })

  it('shows a placeholder when there is no resolution summary yet', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchImpl({
        '/api/auth/me': { user: REQUESTER },
        '/api/tickets/1': TICKET_DETAIL,
      }),
    )

    renderPage()

    expect(await screen.findByText('No resolution summary available yet.')).toBeInTheDocument()
  })

  it('shows a safe error state and a way back when the ticket cannot be loaded (e.g. 404 for someone else’s ticket)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const path = url.replace('http://localhost:4000', '')
        if (path === '/api/auth/me') return Promise.resolve(jsonResponse({ user: REQUESTER }))
        return Promise.resolve({
          ok: false,
          status: 404,
          headers: { get: () => 'application/json' },
          json: async () => ({ error: 'Ticket not found' }),
        })
      }),
    )

    renderPage()

    expect(await screen.findByText('Ticket not found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /My Tickets/ })).toBeInTheDocument()
  })
})
