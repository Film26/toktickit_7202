import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/auth/AuthContext'
import StaffDashboardPage from '../../src/pages/StaffDashboardPage'
import TicketQueuePage from '../../src/pages/TicketQueuePage'
import NavBar from '../../src/components/NavBar'
import { ADMIN, REQUESTER, STAFF, mockApi, renderAt } from './helpers'

// Issue #68 -- IT Staff Dashboard UI, queue drill-down, navigation.
// UI-01, UI-02, UI-10, UI-11 in docs/lab-04/tests.md (AC-17, AC-19, AC-26).

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

const metric = (key: string, label: string, value: number, drillDown: string, todayDelta: number | null = null) => ({
  key,
  label,
  value,
  todayDelta,
  drillDown,
})

function staffPayload(overrides: Record<string, unknown> = {}) {
  return {
    generatedAt: '2026-10-07T03:00:00.000Z',
    timeZone: 'Asia/Bangkok',
    metrics: [
      metric('new', 'New', 14, '/queue?status=NEW', 3),
      metric('open', 'Open', 23, '/queue?status=OPEN', 0),
      metric('inProgress', 'In Progress', 18, '/queue?status=IN_PROGRESS', 1),
      metric('waitingForRequester', 'Waiting for Requester', 7, '/queue?status=WAITING_FOR_REQUESTER', 0),
      metric('myAssigned', 'My Assigned', 16, '/queue?ownerId=me&statusGroup=open'),
      metric('unassigned', 'Unassigned', 0, '/queue?ownerId=unassigned&statusGroup=open'),
    ],
    byItPriority: [
      { priority: 'URGENT', value: 2, drillDown: '/queue?statusGroup=open&itPriority=URGENT' },
      { priority: 'unset', value: 1, drillDown: '/queue?statusGroup=open&itPriority=unset' },
    ],
    recentTickets: [
      {
        id: 7,
        ticketNumber: 'TKT-2026-000234',
        summary: 'Laptop battery drains quickly',
        status: 'IN_PROGRESS',
        itPriority: 'HIGH',
        updatedAt: '2026-10-06T02:14:00.000Z',
        resolvedAt: null,
      },
    ],
    myOpenActions: {
      total: 1,
      items: [{ id: 3, ticketId: 7, ticketNumber: 'TKT-2026-000234', description: 'Install new battery', status: 'PLANNED', actionAt: '2026-10-07T02:00:00.000Z' }],
    },
    userCounts: null,
    ...overrides,
  }
}

describe('UI-01: IT Staff Dashboard content', () => {
  it('shows the greeting, all six metric cards with values, deltas and drill-down links', async () => {
    const { fetchMock } = mockApi({
      'GET /api/auth/me': { body: { user: STAFF } },
      'GET /api/dashboard/staff': { body: staffPayload() },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/dashboard', '/dashboard', <StaffDashboardPage />)

    expect(await screen.findByRole('heading', { name: 'Welcome back, Ivy!' })).toBeInTheDocument()
    expect(screen.getByTestId('metric-new')).toHaveTextContent('14')
    expect(screen.getByText('+3 today')).toBeInTheDocument()
    expect(screen.getByTestId('metric-myAssigned')).toHaveTextContent('16')
    expect(screen.getByTestId('metric-unassigned')).toHaveTextContent('0')
    expect(screen.getByText('Nothing here')).toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'View all New tickets' })).toHaveAttribute('href', '/queue?status=NEW')
    expect(screen.getByRole('link', { name: 'View all My Assigned tickets' })).toHaveAttribute('href', '/queue?ownerId=me&statusGroup=open')
    expect(screen.getByRole('link', { name: /2 open tickets with IT Priority urgent/ })).toHaveAttribute(
      'href',
      '/queue?statusGroup=open&itPriority=URGENT',
    )

    const recent = screen.getByRole('region', { name: 'My Recent Tickets' })
    expect(within(recent).getByRole('link', { name: 'TKT-2026-000234' })).toHaveAttribute('href', '/tickets/7')
    const actions = screen.getByRole('region', { name: /My Open Actions Taken/ })
    expect(within(actions).getByText('Install new battery')).toBeInTheDocument()
    expect(within(actions).getByText('Planned')).toBeInTheDocument()

    expect(screen.queryByRole('region', { name: 'User Accounts' })).not.toBeInTheDocument()
  })
})

