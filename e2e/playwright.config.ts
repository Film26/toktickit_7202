import { defineConfig, devices } from '@playwright/test'

// Lab 2 + Lab 3 end-to-end suite. Runs against the REAL dev-mode app (API +
// client dev servers), backed by the existing dev Postgres DB at server/.env's
// DATABASE_URL - the same DB the seed script targets. Both servers are
// started automatically before the tests run (see `webServer` below) and
// torn down afterward.
export default defineConfig({
  testDir: '.',
  testMatch: ['lab-02/**/*.spec.ts', 'lab-03/**/*.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 30_000,

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'npm run dev',
      cwd: '../server',
      url: 'http://localhost:4000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npm run dev',
      cwd: '../client',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
})
