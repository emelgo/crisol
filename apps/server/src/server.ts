import { connect } from '@crisol/db'
import { Redis } from 'ioredis'
import { buildApp } from './app.ts'
import { createAuth } from './auth/auth.ts'
import type { Config } from './config.ts'
import { serviceChecks } from './services.ts'

/** Arranca el servidor con sus conexiones; stop() deja de aceptar peticiones y las cierra */
export async function startServer(config: Config, options: { logger?: boolean } = {}) {
  const db = connect(config.DATABASE_URL)
  const valkey = new Redis(config.VALKEY_URL, { maxRetriesPerRequest: 2 })
  const app = buildApp({
    checks: serviceChecks(db, valkey),
    logger: options.logger ?? false,
    ...(config.WEB_DIR ? { webDir: config.WEB_DIR } : {}),
    accounts: { auth: createAuth({ db: db.db, secret: config.AUTH_SECRET, baseURL: config.PUBLIC_URL }), db: db.db }
  })
  await app.listen({ host: config.HOST, port: config.PORT })
  return {
    app,
    async stop() {
      await app.close()
      await db.close()
      valkey.disconnect()
    }
  }
}
