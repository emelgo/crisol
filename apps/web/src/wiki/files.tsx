/**
 * Los archivos: los de un mundo y, aparte, los comunes de la cuenta, que comparten todos sus mundos (ADR-0005; también
 * en su pantalla, fuera de los mundos). En tarjetas, como los mundos: su miniatura, su nombre y su engranaje (nombre,
 * reemplazar y la zona de peligro). Se suben con el recuadro discontinuo del final (varios o una carpeta) o
 * soltándolos encima; cada subida sale en la lista con su progreso y se puede cancelar, y al acabar es ya su tarjeta.
 * Las carpetas de lo que se sube no cuentan: se ordenan por tipo
 */
import { MAX_FILE_BYTES, TRASH_DAYS } from '@crisol/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Navigate } from '@tanstack/react-router'
import { File as FileIcon, FileText, Plus, Settings, Upload as UploadIcon, X } from 'lucide-react'
import { type DragEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { ApiError, type UploadTarget } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useCodeText, useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { burnCard, closeAtOnce, keepCard, useCardList } from '../components/card-transition.ts'
import { ChangesBar } from '../components/changes.tsx'
import { ConfirmByName, DangerZone } from '../components/danger.tsx'
import dialogStyles from '../components/dialog.module.css'
import { Field, FormError } from '../components/field.tsx'
import { focusAfterRemoving } from '../components/focus.ts'
import form from '../components/form.module.css'
import list from '../components/list.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { Modal } from '../components/modal.tsx'
import { PageTitle } from '../components/page-title.tsx'
import cards from '../routes/world-card.module.css'
import { CoverViewer } from '../routes/world-cover.tsx'
import styles from './files.module.css'
import type { WorldFile } from './links-context.ts'
import { WikiLayout } from './wiki.tsx'

const route = getRouteApi('/mundos/$worldId/archivos')

const KINDS = ['image', 'pdf', 'other'] as const
type Kind = (typeof KINDS)[number]
/** Cuántas subidas a la vez */
const PARALLEL = 3

type Target = { worldId: string } | { organizationId: string }

export function WikiFiles() {
  const { worldId } = route.useParams()
  return (
    <WikiLayout worldId={worldId}>
      {(world) => <FilesPage worldId={worldId} world={world.name} organizationId={world.organizationId} />}
    </WikiLayout>
  )
}

/** Si la cuenta administra la organización: solo entonces sube y cambia los comunes */
function useOwns(organizationId: string | undefined) {
  const api = useApi()
  const organizations = useQuery({ queryKey: ['organizations'], queryFn: () => api.call('listOrganizations', {}) })
  return organizations.data?.organizations.some((o) => o.id === organizationId && o.role === 'owner') ?? false
}

/** Los de un mundo y, aparte, la carpeta de los comunes, la misma en todos sus mundos */
function FilesPage({ worldId, world, organizationId }: { worldId: string; world: string; organizationId: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const commonId = useId()
  const files = useQuery({ queryKey: ['files', worldId], queryFn: () => api.call('listFiles', { worldId }) })
  const ownsCommon = useOwns(organizationId)
  // Las mismas listas mientras no cambien los datos: las tarjetas comparan para saber cuáles son nuevas o se han ido
  const own = useMemo(() => files.data?.files.filter((file) => file.worldId !== null), [files.data])
  const common = useMemo(() => files.data?.files.filter((file) => file.worldId === null), [files.data])
  return (
    <section>
      <PageTitle>{t('files.worldTitle', { world })}</PageTitle>
      {failed(files) && <LoadError error={files.error} onRetry={() => files.refetch()} />}
      <FilesSection target={{ worldId }} name={`archivos-${worldId}`} files={own} canWrite empty={t('files.empty')} />
      <section aria-labelledby={commonId} className={styles.common}>
        <h2 id={commonId}>{t('files.common')}</h2>
        <p className={styles.commonHint}>{t('files.commonHint')}</p>
        <FilesSection
          target={{ organizationId }}
          name={`comunes-${organizationId}`}
          files={common}
          canWrite={ownsCommon}
          empty={t('files.commonEmpty')}
        />
      </section>
    </section>
  )
}

/** Los comunes de la cuenta, en su pantalla, fuera de los mundos («Archivos» en la barra de Mis mundos) */
export function CommonFiles() {
  const { t } = useTranslation()
  const api = useApi()
  const { account, pending } = useAccounts().useAccount()
  const organizations = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.call('listOrganizations', {}),
    enabled: Boolean(account)
  })
  const owned = organizations.data?.organizations.find((o) => o.role === 'owner')
  const files = useQuery({
    queryKey: ['commonFiles'],
    queryFn: () => api.call('listCommonFiles', {}),
    enabled: Boolean(owned)
  })
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  return (
    <section className={styles.page}>
      <PageTitle>{t('files.commonTitle')}</PageTitle>
      <p className={styles.commonHint}>{t('files.commonHint')}</p>
      {failed(files) && <LoadError error={files.error} onRetry={() => files.refetch()} />}
      {owned && (
        <FilesSection
          target={{ organizationId: owned.id }}
          name={`comunes-${owned.id}`}
          files={files.data?.files}
          canWrite
          empty={t('files.commonEmpty')}
        />
      )}
    </section>
  )
}

