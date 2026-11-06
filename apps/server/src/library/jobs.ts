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
import { pdfPagesIsolated } from './text.ts'

export interface LibraryJobs {
  /** Pide leer un PDF (al subirlo o cambiarlo) */
  enqueue(fileId: string): Promise<void>
  /** Pide leer los que faltan (los de antes de la biblioteca, cambiados o que se quedaron a medias) y poner al día todo */
  enqueuePending(): Promise<void>
  /** Pide poner al día los trozos de esos documentos de la wiki (recién guardados) y calcular los vectores que falten */
  refresh(documentIds?: readonly string[]): Promise<void>
  /** Espera a que no quede nada (para las pruebas) */
  idle(): Promise<void>
  close(): Promise<void>
}

/** Los bytes de un archivo, en un solo búfer (sin más copias) */
async function bytesOf(storage: Storage, key: string): Promise<Uint8Array> {
  const chunks: Buffer[] = []
  for await (const chunk of storage.read(key)) chunks.push(chunk as Buffer)
  const joined = Buffer.concat(chunks)
  return new Uint8Array(joined.buffer, joined.byteOffset, joined.byteLength)
}

/** Lee un PDF: su avance cada pocas páginas, su texto al acabar; si falla, lo dice. Uno borrado o que no es PDF, nada */
export async function readPdf(db: Database, storage: Storage, fileId: string) {
  const file = await filesRepo.findFile(db, fileId)
  if (file?.kind !== 'pdf') return
  const { hash } = file
  await libraryRepo.setTextStatus(db, fileId, { status: 'reading', hash, pages: 0, read: 0 })
  try {
    let last = 0
    const pages = await pdfPagesIsolated(await bytesOf(storage, file.storageKey), async (read, total) => {
      // Cada 10 páginas (y la primera, para saber cuántas tiene)
      if (read === 1 || read - last >= 10) {
        last = read
        await libraryRepo.setTextStatus(db, fileId, { status: 'reading', hash, pages: total, read })
      }
    })
    // Si se cambió mientras se leía, lo leído ya no vale: otra vez, con el nuevo
    const now = await filesRepo.findFile(db, fileId)
    if (now && now.hash !== hash) return readPdf(db, storage, fileId)
    await libraryRepo.savePages(db, fileId, hash, pages)
    // Sus trozos para buscar por significado (sin vector: los calcula la pasada siguiente)
    await libraryRepo.syncBookChunks(db, file, bookChunks(pages))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await libraryRepo.setTextStatus(db, fileId, { status: 'failed', hash, error: message.slice(0, 500) })
  }
}

/** Cuántos trozos se calculan de una vez, y cuántas tandas en una pasada (unos minutos: luego deja paso a los libros) */
const BATCH = 16
const PASS_BATCHES = 40

const valid = (vector: readonly number[] | undefined): vector is number[] =>
  vector !== undefined && vector.length > 0 && vector.every(Number.isFinite)

/**
 * Una pasada de la búsqueda por significado: los trozos de esos documentos de la wiki (o de todos) al día y los
 * vectores que falten, de tanda en tanda, como mucho `PASS_BATCHES`. Un trozo con el que el modelo no puede se marca y
 * no estorba a los demás; si no puede con ninguno (el modelo no está bien), se para sin marcar nada. Dice si queda más
 */
export async function embedPending(
  db: Database,
  embedder: Embedder | null,
  documents: readonly string[] | 'all' = 'all'
): Promise<{ more: boolean }> {
  await libraryRepo.syncWikiChunks(db, documents === 'all' ? undefined : documents)
  if (!embedder) return { more: false }
  for (let batch = 0; batch < PASS_BATCHES; batch++) {
    const pending = await libraryRepo.pendingChunks(db, BATCH)
    if (pending.length === 0) return { more: false }
    let vectors: number[][] | null = null
    try {
      vectors = await embedder.embed(
        pending.map((chunk) => chunk.text),
        'passage'
      )
    } catch {
      vectors = null
    }
    if (vectors && pending.every((_, i) => valid(vectors?.[i]))) {
      await libraryRepo.setEmbeddings(
        db,
        pending.map((chunk, i) => ({ id: chunk.id, vector: vectors?.[i] ?? [] }))
      )
      continue
    }
    // Uno a uno: el que falle, marcado
    let ok = 0
    const failed: string[] = []
    for (const chunk of pending) {
      try {
        const [vector] = await embedder.embed([chunk.text], 'passage')
        if (valid(vector)) {
          await libraryRepo.setEmbeddings(db, [{ id: chunk.id, vector }])
          ok++
        } else failed.push(chunk.id)
      } catch {
        failed.push(chunk.id)
      }
    }
    if (ok === 0) throw new Error('el modelo no ha podido con ningún trozo')
    for (const id of failed) await libraryRepo.markChunkFailed(db, id)
  }
  return { more: true }
}

