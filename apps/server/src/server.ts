import { join } from 'node:path'
import { aiRepo, connect } from '@crisol/db'
import { Redis } from 'ioredis'
import { buildApp } from './app.ts'
import { createAuth } from './auth/auth.ts'
import type { Config } from './config.ts'
import { diskStorage } from './files/storage.ts'
import { startPurges } from './jobs/purges.ts'
import { modelEmbedder } from './library/embedder.ts'
import { queuedLibrary } from './library/jobs.ts'
import { deriveSealKey } from './secrets.ts'
import { serviceChecks } from './services.ts'
import { pdfRenderer } from './wiki/pdf.ts'

/** Arranca el servidor con sus conexiones; stop() deja de aceptar peticiones y las cierra */
export async function startServer(
  config: Config,
  options: { logger?: boolean /** Las pruebas acortan la espera de las aprobaciones */; approvalWaitMs?: number } = {}
) {
  const db = connect(config.DATABASE_URL)
  const valkey = new Redis(config.VALKEY_URL, { maxRetriesPerRequest: 2 })
  const auth = createAuth({
    db: db.db,
    secret: config.AUTH_SECRET,
    baseURL: config.PUBLIC_URL,
    ...(config.AUTH_RATE_LIMIT_MAX ? { rateLimitMax: config.AUTH_RATE_LIMIT_MAX } : {})
  })
  const storage = diskStorage(join(config.DATA_DIR, 'archivos'))
  // El PDF de las hojas abre la web del propio servidor: solo si la sirve él
  const internalUrl = `http://127.0.0.1:${config.PORT}`
  const pdf = config.WEB_DIR ? pdfRenderer({ baseUrl: internalUrl, executablePath: config.CHROMIUM_PATH }) : null
  // El texto de los PDF, en segundo plano (el registro de la app aún no existe: se avisa por consola)
  let logError = (error: unknown) => console.error(error)
  // El modelo, en su hilo: se carga al usarlo (si están sus archivos)
  const embedder = modelEmbedder({ dir: config.MODEL_DIR })
  const library = queuedLibrary({
    db: db.db,
    storage,
    embedder,
    valkeyUrl: config.VALKEY_URL,
    prefix: config.QUEUE_PREFIX,
    onError: (e) => logError(e)
  })
  const app = buildApp({
    checks: serviceChecks(db, valkey),
    logger: options.logger ?? false,
    ...(config.WEB_DIR ? { webDir: config.WEB_DIR } : {}),
    accounts: { auth, db: db.db, publicUrl: config.PUBLIC_URL, sealKey: deriveSealKey(config.AUTH_SECRET) },
    mcpJwksUrl: `http://127.0.0.1:${config.PORT}/api/auth/jwks`,
    storage,
    ...(pdf ? { pdf: { renderer: pdf, internalUrl } } : {}),
    ...(options.approvalWaitMs ? { approvalWaitMs: options.approvalWaitMs } : {}),
    library,
    ...(embedder ? { embedder } : {})
  })
  logError = (error) => app.log.error(error, 'Falló leer un PDF')
  // Lo aprobado que se quedó haciéndose al pararse el anterior ya no se va a acabar
  await aiRepo.failInterruptedApprovals(db.db, new Date(Date.now() - 60_000))
  await app.listen({ host: config.HOST, port: config.PORT })
  // La purga diaria de la papelera y del historial
  const purges = await startPurges({
    db: db.db,
    prefix: config.QUEUE_PREFIX,
    valkeyUrl: config.VALKEY_URL,
    storage,
    onError: (error) => app.log.error(error, 'Falló la purga diaria')
  })
  // Los PDF que faltan por leer (los de antes de la biblioteca, o cambiados)
  void library.enqueuePending().catch((error) => logError(error))
  return {
    app,
    auth,
    async stop() {
      await purges.close()
      await library.close()
      await embedder?.close()
      await app.close()
      await pdf?.close()
      await db.close()
      valkey.disconnect()
    }
  }
}
