import { expect, test } from '@playwright/test'
import { API_BASE_URL, USERS, api, createInProgressTicket, loginThroughUi, logout } from './fixtures'

// E2E-03 (docs/lab-04/tests.md; AC-10, AC-11, AC-25). The resolution gate
// blocks Resolve while work is open (in the UI and directly against the API),
// the ticket resolves once the work is completed, and the Requester closes
// the loop with Confirm Resolution. Status History records each step.

test('Resolution gate, resolve, Requester confirmation, status history', async ({ page, request }) => {
  const ticket = await createInProgressTicket(request, `E2E resolution ${Date.now()}`)
  await api(request, ticket.staffToken, 'POST', `/api/tickets/${ticket.id}/actions`, {
    description: 'Reset the user profile',
  })

  await test.step('Resolve is disabled with the reason while an action is open', async () => {
    await loginThroughUi(page, USERS.staff)
    await page.goto(`/tickets/${ticket.id}`)
    await page.getByLabel('Resolution Summary').fill('Profile reset fixed it')
    await expect(page.getByRole('button', { name: 'Resolve Ticket' })).toBeDisabled()
    await expect(page.getByText(/Can't resolve yet: 1 action is still open/)).toBeVisible()
  })

  await test.step('The backend enforces the same gate for a client that bypasses the screen', async () => {
    const response = await request.post(`${API_BASE_URL}/api/tickets/${ticket.id}/resolve`, {
      headers: { Authorization: `Bearer ${ticket.staffToken}` },
      data: { resolutionSummary: 'bypass' },
    })
    expect(response.status()).toBe(409)
    expect((await response.json()).code).toBe('RESOLUTION_GATE')
  })

  await test.step('Completing the action through the UI unlocks Resolve', async () => {
    await page.getByRole('button', { name: 'Go to Actions Taken' }).click()
    await page.getByRole('button', { name: /View or edit action: Reset the user profile/ }).click()
    await page.getByLabel(/^Result/).fill('Profile rebuilt; Outlook opens normally')
    await page.getByRole('button', { name: 'Mark Completed' }).click()
    await expect(page.getByRole('row', { name: /Reset the user profile/ }).getByText('Completed')).toBeVisible()

    await expect(page.getByLabel('Resolution Summary')).toHaveValue('Profile reset fixed it') // input kept
    await expect(page.getByRole('button', { name: 'Resolve Ticket' })).toBeEnabled()
    await page.getByRole('button', { name: 'Resolve Ticket' }).click()
    await expect(page.getByText('Resolved', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Close Ticket' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mark Waiting' })).toHaveCount(0)
  })

  await test.step('Actions are locked after resolution', async () => {
    await expect(page.getByText('Actions are read-only once a ticket is Resolved, Closed or Cancelled.')).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Add Action' })).toHaveCount(0)
  })

  await test.step('The Requester confirms the resolution and the ticket closes', async () => {
    await logout(page)
    await loginThroughUi(page, USERS.requester)
    await page.goto(`/tickets/${ticket.id}`)
    await page.getByRole('button', { name: 'Confirm Resolution' }).click()
    await expect(page.getByRole('button', { name: 'Request Reopening' })).toBeVisible()

    await page.getByRole('button', { name: 'Status History' }).click()
    const history = page.getByRole('list', { name: /Status history/ })
    await expect(history.getByRole('listitem')).toHaveCount(4) // Created, -> In Progress, -> Resolved, -> Closed
    await expect(history.getByRole('listitem').last()).toContainText(`by ${USERS.requester.name}`)
  })
})
