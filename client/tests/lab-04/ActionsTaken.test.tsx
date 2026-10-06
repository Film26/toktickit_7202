import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ItStaffTicketDetailPage from '../../src/pages/ItStaffTicketDetailPage'
import RequesterTicketDetailPage from '../../src/pages/RequesterTicketDetailPage'
import { OWNERS, REQUESTER, STAFF, baseAction, baseTicket, mockApi, renderAt } from './helpers'

// Issue #66 -- Actions Taken area on Ticket Detail.
// UI-04..UI-07 in docs/lab-04/tests.md (AC-08, AC-24).

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

async function openActionsTab() {
  await userEvent.click(await screen.findByRole('button', { name: /^Actions Taken/ }))
}

function renderStaff() {
  return renderAt('/tickets/1', '/tickets/:id', <ItStaffTicketDetailPage />)
}

describe('Actions Taken list (UI-04, UI-07)', () => {
  it('lists every field for each action, in the order returned', async () => {
    const actions = [
      baseAction({ id: 10, description: 'First action', status: 'COMPLETED', result: 'Worked', followUpRequired: true, followUpNote: 'Check again Friday' }),
      baseAction({ id: 11, description: 'Second action', status: 'PLANNED' }),
    ]
    const { fetchMock } = mockApi({
      'GET /api/auth/me': { body: { user: STAFF } },
      'GET /api/tickets/assignable-owners': { body: OWNERS },
      'GET /api/tickets/1': { body: baseTicket({ actionsTaken: actions }) },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderStaff()
    await openActionsTab()

    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('First action')).toBeInTheDocument()
    expect(within(rows[0]).getByText('Worked')).toBeInTheDocument()
    expect(within(rows[0]).getByText('Completed')).toBeInTheDocument()
    expect(within(rows[0]).getByText('Check again Friday')).toBeInTheDocument()
    expect(within(rows[0]).getByText('Ivy ITStaff')).toBeInTheDocument()
    expect(within(rows[0]).getByText('Marcus Tan')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Second action')).toBeInTheDocument()
  })

  it('UI-07: a Requester sees the actions read-only, with no Add or Edit controls', async () => {
    const { fetchMock } = mockApi({
      'GET /api/auth/me': { body: { user: REQUESTER } },
      'GET /api/tickets/1': { body: baseTicket({ actionsTaken: [baseAction()] }) },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/tickets/1', '/tickets/:id', <RequesterTicketDetailPage />)
    await openActionsTab()

    expect((await screen.findAllByText('Ran the battery health report')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: '+ Add Action' })).not.toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('button', { name: /^View action/ })[0])
    expect(screen.getByRole('heading', { name: 'Action Taken' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Save/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Action Description/)).toBeDisabled()
  })

  it('shows the empty state and hides Add Action on a Resolved ticket', async () => {
    const { fetchMock } = mockApi({
      'GET /api/auth/me': { body: { user: STAFF } },
      'GET /api/tickets/assignable-owners': { body: OWNERS },
      'GET /api/tickets/1': { body: baseTicket({ status: 'RESOLVED' }) },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderStaff()
    await openActionsTab()

    expect(await screen.findByText('No Actions Taken recorded yet.')).toBeInTheDocument()
    expect(screen.getByText(/read-only once a ticket is Resolved/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Add Action' })).not.toBeInTheDocument()
  })
})

describe('Create mode validation and failure handling (UI-04, UI-05)', () => {
  it('UI-04: shows inline errors under the fields and sends nothing when invalid', async () => {
    const { fetchMock, calls } = mockApi({
      'GET /api/auth/me': { body: { user: STAFF } },
      'GET /api/tickets/assignable-owners': { body: OWNERS },
      'GET /api/tickets/1': { body: baseTicket() },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderStaff()
    await openActionsTab()
    await userEvent.click(await screen.findByRole('button', { name: '+ Add Action' }))

    expect(screen.getByRole('heading', { name: 'Add Action Taken' })).toHaveFocus()
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'COMPLETED')
    await userEvent.click(screen.getByLabelText('Follow-Up Required?'))
    await userEvent.click(screen.getByRole('button', { name: 'Save Action' }))

    expect(screen.getByText('Action Description is required')).toBeInTheDocument()
    expect(screen.getByText('Result is required to complete an action')).toBeInTheDocument()
    expect(screen.getByText('Follow-Up Note is required when follow-up is needed')).toBeInTheDocument()
    expect(screen.getByLabelText(/Action Description/)).toHaveAttribute('aria-invalid', 'true')
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0)
  })

  it('UI-05: keeps entered values after a server failure and maps server field errors', async () => {
    const { fetchMock } = mockApi({
      'GET /api/auth/me': { body: { user: STAFF } },
      'GET /api/tickets/assignable-owners': { body: OWNERS },
      'GET /api/tickets/1': { body: baseTicket() },
      'POST /api/tickets/1/actions': {
        status: 400,
        body: { error: 'Please correct the highlighted fields', code: 'VALIDATION_ERROR', fields: { assigneeId: 'Assigned To must be an active IT Staff or Administrator user' } },
      },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderStaff()
    await openActionsTab()
    await userEvent.click(await screen.findByRole('button', { name: '+ Add Action' }))

    await userEvent.type(screen.getByLabelText(/Action Description/), 'Swap the battery')
    await userEvent.type(screen.getByLabelText('Attachment Notes'), 'see battery.pdf')
    await userEvent.click(screen.getByRole('button', { name: 'Save Action' }))

    expect(await screen.findByText('Assigned To must be an active IT Staff or Administrator user')).toBeInTheDocument()
    expect(screen.getByLabelText(/Action Description/)).toHaveValue('Swap the battery')
    expect(screen.getByLabelText('Attachment Notes')).toHaveValue('see battery.pdf')
  })

  it('UI-05: disables Save while saving and reuses the same clientRequestId on retry', async () => {
    let attempt = 0
    const { fetchMock, calls } = mockApi({
      'GET /api/auth/me': { body: { user: STAFF } },
      'GET /api/tickets/assignable-owners': { body: OWNERS },
      'GET /api/tickets/1': { body: baseTicket() },
      'POST /api/tickets/1/actions': () => {
        attempt += 1
        return attempt === 1 ? { status: 500, body: { error: 'Something went wrong. Please try again.' } } : { status: 201, body: baseAction() }
      },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderStaff()
    await openActionsTab()
    await userEvent.click(await screen.findByRole('button', { name: '+ Add Action' }))
    await userEvent.type(screen.getByLabelText(/Action Description/), 'Swap the battery')

    await userEvent.click(screen.getByRole('button', { name: 'Save Action' }))
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Action Description/)).toHaveValue('Swap the battery')

    await userEvent.click(screen.getByRole('button', { name: 'Save Action' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Add Action Taken' })).not.toBeInTheDocument())

    const posts = calls.filter((c) => c.method === 'POST')
    expect(posts).toHaveLength(2)
    const [first, second] = posts.map((c) => c.body as { clientRequestId: string; performedBy?: unknown })
    expect(first.clientRequestId).toBeTruthy()
    expect(second.clientRequestId).toBe(first.clientRequestId)
    expect(first).not.toHaveProperty('performedBy')
  })
})

describe('View / Edit mode (UI-06)', () => {
  it('sends the version with an edit and opens Completed actions read-only', async () => {
    const { fetchMock, calls } = mockApi({
      'GET /api/auth/me': { body: { user: STAFF } },
      'GET /api/tickets/assignable-owners': { body: OWNERS },
      'GET /api/tickets/1': {
        body: baseTicket({ actionsTaken: [baseAction({ id: 10, version: 4 }), baseAction({ id: 11, description: 'Done one', status: 'COMPLETED', result: 'ok' })] }),
      },
      'PATCH /api/tickets/1/actions/10': { body: baseAction({ version: 5 }) },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderStaff()
    await openActionsTab()

    const table = await screen.findByRole('table')
    await userEvent.click(within(table).getByRole('button', { name: /View action: Done one/ }))
    expect(screen.getByText('This action is Completed and can no longer be edited.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    await userEvent.click(within(table).getByRole('button', { name: /View or edit action: Ran the battery/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true))
    expect(calls.find((c) => c.method === 'PATCH')!.body).toMatchObject({ status: 'IN_PROGRESS', version: 4 })
  })

  it('UI-06 / AC-08: a 409 STALE_UPDATE shows the conflict alert with Reload and keeps the edit', async () => {
    const { fetchMock } = mockApi({
      'GET /api/auth/me': { body: { user: STAFF } },
      'GET /api/tickets/assignable-owners': { body: OWNERS },
      'GET /api/tickets/1': { body: baseTicket({ actionsTaken: [baseAction()] }) },
      'PATCH /api/tickets/1/actions/10': {
        status: 409,
        body: { error: 'This action was changed by someone else.', code: 'STALE_UPDATE', current: baseAction({ version: 2 }) },
      },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderStaff()
    await openActionsTab()

    const table = await screen.findByRole('table')
    await userEvent.click(within(table).getByRole('button', { name: /View or edit/ }))
    const description = screen.getByLabelText(/Action Description/)
    await userEvent.clear(description)
    await userEvent.type(description, 'My newer wording')
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByText(/changed by someone else/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Action Description/)).toHaveValue('My newer wording')
  })

  it('Mark Completed without a Result switches the status and asks for the Result', async () => {
    const { fetchMock, calls } = mockApi({
      'GET /api/auth/me': { body: { user: STAFF } },
      'GET /api/tickets/assignable-owners': { body: OWNERS },
      'GET /api/tickets/1': { body: baseTicket({ actionsTaken: [baseAction()] }) },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderStaff()
    await openActionsTab()

    const table = await screen.findByRole('table')
    await userEvent.click(within(table).getByRole('button', { name: /View or edit/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Mark Completed' }))

    expect(screen.getByText('Result is required to complete an action')).toBeInTheDocument()
    expect(screen.getByLabelText('Status')).toHaveValue('COMPLETED')
    expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(0)
  })
})
