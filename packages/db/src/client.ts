import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index.ts'

/** Conexión a Postgres con Drizzle. Hay que cerrarla con close() */
export function connect(url: string, options: { max?: number } = {}) {
  const sql = postgres(url, { max: options.max ?? 10 })
  return { db: drizzle(sql, { schema, casing: 'snake_case' }), sql, close: () => sql.end() }
}

export type Connection = ReturnType<typeof connect>
export type Database = Connection['db']
