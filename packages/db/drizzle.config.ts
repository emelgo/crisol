import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  // Columnas en snake_case en la base de datos, camelCase en TypeScript
  casing: 'snake_case'
})
