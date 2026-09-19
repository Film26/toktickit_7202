import { expect, test } from '@playwright/test'
import { apiCreateUser, apiLogin } from './fixtures/api'

// Lab 3 authentication/authorization E2E coverage (Issue #49 Part A).
// Each test is independent (unlike the Lab 2 flow) since login state
// resets between tests via a fresh browser context - Playwright gives each
// test its own context/localStorage automatically.

const marker = `E2E ${Date.now()}`

test('Login: valid credentials reach the dashboard', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('itstaff@toktickit.dev')
  await page.getByLabel('Password', { exact: true }).fill('ItStaff123!')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'All Tickets' })).toBeVisible()
})

test('Login: wrong password is rejected with a generic error', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('itstaff@toktickit.dev')
  await page.getByLabel('Password', { exact: true }).fill('WrongPassword123!')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByText('Invalid credentials')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})

test('Login: an inactive account gets the identical generic error (BR-06)', async ({ page }) => {
  // Correct password for a real, but deactivated, IT Staff account - the
  // response must be indistinguishable from a wrong-password attempt so
  // account existence/status is never leaked.
  await page.goto('/login')
  await page.getByLabel('Email').fill('inactive-itstaff@toktickit.dev')
  await page.getByLabel('Password', { exact: true }).fill('InactiveItStaff123!')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByText('Invalid credentials')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})

test('Mandatory first-password change gates the app until a new password is saved', async ({ page, request }) => {
  let email = ''
  let temporaryPassword = ''

  await test.step('Administrator creates a new user (always mustChangePassword: true per BR-08)', async () => {
    const adminToken = await apiLogin(request, 'admin@toktickit.dev', 'Admin123!')
    email = `e2e.force-change.${Date.now()}@toktickit.dev`
    const created = await apiCreateUser(request, adminToken, {
      email,
      fullName: `${marker} Force Change`,
      role: 'REQUESTER',
    })
    temporaryPassword = created.temporaryPassword
  })

  await test.step('Logging in with the temporary password lands on the forced change screen, not the dashboard', async () => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password', { exact: true }).fill(temporaryPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/first-password-change$/)
  })

  await test.step('Direct navigation to another screen is bounced back to the forced change screen', async () => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/first-password-change$/)
  })

  await test.step('Saving a new password unlocks normal navigation', async () => {
    await page.getByLabel('Current (temporary) password', { exact: true }).fill(temporaryPassword)
    await page.getByLabel('New password', { exact: true }).fill('BrandNewPass123!')
    await page.getByLabel('Confirm new password', { exact: true }).fill('BrandNewPass123!')
    await page.getByRole('button', { name: 'Change Password' }).click()

    await expect(page).toHaveURL(/\/dashboard$/)
  })
})

test('Logout clears the session and blocks direct URL access afterward', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('itstaff@toktickit.dev')
  await page.getByLabel('Password', { exact: true }).fill('ItStaff123!')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login$/)
})
