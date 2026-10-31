import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { API_BASE_URL, USERS, api, apiLogin } from './fixtures'

// Handout Part 8 evidence (Issue #80): desktop screenshots showing the Lab 1-3
// features still working inside the Lab 4 app shell, captured into
// artifacts/lab-04/screenshots/regression/. Read-only. The Administrator
// screens need the seed admin password; if it was changed on the database
// in use, that test is skipped (capture it against the test DB instead).

const OUT = path.join(__dirname, '..', '..', 'artifacts', 'lab-04', 'screenshots', 'regression')
const ADMIN = { email: 'admin@toktickit.dev', password: 'Admin123!' }

async function useToken(page: Page, token: string) {
  await page.addInitScript((t) => window.localStorage.setItem('toktickit.token', t), token)
}

async function shot(page: Page, name: string, fullPage = true) {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage })
}

async function sampleTicketId(page: Page, token: string) {
  return (await api<{ tickets: Array<{ id: number }> }>(page.request, token, 'GET', '/api/tickets?q=TKT-SAMPLE-000001')).tickets[0].id
}

test('Authentication: login and access denied', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(USERS.requester.email)
  await page.getByLabel('Password', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Invalid credentials')).toBeVisible()
  await shot(page, '01-login-invalid-credentials')

  await useToken(page, await apiLogin(page.request, USERS.requester))
  await page.goto('/admin/users')
  await expect(page).toHaveURL(/access-denied/)
  await shot(page, '02-requester-blocked-from-admin')
})

test('Requester: My Tickets, Create Ticket, Ticket Detail with comments and attachments', async ({ page }) => {
  const staffToken = await apiLogin(page.request, USERS.staff)
  const id = await sampleTicketId(page, staffToken)
  await useToken(page, await apiLogin(page.request, USERS.requester))

  await page.goto('/tickets')
  await expect(page.getByRole('heading', { name: 'My Tickets' })).toBeVisible()
  await shot(page, '03-requester-my-tickets')

  await page.goto('/tickets/new')
  await page.getByRole('button', { name: 'Submit Ticket' }).click()
  await shot(page, '04-requester-create-ticket-validation')

  await page.goto(`/tickets/${id}`)
  await expect(page.getByRole('button', { name: /Public Comments/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Internal Notes/ })).toHaveCount(0)
  await shot(page, '05-requester-ticket-detail-public-comments')

  await page.getByRole('button', { name: /^Attachments/ }).click()
  await shot(page, '06-requester-attachments')
})

test('IT Staff: queue and Internal Notes', async ({ page }) => {
  const token = await apiLogin(page.request, USERS.staff)
  const id = await sampleTicketId(page, token)
  await useToken(page, token)

  await page.goto('/queue')
  await expect(page.getByRole('heading', { name: 'Ticket Queue' })).toBeVisible()
  await shot(page, '07-staff-ticket-queue')

  await page.goto(`/tickets/${id}`)
  await page.getByRole('button', { name: /Internal Notes/ }).click()
  await expect(page.getByText(/Internal — not visible to the Requester/)).toBeVisible()
  await shot(page, '08-staff-internal-notes')
})

test('Administrator: user management and reference data', async ({ page }) => {
  const login = await page.request.post(`${API_BASE_URL}/api/auth/login`, { data: ADMIN })
  test.skip(!login.ok(), 'seed admin password not valid on this database')
  await useToken(page, ((await login.json()) as { token: string }).token)

  await page.goto('/admin/users')
  await expect(page.getByRole('heading', { name: /User/ }).first()).toBeVisible()
  // first screenful only: a test database can hold hundreds of generated users
  await shot(page, '09-admin-user-management', false)

  await page.goto('/admin/reference-data')
  await shot(page, '10-admin-reference-data', false)
})
