/**
 * Preparar el mapa de una escena desde la página: un hilo (`prepare.worker.ts`) por trabajo, que se para al cancelar.
 * Va en un contexto para que las pruebas de los componentes pongan uno de mentira (sin hilos ni lienzos)
 */
import type { SceneTiles } from '@crisol/contracts'
import { createContext, useContext } from 'react'
import { ApiError } from '../api/client.ts'
import type { DetectedGrid, PreparedUvtt, PrepareSource, WorkerReply, WorkerRequest } from './prepare.ts'

export interface PreparedScene {
  width: number
  height: number
  tiles: SceneTiles
  uvtt: PreparedUvtt | null
}

export interface PrepareEvents {
  /** Ya se sabe lo que mide; preview es la imagen, para verla mientras se trocea (null si ya iba pintada) */
  onImage?(info: { width: number; height: number; preview: Blob | null; total: number }): void
  onProgress?(done: number, total: number): void
}

export interface PrepareJob {
  done: Promise<PreparedScene>
  cancel(): void
}

export interface ScenePreparer {
  prepare(sceneId: string, source: PrepareSource, events?: PrepareEvents): PrepareJob
  /** La rejilla impresa en el mapa ya troceado, o null si no se ve ninguna */
  detect(scene: { id: string; width: number; height: number; tiles: SceneTiles }): Promise<DetectedGrid | null>
}

const newWorker = () => new Worker(new URL('./prepare.worker.ts', import.meta.url), { type: 'module' })

/** Habla con un hilo nuevo hasta que acaba (o falla) y luego lo para */
function run<T>(request: WorkerRequest, onReply: (reply: WorkerReply, finish: (value: T) => void) => void) {
  const worker = newWorker()
  let settle: { resolve: (value: T) => void; reject: (error: unknown) => void } | null = null
  const done = new Promise<T>((resolve, reject) => {
    settle = { resolve, reject }
  })
  const stop = (outcome: { value: T } | { error: unknown }) => {
    worker.terminate()
    if (!settle) return
    if ('value' in outcome) settle.resolve(outcome.value)
    else settle.reject(outcome.error)
    settle = null
  }
  worker.onmessage = (event: MessageEvent<WorkerReply>) => {
    if (event.data.type === 'failed') return stop({ error: new ApiError(event.data.code, 0) })
    onReply(event.data, (value) => stop({ value }))
  }
  worker.onerror = () => stop({ error: new ApiError('UPLOAD_FAILED', 0) })
  // Una imagen ya pintada pasa al hilo sin copiarse
  const transfer = request.type === 'prepare' && request.source.kind === 'bitmap' ? [request.source.bitmap] : []
  worker.postMessage(request, transfer)
  return { done, cancel: () => stop({ error: new ApiError('CANCELLED', 0) }) }
}

export const workerPreparer: ScenePreparer = {
  prepare(sceneId, source, events = {}) {
    const version = crypto.randomUUID()
    return run<PreparedScene>({ type: 'prepare', sceneId, version, source }, (reply, finish) => {
      if (reply.type === 'image') events.onImage?.(reply)
      else if (reply.type === 'progress') events.onProgress?.(reply.done, reply.total)
      else if (reply.type === 'prepared')
        finish({
          width: reply.width,
          height: reply.height,
          tiles: { version, size: reply.size, levels: reply.levels },
          uvtt: reply.uvtt
        })
    })
  },
  detect(scene) {
    return run<DetectedGrid | null>(
      {
        type: 'detect',
        sceneId: scene.id,
        version: scene.tiles.version,
        width: scene.width,
        height: scene.height,
        size: scene.tiles.size,
        levels: scene.tiles.levels
      },
      (reply, finish) => {
        if (reply.type === 'detected') finish(reply.grid)
      }
    ).done
  }
}

export const PreparerContext = createContext<ScenePreparer>(workerPreparer)

export const usePreparer = () => useContext(PreparerContext)
