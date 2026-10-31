import { expect, type APIRequestContext, type Page } from '@playwright/test'

// Lab 4 E2E helpers. Specs drive the UI for the behaviour under test and use
// the real API only to set up state that is not itself being tested.
export const API_BASE_URL = 'http://localhost:4000'

export const USERS = {
  staff: { email: 'itstaff@toktickit.dev', password: 'ItStaff123!', name: 'Ivy ITStaff' },
  marcus: { email: 'marcus.tan@toktickit.dev', password: 'MarcusTan123!', name: 'Marcus Tan' },
  requester: { email: 'requester@toktickit.dev', password: 'Requester123!', name: 'Rachel Requester' },
  otherRequester: { email: 'jennifer.anderson@toktickit.dev', password: 'Jennifer123!', name: 'Jennifer Anderson' },
} as const

export type TestUser = (typeof USERS)[keyof typeof USERS]

export async function apiLogin(request: APIRequestContext, user: TestUser) {
  const response = await request.post(`${API_BASE_URL}/api/auth/login`, { data: { email: user.email, password: user.password } })
  expect(response.ok(), `login ${user.email}`).toBeTruthy()
  return ((await response.json()) as { token: string }).token
}

export async function api<T>(request: APIRequestContext, token: string, method: 'GET' | 'POST' | 'PATCH', path: string, data?: unknown) {
  const response = await request.fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    data,
  })
  if (!response.ok()) throw new Error(`${method} ${path} -> ${response.status()} ${await response.text()}`)
  return (await response.json()) as T
}

// A fresh Requester ticket moved to In Progress by IT Staff.
export async function createInProgressTicket(request: APIRequestContext, summary: string) {
  const requesterToken = await apiLogin(request, USERS.requester)
  const staffToken = await apiLogin(request, USERS.staff)
  const categories = await api<Array<{ id: number }>>(request, requesterToken, 'GET', '/api/categories')
  const ticket = await api<{ id: number; ticketNumber: string }>(request, requesterToken, 'POST', '/api/tickets', {
    categoryId: categories[0].id,
    summary,
    description: 'Created by the Lab 4 E2E suite.',
  })
  await api(request, staffToken, 'PATCH', `/api/tickets/${ticket.id}/status`, { status: 'IN_PROGRESS' })
  return { ...ticket, requesterToken, staffToken }
}

export async function loginThroughUi(page: Page, user: TestUser) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)
}

export function mainNav(page: Page) {
  return page.getByRole('navigation', { name: 'Main' })
}
