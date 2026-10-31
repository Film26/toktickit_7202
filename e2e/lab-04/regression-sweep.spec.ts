import { expect, test, type Page } from '@playwright/test'
import { USERS, api, apiLogin, type TestUser } from './fixtures'

// REG-04 (docs/lab-04/tests.md, Issue #79; handout 8.5 "console errors,
// broken links, placeholder text, and unfinished controls are removed").
// Visits every route each role can reach, plus every link found on the
// dashboards, and fails on: a browser console error, an unexpected failed
// API call, the Not Found page, or leftover placeholder text.

const ADMIN = { email: 'admin@toktickit.dev', password: 'Admin123!', name: 'Alex Administrator' } as const
const PLACEHOLDER = /\b(TODO|FIXME|lorem ipsum|placeholder text|coming soon)\b/i

// Each test visits ~10-20 pages and waits for each to settle.
test.describe.configure({ timeout: 180_000 })

type Problems = { console: string[]; api: string[] }

function watch(page: Page): Problems {
  const problems: Problems = { console: [], api: [] }
  page.on('console', (message) => {
    if (message.type() === 'error') problems.console.push(message.text())
  })
  page.on('pageerror', (error) => problems.console.push(`pageerror: ${error.message}`))
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      problems.api.push(`${response.status()} ${response.request().method()} ${response.url()}`)
    }
  })
  return problems
}

async function signIn(page: Page, user: TestUser | typeof ADMIN) {
  const token = await apiLogin(page.request, user as TestUser)
  await page.addInitScript((t) => window.localStorage.setItem('toktickit.token', t), token)
  return token
}

async function visit(page: Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  await expect(page.locator('.spinner-border')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /not found/i }), `${path} rendered the Not Found page`).toHaveCount(0)
  const text = await page.locator('body').innerText()
  expect(text, `${path} contains placeholder text`).not.toMatch(PLACEHOLDER)
}

// Every in-app link on the current page (nav, cards, quick actions, lists).
async function internalLinks(page: Page) {
  const hrefs = await page.locator('a[href^="/"]').evaluateAll((links) => links.map((a) => a.getAttribute('href')!))
  return [...new Set(hrefs)]
}

function expectClean(problems: Problems, role: string) {
  expect(problems.console, `${role}: browser console errors`).toEqual([])
  expect(problems.api, `${role}: failed API calls`).toEqual([])
}

test('Requester: every screen and dashboard link', async ({ page }) => {
  const problems = watch(page)
  const token = await signIn(page, USERS.requester)
  const ownTicket = (await api<{ tickets: Array<{ id: number }> }>(page.request, token, 'GET', '/api/tickets/mine?pageSize=1')).tickets[0]

  await visit(page, '/dashboard')
  const links = await internalLinks(page)
  for (const path of ['/tickets', '/tickets/new', `/tickets/${ownTicket.id}`, ...links]) await visit(page, path)

  expectClean(problems, 'Requester')
})

test('IT Staff: every screen and dashboard link', async ({ page }) => {
  const problems = watch(page)
  const token = await signIn(page, USERS.staff)
  const ticket = (await api<{ tickets: Array<{ id: number }> }>(page.request, token, 'GET', '/api/tickets?pageSize=1')).tickets[0]

  await visit(page, '/dashboard')
  const links = await internalLinks(page)
  for (const path of ['/queue', `/tickets/${ticket.id}`, ...links]) await visit(page, path)

  expectClean(problems, 'IT Staff')
})

test('Administrator: every screen and dashboard link', async ({ page }) => {
  const problems = watch(page)
  await signIn(page, ADMIN)

  await visit(page, '/dashboard')
  const links = await internalLinks(page)
  for (const path of ['/queue', '/admin/users', '/admin/reference-data', ...links]) await visit(page, path)

  expectClean(problems, 'Administrator')
})

test('Role restrictions redirect instead of breaking', async ({ page }) => {
  const problems = watch(page)
  await signIn(page, USERS.requester)
  for (const path of ['/queue', '/admin/users']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/access-denied$/)
  }
  expectClean(problems, 'Requester on staff routes')
})
