import { loadConfig } from './config.ts'
import { startServer } from './server.ts'

/** Lo que se espera a que se cierre todo bien antes de salir igual (una conexión abierta no lo deja colgado) */
const STOP_MS = 5000

const server = await startServer(loadConfig(process.env), { logger: true })
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    // Si algo no se cierra (un socket de la mesa, un PDF a medias), se sale igualmente: si no, `node --watch` se queda
    // esperando y el servidor de desarrollo sigue con el código viejo
    setTimeout(() => process.exit(0), STOP_MS).unref()
    void server.stop().then(() => process.exit(0))
  })
