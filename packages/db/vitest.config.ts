import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Pruebas contra Postgres real: crear una base y migrarla puede pasar de 5 s con todo en paralelo
    testTimeout: 20_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['lcov', 'text-summary']
    }
  }
})
