import { connect } from '@crisol/db'
import { Redis } from 'ioredis'
import { buildApp } from './app.ts'
import { loadConfig } from './config.ts'
import { serviceChecks } from './services.ts'

const config = loadConfig(process.env)
const db = connect(config.DATABASE_URL)
const valkey = new Redis(config.VALKEY_URL, { maxRetriesPerRequest: 2 })
const app = buildApp({ checks: serviceChecks(db, valkey), logger: true })

// Al parar: deja de aceptar peticiones y cierra las conexiones
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    await app.close()
    await db.close()
    valkey.disconnect()
  })
}

await app.listen({ host: config.HOST, port: config.PORT })
