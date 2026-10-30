/**
 * Los archivos del mundo: subirlos (con botón, varios o una carpeta, o arrastrándolos), con su progreso, y la lista por
 * tipo, con renombrar, reemplazar y mandar a la papelera. Las carpetas de lo que se sube no cuentan: se ordenan por tipo
 */
import { MAX_FILE_BYTES } from '@crisol/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { type DragEvent, useCallback, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useCodeText, useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import list from '../components/list.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { RenamableItem } from '../components/renamable-item.tsx'
import styles from './files.module.css'
import type { WorldFile } from './links-context.ts'
import { WikiLayout } from './wiki.tsx'

const route = getRouteApi('/mundos/$worldId/archivos')

const KINDS = ['image', 'pdf', 'other'] as const
/** Cuántas subidas a la vez */
const PARALLEL = 3

export function WikiFiles() {
  const { worldId } = route.useParams()
  return <WikiLayout worldId={worldId}>{(world) => <FilesPage worldId={worldId} world={world.name} />}</WikiLayout>
}

function FilesPage({ worldId, world }: { worldId: string; world: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const files = useQuery({ queryKey: ['files', worldId], queryFn: () => api.call('listFiles', { worldId }) })
  const uploads = useUploads(worldId)
  return (
    <section>
      <PageTitle>{t('files.worldTitle', { world })}</PageTitle>
      <Uploader onFiles={uploads.add} />
      <UploadList uploads={uploads.items} onClear={uploads.clear} />
      {failed(files) && <LoadError error={files.error} onRetry={() => files.refetch()} />}
      {files.data &&
        (files.data.files.length === 0 ? (
          <p>{t('files.empty')}</p>
        ) : (
          KINDS.map((kind) => (
            <FileGroup key={kind} kind={kind} files={files.data.files.filter((file) => file.kind === kind)} />
          ))
        ))}
    </section>
  )
}

/** Los botones de subir y la zona donde soltar archivos o carpetas */
function Uploader({ onFiles }: { onFiles: (files: File[]) => void }) {
  const { t } = useTranslation()
  const several = useRef<HTMLInputElement>(null)
  const folder = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const take = (input: HTMLInputElement) => {
    onFiles([...(input.files ?? [])])
    input.value = ''
  }
  const drop = async (event: DragEvent) => {
    event.preventDefault()
    setOver(false)
    onFiles(await droppedFiles(event.dataTransfer))
  }
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: soltar es un atajo; los botones hacen lo mismo con el teclado
    <div
      className={`${styles.drop} ${over ? styles.over : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
    >
      <div className={styles.buttons}>
        <button type="button" className={form.button} onClick={() => several.current?.click()}>
          {t('files.upload')}
        </button>
        <button type="button" className={list.secondary} onClick={() => folder.current?.click()}>
          {t('files.uploadFolder')}
        </button>
      </div>
      <p className={styles.hint}>{over ? t('files.dropHere') : t('files.drop')}</p>
      <input ref={several} type="file" multiple hidden onChange={(event) => take(event.currentTarget)} />
      {/* webkitdirectory: elegir una carpeta (todos los navegadores lo entienden con ese nombre) */}
      <input
        ref={folder}
        type="file"
        hidden
        {...{ webkitdirectory: '' }}
        onChange={(event) => take(event.currentTarget)}
      />
    </div>
  )
}

/** Lo que se soltó: los archivos y, de las carpetas, todo lo que tengan dentro */
async function droppedFiles(data: DataTransfer): Promise<File[]> {
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

type Upload = {
  key: number
  name: string
  fraction: number
  status: 'waiting' | 'uploading' | 'done' | 'failed'
  error?: string
}

/** La cola de subidas: unas pocas a la vez, cada una con su progreso */
function useUploads(worldId: string) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const codeText = useCodeText()
  const announce = useAnnounce()
  const [items, setItems] = useState<Upload[]>([])
  const queue = useRef<Array<{ key: number; file: File }>>([])
  const running = useRef(0)
  const finished = useRef(0)
  const nextKey = useRef(0)
  const update = useCallback(
    (key: number, patch: Partial<Upload>) =>
      setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item))),
    []
  )

  const pump = useCallback(() => {
    while (running.current < PARALLEL && queue.current.length > 0) {
      const next = queue.current.shift()
      if (!next) break
      running.current++
      update(next.key, { status: 'uploading' })
      api
        .uploadFile({ worldId, name: next.file.name }, next.file, (fraction) => update(next.key, { fraction }))
        .then(
          () => {
            finished.current++
            update(next.key, { status: 'done', fraction: 1 })
            void queryClient.invalidateQueries({ queryKey: ['files', worldId] })
          },
          (error: unknown) =>
            update(next.key, {
              status: 'failed',
              error: codeText(error instanceof ApiError ? error.code : 'UNKNOWN')
            })
        )
        .finally(() => {
          running.current--
          if (running.current === 0 && queue.current.length === 0 && finished.current > 0) {
            announce(t('files.uploadedAll', { count: finished.current }))
            finished.current = 0
          }
          pump()
        })
    }
  }, [api, worldId, queryClient, codeText, announce, t, update])

  const add = useCallback(
    (files: File[]) => {
      // Lo oculto de las carpetas (.DS_Store y compañía) no se sube
      const wanted = files.filter((file) => !file.name.startsWith('.'))
      const added = wanted.map((file) => {
        const key = nextKey.current++
        const tooLarge = file.size > MAX_FILE_BYTES
        if (!tooLarge) queue.current.push({ key, file })
        return {
          key,
          name: file.name,
          fraction: 0,
          status: tooLarge ? 'failed' : 'waiting',
          ...(tooLarge ? { error: codeText('TOO_LARGE') } : {})
        } satisfies Upload
      })
      setItems((current) => [...current, ...added])
      pump()
    },
    [pump, codeText]
  )

  const clear = useCallback(
    () => setItems((current) => current.filter((item) => item.status === 'waiting' || item.status === 'uploading')),
    []
  )
  return { items, add, clear }
}

function UploadList({ uploads, onClear }: { uploads: Upload[]; onClear: () => void }) {
  const { t } = useTranslation()
  const headingId = useId()
  if (uploads.length === 0) return null
  const anyFinished = uploads.some((upload) => upload.status === 'done' || upload.status === 'failed')
  return (
    <section aria-labelledby={headingId} className={styles.uploads}>
      <h2 id={headingId}>{t('files.uploads')}</h2>
      <ul className={styles.uploadList}>
        {uploads.map((upload) => (
          <li key={upload.key} className={styles.upload}>
            <span className={styles.uploadName}>{upload.name}</span>
            {upload.status === 'failed' ? (
              <span className={styles.error}>{t('files.failed', { error: upload.error })}</span>
            ) : upload.status === 'done' ? (
              <span className={styles.done}>{t('files.uploaded')}</span>
            ) : (
              <progress
                className={styles.progress}
                value={upload.fraction}
                max={1}
                aria-label={t('files.progress', { name: upload.name })}
              />
            )}
          </li>
        ))}
      </ul>
      {anyFinished && (
        <button type="button" className={list.secondary} onClick={onClear}>
          {t('files.clear')}
        </button>
      )}
    </section>
  )
}

function FileGroup({ kind, files }: { kind: (typeof KINDS)[number]; files: WorldFile[] }) {
  const { t } = useTranslation()
  const headingId = useId()
  if (files.length === 0) return null
  return (
    <section aria-labelledby={headingId} className={styles.group}>
      <h2 id={headingId}>
        {t(`files.groups.${kind}`)} <span className={styles.count}>({files.length})</span>
      </h2>
      <ul className={list.list}>
        {files.map((file) => (
          <FileItem key={file.id} file={file} />
        ))}
      </ul>
    </section>
  )
}

const sizeText = (bytes: number, locale: string) => {
  const [value, unit] =
    bytes >= 1024 * 1024 ? [bytes / (1024 * 1024), 'megabyte'] : [Math.max(bytes / 1024, 0.1), 'kilobyte']
  return new Intl.NumberFormat(locale, { style: 'unit', unit, maximumFractionDigits: 1 }).format(value)
}

function FileItem({ file }: { file: WorldFile }) {
  const { t, i18n } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['files', file.worldId] })
  return (
    <RenamableItem
      name={file.name}
      role={sizeText(file.size, i18n.language)}
      href={file.url}
      maxLength={200}
      deleteWarning={file.usedBy > 0 ? t('files.deleteUsed', { name: file.name, count: file.usedBy }) : undefined}
      onRename={async (name) => {
        await api.call('renameFile', { fileId: file.id, name })
        await refresh()
      }}
      onDelete={async () => {
        await api.call('deleteFile', { fileId: file.id })
        await refresh()
      }}
    >
      <ReplaceButton file={file} onReplaced={refresh} />
    </RenamableItem>
  )
}

/** Reemplazar: otro archivo con el mismo nombre (las páginas que lo usan ven el nuevo) */
function ReplaceButton({ file, onReplaced }: { file: WorldFile; onReplaced: () => Promise<unknown> }) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const announce = useAnnounce()
  const input = useRef<HTMLInputElement>(null)
  const replace = useMutation({
    mutationFn: (chosen: File) => {
      if (chosen.size > MAX_FILE_BYTES) throw new ApiError('TOO_LARGE', 413)
      return api.uploadFile({ fileId: file.id }, chosen)
    },
    onSuccess: async () => {
      await onReplaced()
      announce(t('files.replaced', { name: file.name }))
    }
  })
  return (
    <>
      <BusyButton
        className={list.secondary}
        aria-label={t('files.replaceButton', { name: file.name })}
        busy={replace.isPending}
        onClick={() => input.current?.click()}
      >
        {t('files.replace')}
      </BusyButton>
      <input
        ref={input}
        type="file"
        hidden
        onChange={(event) => {
          const chosen = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (chosen) replace.mutate(chosen)
        }}
      />
      <FormError message={replace.error ? errorText(replace.error) : null} />
    </>
  )
}
