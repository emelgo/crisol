import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // Con include salen también los archivos que ninguna prueba carga
      include: ['*.ts', 'srd/*.ts'],
      // Lo de leer los PDF y escribir el contenido solo corre en local, con los PDF
      exclude: ['*.test.ts', 'srd/*.test.ts', 'vitest.config.ts', 'srd/texto.ts', 'srd/extraer.ts', 'srd/comprobar.ts'],
      reporter: ['lcov', 'text-summary']
    }
  }
})
