import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Every API test file shares the one .env.test database. Running files
    // one at a time keeps "dashboard value == database count" checks
    // (docs/lab-04 DASH-*) deterministic instead of racing other files'
    // inserts, and removes the load-induced seed-test timeouts noted in
    // docs/lab-03/tests.md.
    fileParallelism: false,
  },
})
