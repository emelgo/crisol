import { defineConfig, devices } from '@playwright/test'
import { E2E_PORT } from './servidor.ts'

const baseURL = `http://127.0.0.1:${E2E_PORT}`

export default defineConfig({
  testDir: './tests',
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node servidor.ts',
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
})
