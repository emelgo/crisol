/**
 * Leer el texto de los PDF en segundo plano (docs/specs/biblioteca.md): al subirlos o cambiarlos, y los ya subidos al
 * arrancar. En el servidor, por BullMQ (uno a la vez, sin repetir el mismo archivo en la cola); en las pruebas, en el
 * propio proceso
 */
import { type Database, filesRepo, libraryRepo } from '@crisol/db'
import { Queue, Worker } from 'bullmq'
import { Redis } from 'ioredis'
import type { Storage } from '../files/storage.ts'
import { bookChunks } from './chunks.ts'
import type { Embedder } from './embedder.ts'
import { pdfPages } from './text.ts'

export interface LibraryJobs {
  /** Pide leer un PDF (al subirlo o cambiarlo) */
  enqueue(fileId: string): Promise<void>
  /** Pide leer los que faltan (los subidos antes de que hubiera biblioteca, o cambiados) */
  enqueuePending(): Promise<void>
  /** Pide poner al día los trozos de la wiki y calcular los vectores que falten (tras guardar una página) */
  refresh(): Promise<void>
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
  if (file?.kind !== 'pdf') return
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
    // Sus trozos para buscar por significado (sin vector: los calcula la pasada siguiente)
    await libraryRepo.syncBookChunks(db, file, bookChunks(pages))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await libraryRepo.setTextStatus(db, fileId, { status: 'failed', hash, error: message.slice(0, 500) })
  }
}

/** Cuántos trozos se calculan de una vez */
const BATCH = 16

/**
 * La pasada de la búsqueda por significado: los trozos de la wiki al día y los vectores que falten, de tanda en
 * tanda. Sin modelo, solo los trozos (se calculan cuando lo haya)
 */
export async function embedPending(db: Database, embedder: Embedder | null) {
  await libraryRepo.syncWikiChunks(db)
  if (!embedder) return 0
  let done = 0
  for (;;) {
    const pending = await libraryRepo.pendingChunks(db, BATCH)
    if (pending.length === 0) return done
    const vectors = await embedder.embed(
      pending.map((chunk) => chunk.text),
      'passage'
    )
    await libraryRepo.setEmbeddings(
      db,
      pending.map((chunk, i) => ({ id: chunk.id, vector: vectors[i] ?? [] })).filter((row) => row.vector.length > 0)
    )
    done += pending.length
  }
}

/** En el propio proceso, uno tras otro: para las pruebas (y sin Valkey) */
export function inlineLibrary(db: Database, storage: Storage, embedder: Embedder | null = null): LibraryJobs {
  let chain: Promise<void> = Promise.resolve()
  const then = (work: () => Promise<unknown>) => {
    chain = chain.then(work).then(
      () => undefined,
      () => undefined
    )
    return Promise.resolve()
  }
  const run = (fileId: string) =>
    then(async () => {
      await readPdf(db, storage, fileId)
      await embedPending(db, embedder)
    })
  return {
    enqueue: run,
    async enqueuePending() {
      for (const file of await libraryRepo.pdfsToRead(db)) await run(file.id)
    },
    refresh: () => then(() => embedPending(db, embedder)),
    idle: () => chain,
    close: () => chain
  }
}

const QUEUE = 'biblioteca'

/** Por BullMQ sobre Valkey: un trabajo por archivo (su id), uno a la vez */
export function queuedLibrary(options: {
  db: Database
  storage: Storage
  embedder: Embedder | null
  valkeyUrl: string
  prefix?: string
  onError?: (error: unknown) => void
}): LibraryJobs {
  const prefix = options.prefix ?? 'crisol'
  const connection = new Redis(options.valkeyUrl, { maxRetriesPerRequest: null })
  const queue = new Queue(QUEUE, { connection, prefix })
  const refresh = async () => {
    // Una sola esperando: las que se piden mientras tanto ya van en ella
    await queue.add('significado', {}, { jobId: 'significado', removeOnComplete: true, removeOnFail: true })
  }
  const worker = new Worker(
    QUEUE,
    async (job) => {
      if (job.name === 'significado') return embedPending(options.db, options.embedder)
      await readPdf(options.db, options.storage, String(job.data.fileId))
      await refresh()
    },
    // Una pasada larga (un libro entero) renueva su reserva sola; uno a la vez
    { connection, prefix, concurrency: 1, lockDuration: 120_000 }
  )
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
      await refresh()
    },
    refresh,
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
