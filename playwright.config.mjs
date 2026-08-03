import { defineConfig } from 'playwright/test'

const port = Number(process.env.DHEVALS_E2E_PORT || 4174)
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('DHEVALS_E2E_PORT must be an integer between 1024 and 65535')
}

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
