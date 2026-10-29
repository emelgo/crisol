import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // Con include salen también los archivos que ninguna prueba carga
      include: ['*.ts'],
      exclude: ['*.test.ts', 'vitest.config.ts'],
      reporter: ['lcov', 'text-summary']
    }
  }
})
