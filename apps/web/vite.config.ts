import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // La física de los dados 3D va en un worker de módulo
  worker: { format: 'es' },
  server: {
    host: '127.0.0.1',
    port: 5173,
    // En desarrollo la API la sirve el servidor de apps/server
    proxy: { '/api': { target: 'http://127.0.0.1:8130', ws: true } },
    // Los más de 4000 dibujos de los iconos no cambian: vigilarlos agota los vigilantes del sistema (inotify) y Vite
    // deja de ver los cambios
    watch: { ignored: ['**/public/iconos/**'] }
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.ts'],
    // Con todos los paquetes probándose a la vez, una prueba larga (varias acciones seguidas) pasa de los 5 s por carga
    testTimeout: 15_000,
    // tokens.css, de verdad: su prueba comprueba los contrastes
    css: { include: [/tokens\.css/], modules: { classNameStrategy: 'non-scoped' } },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}'],
      reporter: ['lcov', 'text-summary']
    }
  }
})
