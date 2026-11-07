/**
 * Preparar el mapa de una escena (trocearlo y subirlo) y ponérselo: lo usan la pestaña de la página, al elegir la
 * imagen, y la mesa, con una escena que creó la IA con un archivo del mundo (aún sin trocear)
 */
import type { SceneView } from '@crisol/contracts'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import type { PrepareSource } from './prepare.ts'
import { usePreparer } from './preparer.ts'
import { sceneListKey, sceneTabKey } from './queries.ts'

/** De dónde sale el mapa: una imagen del mundo, una que se elige, un UVTT, o el archivo que ya tiene (la IA) */
export type SceneChoice =
  | { kind: 'world'; file: { id: string; url: string } }
  | { kind: 'image'; file: Blob }
  | { kind: 'uvtt'; file: Blob }
  | { kind: 'own'; fileId: string }

export type Preparation =
  | { status: 'idle' }
  | {
      status: 'preparing'
      done: number
      total: number
      /** La imagen, para verla mientras se trocea (una dirección de objeto) */
      preview: string | null
      size: { width: number; height: number } | null
    }
  | { status: 'failed'; error: unknown }

/**
 * Un SVG (los mapas que dibuja la IA) se pinta aquí, en la página, a su tamaño: el hilo que trocea no sabe
 * descodificarlo. Con sus filtros (feTurbulence…), tal cual los pinta el navegador
 */
async function paintSvg(svg: Blob, size: { width: number; height: number } | null): Promise<ImageBitmap> {
  const url = URL.createObjectURL(svg)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const width = Math.round(size?.width ?? (image.naturalWidth || 1600))
    const height = Math.round(size?.height ?? (image.naturalHeight || 1200))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new ApiError('BAD_IMAGE', 0)
    context.drawImage(image, 0, 0, width, height)
    return await createImageBitmap(canvas)
  } catch (error) {
    throw error instanceof ApiError ? error : new ApiError('BAD_IMAGE', 0)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Lo que se le pasa al hilo que trocea, y la imagen para enseñarla mientras tanto */
async function sourceOf(
  choice: SceneChoice,
  size: { width: number; height: number } | null
): Promise<{ source: PrepareSource; preview: Blob | null }> {
  if (choice.kind === 'uvtt') return { source: { kind: 'uvtt', blob: choice.file }, preview: null }
  if (choice.kind === 'image') return { source: { kind: 'image', blob: choice.file }, preview: null }
  const response = await fetch(choice.kind === 'world' ? choice.file.url : `/api/files/${choice.fileId}`)
  if (!response.ok) throw new ApiError('BAD_IMAGE', response.status)
  const blob = await response.blob()
  if (blob.type !== 'image/svg+xml') return { source: { kind: 'image', blob }, preview: null }
  return { source: { kind: 'bitmap', bitmap: await paintSvg(blob, size) }, preview: blob }
}

/** Las escenas que se están preparando en esta pestaña del navegador: no se preparan dos veces a la vez */
const busy = new Set<string>()

export function useScenePreparation(worldId: string) {
  const api = useApi()
  const preparer = usePreparer()
  const queryClient = useQueryClient()
  const [state, setState] = useState<Preparation>({ status: 'idle' })
  const job = useRef<{ cancel(): void; sceneId: string } | null>(null)
  const preview = useRef<string | null>(null)

  const release = useCallback(() => {
    if (preview.current) URL.revokeObjectURL(preview.current)
    preview.current = null
    if (job.current) busy.delete(job.current.sceneId)
    job.current = null
  }, [])

  const start = useCallback(
    async (scene: SceneView, choice: SceneChoice) => {
      if (busy.has(scene.id)) return
      busy.add(scene.id)
      setState({ status: 'preparing', done: 0, total: 0, preview: null, size: null })
      // Mientras se baja (o se pinta) el archivo, cancelar ya vale
      let cancelled = false
      job.current = {
        cancel: () => {
          cancelled = true
        },
        sceneId: scene.id
      }
      try {
        // La IA solo da el archivo: un SVG se pinta a las medidas que leyó el servidor
        const { source, preview: painted } = await sourceOf(choice, choice.kind === 'own' ? scene.image : null)
        if (cancelled) throw new ApiError('CANCELLED', 0)
        const running = preparer.prepare(scene.id, source, {
          onImage: ({ width, height, preview: image, total }) => {
            const shown = image ?? painted
            preview.current = shown ? URL.createObjectURL(shown) : null
            setState({ status: 'preparing', done: 0, total, preview: preview.current, size: { width, height } })
          },
          onProgress: (done, total) =>
            setState((current) => (current.status === 'preparing' ? { ...current, done, total } : current))
        })
        job.current = { cancel: running.cancel, sceneId: scene.id }
        const prepared = await running.done
        let placed = await api.call('setSceneImage', {
          sceneId: scene.id,
          width: prepared.width,
          height: prepared.height,
          tiles: prepared.tiles,
          // Una imagen nueva deja el archivo de antes y lo que traía un UVTT; la que ya tenía (la IA), no
          ...(choice.kind === 'world' ? { fileId: choice.file.id } : choice.kind === 'own' ? {} : { fileId: null }),
          ...(choice.kind === 'own' ? {} : { imported: prepared.uvtt?.imported ?? null })
        })
        if (prepared.uvtt) placed = await api.call('updateScene', { sceneId: scene.id, grid: prepared.uvtt.grid })
        queryClient.setQueryData(sceneTabKey(worldId, scene.tabId), placed)
        void queryClient.invalidateQueries({ queryKey: sceneListKey(worldId) })
        release()
        setState({ status: 'idle' })
        return placed
      } catch (error) {
        release()
        setState(
          error instanceof Error && 'code' in error && error.code === 'CANCELLED'
            ? { status: 'idle' }
            : { status: 'failed', error }
        )
        return null
      }
    },
    [api, preparer, queryClient, release, worldId]
  )

  const cancel = useCallback(() => job.current?.cancel(), [])
  // Al irse (otra página, otra escena), se para
  useEffect(() => () => job.current?.cancel(), [])

  return { state, start, cancel }
}
