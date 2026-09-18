import path from 'node:path'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

// Lab 3 visual inspection (Issue #49 Part B). Captures desktop/tablet/mobile
// screenshots of every Lab 3 screen into
// artifacts/lab-03/screenshots/{authentication,staff-queue,staff-ticket-detail,user-management}/
// and does light assertions along the way. This is a one-off documentation
// pass, not a correctness suite (that's authentication/staff-ticket-flow/
// user-administration.spec.ts) - screenshots are the actual deliverable.

const API_BASE_URL = 'http://localhost:4000'
const SCREENSHOT_ROOT = path.join(__dirname, '..', '..', 'artifacts', 'lab-03', 'screenshots')

const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  tablet: { width: 800, height: 1024 },
  mobile: { width: 375, height: 812 },
} as const

async function apiLogin(request: APIRequestContext, email: string, password: string) {
  const response = await request.post(`${API_BASE_URL}/api/auth/login`, { data: { email, password } })
  return ((await response.json()) as { token: string }).token
}

async function applySession(page: Page, token: string) {
  await page.addInitScript((t) => window.localStorage.setItem('toktickit.token', t), token)
}

async function shootAllViewports(page: Page, folder: string, name: string) {
  for (const [viewportName, size] of Object.entries(VIEWPORTS)) {
    await page.setViewportSize(size)
    // let the layout settle (debounced search boxes, CSS transitions) before capture
    await page.waitForTimeout(150)
    await page.screenshot({
      path: path.join(SCREENSHOT_ROOT, folder, `${name}-${viewportName}.png`),
      fullPage: true,
    })
  }
}

test.describe('Authentication screens', () => {
  test('Login', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    await shootAllViewports(page, 'authentication', 'login')
  })

  test('Login - validation/error state', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('itstaff@toktickit.dev')
    await page.getByLabel('Password').fill('WrongPassword123!')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Invalid credentials')).toBeVisible()
    await shootAllViewports(page, 'authentication', 'login-error')
  })

  test('Change Password (forced, first login)', async ({ page, request }) => {
    const adminToken = await apiLogin(request, 'admin@toktickit.dev', 'Admin123!')
    const email = `visual.force-change.${Date.now()}@toktickit.dev`
    const createResponse = await request.post(`${API_BASE_URL}/api/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { email, fullName: 'Visual Inspection Temp User', role: 'REQUESTER' },
    })
    const { temporaryPassword } = (await createResponse.json()) as { temporaryPassword: string }

    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(temporaryPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/first-password-change$/)
    await shootAllViewports(page, 'authentication', 'change-password')
  })
})

test.describe('IT Staff Ticket Queue', () => {
  test('queue with data', async ({ page, request }) => {
    const token = await apiLogin(request, 'itstaff@toktickit.dev', 'ItStaff123!')
    await applySession(page, token)
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'All Tickets' })).toBeVisible()
    await shootAllViewports(page, 'staff-queue', 'queue')
  })

  test('queue - no-results state (active filter, zero matches)', async ({ page, request }) => {
    const token = await apiLogin(request, 'itstaff@toktickit.dev', 'ItStaff123!')
    await applySession(page, token)
    await page.goto('/dashboard')
    await page.getByLabel('Search tickets').fill(`no-such-ticket-${Date.now()}`)
    await expect(page.getByText('No tickets match your filters.')).toBeVisible()
    await shootAllViewports(page, 'staff-queue', 'queue-no-results')
  })
})

test.describe('Ticket Detail screens', () => {
  async function seedTicket(request: APIRequestContext) {
    const requesterToken = await apiLogin(request, 'requester@toktickit.dev', 'Requester123!')
    const categoriesResponse = await request.get(`${API_BASE_URL}/api/categories`)
    const categories = (await categoriesResponse.json()) as Array<{ id: number; name: string }>
    const category = categories.find((c) => c.name === 'Network') ?? categories[0]
    const marker = `Visual ${Date.now()}`
    const ticketResponse = await request.post(`${API_BASE_URL}/api/tickets`, {
      headers: { Authorization: `Bearer ${requesterToken}` },
      data: {
        categoryId: category.id,
        summary: `${marker} screenshot fixture ticket`,
        description: `${marker} - created for Lab 3 visual inspection screenshots.`,
        requestedPriority: 'HIGH',
      },
    })
    const ticket = (await ticketResponse.json()) as { id: number }

    // a public comment + an internal note, so both tabs have real content
    // and the visual distinction between them is actually visible
    await request.post(`${API_BASE_URL}/api/tickets/${ticket.id}/comments`, {
      headers: { Authorization: `Bearer ${requesterToken}` },
      data: { body: `${marker} - a public comment visible to everyone.` },
    })
    const staffToken = await apiLogin(request, 'itstaff@toktickit.dev', 'ItStaff123!')
    await request.post(`${API_BASE_URL}/api/tickets/${ticket.id}/notes`, {
      headers: { Authorization: `Bearer ${staffToken}` },
      data: { body: `${marker} - an internal note, staff-only.` },
    })

    return ticket.id
  }

  test('Requester Ticket Detail (with Public Comments)', async ({ page, request }) => {
    const ticketId = await seedTicket(request)
    const token = await apiLogin(request, 'requester@toktickit.dev', 'Requester123!')
    await applySession(page, token)
    await page.goto(`/tickets/${ticketId}`)
    await expect(page.getByText('Ticket No.')).toBeVisible()
    await shootAllViewports(page, 'staff-ticket-detail', 'requester-ticket-detail')
  })

  test('IT Staff Ticket Detail (Public Comments vs Internal Notes)', async ({ page, request }) => {
    const ticketId = await seedTicket(request)
    const token = await apiLogin(request, 'itstaff@toktickit.dev', 'ItStaff123!')
    await applySession(page, token)
    await page.goto(`/tickets/${ticketId}`)
    await expect(page.getByText('Ticket No.')).toBeVisible()
    await shootAllViewports(page, 'staff-ticket-detail', 'it-staff-ticket-detail-comments')

    await page.getByRole('button', { name: /Internal Notes/ }).click()
    await shootAllViewports(page, 'staff-ticket-detail', 'it-staff-ticket-detail-notes')
  })
})

test.describe('Administrator User Management', () => {
  test('user list with data', async ({ page, request }) => {
    const token = await apiLogin(request, 'admin@toktickit.dev', 'Admin123!')
    await applySession(page, token)
    await page.goto('/admin/users')
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible()
    await shootAllViewports(page, 'user-management', 'user-list')
  })

  test('create user - success feedback with temporary password', async ({ page, request }) => {
    const token = await apiLogin(request, 'admin@toktickit.dev', 'Admin123!')
    await applySession(page, token)
    await page.goto('/admin/users')

    await page.getByLabel('Full name').fill('Visual Inspection Created User')
    await page.getByLabel('Email', { exact: true }).fill(`visual.created.${Date.now()}@toktickit.dev`)
    await page.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await shootAllViewports(page, 'user-management', 'create-user-success')
  })
})
