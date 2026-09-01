import path from 'node:path'
import { expect, test } from '@playwright/test'

// End-to-end Lab 2 flow, run against the REAL dev-mode app (dev API +
// client dev servers, backed by the existing dev Postgres DB). Every step
// depends on the state left by the previous one, so this is one long test
// rather than several independent ones - see playwright.config.ts
// (workers: 1, fullyParallel: false) for why that ordering is safe.

const TICKET_NUMBER_PATTERN = /^TKT-\d{4}-\d{6}$/
const marker = `E2E ${Date.now()}`
const summary = `${marker} Wi-Fi drops every few minutes`
const description = `${marker} - the office Wi-Fi disconnects roughly every ten minutes and requires a manual reconnect.`

test('Requester ticket lifecycle: dev-select -> create -> my tickets -> detail -> attachment', async ({ page }) => {
  let ticketNumber = ''

  await test.step('Dev Requester Selector: pick an active Requester with no password', async () => {
    await page.goto('/dev-requester-select')

    await expect(page.getByRole('option', { name: 'Rachel Requester' })).toBeAttached()
    await page.getByLabel('Development Requester').selectOption({ label: 'Rachel Requester' })

    // this screen must never collect or send a password
    await expect(page.locator('input[type="password"]')).toHaveCount(0)

    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'My Tickets' })).toBeVisible()
  })

  await test.step('Create Ticket: fill the full Requester-facing form and submit', async () => {
    await page.getByRole('link', { name: 'Create Ticket', exact: true }).click()
    await expect(page).toHaveURL(/\/tickets\/new$/)

    await page.locator('#category').selectOption({ label: 'Hardware' })
    await page.locator('#relatedSystem').selectOption({ label: 'Corporate Laptop' })
    await page.getByLabel(/^Summary/).fill(summary)
    await page.getByLabel(/^Description/).fill(description)
    await page.locator('#requestedPriority').selectOption('HIGH')

    await page.getByRole('button', { name: 'Submit Ticket' }).click()

    // on success, CreateTicketPage navigates straight to the new ticket's detail page
    await expect(page).toHaveURL(/\/tickets\/\d+$/)
    const ticketNumberLocator = page.getByText(TICKET_NUMBER_PATTERN)
    await expect(ticketNumberLocator).toBeVisible()
    ticketNumber = (await ticketNumberLocator.textContent())?.trim() ?? ''
    expect(ticketNumber).toMatch(TICKET_NUMBER_PATTERN)
  })

  await test.step('My Tickets: the just-created ticket appears when searched for', async () => {
    await page.getByRole('link', { name: 'TokTickIT' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    await page.getByLabel('Search tickets').fill(marker)
    // TicketTable renders each <tr role="button" ...>, which overrides the
    // implicit "row" role - so the accessible role to query by is "button"
    await expect(page.getByRole('button', { name: new RegExp(ticketNumber) })).toBeVisible()
    await expect(page.getByText(summary)).toBeVisible()
  })

  await test.step('Ticket Detail: read-only fields match what was submitted, then manage an attachment', async () => {
    await page.getByRole('button', { name: new RegExp(ticketNumber) }).click()
    await expect(page).toHaveURL(/\/tickets\/\d+$/)

    await expect(page.getByText(ticketNumber)).toBeVisible()
    await expect(page.getByText('Hardware')).toBeVisible()
    await expect(page.getByText('Corporate Laptop')).toBeVisible()
    await expect(page.getByText(summary)).toBeVisible()
    await expect(page.getByText(description)).toBeVisible()
    await expect(page.getByText('High', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: /Attachments/ }).click()

    const fixturePath = path.join(__dirname, 'fixtures', 'test-attachment.png')
    await page.locator('input[type="file"]').setInputFiles(fixturePath)
    await page.getByRole('button', { name: 'Upload' }).click()

    await expect(page.getByText('test-attachment.png')).toBeVisible()
    const attachmentRow = page.locator('li', { hasText: 'test-attachment.png' })
    await expect(attachmentRow.getByRole('button', { name: 'Download' })).toBeVisible()
    await expect(attachmentRow.getByRole('button', { name: 'Remove' })).toBeVisible()

    await attachmentRow.getByRole('button', { name: 'Remove' }).click()
    await page.getByPlaceholder('Reason for removal...').fill('End-to-end test cleanup')
    await page.getByRole('button', { name: 'Confirm removal' }).click()

    await expect(page.getByText(/Removed by Rachel Requester/)).toBeVisible()
    await expect(attachmentRow.getByRole('button', { name: 'Download' })).toHaveCount(0)
    await expect(attachmentRow.getByRole('button', { name: 'Remove' })).toHaveCount(0)
  })
})