describe('UI-02: states', () => {
  it('shows a loading state, then an error with Retry that recovers', async () => {
    let attempt = 0
    const { fetchMock } = mockApi({
      'GET /api/auth/me': { body: { user: STAFF } },
      'GET /api/dashboard/staff': () => {
        attempt += 1
        return attempt === 1 ? { status: 500, body: { error: 'Something went wrong. Please try again.' } } : { body: staffPayload() }
      },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/dashboard', '/dashboard', <StaffDashboardPage />)

    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument()
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByTestId('metric-new')).toHaveTextContent('14')
  })

  it('shows empty states for a staff member with nothing assigned', async () => {
    const { fetchMock } = mockApi({
      'GET /api/auth/me': { body: { user: STAFF } },
      'GET /api/dashboard/staff': { body: staffPayload({ recentTickets: [], myOpenActions: { total: 0, items: [] } }) },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/dashboard', '/dashboard', <StaffDashboardPage />)

    expect(await screen.findByText('No tickets are assigned to you yet.')).toBeInTheDocument()
    expect(screen.getByText('You have no open Actions Taken.')).toBeInTheDocument()
  })

  it('shows a forbidden message without Retry on 403', async () => {
    const { fetchMock } = mockApi({
      'GET /api/auth/me': { body: { user: STAFF } },
      'GET /api/dashboard/staff': { status: 403, body: { error: 'Insufficient permissions' } },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/dashboard', '/dashboard', <StaffDashboardPage />)

    expect(await screen.findByText('You do not have access to this dashboard.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('AC-19: an Administrator sees the User Accounts card', async () => {
    const { fetchMock } = mockApi({
      'GET /api/auth/me': { body: { user: ADMIN } },
      'GET /api/dashboard/staff': {
        body: staffPayload({ userCounts: { activeRequesters: 4, activeItStaff: 3, activeAdministrators: 1, inactive: 2 } }),
      },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/dashboard', '/dashboard', <StaffDashboardPage />)

    const card = await screen.findByRole('region', { name: 'User Accounts' })
    expect(within(card).getByText('Active Requesters').nextSibling).toHaveTextContent('4')
    expect(within(card).getByRole('link', { name: 'Manage users' })).toHaveAttribute('href', '/admin/users')
  })
})

describe('UI-10: Ticket Queue applies drill-down filters from the URL', () => {
  it('forwards status/owner/statusGroup/itPriority to the API and shows a clearable chip', async () => {
    const { fetchMock, calls } = mockApi({
      'GET /api/auth/me': { body: { user: STAFF } },
      'GET /api/categories': { body: [] },
      'GET /api/tickets': { body: { tickets: [], pagination: { page: 1, pageSize: 10, totalCount: 0, totalPages: 1 } } },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/queue?ownerId=me&statusGroup=open&itPriority=URGENT', '/queue', <TicketQueuePage />)

    await waitFor(() => expect(calls.some((c) => c.path.startsWith('/api/tickets?'))).toBe(true))
    const query = new URLSearchParams(calls.find((c) => c.path.startsWith('/api/tickets?'))!.path.split('?')[1])
    expect(query.get('ownerId')).toBe('me')
    expect(query.get('statusGroup')).toBe('open')
    expect(query.get('itPriority')).toBe('URGENT')

    expect(screen.getByText(/Filtered from dashboard: open tickets, IT Priority: Urgent/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'My Tickets' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() => {
      const last = new URLSearchParams(calls.filter((c) => c.path.startsWith('/api/tickets?')).at(-1)!.path.split('?')[1])
      expect(last.get('statusGroup')).toBeNull()
      expect(last.get('itPriority')).toBeNull()
    })
  })

  it('forwards an exact status from the URL', async () => {
    const { fetchMock, calls } = mockApi({
      'GET /api/auth/me': { body: { user: STAFF } },
      'GET /api/categories': { body: [] },
      'GET /api/tickets': { body: { tickets: [], pagination: { page: 1, pageSize: 10, totalCount: 0, totalPages: 1 } } },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/queue?status=WAITING_FOR_REQUESTER', '/queue', <TicketQueuePage />)

    await waitFor(() => expect(calls.some((c) => c.path.includes('status=WAITING_FOR_REQUESTER'))).toBe(true))
    expect(screen.getByRole('button', { name: 'Waiting for Requester' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('UI-11: role navigation with active-page indication', () => {
  function renderNav(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <NavBar />
        </AuthProvider>
      </MemoryRouter>,
    )
  }

  it.each([
    [STAFF, ['Dashboard', 'Ticket Queue']],
    [ADMIN, ['Dashboard', 'Ticket Queue', 'Users', 'Reference Data']],
    [REQUESTER, ['Dashboard', 'My Tickets', 'Create Ticket']],
  ])('%o sees exactly its links', async (user, links) => {
    localStorage.setItem('toktickit.token', 'fake-token')
    vi.stubGlobal('fetch', mockApi({ 'GET /api/auth/me': { body: { user } } }).fetchMock)
    renderNav('/dashboard')

    const nav = await screen.findByRole('navigation', { name: 'Main' })
    const names = within(within(nav).getByRole('list'))
      .getAllByRole('link')
      .map((link) => link.textContent)
    expect(names).toEqual(links)
    expect(screen.queryByRole('button', { name: 'Change Requester' })).not.toBeInTheDocument()
  })

  it('marks the current page with aria-current', async () => {
    localStorage.setItem('toktickit.token', 'fake-token')
    vi.stubGlobal('fetch', mockApi({ 'GET /api/auth/me': { body: { user: STAFF } } }).fetchMock)
    renderNav('/queue')

    expect(await screen.findByRole('link', { name: 'Ticket Queue' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
  })
})
