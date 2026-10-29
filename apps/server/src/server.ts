import { connect } from '@crisol/db'
import { Redis } from 'ioredis'
import { buildApp } from './app.ts'
import { createAuth } from './auth/auth.ts'
import type { Config } from './config.ts'
import { startPurges } from './jobs/purges.ts'
import { deriveSealKey } from './secrets.ts'
import { serviceChecks } from './services.ts'

/** Arranca el servidor con sus conexiones; stop() deja de aceptar peticiones y las cierra */
export async function startServer(config: Config, options: { logger?: boolean } = {}) {
  const db = connect(config.DATABASE_URL)
  const valkey = new Redis(config.VALKEY_URL, { maxRetriesPerRequest: 2 })
  const auth = createAuth({ db: db.db, secret: config.AUTH_SECRET, baseURL: config.PUBLIC_URL })
  const app = buildApp({
    checks: serviceChecks(db, valkey),
    logger: options.logger ?? false,
    ...(config.WEB_DIR ? { webDir: config.WEB_DIR } : {}),
    accounts: { auth, db: db.db, publicUrl: config.PUBLIC_URL, sealKey: deriveSealKey(config.AUTH_SECRET) },
    mcpJwksUrl: `http://127.0.0.1:${config.PORT}/api/auth/jwks`
  })
  await app.listen({ host: config.HOST, port: config.PORT })
  // La purga diaria de la papelera y del historial
  const purges = await startPurges({
    db: db.db,
    valkeyUrl: config.VALKEY_URL,
    onError: (error) => app.log.error(error, 'Falló la purga diaria')
  })
  return {
    app,
    auth,
    async stop() {
      await purges.close()
      await app.close()
      await db.close()
      valkey.disconnect()
    }
  }
}
