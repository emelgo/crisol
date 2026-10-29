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

if (import.meta.main) {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('Falta DATABASE_URL')
  await runMigrations(url)
  console.log('Migraciones aplicadas')
}
