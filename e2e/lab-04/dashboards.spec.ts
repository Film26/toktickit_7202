import { expect, test } from '@playwright/test'
import { USERS, api, apiLogin, loginThroughUi, mainNav } from './fixtures'

// E2E-04, E2E-05 (docs/lab-04/tests.md; AC-02, AC-18, AC-26). Each dashboard
// card shows the backend count and its "View all" opens the list holding
// exactly those tickets; Requesters only ever see their own.

type Paged = { pagination: { totalCount: number } }

test('IT Staff dashboard cards drill down to a matching Ticket Queue', async ({ page, request }) => {
  const token = await apiLogin(request, USERS.staff)
  await loginThroughUi(page, USERS.staff)
  await expect(page.getByRole('heading', { name: 'Welcome back, Ivy!' })).toBeVisible()
  await expect(mainNav(page).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')

  for (const [label, query] of [
    ['New', 'status=NEW'],
    ['My Assigned', 'ownerId=me&statusGroup=open'],
    ['Unassigned', 'ownerId=unassigned&statusGroup=open'],
  ] as const) {
    await page.goto('/dashboard')
    const key = { New: 'new', 'My Assigned': 'myAssigned', Unassigned: 'unassigned' }[label]
    const shown = Number(await page.getByTestId(`metric-${key}`).textContent())
    const expected = (await api<Paged>(request, token, 'GET', `/api/tickets?${query}&pageSize=1`)).pagination.totalCount
    expect(shown, `${label} card equals the list API total`).toBe(expected)

    await page.getByRole('link', { name: `View all ${label} tickets` }).click()
    await page.waitForURL('**/queue?*')
    expect(new URL(page.url()).search).toBe(`?${query}`)
    await expect(page.getByRole('heading', { name: 'Ticket Queue' })).toBeVisible()
    await expect(mainNav(page).getByRole('link', { name: 'Ticket Queue' })).toHaveAttribute('aria-current', 'page')
  }
  await expect(page.getByText(/Filtered from dashboard: open tickets/)).toBeVisible()
})

test('Requester dashboard is scoped to the Requester and drills down to My Tickets', async ({ page, request }) => {
  const token = await apiLogin(request, USERS.requester)
  const otherToken = await apiLogin(request, USERS.otherRequester)
  const othersTickets = await api<{ tickets: Array<{ id: number }> }>(request, otherToken, 'GET', '/api/tickets/mine?pageSize=1')

  await loginThroughUi(page, USERS.requester)
  await expect(page.getByRole('heading', { name: 'Welcome, Rachel!' })).toBeVisible()

  const shown = Number(await page.getByTestId('metric-open').textContent())
  const expected = (await api<Paged>(request, token, 'GET', '/api/tickets/mine?statusGroup=open&pageSize=1')).pagination.totalCount
  expect(shown).toBe(expected)

  await page.getByRole('link', { name: 'View all My Open Tickets tickets' }).click()
  await expect(page).toHaveURL(/\/tickets\?statusGroup=open$/)
  await expect(page.getByRole('heading', { name: 'My Tickets' })).toBeVisible()
  await expect(page.getByText(/Filtered from dashboard: open tickets/)).toBeVisible()

  // Ownership is enforced by the backend: another Requester's ticket is "not found".
  await page.goto(`/tickets/${othersTickets.tickets[0].id}`)
  await expect(page.getByText('Ticket not found')).toBeVisible()
})