/**
 * Los archivos de un ámbito en tarjetas, con las subidas en marcha y, si se puede subir, el recuadro para hacerlo;
 * también se sueltan encima. name: su lista (la de card-transition)
 */
function FilesSection({
  target,
  name,
  files,
  canWrite,
  empty
}: {
  target: Target
  name: string
  /** Sin datos aún: undefined */
  files: WorldFile[] | undefined
  canWrite: boolean
  empty: string
}) {
  const { t } = useTranslation()
  const uploads = useUploads(target)
  const [kind, setKind] = useState<Kind | 'all'>('all')
  const [over, setOver] = useState(false)
  const shown = useMemo(() => (kind === 'all' ? files : files?.filter((file) => file.kind === kind)), [files, kind])
  const list = useCardList(name, shown)
  const present = KINDS.filter((k) => files?.some((file) => file.kind === k))
  const drop = async (event: DragEvent) => {
    event.preventDefault()
    setOver(false)
    if (canWrite) uploads.add(await droppedFiles(event.dataTransfer))
  }
  if (!files) return null
  const nothing = files.length === 0 && uploads.items.length === 0
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: soltar es un atajo; el recuadro de subir hace lo mismo con el teclado
    <div
      className={`${styles.zone} ${over ? styles.over : ''}`}
      onDragOver={(event) => {
        if (!canWrite) return
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false)
      }}
      onDrop={drop}
    >
      {present.length > 1 && (
        // biome-ignore lint/a11y/useSemanticElements: unos botones que filtran, no un formulario
        <div className={styles.kinds} role="group" aria-label={t('files.kinds')}>
          {(['all', ...present] as const).map((k) => (
            <button key={k} type="button" className={styles.kind} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {k === 'all' ? t('files.all') : t(`files.groups.${k}`)}
              <span className={styles.count}>
                {k === 'all' ? files.length : files.filter((file) => file.kind === k).length}
              </span>
            </button>
          ))}
        </div>
      )}
      {nothing && !canWrite && <p className={styles.empty}>{empty}</p>}
      <ul className={cards.list} aria-label={t('files.listLabel')} data-card-list>
        {list.map(({ item, fresh, burning, burnt }) => (
          <FileCard
            key={item.id}
            file={item}
            list={name}
            canWrite={canWrite}
            fresh={fresh}
            burning={burning}
            onBurnt={burnt}
          />
        ))}
        {uploads.items.map((upload) => (
          <UploadCard key={upload.key} upload={upload} onCancel={() => uploads.cancel(upload.key)} />
        ))}
        {canWrite && <UploadTile onFiles={uploads.add} />}
      </ul>
      {over && <p className={styles.dropHint}>{t('files.dropHere')}</p>}
    </div>
  )
}

/** «Subir archivos»: un recuadro discontinuo, como «Nuevo mundo», tras el último; y, debajo, una carpeta entera */
function UploadTile({ onFiles }: { onFiles: (files: File[]) => void }) {
  const { t } = useTranslation()
  const several = useRef<HTMLInputElement>(null)
  const folder = useRef<HTMLInputElement>(null)
  const take = (input: HTMLInputElement) => {
    onFiles([...(input.files ?? [])])
    input.value = ''
  }
  return (
    <li className={`${cards.newItem} ${styles.uploadItem}`}>
      <button type="button" className={cards.newCard} onClick={() => several.current?.click()}>
        <Plus aria-hidden="true" size={28} strokeWidth={1.5} />
        {t('files.upload')}
      </button>
      <button type="button" className={styles.folder} onClick={() => folder.current?.click()}>
        {t('files.uploadFolder')}
      </button>
      <input ref={several} type="file" multiple hidden onChange={(event) => take(event.currentTarget)} />
      {/* webkitdirectory: elegir una carpeta (todos los navegadores lo entienden con ese nombre) */}
      <input
        ref={folder}
        type="file"
        hidden
        {...{ webkitdirectory: '' }}
        onChange={(event) => take(event.currentTarget)}
      />
    </li>
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
  /** Para la miniatura de una imagen, mientras sube */
  preview: string | null
  fraction: number
  status: 'waiting' | 'uploading' | 'failed'
  error?: string
}

/**
 * La cola de subidas a un ámbito: unas pocas a la vez, cada una con su progreso. Al acabar, se quita (ya es su
 * tarjeta); la que falla se queda con el motivo hasta quitarla. Cancelar una la corta o la saca de la cola
 */
function useUploads(target: Target) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const codeText = useCodeText()
  const announce = useAnnounce()
  const [items, setItems] = useState<Upload[]>([])
  const queue = useRef<Array<{ key: number; file: File }>>([])
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
      const to: UploadTarget = { ...target, name: next.file.name }
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
            // Ya es su tarjeta
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
  }, [api, target, queryClient, codeText, announce, t, update, remove])

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
          preview: file.type.startsWith('image/') && !tooLarge ? URL.createObjectURL(file) : null,
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

