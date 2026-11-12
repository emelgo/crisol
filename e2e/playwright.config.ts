import { defineConfig, devices } from '@playwright/test'
import { E2E_PORT } from './servidor.ts'
import { SIN_DESENFOQUE } from './sin-desenfoque.ts'

const baseURL = `http://127.0.0.1:${E2E_PORT}`

export default defineConfig({
  testDir: './tests',
  forbidOnly: Boolean(process.env.CI),
  // La máquina de la CI va más despacio que el VPS: más margen de espera allí (sin reintentos, que taparían fallos)
  timeout: process.env.CI ? 60_000 : 30_000,
  expect: { timeout: process.env.CI ? 10_000 : 5_000 },
  // Un solo hilo: todas las pruebas comparten el servidor y su base de datos, y algunas la vacían al empezar
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL, trace: 'retain-on-failure', storageState: SIN_DESENFOQUE },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node servidor.ts',
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
})
