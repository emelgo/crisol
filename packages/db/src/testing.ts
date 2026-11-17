/**
 * Bases de datos para las pruebas de integración. Cada paquete usa la suya, nueva en cada ejecución (una copia de una
 * plantilla ya migrada), para que las pruebas de varios paquetes puedan correr a la vez sin pisarse.
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'
import { runMigrations } from './migrate.ts'

// El Compose de desarrollo; en la CI lo cambia TEST_DATABASE_URL
const DEFAULT_SERVER = 'postgres://crisol:crisol@127.0.0.1:54330/crisol'
const SIMPLE_NAME = /^[a-z_][a-z0-9_]{0,62}$/

/** URL de la base de datos de pruebas `name` (en el servidor de TEST_DATABASE_URL) */
export function testDatabaseUrl(name: string): string {
  if (!SIMPLE_NAME.test(name)) throw new Error(`Nombre de base de datos no válido: ${name}`)
  const url = new URL(process.env.TEST_DATABASE_URL ?? DEFAULT_SERVER)
  url.pathname = `/${name}`
  return url.toString()
}

const MIGRATIONS = join(import.meta.dirname, '..', 'drizzle')
const TEMPLATE_PREFIX = 'crisol_test_plantilla_'

/** La base ya migrada de la que se copian las de las pruebas: su nombre lleva la huella de las migraciones */
function templateName(): string {
  const hash = createHash('sha256')
  for (const file of readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort())
    hash.update(file).update(readFileSync(join(MIGRATIONS, file)))
  hash.update(readFileSync(join(MIGRATIONS, 'meta', '_journal.json')))
  return `${TEMPLATE_PREFIX}${hash.digest('hex').slice(0, 12)}`
}

/**
 * La plantilla, si aún no está: se migra una vez (bajo un candado, por si varios procesos llegan a la vez) y se quitan
 * las de migraciones de antes. Migrar cada base desde cero, con todas las pruebas a la vez, cargaba tanto Postgres que
 * las preparaciones pasaban de 30 s
 */
async function ensureTemplate(admin: postgres.Sql, server: string): Promise<string> {
  const template = templateName()
  await admin`select pg_advisory_lock(hashtext(${TEMPLATE_PREFIX}))`
  try {
    const [found] = await admin`select 1 from pg_database where datname = ${template}`
    if (found) return template
    // Se migra con otro nombre y se renombra al acabar: una a medias (un proceso que se cortó) nunca se usa
    const building = `${template}_x`
    await admin.unsafe(`drop database if exists ${building} with (force)`)
    await admin.unsafe(`create database ${building}`)
    const url = new URL(server)
    url.pathname = `/${building}`
    await runMigrations(url.toString())
    await admin.unsafe(`alter database ${building} rename to ${template}`)
    const old = await admin<{ name: string }[]>`
      select datname as name from pg_database where datname like ${`${TEMPLATE_PREFIX}%`} and datname != ${template}`
    for (const { name } of old) await admin.unsafe(`drop database if exists ${name} with (force)`)
    return template
  } finally {
    await admin`select pg_advisory_unlock(hashtext(${TEMPLATE_PREFIX}))`
  }
}

/** Borra y crea la base de datos `name`, ya migrada (copia de la plantilla), y devuelve su URL */
export async function freshTestDatabase(name: string): Promise<string> {
  const url = testDatabaseUrl(name)
  const server = process.env.TEST_DATABASE_URL ?? DEFAULT_SERVER
  const admin = postgres(server, { max: 1, onnotice: () => undefined })
  try {
    const template = await ensureTemplate(admin, server)
    await admin.unsafe(`drop database if exists ${name} with (force)`)
    await admin.unsafe(`create database ${name} template ${template}`)
  } finally {
    await admin.end()
  }
  return url
}

/**
 * Lo que no se vacía: Better Auth da de alta el recurso MCP una vez por proceso y guarda en memoria su clave de
 * firma; si se borran con el servidor en marcha, dejan de cuadrar
 */
const KEEP = ['jwks', 'oauth_resource']

/** Vacía las tablas de la aplicación (no las de las migraciones ni KEEP), para empezar cada prueba de cero */
export async function resetDatabase(sql: postgres.Sql): Promise<void> {
  const tables = await sql<{ name: string }[]>`
    select quote_ident(tablename) as name from pg_tables
    where schemaname = 'public' and tablename != all(${KEEP})`
  await sql.unsafe(`truncate ${tables.map((t) => t.name).join(', ')} restart identity cascade`)
}