/** Una subida en marcha, con su miniatura (si es una imagen), su progreso y la X para cancelarla */
function UploadCard({ upload, onCancel }: { upload: Upload; onCancel: () => void }) {
  const { t, i18n } = useTranslation()
  const percent = new Intl.NumberFormat(i18n.language, { style: 'percent' }).format(upload.fraction)
  const broken = upload.status === 'failed'
  return (
    <li className={`${cards.card} ${styles.uploading}`}>
      <div className={styles.thumb}>
        {upload.preview ? <img src={upload.preview} alt="" /> : <UploadIcon aria-hidden="true" size={32} />}
        {!broken && (
          <progress
            className={styles.progress}
            value={upload.fraction}
            max={1}
            aria-label={t('files.progress', { name: upload.name })}
          />
        )}
      </div>
      <div className={cards.body}>
        <span className={styles.fileName}>{upload.name}</span>
        <div className={cards.footer}>
          {broken ? (
            <span className={styles.error}>{t('files.failed', { error: upload.error })}</span>
          ) : (
            <span className={cards.role}>{percent}</span>
          )}
          <button
            type="button"
            className={cards.gear}
            aria-label={t(broken ? 'files.dismiss' : 'files.cancelUpload', { name: upload.name })}
            title={t(broken ? 'files.dismiss' : 'files.cancelUpload', { name: upload.name })}
            onClick={onCancel}
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
      </div>
    </li>
  )
}

const sizeText = (bytes: number, locale: string) => {
  const [value, unit] =
    bytes >= 1024 * 1024 ? [bytes / (1024 * 1024), 'megabyte'] : [Math.max(bytes / 1024, 0.1), 'kilobyte']
  return new Intl.NumberFormat(locale, { style: 'unit', unit, maximumFractionDigits: 1 }).format(value)
}

/** La miniatura: la imagen o, si no lo es, su icono */
function Thumb({ file }: { file: WorldFile }) {
  if (file.kind === 'image') return <img src={file.url} alt="" loading="lazy" />
  return file.kind === 'pdf' ? (
    <FileText aria-hidden="true" size={40} strokeWidth={1.25} />
  ) : (
    <FileIcon aria-hidden="true" size={40} strokeWidth={1.25} />
  )
}

/**
 * Un archivo en su tarjeta: toda ella lo abre (una imagen, en grande; lo demás, en otra pestaña) y su engranaje, para
 * quien puede cambiarlo, abre su ventana. fresh: recién subido, se forja; burning: borrado, arde
 */
function FileCard({
  file,
  list: listName,
  canWrite,
  fresh,
  burning,
  onBurnt
}: {
  file: WorldFile
  list: string
  canWrite: boolean
  fresh: boolean
  burning: boolean
  onBurnt: () => void
}) {
  const { t, i18n } = useTranslation()
  const [viewing, setViewing] = useState(false)
  const [entering, setEntering] = useState(fresh)
  const card = useRef<HTMLLIElement>(null)
  const burnt = useRef(onBurnt)
  burnt.current = onBurnt
  useEffect(() => {
    if (!burning) return
    if (typeof card.current?.getAnimations !== 'function') return burnt.current()
    const timer = window.setTimeout(() => burnt.current(), 2000)
    return () => window.clearTimeout(timer)
  }, [burning])
  const classes = [cards.card, entering ? cards.entering : '', burning ? cards.burning : ''].filter(Boolean)
  return (
    <li
      ref={card}
      className={classes.join(' ')}
      aria-hidden={burning || undefined}
      inert={burning}
      onAnimationEnd={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.animationName.includes('enfria')) setEntering(false)
        if (event.animationName.includes('arde')) burnt.current()
      }}
      data-card={file.id}
    >
      <div className={styles.thumb}>
        <Thumb file={file} />
      </div>
      <div className={cards.body}>
        {file.kind === 'image' ? (
          <button
            type="button"
            className={`${cards.name} ${styles.fileName} ${styles.open}`}
            aria-haspopup="dialog"
            onClick={() => setViewing(true)}
          >
            {file.name}
          </button>
        ) : (
          <a
            href={file.url}
            className={`${cards.name} ${styles.fileName}`}
            target="_blank"
            rel="noopener"
            {...(file.kind === 'other' ? { download: file.name } : {})}
          >
            {file.name}
          </a>
        )}
        <div className={cards.footer}>
          <span className={cards.role}>
            {sizeText(file.size, i18n.language)}
            {file.usedBy > 0 && ` · ${t('files.usedBy', { count: file.usedBy })}`}
          </span>
          {canWrite && <FileSettings file={file} list={listName} />}
        </div>
      </div>
      {viewing && <CoverViewer url={file.url} label={file.name} onClose={() => setViewing(false)} />}
    </li>
  )
}

