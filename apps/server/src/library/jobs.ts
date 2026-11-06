/**
 * Leer el texto de los PDF en segundo plano (docs/specs/biblioteca.md): al subirlos o cambiarlos, y los ya subidos al
 * arrancar. En el servidor, por BullMQ (uno a la vez, sin repetir el mismo archivo en la cola); en las pruebas, en el
 * propio proceso
 */
import { type Database, filesRepo, libraryRepo } from '@crisol/db'
import { Queue, Worker } from 'bullmq'
import { Redis } from 'ioredis'
import type { Storage } from '../files/storage.ts'
import { pdfPages } from './text.ts'

export interface LibraryJobs {
  /** Pide leer un PDF (al subirlo o cambiarlo) */
  enqueue(fileId: string): Promise<void>
  /** Pide leer los que faltan (los subidos antes de que hubiera biblioteca, o cambiados) */
  enqueuePending(): Promise<void>
  /** Espera a que no quede nada por leer (para las pruebas) */
  idle(): Promise<void>
  close(): Promise<void>
}

async function bytesOf(storage: Storage, key: string): Promise<Uint8Array> {
  const chunks: Buffer[] = []
  for await (const chunk of storage.read(key)) chunks.push(chunk as Buffer)
  return new Uint8Array(Buffer.concat(chunks))
}

/** Lee un PDF: su avance cada pocas páginas, su texto al acabar; si falla, lo dice. Uno borrado o que no es PDF, nada */
export async function readPdf(db: Database, storage: Storage, fileId: string) {
  const file = await filesRepo.findFile(db, fileId)
  if (!file || file.kind !== 'pdf') return
  const { hash } = file
  await libraryRepo.setTextStatus(db, fileId, { status: 'reading', hash, pages: 0, read: 0 })
  try {
    let last = 0
    const pages = await pdfPages(await bytesOf(storage, file.storageKey), async (read, total) => {
      // Cada 10 páginas (y la primera, para saber cuántas tiene)
      if (read === 1 || read - last >= 10) {
        last = read
        await libraryRepo.setTextStatus(db, fileId, { status: 'reading', hash, pages: total, read })
      }
    })
    await libraryRepo.savePages(db, fileId, hash, pages)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await libraryRepo.setTextStatus(db, fileId, { status: 'failed', hash, error: message.slice(0, 500) })
  }
}

/** En el propio proceso, uno tras otro: para las pruebas (y sin Valkey) */
export function inlineLibrary(db: Database, storage: Storage): LibraryJobs {
  let chain: Promise<void> = Promise.resolve()
  const run = (fileId: string) => {
    chain = chain.then(() => readPdf(db, storage, fileId)).catch(() => undefined)
    return Promise.resolve()
  }
  return {
    enqueue: run,
    async enqueuePending() {
      for (const file of await libraryRepo.pdfsToRead(db)) await run(file.id)
    },
    idle: () => chain,
    close: () => chain
  }
}

const QUEUE = 'biblioteca'

/** Por BullMQ sobre Valkey: un trabajo por archivo (su id), uno a la vez */
export function queuedLibrary(options: {
  db: Database
  storage: Storage
  valkeyUrl: string
  prefix?: string
  onError?: (error: unknown) => void
}): LibraryJobs {
  const prefix = options.prefix ?? 'crisol'
  const connection = new Redis(options.valkeyUrl, { maxRetriesPerRequest: null })
  const queue = new Queue(QUEUE, { connection, prefix })
  const worker = new Worker(QUEUE, (job) => readPdf(options.db, options.storage, String(job.data.fileId)), {
    connection,
    prefix,
    concurrency: 1
  })
  worker.on('failed', (_, error) => options.onError?.(error))
  worker.on('error', (error) => options.onError?.(error))
  const enqueue = async (fileId: string) => {
    // Con su id: si ya está esperando, no se repite; lo hecho se quita, para poder pedirlo otra vez
    await queue.add('leer', { fileId }, { jobId: fileId, removeOnComplete: true, removeOnFail: true })
  }
  return {
    enqueue,
    async enqueuePending() {
      for (const file of await libraryRepo.pdfsToRead(options.db)) await enqueue(file.id)
    },
    async idle() {
      const pending = async () => {
        const counts = await queue.getJobCounts('waiting', 'active', 'delayed')
        return (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0)
      }
      while ((await pending()) > 0) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    },
    async close() {
      await worker.close()
      await queue.close()
      connection.disconnect()
    }
  }
}
