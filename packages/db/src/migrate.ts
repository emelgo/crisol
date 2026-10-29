import { join } from 'node:path'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { connect } from './client.ts'

const MIGRATIONS = join(import.meta.dirname, '..', 'drizzle')

export async function runMigrations(url: string): Promise<void> {
  const { db, close } = connect(url, { max: 1 })
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS })
  } finally {
    await close()
  }
}

/** Aplica las migraciones a la base de DATABASE_URL */
export async function migrateFromEnv(env: Record<string, string | undefined>): Promise<void> {
  const url = env.DATABASE_URL
  if (!url) throw new Error('Falta DATABASE_URL')
  await runMigrations(url)
}

if (import.meta.main) {
  await migrateFromEnv(process.env)
  console.log('Migraciones aplicadas')
}
