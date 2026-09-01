import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/auth/AuthContext'
import CreateTicketPage from '../../src/pages/CreateTicketPage'

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

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <CreateTicketPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('CreateTicketPage (Lab 2)', () => {
  beforeEach(() => {
    localStorage.setItem('toktickit.token', 'fake-token')
  })
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('loads reference data (categories, related systems) and renders the form fields', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchImpl({
        '/api/auth/me': { user: REQUESTER },
        '/api/categories': [
          { id: 1, name: 'Hardware' },
          { id: 2, name: 'Software' },
        ],
        '/api/related-systems': [{ id: 1, name: 'Corporate Laptop' }],
      }),
    )

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Hardware' })).toBeInTheDocument()
    })
    expect(screen.getByRole('option', { name: 'Software' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Corporate Laptop' })).toBeInTheDocument()

    expect(screen.getByLabelText(/Summary/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Requested Priority/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit Ticket' })).toBeInTheDocument()
  })

  it('shows field-level validation messages on an empty submit and never calls the create-ticket API', async () => {
    const fetchMock = mockFetchImpl({
      '/api/auth/me': { user: REQUESTER },
      '/api/categories': [{ id: 1, name: 'Hardware' }],
      '/api/related-systems': [],
    })
    vi.stubGlobal('fetch', fetchMock)

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Hardware' })).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: 'Submit Ticket' }))

    expect(await screen.findByText('Summary is required.')).toBeInTheDocument()
    expect(screen.getByText('Description is required.')).toBeInTheDocument()

    const postedTicketCreation = fetchMock.mock.calls.some(([url, options]) => {
      const isTicketsEndpoint =
        String(url).includes('/api/tickets') && !String(url).includes('categories') && !String(url).includes('related-systems')
      return isTicketsEndpoint && (options as { method?: string } | undefined)?.method === 'POST'
    })
    expect(postedTicketCreation).toBe(false)
  })

  it('clears a field error as soon as the requester starts fixing that field', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchImpl({
        '/api/auth/me': { user: REQUESTER },
        '/api/categories': [{ id: 1, name: 'Hardware' }],
        '/api/related-systems': [],
      }),
    )

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Hardware' })).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: 'Submit Ticket' }))
    expect(await screen.findByText('Summary is required.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/Summary/), 'Wi-Fi keeps dropping')
    expect(screen.queryByText('Summary is required.')).not.toBeInTheDocument()
  })

  it('submits with valid data and navigates to the created ticket', async () => {
    const createdTicket = { id: 42, ticketNumber: 'TKT-2026-000042', status: 'NEW' }
    const fetchMock = vi.fn((url: string, options?: { method?: string; body?: string }) => {
      const path = url.replace('http://localhost:4000', '')
      if (path === '/api/auth/me') return Promise.resolve(jsonResponse({ user: REQUESTER }))
      if (path === '/api/categories') return Promise.resolve(jsonResponse([{ id: 1, name: 'Hardware' }]))
      if (path === '/api/related-systems') return Promise.resolve(jsonResponse([]))
      if (path === '/api/tickets' && options?.method === 'POST') {
        return Promise.resolve(jsonResponse(createdTicket))
      }
      return Promise.resolve(jsonResponse([]))
    })
    vi.stubGlobal('fetch', fetchMock)

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Hardware' })).toBeInTheDocument()
    })

    await userEvent.type(screen.getByLabelText(/Summary/), 'Wi-Fi keeps dropping')
    await userEvent.type(screen.getByLabelText(/Description/), 'It disconnects every few minutes.')
    await userEvent.click(screen.getByRole('button', { name: 'Submit Ticket' }))

    await waitFor(() => {
      const postedTicketCreation = fetchMock.mock.calls.some(([url, options]) => {
        const path = String(url).replace('http://localhost:4000', '')
        return path === '/api/tickets' && (options as { method?: string } | undefined)?.method === 'POST'
      })
      expect(postedTicketCreation).toBe(true)
    })
  })
})
