import { expect, test } from '@playwright/test'
import { USERS, createInProgressTicket, loginThroughUi, logout } from './fixtures'

// E2E-01, E2E-02 (docs/lab-04/tests.md; AC-03, AC-07, AC-24).
// IT Staff plan an action for another staff member, edit it, hit the
// completion validation, complete it; the Requester then sees it read-only.

test('Actions Taken: plan, assign, edit, complete; Requester sees it read-only', async ({ page, request }) => {
  const marker = `E2E actions ${Date.now()}`
  const ticket = await createInProgressTicket(request, marker)

  await test.step('IT Staff opens the ticket and the Actions Taken tab', async () => {
    await loginThroughUi(page, USERS.staff)
    await page.goto(`/tickets/${ticket.id}`)
    await page.getByRole('button', { name: /^Actions Taken 0/ }).click()
    await expect(page.getByText('No Actions Taken recorded yet.')).toBeVisible()
  })

  await test.step('Create: blank description is caught inline, then a Planned action is saved for Marcus', async () => {
    await page.getByRole('button', { name: '+ Add Action' }).click()
    await expect(page.getByRole('heading', { name: 'Add Action Taken' })).toBeFocused()
    await page.getByRole('button', { name: 'Save Action' }).click()
    await expect(page.getByText('Action Description is required')).toBeVisible()

    await page.getByLabel(/Action Description/).fill('Replace the docking station')
    await page.getByLabel('Assigned To').selectOption({ label: USERS.marcus.name })
    await page.getByLabel('Follow-Up Required?').check()
    await page.getByRole('button', { name: 'Save Action' }).click()
    await expect(page.getByText('Follow-Up Note is required when follow-up is needed')).toBeVisible()
    await page.getByLabel(/Follow-Up Note/).fill('Check the monitor firmware afterwards')
    await page.getByLabel('Attachment Notes').fill('See dock-photo.png in Attachments')
    await page.getByRole('button', { name: 'Save Action' }).click()

    const row = page.getByRole('row', { name: /Replace the docking station/ })
    await expect(row).toBeVisible()
    await expect(row.getByText(USERS.staff.name)).toBeVisible() // Performed By (auto)
    await expect(row.getByText(USERS.marcus.name)).toBeVisible() // Assigned To
    await expect(row.getByText('Planned')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Actions Taken 1/ })).toBeVisible()
  })

  await test.step('Edit, then Mark Completed requires a Result', async () => {
    await page.getByRole('button', { name: /View or edit action: Replace the docking station/ }).click()
    await page.getByLabel(/Action Description/).fill('Replace the docking station (USB-C model)')
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByRole('row', { name: /USB-C model/ })).toBeVisible()

    await page.getByRole('button', { name: /View or edit action: Replace the docking station/ }).click()
    await page.getByRole('button', { name: 'Mark Completed' }).click()
    await expect(page.getByText('Result is required to complete an action')).toBeVisible()
    await page.getByLabel(/^Result/).fill('New dock works with both monitors')
    await page.getByRole('button', { name: 'Mark Completed' }).click()

    const row = page.getByRole('row', { name: /USB-C model/ })
    await expect(row.getByText('Completed')).toBeVisible()
    await expect(row.getByText('New dock works with both monitors')).toBeVisible()
    await expect(row.getByRole('button', { name: /^View action/ })).toBeVisible() // no longer editable
  })

  await test.step('The Requester sees the action with every field, read-only', async () => {
    await logout(page)
    await loginThroughUi(page, USERS.requester)
    await page.goto(`/tickets/${ticket.id}`)
    await page.getByRole('button', { name: /^Actions Taken 1/ }).click()

    const row = page.getByRole('row', { name: /USB-C model/ })
    await expect(row.getByText('New dock works with both monitors')).toBeVisible()
    await expect(row.getByText(USERS.marcus.name)).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Add Action' })).toHaveCount(0)

    await row.getByRole('button', { name: /^View action/ }).click()
    await expect(page.getByLabel(/Action Description/)).toBeDisabled()
    await expect(page.getByLabel('Attachment Notes')).toHaveValue('See dock-photo.png in Attachments')
    await expect(page.getByRole('button', { name: /Save/ })).toHaveCount(0)
  })
})
