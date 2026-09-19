import { expect, test } from '@playwright/test'
import { apiLogin } from './fixtures/api'

// Lab 3 Administrator User Management E2E coverage (Issue #49 Part A).
// One continuous flow (like the Lab 2 spec) - see playwright.config.ts
// (workers: 1, fullyParallel: false) for why sequential, dependent steps
// are safe here.

const marker = `E2E ${Date.now()}`
const newUserEmail = `e2e.admin-created.${Date.now()}@toktickit.dev`
const newUserName = `${marker} Created User`

test('Administrator: create, search/filter, edit role, reset password, and the safety rules', async ({
  page,
  request,
  browser,
}) => {
  let createdTemporaryPassword = ''
  let resetTemporaryPassword = ''
  const userRow = () => page.locator('tbody tr', { hasText: newUserEmail })

  await test.step('Administrator logs in and opens User Management', async () => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('admin@toktickit.dev')
    await page.getByLabel('Password', { exact: true }).fill('Admin123!')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    await page.getByRole('link', { name: 'Users' }).click()
    await expect(page).toHaveURL(/\/admin\/users$/)
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible()
  })

  await test.step('Create a new user and capture the one-time temporary password', async () => {
    await page.getByLabel('Full name').fill(newUserName)
    await page.getByLabel('Email', { exact: true }).fill(newUserEmail)
    await page.getByLabel('Role', { exact: true }).selectOption('REQUESTER')
    await page.getByRole('button', { name: 'Create' }).click()

    const successAlert = page.getByRole('alert').filter({ hasText: newUserEmail })
    await expect(successAlert).toBeVisible()
    createdTemporaryPassword = ((await successAlert.locator('code').textContent()) ?? '').trim()
    expect(createdTemporaryPassword.length).toBeGreaterThan(0)
  })

  await test.step('Search and role-filter find the new user', async () => {
    await page.getByPlaceholder('Search by name or email').fill(marker)
    await expect(userRow()).toBeVisible()

    await page.getByLabel('Filter by role').selectOption('IT_STAFF')
    await expect(userRow()).toHaveCount(0)

    await page.getByLabel('Filter by role').selectOption('REQUESTER')
    await expect(userRow()).toBeVisible()
  })

  await test.step('Edit the user: change their role', async () => {
    await userRow().locator('select').selectOption('IT_STAFF')
    // the role filter is still "Requester" from the previous step, so once
    // the row's role actually changed server-side, it drops out of view
    await expect(userRow()).toHaveCount(0)

    await page.getByLabel('Filter by role').selectOption('IT_STAFF')
    await expect(userRow()).toBeVisible()
  })

  await test.step('Reset the password: a new temporary password is issued and "Change required" shows', async () => {
    await userRow().getByRole('button', { name: 'Reset Password' }).click()

    const successAlert = page.getByRole('alert').filter({ hasText: newUserEmail })
    // the alert was already visible (showing the creation password) before
    // this click - wait for its code content to actually change rather than
    // just for the alert to be visible, or we can read stale text
    await expect(successAlert.locator('code')).not.toHaveText(createdTemporaryPassword)
    resetTemporaryPassword = ((await successAlert.locator('code').textContent()) ?? '').trim()
    expect(resetTemporaryPassword.length).toBeGreaterThan(0)
    expect(resetTemporaryPassword).not.toBe(createdTemporaryPassword)

    await expect(userRow().getByText('Change required')).toBeVisible()
  })

  await test.step('The reset user must change their password at next login', async () => {
    const freshContext = await browser.newContext()
    const freshPage = await freshContext.newPage()
    await freshPage.goto('/login')
    await freshPage.getByLabel('Email').fill(newUserEmail)
    await freshPage.getByLabel('Password', { exact: true }).fill(resetTemporaryPassword)
    await freshPage.getByRole('button', { name: 'Sign in' }).click()
    await expect(freshPage).toHaveURL(/\/first-password-change$/)
    await freshContext.close()
  })

  await test.step("An Administrator's own row disables Deactivate (BR-16)", async () => {
    // clear the search/role filters left over from previous steps so the
    // signed-in Administrator's own row (which matches neither) is visible
    await page.getByPlaceholder('Search by name or email').fill('')
    await page.getByLabel('Filter by role').selectOption('')

    const ownRow = page.locator('tbody tr', { hasText: 'admin@toktickit.dev' })
    const deactivateButton = ownRow.getByRole('button', { name: 'Deactivate' })
    await expect(deactivateButton).toBeDisabled()
    await expect(deactivateButton).toHaveAttribute('title', "You can't deactivate your own account.")
  })

  await test.step('The server rejects deactivating the last active Administrator even if attempted directly (BR-16/BR-17)', async () => {
    const adminToken = await apiLogin(request, 'admin@toktickit.dev', 'Admin123!')
    const meResponse = await request.get('http://localhost:4000/api/auth/me', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const { user } = (await meResponse.json()) as { user: { id: number } }

    const response = await request.patch(`http://localhost:4000/api/users/${user.id}/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { isActive: false },
    })
    expect(response.status()).toBe(403)
    const body = (await response.json()) as { error: string }
    expect(body.error).toBe('Cannot deactivate your own account')
  })

  await test.step('A non-Administrator is forbidden from User Management', async () => {
    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL(/\/login$/)

    await page.getByLabel('Email').fill('itstaff@toktickit.dev')
    await page.getByLabel('Password', { exact: true }).fill('ItStaff123!')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    await page.goto('/admin/users')
    await expect(page).toHaveURL(/\/access-denied$/)
    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible()
  })
})
