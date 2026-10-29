// Solo para la CLI de Better Auth: genera su esquema en packages/db (pnpm --filter @crisol/server auth:schema)
import { connect } from '@crisol/db'
import { createAuth } from './src/auth/auth.ts'

export const auth = createAuth({
  db: connect('postgres://generador@127.0.0.1/sin-conexion').db,
  secret: 'x'.repeat(32),
  baseURL: 'http://127.0.0.1'
})
