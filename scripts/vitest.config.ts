import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // Con include salen también los archivos que ninguna prueba carga
      include: ['*.ts', 'srd/*.ts', 'foundry/*.ts'],
      // Lo de leer los PDF y escribir el contenido solo corre en local, con los PDF
      exclude: [
        '*.test.ts',
        'srd/*.test.ts',
        'vitest.config.ts',
        'srd/texto.ts',
        'srd/extraer.ts',
        'srd/comprobar.ts',
        // Solo en local, con los datos de dnd5e exportados: no son lógica que se pruebe aquí
        'srd/dnd5e-exportar.ts',
        'srd/comparar-dnd5e.ts',
        // Solo en local, con el dnd5e instalado
        'foundry/probar.ts'
      ],
      reporter: ['lcov', 'text-summary']
    }
  }
})
