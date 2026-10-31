import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { USERS, api, apiLogin, createInProgressTicket, type TestUser } from './fixtures'

// A11Y-01..A11Y-03 (docs/lab-04/tests.md, Issue #77). Automated WCAG 2.1 A/AA
// scan (axe-core) of every Lab 4 screen and the key Lab 1-3 screens, plus a
// keyboard-only pass through the Actions Taken create flow. Serious and
// critical violations fail the test; anything lower is printed for review.

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function signIn(page: Page, user: TestUser) {
  const token = await apiLogin(page.request, user)
  await page.addInitScript((t) => window.localStorage.setItem('toktickit.token', t), token)
  return token
}

// Presses Tab (at most 20 times) until the locator has focus, proving it is
// reachable by keyboard without depending on an exact, browser-specific count.
async function tabUntilFocused(page: Page, locator: Locator) {
  for (let i = 0; i < 20 && !(await locator.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab')
  }
  await expect(locator).toBeFocused()
}

async function expectAccessible(page: Page, screen: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  for (const violation of results.violations) {
    console.log(
      `[a11y] ${screen}: ${violation.impact} ${violation.id} (${violation.nodes.length}) ${violation.help}\n` +
        violation.nodes
          .slice(0, 3)
          .map((node) => `    ${node.target.join(' ')}`)
          .join('\n'),
    )
  }
  expect(blocking.map((v) => `${v.id}: ${v.help}`), `${screen} serious/critical WCAG violations`).toEqual([])
}

test.describe('A11Y-01: Lab 4 screens', () => {
  test('IT Staff dashboard, queue drill-down', async ({ page }) => {
    await signIn(page, USERS.staff)
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
    await expectAccessible(page, 'staff dashboard')

    await page.goto('/queue?ownerId=me&statusGroup=open')
    await expect(page.getByRole('heading', { name: 'Ticket Queue' })).toBeVisible()
    await expectAccessible(page, 'ticket queue (drill-down)')
  })

  test('Requester dashboard, My Tickets drill-down', async ({ page }) => {
    await signIn(page, USERS.requester)
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: /Welcome, Rachel/ })).toBeVisible()
    await expectAccessible(page, 'requester dashboard')

    await page.goto('/tickets?statusGroup=open')
    await expect(page.getByRole('heading', { name: 'My Tickets' })).toBeVisible()
    await expectAccessible(page, 'my tickets (drill-down)')
  })

  test('Ticket Detail: Actions Taken list, create form with errors, edit form, status history', async ({ page }) => {
    const token = await signIn(page, USERS.staff)
    const id = (await api<{ tickets: Array<{ id: number }> }>(page.request, token, 'GET', '/api/tickets?q=TKT-SAMPLE-000001')).tickets[0].id
    await page.goto(`/tickets/${id}`)
    await page.getByRole('button', { name: /^Actions Taken/ }).click()
    await expect(page.getByRole('button', { name: '+ Add Action' })).toBeVisible()
    await expectAccessible(page, 'actions taken list')

    await page.getByRole('button', { name: '+ Add Action' }).click()
    await page.getByRole('button', { name: 'Save Action' }).click()
    await expect(page.getByText('Action Description is required')).toBeVisible()
    await expectAccessible(page, 'actions taken create form (with errors)')
    await page.getByRole('button', { name: 'Discard' }).click()

    await page.getByRole('button', { name: /View or edit action/ }).first().click()
    await expectAccessible(page, 'actions taken edit form')
    await page.getByRole('button', { name: 'Discard' }).click()

    await page.getByRole('button', { name: 'Status History' }).click()
    await expectAccessible(page, 'status history')
  })

  test('Requester Ticket Detail with read-only actions', async ({ page }) => {
    const staffToken = await apiLogin(page.request, USERS.staff)
    const id = (await api<{ tickets: Array<{ id: number }> }>(page.request, staffToken, 'GET', '/api/tickets?q=TKT-SAMPLE-000001')).tickets[0].id
    await signIn(page, USERS.requester)
    await page.goto(`/tickets/${id}`)
    await page.getByRole('button', { name: /^Actions Taken/ }).click()
    await page.getByRole('button', { name: /^View action/ }).first().click()
    await expectAccessible(page, 'requester actions taken (read-only)')
  })
})

test.describe('A11Y-02: key Lab 1-3 screens', () => {
  test('Login, Create Ticket', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    await expectAccessible(page, 'login')

    await signIn(page, USERS.requester)
    await page.goto('/tickets/new')
    await expect(page.getByRole('button', { name: 'Submit Ticket' })).toBeVisible()
    await expectAccessible(page, 'create ticket')
  })
})

test('A11Y-03: keyboard-only Actions Taken create flow', async ({ page, request }) => {
  const ticket = await createInProgressTicket(request, `A11Y keyboard ${Date.now()}`)
  await signIn(page, USERS.staff)
  await page.goto(`/tickets/${ticket.id}`)

  // Reach and open the tab, open the form, fill it and save -- keyboard only.
  await page.getByRole('button', { name: /^Actions Taken 0/ }).focus()
  await page.keyboard.press('Enter')
  await tabUntilFocused(page, page.getByRole('button', { name: '+ Add Action' }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Add Action Taken' })).toBeFocused()

  // Tab forward until the Description box has focus. The date/time field has
  // one Tab stop per segment (day, month, year, hour...) in Chromium, so the
  // exact count is browser-specific; what matters is that it is reachable.
  const description = page.getByLabel(/Action Description/)
  await tabUntilFocused(page, description)
  await page.keyboard.type('Keyboard-only action')
  // Submit from the keyboard: Tab on to the Save button and press Enter.
  await tabUntilFocused(page, page.getByRole('button', { name: 'Save Action' }))
  await page.keyboard.press('Enter')

  await expect(page.getByRole('row', { name: /Keyboard-only action/ })).toBeVisible()
  // Focus returns to the control that opened the form.
  await expect(page.getByRole('button', { name: '+ Add Action' })).toBeFocused()
})
