import { expect, test } from '@playwright/test'
import { apiCreateTicket, apiFetchCategories, apiLogin } from './fixtures/api'

// Lab 3 IT Staff Ticket Queue + Ticket Detail E2E coverage (Issue #49 Part A).
// One continuous flow (like the Lab 2 spec) since each step depends on the
// ticket state left by the previous one - see playwright.config.ts
// (workers: 1, fullyParallel: false).

const marker = `E2E ${Date.now()}`
const summary = `${marker} Wi-Fi drops in the east wing`

test('IT Staff queue + ticket detail: search/sort, claim, IT Priority, status, comments, notes', async ({
  page,
  request,
}) => {
  let ticketId = 0
  let ticketNumber = ''

  await test.step('Seed a fresh ticket as the Requester via the API', async () => {
    const requesterToken = await apiLogin(request, 'requester@toktickit.dev', 'Requester123!')
    const categories = await apiFetchCategories(request)
    const category = categories.find((c) => c.name === 'Network') ?? categories[0]
    const created = await apiCreateTicket(request, requesterToken, {
      categoryId: category.id,
      summary,
      description: `${marker} - intermittent Wi-Fi drops reported by multiple people in the east wing.`,
      requestedPriority: 'HIGH',
    })
    ticketId = created.id
    ticketNumber = created.ticketNumber
  })

  await test.step('IT Staff logs in and lands on the queue', async () => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('itstaff@toktickit.dev')
    await page.getByLabel('Password').fill('ItStaff123!')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'All Tickets' })).toBeVisible()
  })

  await test.step('Search narrows the queue to the seeded ticket, sorting still shows it', async () => {
    await page.getByLabel('Search tickets').fill(marker)
    await expect(page.getByRole('button', { name: new RegExp(ticketNumber) })).toBeVisible()
    await expect(page.getByText(summary)).toBeVisible()

    await page.getByLabel('Sort tickets').selectOption({ label: 'Ticket No. (A-Z)' })
    await expect(page.getByRole('button', { name: new RegExp(ticketNumber) })).toBeVisible()
  })

  await test.step('Opening the ticket goes to its detail page', async () => {
    await page.getByRole('button', { name: new RegExp(ticketNumber) }).click()
    await expect(page).toHaveURL(new RegExp(`/tickets/${ticketId}$`))
    await expect(page.getByText(ticketNumber)).toBeVisible()
  })

  await test.step('Claim ownership, then reassign to another IT Staff member', async () => {
    // scope to the read-only "Ticket Owner" field's own div - a plain
    // getByText would also match the Owner <select>'s own selected
    // <option> (same text), which isn't distinct from the readonly field
    const ownerField = page.locator('div.form-control.bg-light.text-truncate')

    await page.getByLabel('Owner').selectOption({ label: 'Ivy ITStaff' })
    await expect(ownerField.filter({ hasText: /^Ivy ITStaff$/ })).toBeVisible()

    await page.getByLabel('Owner').selectOption({ label: 'Marcus Tan' })
    await expect(ownerField.filter({ hasText: /^Marcus Tan$/ })).toBeVisible()
  })

  await test.step('Set IT Priority independently of Requested Priority', async () => {
    await page.getByLabel('IT Priority').selectOption('URGENT')
    await expect(page.getByText('Urgent', { exact: true })).toBeVisible()
    // Requested Priority (submitted as HIGH) is untouched by the IT Priority change.
    await expect(page.getByText('High', { exact: true })).toBeVisible()
  })

  await test.step('Move the ticket through a permitted status sequence', async () => {
    await page.getByRole('button', { name: 'Start Progress' }).click()
    await expect(page.getByText('In Progress', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Mark Waiting' }).click()
    await expect(page.getByText('Waiting for Requester')).toBeVisible()

    await page.getByRole('button', { name: 'Resume Progress' }).click()
    await expect(page.getByText('In Progress', { exact: true })).toBeVisible()
  })

  await test.step('Post a Public Comment', async () => {
    await page.getByPlaceholder('Type your comment here...').fill(`${marker} public update`)
    await page.getByRole('button', { name: 'Post Comment' }).click()
    await expect(page.getByText(`${marker} public update`)).toBeVisible()
    await expect(page.getByRole('button', { name: /Public Comments 1/ })).toBeVisible()
  })

  await test.step('Write an Internal Note', async () => {
    await page.getByRole('button', { name: /Internal Notes/ }).click()
    await page.getByPlaceholder('Add an internal note (not visible to the requester)...').fill(`${marker} internal-only note`)
    await page.getByRole('button', { name: 'Add Note' }).click()
    await expect(page.getByText(`${marker} internal-only note`)).toBeVisible()
    await expect(page.getByRole('button', { name: /Internal Notes 1/ })).toBeVisible()
  })

  await test.step('The Requester session never sees the Internal Note, but does see the Public Comment', async () => {
    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL(/\/login$/)

    await page.getByLabel('Email').fill('requester@toktickit.dev')
    await page.getByLabel('Password').fill('Requester123!')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    await page.getByLabel('Search tickets').fill(marker)
    await page.getByRole('button', { name: new RegExp(ticketNumber) }).click()
    await expect(page).toHaveURL(new RegExp(`/tickets/${ticketId}$`))

    await expect(page.getByText(`${marker} public update`)).toBeVisible()
    await expect(page.getByRole('button', { name: /Internal Notes/ })).toHaveCount(0)
    await expect(page.getByText(`${marker} internal-only note`)).toHaveCount(0)
  })
})
