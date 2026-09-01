import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/auth/AuthContext'
import UserManagementPage from '../../src/pages/UserManagementPage'
import ReferenceDataManagementPage from '../../src/pages/ReferenceDataManagementPage'

const ADMIN = {
  id: 1,
  email: 'admin@toktickit.dev',
  fullName: 'Alex Administrator',
  role: 'ADMINISTRATOR',
  mustChangePassword: false,
}

function jsonResponse(body: unknown) {
  return {
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => body,
  }
}

/**
 * Maps "PATH" -> body (used for any method), or "PATH" -> { GET: ..., POST: ... }
 * when the same path needs different responses per HTTP method.
 */
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

describe('UserManagementPage', () => {
  beforeEach(() => {
    localStorage.setItem('toktickit.token', 'fake-token')
  })
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('renders the user list and allows creating a user', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchImpl({
        '/api/auth/me': { user: ADMIN },
        '/api/users': {
          GET: [
            {
              id: 3,
              email: 'requester@toktickit.dev',
              fullName: 'Rachel Requester',
              role: 'REQUESTER',
              isActive: true,
              mustChangePassword: false,
              createdAt: new Date().toISOString(),
            },
          ],
          POST: {
            user: {
              id: 99,
              email: 'new-person@toktickit.dev',
              fullName: 'New Person',
              role: 'REQUESTER',
              isActive: true,
              mustChangePassword: true,
              createdAt: new Date().toISOString(),
            },
            temporaryPassword: 'Temp123!xyz',
          },
        },
      }),
    )

    render(
      <MemoryRouter>
        <AuthProvider>
          <UserManagementPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Rachel Requester')).toBeInTheDocument()
    })

    await userEvent.type(screen.getByLabelText('Full name'), 'New Person')
    await userEvent.type(screen.getByLabelText('Email'), 'new-person@toktickit.dev')
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(screen.getByText('Temp123!xyz')).toBeInTheDocument()
    })
  })
})

describe('ReferenceDataManagementPage', () => {
  beforeEach(() => {
    localStorage.setItem('toktickit.token', 'fake-token')
  })
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('renders categories and related systems including inactive ones', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchImpl({
        '/api/auth/me': { user: ADMIN },
        '/api/categories/manage': [
          { id: 1, name: 'Hardware', isActive: true, createdAt: new Date().toISOString() },
          { id: 2, name: 'Retired Category', isActive: false, createdAt: new Date().toISOString() },
        ],
        '/api/related-systems/manage': [
          { id: 1, name: 'Corporate Laptop', isActive: true, createdAt: new Date().toISOString() },
        ],
      }),
    )

    render(
      <MemoryRouter>
        <AuthProvider>
          <ReferenceDataManagementPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Hardware')).toBeInTheDocument()
    })
    expect(screen.getByText('Retired Category')).toBeInTheDocument()
    expect(screen.getByText('Corporate Laptop')).toBeInTheDocument()
  })
})
