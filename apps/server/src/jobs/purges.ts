import { type Database, trashRepo } from '@crisol/db'
import { Queue, QueueEvents, Worker } from 'bullmq'
import { Redis } from 'ioredis'

type PurgeResult = Awaited<ReturnType<typeof trashRepo.purge>>

export interface PurgeJobs {
  queue: Queue
  /** El espacio de nombres en Valkey */
  prefix: string
  /** Lanza la purga ya y espera a que acabe (para las pruebas y para lanzarla a mano) */
  runNow(): Promise<PurgeResult>
  close(options?: { obliterate?: boolean }): Promise<void>
}

const QUEUE = 'purgas'

/**
 * La purga diaria (papelera a los 30 días, historial a los 90), a las 4:00 de Madrid. Va por BullMQ sobre Valkey:
 * el programa se guarda una sola vez, aunque arranquen varias instancias, y una sola la ejecuta.
 */
export async function startPurges(options: {
  db: Database
  valkeyUrl: string
  /** El reloj (las pruebas lo simulan) */
  now?: () => Date
  prefix?: string
  onError?: (error: unknown) => void
}): Promise<PurgeJobs> {
  const prefix = options.prefix ?? 'crisol'
  const now = options.now ?? (() => new Date())
  // BullMQ pide que los comandos bloqueantes no se reintenten solos
  const connection = new Redis(options.valkeyUrl, { maxRetriesPerRequest: null })
  const queue = new Queue(QUEUE, { connection, prefix })
  await queue.upsertJobScheduler('purga-diaria', { pattern: '0 4 * * *', tz: 'Europe/Madrid' }, { name: 'purgar' })
  const worker = new Worker(QUEUE, () => trashRepo.purge(options.db, now()), { connection, prefix })
  worker.on('failed', (_, error) => options.onError?.(error))
  worker.on('error', (error) => options.onError?.(error))

  return {
    queue,
    prefix,
    async runNow() {
      // Su propia conexión (escucha bloqueando), que se cierra al acabar
      const listening = connection.duplicate()
      const events = new QueueEvents(QUEUE, { connection: listening, prefix })
      try {
        await events.waitUntilReady()
        const job = await queue.add('purgar', {})
        return (await job.waitUntilFinished(events)) as PurgeResult
      } finally {
        await events.close()
        listening.disconnect()
      }
    },
    async close({ obliterate = false } = {}) {
      await worker.close()
      if (obliterate) await queue.obliterate({ force: true })
      await queue.close()
      connection.disconnect()
    }
  }
}
