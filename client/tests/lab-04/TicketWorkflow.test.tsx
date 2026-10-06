import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ItStaffTicketDetailPage from '../../src/pages/ItStaffTicketDetailPage'
import RequesterTicketDetailPage from '../../src/pages/RequesterTicketDetailPage'
import { allowedCommands } from '../../src/lib/ticketWorkflow'
import { OWNERS, REQUESTER, STAFF, baseAction, baseTicket, mockApi, renderAt } from './helpers'

// Issue #67 -- Ticket workflow UI. UI-08, UI-09 in docs/lab-04/tests.md (AC-25).

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

const WORKFLOW_BUTTONS = [
  'Start Progress',
  'Acknowledge',
  'Cancel Ticket',
  'Mark Waiting',
  'Resume Progress',
  'Close Ticket',
  'Confirm Resolution',
  'Reject Resolution',
  'Request Reopening',
  'Resolve Ticket',
]

function visibleWorkflowButtons() {
  return WORKFLOW_BUTTONS.filter((name) => screen.queryByRole('button', { name }))
}

describe('UI-08: status controls match the transition matrix for role and status', () => {
  it.each([
    ['NEW', ['Start Progress', 'Acknowledge', 'Cancel Ticket']],
    ['OPEN', ['Start Progress', 'Cancel Ticket']],
    ['IN_PROGRESS', ['Mark Waiting', 'Resolve Ticket']],
    ['WAITING_FOR_REQUESTER', ['Resume Progress', 'Resolve Ticket']],
    ['RESOLVED', ['Close Ticket']],
    ['CLOSED', []],
    ['REOPENED', ['Start Progress', 'Acknowledge']],
    ['CANCELLED', []],
  ])('IT Staff on a %s ticket sees exactly %o', async (status, expected) => {
    const { fetchMock } = mockApi({
      'GET /api/auth/me': { body: { user: STAFF } },
      'GET /api/tickets/assignable-owners': { body: OWNERS },
      'GET /api/tickets/1': { body: baseTicket({ status }) },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/tickets/1', '/tickets/:id', <ItStaffTicketDetailPage />)
    await screen.findByText('TKT-2026-000001')

    expect(visibleWorkflowButtons().sort()).toEqual([...expected].sort())
  })

  it.each([
    ['IN_PROGRESS', []],
    ['RESOLVED', ['Confirm Resolution', 'Reject Resolution']],
    ['CLOSED', ['Request Reopening']],
  ])('a Requester on a %s ticket sees exactly %o', async (status, expected) => {
    const { fetchMock } = mockApi({
      'GET /api/auth/me': { body: { user: REQUESTER } },
      'GET /api/tickets/1': { body: baseTicket({ status }) },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/tickets/1', '/tickets/:id', <RequesterTicketDetailPage />)
    await screen.findByText('TKT-2026-000001')

    expect(visibleWorkflowButtons().sort()).toEqual([...expected].sort())
  })

  it('a Requester never gets a staff transition from the helper', () => {
    for (const status of ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED', 'CANCELLED'] as const) {
      expect(allowedCommands(status, 'REQUESTER')).toEqual([])
    }
  })
})

describe('UI-09: resolution gate guidance, version, refresh', () => {
  it('disables Resolve with the reasons while an action is open, and links to Actions Taken', async () => {
    const { fetchMock } = mockApi({
      'GET /api/auth/me': { body: { user: STAFF } },
      'GET /api/tickets/assignable-owners': { body: OWNERS },
      'GET /api/tickets/1': { body: baseTicket({ actionsTaken: [baseAction({ status: 'PLANNED' })] }) },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/tickets/1', '/tickets/:id', <ItStaffTicketDetailPage />)

    await userEvent.type(await screen.findByLabelText('Resolution Summary'), 'Fixed')
    expect(screen.getByRole('button', { name: 'Resolve Ticket' })).toBeDisabled()
    expect(screen.getByText(/1 action is still open and no action has been completed yet/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Go to Actions Taken' }))
    expect(screen.getByRole('button', { name: '+ Add Action' })).toBeInTheDocument()
  })

  it('resolves with the ticket version, then refreshes the status badge and history', async () => {
    let resolved = false
    const completed = baseAction({ status: 'COMPLETED', result: 'Fixed' })
    const { fetchMock, calls } = mockApi({
      'GET /api/auth/me': { body: { user: STAFF } },
      'GET /api/tickets/assignable-owners': { body: OWNERS },
      'GET /api/tickets/1': () => ({
        body: resolved
          ? baseTicket({
              status: 'RESOLVED',
              version: 4,
              resolutionSummary: 'Replaced battery',
              actionsTaken: [completed],
              statusHistory: [
                { id: 1, fromStatus: null, toStatus: 'NEW', changedBy: REQUESTER, createdAt: '2026-10-06T01:00:00Z' },
                { id: 2, fromStatus: 'IN_PROGRESS', toStatus: 'RESOLVED', changedBy: STAFF, createdAt: '2026-10-06T02:00:00Z' },
              ],
            })
          : baseTicket({ actionsTaken: [completed] }),
      }),
      'POST /api/tickets/1/resolve': () => {
        resolved = true
        return { body: baseTicket({ status: 'RESOLVED' }) }
      },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/tickets/1', '/tickets/:id', <ItStaffTicketDetailPage />)

    await userEvent.type(await screen.findByLabelText('Resolution Summary'), 'Replaced battery')
    await userEvent.click(screen.getByRole('button', { name: 'Resolve Ticket' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Close Ticket' })).toBeInTheDocument())
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ resolutionSummary: 'Replaced battery', version: 3 })
    expect(screen.getByRole('status')).toHaveTextContent('Status changed to Resolved')
    expect(screen.queryByLabelText('Resolution Summary')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Status History' }))
    const history = screen.getByRole('list', { name: /Status history/ })
    expect(within(history).getAllByRole('listitem')).toHaveLength(2)
    expect(within(history).getByText(/by Ivy ITStaff/)).toBeInTheDocument()
  })

  it('a 409 STALE_UPDATE on a transition shows the conflict alert with Reload', async () => {
    const { fetchMock } = mockApi({
      'GET /api/auth/me': { body: { user: STAFF } },
      'GET /api/tickets/assignable-owners': { body: OWNERS },
      'GET /api/tickets/1': { body: baseTicket({ status: 'NEW' }) },
      'PATCH /api/tickets/1/status': { status: 409, body: { error: 'This ticket was changed by someone else.', code: 'STALE_UPDATE' } },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/tickets/1', '/tickets/:id', <ItStaffTicketDetailPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Acknowledge' }))
    expect(await screen.findByText(/changed by someone else. Reload/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })

  it('FR-17: a failed comment keeps the typed text', async () => {
    const { fetchMock } = mockApi({
      'GET /api/auth/me': { body: { user: REQUESTER } },
      'GET /api/tickets/1': { body: baseTicket() },
      'POST /api/tickets/1/comments': { status: 500, body: { error: 'Something went wrong. Please try again.' } },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/tickets/1', '/tickets/:id', <RequesterTicketDetailPage />)

    const input = await screen.findByLabelText('Type your comment here...')
    await userEvent.type(input, 'Still broken after restart')
    await userEvent.click(screen.getByRole('button', { name: 'Post Comment' }))

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument()
    expect(input).toHaveValue('Still broken after restart')
  })
})
