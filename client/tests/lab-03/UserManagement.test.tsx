import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/auth/AuthContext'
import UserManagementPage from '../../src/pages/UserManagementPage'

// Covers Issue #45 (Administrator safety rules) client-side requirements:
// the role filter control, and disabling self-deactivation on the signed-in
// Administrator's own row (BR-16).

const ADMIN = {
  id: 1,
  email: 'admin@toktickit.dev',
  fullName: 'Alex Administrator',
  role: 'ADMINISTRATOR',
  mustChangePassword: false,
}

const OTHER_ADMIN = {
  id: 2,
  email: 'other-admin@toktickit.dev',
  fullName: 'Other Admin',
  role: 'ADMINISTRATOR',
  isActive: true,
  mustChangePassword: false,
  createdAt: new Date().toISOString(),
}

const SELF_ROW = {
  id: 1,
  email: 'admin@toktickit.dev',
  fullName: 'Alex Administrator',
  role: 'ADMINISTRATOR',
  isActive: true,
  mustChangePassword: false,
  createdAt: new Date().toISOString(),
}

function jsonResponse(body: unknown) {
  return {
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => body,
  }
}

describe('UserManagementPage (Lab 3)', () => {
  beforeEach(() => {
    localStorage.setItem('toktickit.token', 'fake-token')
  })
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('disables the Deactivate control on the signed-in Administrator\'s own row', async () => {
    const fetchMock = vi.fn((url: string) => {
      const path = url.replace('http://localhost:4000', '')
      if (path.startsWith('/api/auth/me')) return Promise.resolve(jsonResponse({ user: ADMIN }))
      if (path.startsWith('/api/users')) return Promise.resolve(jsonResponse([SELF_ROW, OTHER_ADMIN]))
      return Promise.resolve(jsonResponse([]))
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter>
        <AuthProvider>
          <UserManagementPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Alex Administrator')).toBeInTheDocument()
    })

    const rows = screen.getAllByRole('row')
    const selfRow = rows.find((row) => row.textContent?.includes('Alex Administrator'))
    const otherRow = rows.find((row) => row.textContent?.includes('Other Admin'))
    expect(selfRow).toBeDefined()
    expect(otherRow).toBeDefined()

    const selfDeactivateButton = selfRow?.querySelector('button.btn-outline-danger') as HTMLButtonElement
    const otherDeactivateButton = otherRow?.querySelector('button.btn-outline-danger') as HTMLButtonElement

    expect(selfDeactivateButton).toBeDisabled()
    expect(otherDeactivateButton).not.toBeDisabled()
  })

  it('offers a role filter and re-fetches the user list with the selected role', async () => {
    const fetchMock = vi.fn((url: string) => {
      const path = url.replace('http://localhost:4000', '')
      if (path.startsWith('/api/auth/me')) return Promise.resolve(jsonResponse({ user: ADMIN }))
      if (path.startsWith('/api/users')) return Promise.resolve(jsonResponse([SELF_ROW]))
      return Promise.resolve(jsonResponse([]))
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter>
        <AuthProvider>
          <UserManagementPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Alex Administrator')).toBeInTheDocument()
    })

    const roleFilter = screen.getByLabelText('Filter by role')
    await userEvent.selectOptions(roleFilter, 'ADMINISTRATOR')

    await waitFor(() => {
      const calledWithRoleFilter = fetchMock.mock.calls.some(
        ([url]: [string]) => typeof url === 'string' && url.includes('/api/users') && url.includes('role=ADMINISTRATOR'),
      )
      expect(calledWithRoleFilter).toBe(true)
    })
  })
})
