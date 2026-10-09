import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { USERS, api, apiLogin, type TestUser } from './fixtures'

// STYLE-01 (docs/lab-04/tests.md; AC-27) and the handout Part 9 evidence:
// desktop / tablet / mobile screenshots of every Lab 4 screen into
// artifacts/lab-04/screenshots/{staff-dashboard,requester-dashboard,actions-taken}/,
// asserting at every width that the page has no horizontal overflow.
// Read-only: it never writes data, so it is safe to run against the dev DB
// (which is how the committed screenshots were produced).

const SCREENSHOT_ROOT = path.join(__dirname, '..', '..', 'artifacts', 'lab-04', 'screenshots')

const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  tablet: { width: 800, height: 1024 },
  mobile: { width: 375, height: 812 },
} as const

async function signIn(page: Page, user: TestUser) {
  const token = await apiLogin(page.request, user)
  await page.addInitScript((t) => window.localStorage.setItem('toktickit.token', t), token)
  return token
}

async function shootAllViewports(page: Page, folder: string, name: string) {
  for (const [viewportName, size] of Object.entries(VIEWPORTS)) {
    await page.setViewportSize(size)
    await page.waitForTimeout(150)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `${folder}/${name} horizontal overflow at ${viewportName}`).toBeLessThanOrEqual(0)
    await page.screenshot({ path: path.join(SCREENSHOT_ROOT, folder, `${name}-${viewportName}.png`), fullPage: true })
  }
}

async function sampleTicketId(page: Page, token: string) {
  const result = await api<{ tickets: Array<{ id: number }> }>(page.request, token, 'GET', '/api/tickets?q=TKT-SAMPLE-000001')
  return result.tickets[0].id
}

test.describe('IT Staff Dashboard', () => {
  test('dashboard, drill-down, mobile menu', async ({ page }) => {
    await signIn(page, USERS.staff)
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
    await shootAllViewports(page, 'staff-dashboard', '01-dashboard')

    await page.goto('/queue?ownerId=me&statusGroup=open')
    await expect(page.getByText(/Filtered from dashboard/)).toBeVisible()
    await shootAllViewports(page, 'staff-dashboard', '02-drill-down-my-assigned')

    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Menu' }).click()
    await expect(page.getByRole('link', { name: 'Ticket Queue' }).first()).toBeVisible()
    await page.screenshot({ path: path.join(SCREENSHOT_ROOT, 'staff-dashboard', '03-mobile-menu-open-mobile.png') })
  })

  test('loading and safe-failure states', async ({ page }) => {
    await signIn(page, USERS.staff)
    await page.route('**/api/dashboard/staff', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Something went wrong. Please try again.' }) }),
    )
    await page.goto('/dashboard')
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
    await shootAllViewports(page, 'staff-dashboard', '04-safe-failure')
  })
})

test.describe('Requester Dashboard', () => {
  test('dashboard and drill-down', async ({ page }) => {
    await signIn(page, USERS.requester)
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: /Welcome, Rachel/ })).toBeVisible()
    await shootAllViewports(page, 'requester-dashboard', '01-dashboard')

    await page.goto('/tickets?statusGroup=open')
    await expect(page.getByText(/Filtered from dashboard/)).toBeVisible()
    await shootAllViewports(page, 'requester-dashboard', '02-drill-down-open')
  })
})

test.describe('Actions Taken', () => {
  test('staff list, create validation, edit, resolution gate, history', async ({ page }) => {
    const token = await signIn(page, USERS.staff)
    const id = await sampleTicketId(page, token)
    await page.goto(`/tickets/${id}`)
    await page.getByRole('button', { name: /^Actions Taken/ }).click()
    await expect(page.getByRole('button', { name: '+ Add Action' })).toBeVisible()
    await shootAllViewports(page, 'actions-taken', '01-staff-list')

    await page.getByRole('button', { name: '+ Add Action' }).click()
    await page.getByLabel('Status').selectOption('COMPLETED')
    await page.getByLabel('Follow-Up Required?').check()
    await page.getByRole('button', { name: 'Save Action' }).click()
    await expect(page.getByText('Result is required to complete an action')).toBeVisible()
    await shootAllViewports(page, 'actions-taken', '02-create-validation')
    await page.getByRole('button', { name: 'Discard' }).click()

    await page.getByRole('button', { name: /View or edit action/ }).first().click()
    await expect(page.getByRole('heading', { name: 'Edit Action Taken' })).toBeVisible()
    await shootAllViewports(page, 'actions-taken', '03-edit-mode')
    await page.getByRole('button', { name: 'Discard' }).click()

    await page.getByLabel('Resolution Summary').fill('Battery replaced')
    await expect(page.getByText(/Can't resolve yet/)).toBeVisible()
    await shootAllViewports(page, 'actions-taken', '04-resolution-gate')

    await page.getByRole('button', { name: 'Status History' }).click()
    await shootAllViewports(page, 'actions-taken', '05-status-history')
  })

  test('requester read-only view', async ({ page }) => {
    const staffToken = await apiLogin(page.request, USERS.staff)
    const id = await sampleTicketId(page, staffToken)
    await signIn(page, USERS.requester)
    await page.goto(`/tickets/${id}`)
    await page.getByRole('button', { name: /^Actions Taken/ }).click()
    await expect(page.getByRole('button', { name: '+ Add Action' })).toHaveCount(0)
    await shootAllViewports(page, 'actions-taken', '06-requester-read-only')

    await page.getByRole('button', { name: /^View action/ }).first().click()
    await shootAllViewports(page, 'actions-taken', '07-requester-view-panel')
  })
})
