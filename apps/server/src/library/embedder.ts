/**
 * El modelo de la búsqueda por significado, en un hilo aparte (docs/specs/biblioteca.md): se carga al usarlo y se
 * descarga tras un rato sin uso (su memoria vuelve). Sin sus archivos no hay modelo, y la búsqueda sigue por palabras
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { Worker } from 'node:worker_threads'

export interface Embedder {
  /** Los vectores de unos textos: «query» para lo que se busca, «passage» para lo que se guarda */
  embed(texts: readonly string[], kind: 'query' | 'passage'): Promise<number[][]>
  close(): Promise<void>
}

type Reply = { id: number; vectors?: number[][]; error?: string } | { ready: true }

export function modelEmbedder(options: {
  dir: string
  /** Sin uso durante tanto, se descarga (10 minutos) */
  idleMs?: number
  threads?: number
}): Embedder | null {
  const { dir } = options
  if (!existsSync(join(dir, 'model.onnx')) || !existsSync(join(dir, 'sentencepiece.bpe.model'))) return null
  const idleMs = options.idleMs ?? 10 * 60_000
  let worker: Worker | null = null
  let ready: Promise<Worker> | null = null
  let timer: NodeJS.Timeout | null = null
  let next = 0
  const waiting = new Map<number, { resolve: (v: number[][]) => void; reject: (e: Error) => void }>()

  const unload = async () => {
    const current = worker
    worker = null
    ready = null
    for (const pending of waiting.values()) pending.reject(new Error('El modelo se ha descargado'))
    waiting.clear()
    await current?.terminate()
  }
  const touch = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void unload(), idleMs)
    timer.unref()
  }
  const load = () => {
    ready ??= new Promise<Worker>((resolve, reject) => {
      const started = new Worker(new URL('./model-worker.ts', import.meta.url), {
        workerData: { dir, threads: options.threads ?? 2 },
        // Sin las opciones de Node que no valen para un archivo (--input-type, de un -e)
        execArgv: process.execArgv.filter((arg) => !arg.startsWith('--input-type'))
      })
      started.on('message', (reply: Reply) => {
        if ('ready' in reply) {
          worker = started
          resolve(started)
          return
        }
        const pending = waiting.get(reply.id)
        if (!pending) return
        waiting.delete(reply.id)
        if (reply.error) pending.reject(new Error(reply.error))
        else pending.resolve(reply.vectors ?? [])
      })
      started.on('error', (error) => {
        ready = null
        worker = null
        reject(error)
        for (const pending of waiting.values()) pending.reject(error)
        waiting.clear()
      })
      started.on('exit', () => {
        if (worker === started) {
          worker = null
          ready = null
        }
      })
    })
    return ready
  }
  return {
    async embed(texts, kind) {
      if (texts.length === 0) return []
      touch()
      const loaded = await load()
      const id = next++
      // Lo que pide el modelo delante de cada texto
      const prefixed = texts.map((text) => `${kind}: ${text}`)
      return new Promise<number[][]>((resolve, reject) => {
        waiting.set(id, { resolve, reject })
        loaded.postMessage({ id, texts: prefixed })
      })
    },
    async close() {
      if (timer) clearTimeout(timer)
      await unload()
    }
  }
}
