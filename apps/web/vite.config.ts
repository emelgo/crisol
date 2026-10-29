import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    // En desarrollo la API la sirve el servidor de apps/server
    proxy: { '/api': { target: 'http://127.0.0.1:8130', ws: true } }
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.ts'],
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
