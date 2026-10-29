export { type Connection, connect, type Database } from './client.ts'
export { runMigrations } from './migrate.ts'
// Las tablas de Better Auth, para su adaptador
export * as authSchema from './schema/auth.ts'
export * as schema from './schema/index.ts'