/** En el propio proceso, uno tras otro: para las pruebas (y sin Valkey) */
export function inlineLibrary(db: Database, storage: Storage, embedder: Embedder | null = null): LibraryJobs {
  let chain: Promise<void> = Promise.resolve()
  const documents = new Set<string>()
  let all = false
  const then = (work: () => Promise<unknown>) => {
    chain = chain.then(work).then(
      () => undefined,
      () => undefined
    )
    return Promise.resolve()
  }
  const pass = async () => {
    const wanted: readonly string[] | 'all' = all ? 'all' : [...documents]
    all = false
    documents.clear()
    while ((await embedPending(db, embedder, wanted)).more);
  }
  const run = (fileId: string) =>
    then(async () => {
      await readPdf(db, storage, fileId)
      await pass()
    })
  return {
    enqueue: run,
    async enqueuePending() {
      let after: string | null = null
      for (;;) {
        const files = await libraryRepo.pdfsToRead(db, after)
        for (const file of files) await run(file.id)
        if (files.length < 200) break
        after = files.at(-1)?.id ?? null
      }
      all = true
      await then(pass)
    },
    refresh(ids = []) {
      for (const id of ids) documents.add(id)
      return then(pass)
    },
    idle: () => chain,
    close: () => chain
  }
}

const QUEUE = 'biblioteca'

/**
 * Por BullMQ sobre Valkey: un trabajo por archivo (su id), uno a la vez; la pasada de significado, un trabajo aparte
 * que se vuelve a pedir al acabar si queda más o se pidió mientras tanto. Pedir nunca bloquea ni falla: si Valkey no
 * está, se avisa y se sigue (lo que falte se pone al día al arrancar o al abrir la biblioteca)
 */
export function queuedLibrary(options: {
  db: Database
  storage: Storage
  embedder: Embedder | null
  valkeyUrl: string
  prefix?: string
  onError?: (error: unknown) => void
}): LibraryJobs {
  const prefix = options.prefix ?? 'crisol'
  // El trabajador espera bloqueando (sin reintentos por orden); lo que pide, con pocos reintentos: no se cuelga
  const working = new Redis(options.valkeyUrl, { maxRetriesPerRequest: null })
  const asking = new Redis(options.valkeyUrl, { maxRetriesPerRequest: 1 })
  const queue = new Queue(QUEUE, { connection: asking, prefix })
  const documentsKey = `${prefix}:${QUEUE}:documentos`
  const allKey = `${prefix}:${QUEUE}:todo`
  const safely = async (work: () => Promise<unknown>) => {
    try {
      await work()
    } catch (error) {
      options.onError?.(error)
    }
  }
  const askPass = () =>
    queue.add('significado', {}, { jobId: 'significado', removeOnComplete: true, removeOnFail: true })
  const worker = new Worker(
    QUEUE,
    async (job) => {
      if (job.name === 'significado') {
        // Lo pedido hasta ahora: lo que se pida mientras tanto queda para la siguiente
        const [[, ids], , [, all]] = ((await working
          .multi()
          .smembers(documentsKey)
          .del(documentsKey)
          .getdel(allKey)
          .exec()) ?? []) as [[unknown, string[]], unknown, [unknown, string | null]]
        return embedPending(options.db, options.embedder, all ? 'all' : (ids ?? []))
      }
      await readPdf(options.db, options.storage, String(job.data.fileId))
      return null
    },
    { connection: working, prefix, concurrency: 1, lockDuration: 120_000 }
  )
  worker.on('completed', (job, result: { more?: boolean } | null) => {
    void safely(async () => {
      // Tras leer un libro, sus vectores; tras una pasada, otra si queda más o se pidió algo mientras tanto
      if (job.name !== 'significado') return askPass()
      const waiting = (await working.scard(documentsKey)) > 0 || (await working.exists(allKey)) > 0
      if (result?.more || waiting) await askPass()
    })
  })
  worker.on('failed', (_, error) => options.onError?.(error))
  worker.on('error', (error) => options.onError?.(error))
  const enqueue = (fileId: string) =>
    safely(() =>
      // Con su id: si ya está esperando, no se repite; lo hecho se quita, para poder pedirlo otra vez
      queue.add('leer', { fileId }, { jobId: fileId, removeOnComplete: true, removeOnFail: true })
    )
  return {
    enqueue,
    enqueuePending: () =>
      safely(async () => {
        let after: string | null = null
        for (;;) {
          const files = await libraryRepo.pdfsToRead(options.db, after)
          for (const file of files) await enqueue(file.id)
          if (files.length < 200) break
          after = files.at(-1)?.id ?? null
        }
        await asking.set(allKey, '1')
        await askPass()
      }),
    refresh: (ids = []) =>
      safely(async () => {
        if (ids.length > 0) await asking.sadd(documentsKey, ...ids)
        await askPass()
      }),
    async idle() {
      const pending = async () => {
        const counts = await queue.getJobCounts('waiting', 'active', 'delayed')
        return (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0)
      }
      // Quieta de verdad: tras un trabajo, el siguiente se pide al acabar (unos milisegundos después)
      let calm = 0
      while (calm < 3) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        calm = (await pending()) > 0 ? 0 : calm + 1
      }
    },
    async close() {
      // Sin esperar a lo que se está haciendo (se puede repetir sin daño): al pararse, se vuelve a hacer
      await worker.close(true)
      await queue.close()
      working.disconnect()
      asking.disconnect()
    }
  }
}
