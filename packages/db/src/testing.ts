/**
 * Bases de datos para las pruebas de integración. Cada paquete usa la suya, creada desde cero en cada ejecución, para
 * que las pruebas de varios paquetes puedan correr a la vez sin pisarse.
 */
import postgres from 'postgres'
import { runMigrations } from './migrate.ts'

// El Compose de desarrollo; en la CI lo cambia TEST_DATABASE_URL
const DEFAULT_SERVER = 'postgres://crisol:crisol@127.0.0.1:54330/crisol'
const SIMPLE_NAME = /^[a-z_][a-z0-9_]{0,62}$/

/** Borra y crea la base de datos `name`, le aplica las migraciones y devuelve su URL */
export async function freshTestDatabase(name: string): Promise<string> {
  if (!SIMPLE_NAME.test(name)) throw new Error(`Nombre de base de datos no válido: ${name}`)
  const server = process.env.TEST_DATABASE_URL ?? DEFAULT_SERVER
  const admin = postgres(server, { max: 1, onnotice: () => undefined })
  try {
    await admin.unsafe(`drop database if exists ${name} with (force)`)
    await admin.unsafe(`create database ${name}`)
  } finally {
    await admin.end()
  }
  const url = new URL(server)
  url.pathname = `/${name}`
  await runMigrations(url.toString())
  return url.toString()
}

/** Vacía todas las tablas de la aplicación (no las de las migraciones), para empezar cada prueba de cero */
export async function resetDatabase(sql: postgres.Sql): Promise<void> {
  const tables = await sql<{ name: string }[]>`
    select quote_ident(tablename) as name from pg_tables where schemaname = 'public'`
  if (tables.length === 0) return
  await sql.unsafe(`truncate ${tables.map((t) => t.name).join(', ')} restart identity cascade`)
}
