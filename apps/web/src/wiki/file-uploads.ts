/** Subir archivos: la cola de subidas, con su progreso, y lo que se suelta del escritorio */

import { looksUploadable, MAX_FILE_BYTES } from '@crisol/domain'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError, type UploadTarget } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useCodeText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'

/** Cuántas subidas a la vez */
export const PARALLEL = 3

export type Target = { worldId: string } | { organizationId: string }

/** Lo que se soltó: los archivos y, de las carpetas, todo lo que tengan dentro */
export async function droppedFiles(data: DataTransfer): Promise<File[]> {
  const entries = [...data.items].map((item) => item.webkitGetAsEntry?.()).filter((entry) => entry != null)
  if (entries.length === 0) return [...data.files]
  const found: File[] = []
  const visit = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      found.push(await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject)))
      return
    }
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    // Las carpetas se leen por tandas, hasta que una viene vacía
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject))
      if (batch.length === 0) return
      for (const child of batch) await visit(child)
    }
  }
  for (const entry of entries) await visit(entry)
  return found
}

export type Upload = {
  key: number
  name: string
  /** Para la miniatura de una imagen, mientras sube */
  preview: string | null
  fraction: number
  status: 'waiting' | 'uploading' | 'failed'
  error?: string
  /** La carpeta de la lista bajo la que sale mientras sube (null: lo más alto) */
  place: string | null
}

/**
 * La cola de subidas: unas pocas a la vez, cada una con su progreso. Al acabar, se quita (ya es su
 * fila); la que falla se queda con el motivo hasta quitarla. Cancelar una la corta o la saca de la cola
 */
export function useUploads() {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const codeText = useCodeText()
  const announce = useAnnounce()
  const [items, setItems] = useState<Upload[]>([])
  const queue = useRef<Array<{ key: number; file: File; target: Target; folderId: string | null }>>([])
  const controllers = useRef(new Map<number, AbortController>())
  const running = useRef(0)
  const finished = useRef(0)
  const failedCount = useRef(0)
  const nextKey = useRef(0)
  const update = useCallback(
    (key: number, patch: Partial<Upload>) =>
      setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item))),
    []
  )
  const remove = useCallback((key: number) => {
    setItems((current) => {
      const gone = current.find((item) => item.key === key)
      if (gone?.preview) URL.revokeObjectURL(gone.preview)
      return current.filter((item) => item.key !== key)
    })
  }, [])
  // Al irse de la pantalla, lo que sube se corta
  useEffect(() => {
    const live = controllers.current
    return () => {
      for (const controller of live.values()) controller.abort()
    }
  }, [])

  const pump = useCallback(() => {
    while (running.current < PARALLEL && queue.current.length > 0) {
      const next = queue.current.shift()
      if (!next) break
      running.current++
      const controller = new AbortController()
      controllers.current.set(next.key, controller)
      update(next.key, { status: 'uploading' })
      const to: UploadTarget = { ...next.target, name: next.file.name, folderId: next.folderId }
      api
        .uploadFile(to, next.file, (fraction) => update(next.key, { fraction }), controller.signal)
        .then(
          async () => {
            finished.current++
            // Un común sale en los archivos de todos los mundos
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['files'] }),
              queryClient.invalidateQueries({ queryKey: ['commonFiles'] })
            ])
            // Ya es su fila
            remove(next.key)
          },
          (error: unknown) => {
            if (error instanceof ApiError && error.code === 'CANCELLED') return
            failedCount.current++
            update(next.key, {
              status: 'failed',
              error: codeText(error instanceof ApiError ? error.code : 'UNKNOWN')
            })
          }
        )
        .finally(() => {
          controllers.current.delete(next.key)
          running.current--
          // Al acabar la tanda, lo que se subió y lo que no
          if (running.current === 0 && queue.current.length === 0 && finished.current + failedCount.current > 0) {
            const done = t('files.uploadedAll', { count: finished.current })
            announce(failedCount.current > 0 ? `${done} ${t('files.failedAll', { count: failedCount.current })}` : done)
            finished.current = 0
            failedCount.current = 0
          }
          pump()
        })
    }
  }, [api, queryClient, codeText, announce, t, update, remove])

  /**
   * Sube estos a un ámbito (un mundo o los comunes) y a una de sus carpetas (null: a lo más alto). place: la carpeta de
   * la lista bajo la que salen mientras suben
   */
  const add = useCallback(
    (files: File[], target: Target, folderId: string | null, place: string | null) => {
      // Lo oculto de las carpetas (.DS_Store y compañía) no se sube
      const wanted = files.filter((file) => !file.name.startsWith('.'))
      const added = wanted.map((file) => {
        const key = nextKey.current++
        // Lo que no se admite (un programa, un script…) ni se intenta; el servidor lo comprueba igualmente
        const refused = !looksUploadable(file.name) ? 'BAD_TYPE' : file.size > MAX_FILE_BYTES ? 'TOO_LARGE' : null
        if (!refused) queue.current.push({ key, file, target, folderId })
        return {
          key,
          name: file.name,
          preview: file.type.startsWith('image/') && !refused ? URL.createObjectURL(file) : null,
          fraction: 0,
          status: refused ? 'failed' : 'waiting',
          place,
          ...(refused ? { error: codeText(refused) } : {})
        } satisfies Upload
      })
      setItems((current) => [...current, ...added])
      pump()
    },
    [pump, codeText]
  )

  /** Cancela una subida (o quita una que falló) */
  const cancel = useCallback(
    (key: number) => {
      queue.current = queue.current.filter((queued) => queued.key !== key)
      controllers.current.get(key)?.abort()
      remove(key)
    },
    [remove]
  )
  return { items, add, cancel }
}
