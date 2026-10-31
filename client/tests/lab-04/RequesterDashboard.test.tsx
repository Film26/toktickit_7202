import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RequesterDashboardPage from '../../src/pages/RequesterDashboardPage'
import MyTicketsPage from '../../src/pages/MyTicketsPage'
import { REQUESTER, mockApi, renderAt } from './helpers'

// Issue #68 -- Requester Dashboard UI and My Tickets drill-down.
// UI-03 and UI-10 in docs/lab-04/tests.md (AC-17, AC-26).

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

const card = (id: number, status: string, summary: string) => ({
  id,
  ticketNumber: `TKT-2026-00000${id}`,
  summary,
  status,
  itPriority: 'MEDIUM',
  updatedAt: '2026-10-06T05:00:00.000Z',
  resolvedAt: status === 'RESOLVED' ? '2026-10-06T05:00:00.000Z' : null,
})

function payload(overrides: Record<string, unknown> = {}) {
  return {
    generatedAt: '2026-10-07T03:00:00.000Z',
    timeZone: 'Asia/Bangkok',
    metrics: [
      { key: 'open', label: 'My Open Tickets', value: 3, todayDelta: null, drillDown: '/tickets?statusGroup=open' },
      { key: 'inProgress', label: 'In Progress', value: 2, todayDelta: null, drillDown: '/tickets?status=IN_PROGRESS' },
      { key: 'waitingForMe', label: 'Waiting for Me', value: 1, todayDelta: null, drillDown: '/tickets?status=WAITING_FOR_REQUESTER' },
      { key: 'resolved', label: 'Resolved', value: 5, todayDelta: null, drillDown: '/tickets?status=RESOLVED' },
      { key: 'closed', label: 'Closed', value: 12, todayDelta: null, drillDown: '/tickets?status=CLOSED' },
    ],
    attentionRequired: [card(2, 'WAITING_FOR_REQUESTER', 'Wi-Fi drops in meeting room')],
    recentTickets: [card(1, 'IN_PROGRESS', 'Laptop battery drains quickly'), card(2, 'WAITING_FOR_REQUESTER', 'Wi-Fi drops in meeting room')],
    recentlyResolved: [card(3, 'RESOLVED', 'Email not arriving')],
    ...overrides,
  }
}

describe('UI-03: Requester Dashboard', () => {
  it('shows the greeting, five metric cards, lists and quick actions', async () => {
    const { fetchMock } = mockApi({
      'GET /api/auth/me': { body: { user: REQUESTER } },
      'GET /api/dashboard/requester': { body: payload() },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/dashboard', '/dashboard', <RequesterDashboardPage />)

    expect(await screen.findByRole('heading', { name: 'Welcome, Rachel!' })).toBeInTheDocument()
    expect(screen.getByTestId('metric-open')).toHaveTextContent('3')
    expect(screen.getByTestId('metric-closed')).toHaveTextContent('12')
    expect(screen.getByRole('link', { name: 'View all Waiting for Me tickets' })).toHaveAttribute('href', '/tickets?status=WAITING_FOR_REQUESTER')

    const attention = screen.getByRole('region', { name: 'Needs Your Attention' })
    expect(within(attention).getByText('Wi-Fi drops in meeting room')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Recently Resolved' })).getByText('Email not arriving')).toBeInTheDocument()

    const quick = screen.getByRole('region', { name: 'Quick Actions' })
    expect(within(quick).getByRole('link', { name: /Create Ticket/ })).toHaveAttribute('href', '/tickets/new')
    expect(within(quick).getByRole('link', { name: /View My Tickets/ })).toHaveAttribute('href', '/tickets')
  })

  it('AC-17: a Requester with no tickets sees zeros and helpful empty states', async () => {
    const zeroMetrics = payload().metrics.map((m) => ({ ...m, value: 0 }))
    const { fetchMock } = mockApi({
      'GET /api/auth/me': { body: { user: REQUESTER } },
      'GET /api/dashboard/requester': { body: payload({ metrics: zeroMetrics, attentionRequired: [], recentTickets: [], recentlyResolved: [] }) },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/dashboard', '/dashboard', <RequesterDashboardPage />)

    expect(await screen.findByText("You haven't created any tickets yet.")).toBeInTheDocument()
    expect(screen.getByText('Nothing needs your attention right now.')).toBeInTheDocument()
    expect(screen.getAllByText('Nothing here')).toHaveLength(5)
  })

  it('shows a safe failure message with Retry', async () => {
    const { fetchMock } = mockApi({
      'GET /api/auth/me': { body: { user: REQUESTER } },
      'GET /api/dashboard/requester': { status: 500, body: { error: 'Something went wrong. Please try again.' } },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/dashboard', '/dashboard', <RequesterDashboardPage />)

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})

describe('UI-10: My Tickets applies drill-down filters from the URL', () => {
  it('forwards statusGroup=open and shows a clearable chip; a status button replaces it', async () => {
    const { fetchMock, calls } = mockApi({
      'GET /api/auth/me': { body: { user: REQUESTER } },
      'GET /api/tickets/mine': { body: { tickets: [], pagination: { page: 1, pageSize: 10, totalCount: 0, totalPages: 1 } } },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/tickets?statusGroup=open', '/tickets', <MyTicketsPage />)

    await waitFor(() => expect(calls.some((c) => c.path.includes('statusGroup=open'))).toBe(true))
    expect(screen.getByText(/Filtered from dashboard: open tickets/)).toBeInTheDocument()
    expect(screen.getByText('No tickets match your search or filter.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Closed' }))
    await waitFor(() => {
      const last = calls.filter((c) => c.path.startsWith('/api/tickets/mine')).at(-1)!.path
      expect(last).toContain('status=CLOSED')
      expect(last).not.toContain('statusGroup')
    })
    expect(screen.queryByText(/Filtered from dashboard/)).not.toBeInTheDocument()
  })
})