/** El engranaje de un archivo: abre su ventana */
function FileSettings({ file, list: listName }: { file: WorldFile; list: string }) {
  const { t } = useTranslation()
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={cards.gear}
        aria-label={t('files.settingsOf', { name: file.name })}
        title={t('files.settingsOf', { name: file.name })}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Settings aria-hidden="true" size={18} />
      </button>
      {open && (
        <FileDialog
          file={file}
          list={listName}
          onClose={(gone) => {
            setOpen(false)
            if (!gone) trigger.current?.focus()
          }}
        />
      )}
    </>
  )
}

/**
 * La ventana de un archivo: su vista previa, el nombre («Guardar» y «Cancelar» solo con cambios), reemplazarlo por
 * otro (las páginas que lo usan ven el nuevo) y, al final, la zona de peligro. onClose(gone): si se ha borrado
 */
function FileDialog({
  file,
  list: listName,
  onClose
}: {
  file: WorldFile
  list: string
  onClose: (gone: boolean) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const announce = useAnnounce()
  const dialog = useRef<HTMLDialogElement>(null)
  const replaceInput = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const gone = useRef(false)
  const [name, setName] = useState(file.name)
  // Un común sale en los archivos de todos los mundos
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['files'] }),
      queryClient.invalidateQueries({ queryKey: ['commonFiles'] })
    ])
  const rename = useMutation({
    mutationFn: async () => {
      await api.call('renameFile', { fileId: file.id, name: name.trim() })
      await refresh()
    }
  })
  const replace = useMutation({
    mutationFn: async (chosen: File) => {
      if (chosen.size > MAX_FILE_BYTES) throw new ApiError('TOO_LARGE', 413)
      await api.uploadFile({ fileId: file.id }, chosen)
      await refresh()
    },
    onSuccess: () => announce(t('files.replaced', { name: file.name }))
  })
  // Borrado, su tarjeta arde en su sitio: el foco, a la siguiente
  const remove = async () => {
    await api.call('deleteFile', { fileId: file.id })
    const card = document.querySelector(`[data-card="${file.id}"]`)
    keepCard(listName, file, card?.parentElement ? [...card.parentElement.children].indexOf(card) : 0)
    const after = focusAfterRemoving(card)
    gone.current = true
    closeAtOnce(dialog.current)
    await burnCard(file.id, refresh)
    after()
  }
  const changed = name.trim() !== file.name
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={cards.dialog} onClose={() => onClose(gone.current)}>
      <div className={styles.preview}>
        <Thumb file={file} />
      </div>
      <form
        className={cards.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (changed) rename.mutate()
        }}
      >
        <h2 id={titleId}>{t('files.settingsOf', { name: file.name })}</h2>
        <Field
          label={t('files.name')}
          value={name}
          required
          maxLength={200}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <FormError message={rename.error ? errorText(rename.error) : null} />
        <ChangesBar shown={changed}>
          <BusyButton type="submit" className={form.button} busy={rename.isPending}>
            {t('files.save')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => setName(file.name)}>
            {t('files.cancel')}
          </button>
        </ChangesBar>
        <div>
          <BusyButton
            className={`${list.secondary} ${styles.replace}`}
            busy={replace.isPending}
            onClick={() => replaceInput.current?.click()}
          >
            <UploadIcon aria-hidden="true" size={16} />
            {t('files.replace')}
          </BusyButton>
          <input
            ref={replaceInput}
            type="file"
            hidden
            onChange={(event) => {
              const chosen = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (chosen) replace.mutate(chosen)
            }}
          />
          <FormError message={replace.error ? errorText(replace.error) : null} />
        </div>
      </form>
      <div className={cards.dangerArea}>
        <DangerZone>
          <ConfirmByName
            name={file.name}
            action={t('files.delete')}
            title={t('files.deleteTitle', { name: file.name })}
            warning={
              file.usedBy > 0
                ? t('files.deleteUsed', { count: file.usedBy, days: TRASH_DAYS })
                : t('files.deleteWarning', { days: TRASH_DAYS })
            }
            label={t('files.name')}
            typed={false}
            onConfirm={remove}
          />
        </DangerZone>
      </div>
    </Modal>
  )
}
