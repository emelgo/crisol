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
  /** Lo más que espera una petición (60 segundos) */
  timeoutMs?: number
  threads?: number
}): Embedder | null {
  const { dir } = options
  if (!existsSync(join(dir, 'model.onnx')) || !existsSync(join(dir, 'sentencepiece.bpe.model'))) return null
  const idleMs = options.idleMs ?? 10 * 60_000
  /** Lo más que espera una petición (un hilo atascado no deja nada colgado) */
  const timeoutMs = options.timeoutMs ?? 60_000
  let worker: Worker | null = null
  let starting: Worker | null = null
  let ready: Promise<Worker> | null = null
  /** Lo que hace fallar la carga en curso (si se descarga a medias) */
  let abortLoad: ((error: Error) => void) | null = null
  let timer: NodeJS.Timeout | null = null
  let next = 0
  const waiting = new Map<number, { resolve: (v: number[][]) => void; reject: (e: Error) => void }>()
  const failAll = (error: Error) => {
    for (const pending of waiting.values()) pending.reject(error)
    waiting.clear()
  }

  const unload = async () => {
    // También el que aún está cargando: si no, queda suelto con su memoria
    const current = worker ?? starting
    worker = null
    starting = null
    ready = null
    abortLoad?.(new Error('El modelo se ha descargado'))
    abortLoad = null
    failAll(new Error('El modelo se ha descargado'))
    await current?.terminate()
  }
  /** Tras un rato sin uso, se descarga; mientras carga o calcula, no (se vuelve a mirar luego) */
  const touch = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      if (starting || waiting.size > 0) touch()
      else void unload()
    }, idleMs)
    timer.unref()
  }
  const load = () => {
    ready ??= new Promise<Worker>((resolve, reject) => {
      abortLoad = reject
      const started = new Worker(new URL('./model-worker.ts', import.meta.url), {
        workerData: { dir, threads: options.threads ?? 2 },
        // Sin las opciones de Node que no valen para un archivo (--input-type, de un -e)
        execArgv: process.execArgv.filter((arg) => !arg.startsWith('--input-type'))
      })
      starting = started
      started.on('message', (reply: Reply) => {
        if ('ready' in reply) {
          // Si mientras cargaba se pidió descargarlo, fuera
          if (starting !== started) {
            void started.terminate()
            reject(new Error('El modelo se ha descargado'))
            return
          }
          starting = null
          abortLoad = null
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
        if (worker === started || starting === started) {
          worker = null
          starting = null
          ready = null
        }
        reject(error)
        failAll(error)
      })
      // Si el hilo acaba (sin error o terminado), lo que esperaba falla: nada se queda colgado
      started.on('exit', () => {
        if (worker === started || starting === started) {
          worker = null
          starting = null
          ready = null
          reject(new Error('El hilo del modelo ha terminado'))
          failAll(new Error('El hilo del modelo ha terminado'))
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
        const timeout = setTimeout(() => {
          waiting.delete(id)
          reject(new Error('El modelo tarda demasiado'))
        }, timeoutMs)
        waiting.set(id, {
          resolve: (vectors) => {
            clearTimeout(timeout)
            touch()
            resolve(vectors)
          },
          reject: (error) => {
            clearTimeout(timeout)
            reject(error)
          }
        })
        loaded.postMessage({ id, texts: prefixed })
      })
    },
    async close() {
      if (timer) clearTimeout(timer)
      await unload()
    }
  }
}
