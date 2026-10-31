import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import { AuthProvider } from '../../src/auth/AuthContext'

// Shared Lab 4 UI-test helpers: a route-keyed fetch mock that supports
// non-2xx responses and records every request body, plus a render wrapper
// with the real AuthProvider (fed by the mocked /api/auth/me).

export const STAFF = { id: 2, email: 'itstaff@toktickit.dev', fullName: 'Ivy ITStaff', role: 'IT_STAFF', mustChangePassword: false }
export const ADMIN = { id: 1, email: 'admin@toktickit.dev', fullName: 'Alex Administrator', role: 'ADMINISTRATOR', mustChangePassword: false }
export const REQUESTER = { id: 3, email: 'requester@toktickit.dev', fullName: 'Rachel Requester', role: 'REQUESTER', mustChangePassword: false }

export type MockReply = { status?: number; body: unknown } | ((request: { path: string; method: string; body: unknown }) => { status?: number; body: unknown })

export type Recorded = { path: string; method: string; body: unknown }

// routes: { 'GET /api/tickets/1': reply, 'POST /api/tickets/1/actions': reply, ... }
// Longest matching prefix wins; unmatched requests return 200 [].
export function mockApi(routes: Record<string, MockReply>) {
  const calls: Recorded[] = []
  const fetchMock = vi.fn((url: string, options?: { method?: string; body?: string }) => {
    const path = url.replace('http://localhost:4000', '')
    const method = (options?.method ?? 'GET').toUpperCase()
    const body = options?.body ? JSON.parse(options.body) : undefined
    calls.push({ path, method, body })

    const key = Object.keys(routes)
      .filter((candidate) => {
        const [m, p] = candidate.split(' ')
        return m === method && path.startsWith(p)
      })
      .sort((a, b) => b.length - a.length)[0]
    const route = key ? routes[key] : { body: [] }
    const reply = typeof route === 'function' ? route({ path, method, body }) : route
    const status = reply.status ?? 200
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => 'application/json' },
      json: async () => reply.body,
    })
  })
  return { fetchMock, calls }
}

export function renderAt(path: string, routePath: string, element: ReactElement) {
  localStorage.setItem('toktickit.token', 'fake-token')
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

export function baseTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    ticketNumber: 'TKT-2026-000001',
    summary: 'Laptop battery drains quickly',
    description: 'Battery drains fast even when idle.',
    status: 'IN_PROGRESS',
    requestedPriority: 'MEDIUM',
    itPriority: 'HIGH',
    resolutionSummary: null,
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-10-06T10:00:00.000Z',
    resolvedAt: null,
    closedAt: null,
    requesterAppearsResolvedAt: null,
    version: 3,
    requester: { id: 3, fullName: 'Rachel Requester', email: 'requester@toktickit.dev' },
    owner: { id: 2, fullName: 'Ivy ITStaff', email: 'itstaff@toktickit.dev' },
    category: { id: 1, name: 'Hardware' },
    relatedSystem: { id: 1, name: 'Corporate Laptop' },
    publicComments: [],
    internalNotes: [],
    actionsTaken: [],
    attachments: [],
    statusHistory: [],
    ...overrides,
  }
}

export function baseAction(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    ticketId: 1,
    actionAt: '2026-10-06T03:00:00.000Z',
    description: 'Ran the battery health report',
    result: null,
    status: 'PLANNED',
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    performedBy: { id: 2, fullName: 'Ivy ITStaff', role: 'IT_STAFF' },
    assignee: { id: 4, fullName: 'Marcus Tan', role: 'IT_STAFF' },
    version: 1,
    createdAt: '2026-10-06T03:00:00.000Z',
    updatedAt: '2026-10-06T03:00:00.000Z',
    completedAt: null,
    cancelledAt: null,
    ...overrides,
  }
}

export const OWNERS = [
  { id: 2, fullName: 'Ivy ITStaff' },
  { id: 4, fullName: 'Marcus Tan' },
  { id: 5, fullName: 'Sofia Rivera' },
]
