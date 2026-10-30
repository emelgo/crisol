/**
 * Los archivos: los de un mundo y, aparte, los comunes de la cuenta, que comparten todos sus mundos (ADR-0005; también
 * en su pantalla, fuera de los mundos). En tarjetas, como los mundos: su miniatura, su nombre y su engranaje (nombre,
 * carpeta, reemplazar y la zona de peligro). Se ordenan en carpetas, que solo ordenan (el nombre de un archivo es único
 * en su ámbito); se buscan por nombre y se filtran por tipo. Se suben con el recuadro discontinuo del final o
 * soltándolos encima, a la carpeta abierta; cada subida sale con su progreso y se puede cancelar, y al acabar es ya su
 * tarjeta. Un archivo se mueve arrastrándolo a una carpeta
 */

import type { FolderView } from '@crisol/contracts'
import { looksUploadable, MAX_FILE_BYTES, TRASH_DAYS, UPLOAD_ACCEPT } from '@crisol/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Navigate } from '@tanstack/react-router'
import {
  ChevronRight,
  File as FileIcon,
  Files,
  FileText,
  Folder,
  FolderPlus,
  LayoutGrid,
  List,
  Search,
  Settings,
  Upload as UploadIcon,
  X
} from 'lucide-react'
import { type DragEvent, type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { ApiError, type UploadTarget } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useCodeText, useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { ChangesBar } from '../components/changes.tsx'
import { ConfirmByName, DangerZone } from '../components/danger.tsx'
import dialogStyles from '../components/dialog.module.css'
import { Field, FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import list from '../components/list.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { Modal } from '../components/modal.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Tour } from '../components/tour.tsx'
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
  // Las mismas listas mientras no cambien los datos
  const own = useMemo(
    () =>
      files.data && {
        files: files.data.files.filter((f) => f.worldId !== null),
        folders: (files.data.folders ?? []).filter((f) => f.worldId !== null)
      },
    [files.data]
  )
  const common = useMemo(
    () =>
      files.data && {
        files: files.data.files.filter((f) => f.worldId === null),
        folders: (files.data.folders ?? []).filter((f) => f.worldId === null)
      },
    [files.data]
  )
  return (
    <section>
      <PageTitle>{t('files.worldTitle', { world })}</PageTitle>
      {failed(files) && <LoadError error={files.error} onRetry={() => files.refetch()} />}
      <FilesSection target={{ worldId }} data={own} canWrite empty={t('files.empty')} />
      {files.data && <FilesTour />}
      <section aria-labelledby={commonId} className={styles.common}>
        <h2 id={commonId}>{t('files.common')}</h2>
        <FilesSection target={{ organizationId }} data={common} canWrite={ownsCommon} empty={t('files.commonEmpty')} />
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
      {failed(files) && <LoadError error={files.error} onRetry={() => files.refetch()} />}
      {owned ? (
        <FilesSection
          target={{ organizationId: owned.id }}
          data={files.data}
          canWrite
          empty={t('files.commonEmpty')}
          title={<PageTitle>{t('files.commonTitle')}</PageTitle>}
        />
      ) : (
        <PageTitle>{t('files.commonTitle')}</PageTitle>
      )}
      {owned && files.data && <FilesTour />}
    </section>
  )
}

/** El tutorial guiado de Archivos: subir, las carpetas y buscar */
function FilesTour() {
  const { t } = useTranslation()
  return (
    <Tour
      id="archivos"
      steps={[
        { target: '[data-tour="archivos-subir"]', text: t('tour.files.upload') },
        { target: '[data-tour="archivos-carpetas"]', text: t('tour.files.folders'), placement: 'right' },
        { target: '[data-tour="archivos-buscar"]', text: t('tour.files.search') }
      ]}
    />
  )
}

/** Los archivos y las carpetas de un ámbito */
type Scope = { files: WorldFile[]; folders: FolderView[] }

/** El tipo de dato que lleva un archivo arrastrado (para meterlo en una carpeta) */
const DRAGGED = 'application/x-crisol-archivo'

/** Las ya vistas: las que lleguen después (recién subidas o creadas) entran con su animación; al cargar, ninguna */
function useFresh(ids: readonly string[] | undefined) {
  const seen = useRef<Set<string> | null>(null)
  if (ids && !seen.current) seen.current = new Set(ids)
  useEffect(() => {
    for (const id of ids ?? []) seen.current?.add(id)
  }, [ids])
  return (id: string) => Boolean(seen.current && !seen.current.has(id))
}

/** Cómo se ve lo de la carpeta: en lista (cabe mucho) o en tarjetas; se recuerda en este navegador */
type View = 'list' | 'cards'
const VIEW_KEY = 'crisol.archivos.vista'
function useView(): [View, (view: View) => void] {
  const [view, setView] = useState<View>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'cards' ? 'cards' : 'list'
    } catch {
      return 'list'
    }
  })
  const choose = (next: View) => {
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {}
  }
  return [view, choose]
}

/**
 * Los archivos de un ámbito, como un explorador: a la izquierda el árbol de sus carpetas; a la derecha lo de la carpeta
 * elegida (sus carpetas y sus archivos), en lista o en tarjetas, con las subidas en marcha. Arriba, buscar (en todas),
 * filtrar por tipo y subir; también se sueltan encima. Un archivo se mueve arrastrándolo a una carpeta del árbol
 */
function FilesSection({
  target,
  data,
  canWrite,
  empty,
  title
}: {
  target: Target
  /** Sin datos aún: undefined */
  data: Scope | undefined
  canWrite: boolean
  empty: string
  /** El título de la página: con él, la columna del centro y los paneles a los lados */
  title?: ReactNode
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const uploads = useUploads(target)
  const several = useRef<HTMLInputElement>(null)
  const [folderId, setFolderId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<Kind | 'all'>('all')
  const [view, setView] = useView()
  const [over, setOver] = useState(false)
  const [received, setReceived] = useState<string | null>(null)
  // El archivo elegido (pulsando su fila), que sale en el panel de la derecha
  const [selected, setSelected] = useState<string | null>(null)
  const folders = data?.folders ?? []
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  // Si la elegida deja de existir (borrada aquí o en otra pestaña), a lo más alto
  const open = folderId && byId.has(folderId) ? folderId : null
  const pathOf = (id: string | null): FolderView[] => {
    const path: FolderView[] = []
    for (let at = id ? byId.get(id) : undefined; at; at = at.parentId ? byId.get(at.parentId) : undefined) {
      path.unshift(at)
    }
    return path
  }
  const searching = query.trim() !== ''
  const wanted = query.trim().toLocaleLowerCase('es')
  const shownFiles = (data?.files ?? []).filter(
    (file) =>
      (searching ? file.name.toLocaleLowerCase('es').includes(wanted) : (file.folderId ?? null) === open) &&
      (kind === 'all' || file.kind === kind)
  )
  const shownFolders = searching || kind !== 'all' ? [] : folders.filter((folder) => folder.parentId === open)
  const ids = useMemo(() => data && [...data.files.map((f) => f.id), ...(data.folders ?? []).map((f) => f.id)], [data])
  const fresh = useFresh(ids)
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['files'] }),
      queryClient.invalidateQueries({ queryKey: ['commonFiles'] })
    ])
  const announce = useAnnounce()
  // Al soltarlo, dice adónde ha ido
  const moveInto = async (fileId: string, to: string | null) => {
    const file = data?.files.find((f) => f.id === fileId)
    if (!file || (file.folderId ?? null) === to) return
    await api.call('moveFile', { fileId, folderId: to })
    await refresh()
    announce(t('files.moved', { name: file.name, folder: to ? (byId.get(to)?.name ?? '') : t('files.root') }))
    // Y la carpeta que lo recibe se ilumina un momento en el árbol
    setReceived(to ?? 'todos')
    window.setTimeout(() => setReceived(null), 1400)
  }
  const drop = async (event: DragEvent) => {
    event.preventDefault()
    setOver(false)
    // Un archivo de la lista arrastrado fuera de una carpeta no se sube
    if (canWrite && event.dataTransfer.types.includes('Files'))
      uploads.add(await droppedFiles(event.dataTransfer), open)
  }
  if (!data) return null
  const path = pathOf(open)
  const nothing = data.files.length === 0 && folders.length === 0 && uploads.items.length === 0
  if (nothing && !canWrite) return <p className={styles.empty}>{empty}</p>
  const rowProps = { folders, canWrite, onChanged: refresh }
  const tools = (
    <div className={styles.tools}>
      {canWrite && (
        <>
          <button
            type="button"
            className={`${form.button} ${styles.uploadButton}`}
            onClick={() => several.current?.click()}
          >
            <UploadIcon aria-hidden="true" size={16} />
            {t('files.upload')}
          </button>
          <input
            ref={several}
            type="file"
            multiple
            accept={UPLOAD_ACCEPT}
            hidden
            onChange={(event) => {
              uploads.add([...(event.currentTarget.files ?? [])], open)
              event.currentTarget.value = ''
            }}
          />
        </>
      )}
      <label className={styles.search} data-tour="archivos-buscar">
        <Search aria-hidden="true" size={16} />
        <input
          type="search"
          value={query}
          placeholder={t('files.search')}
          aria-label={t('files.search')}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </label>
      {/* biome-ignore lint/a11y/useSemanticElements: unos botones que filtran, no un formulario */}
      <div className={styles.kinds} role="group" aria-label={t('files.kinds')}>
        {(['all', ...KINDS] as const).map((k) => (
          <button key={k} type="button" className={styles.kind} aria-pressed={kind === k} onClick={() => setKind(k)}>
            {k === 'all' ? t('files.all') : t(`files.groups.${k}`)}
          </button>
        ))}
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: dos botones que eligen la vista */}
      <div className={styles.views} role="group" aria-label={t('files.view')}>
        <button
          type="button"
          className={styles.viewButton}
          aria-pressed={view === 'list'}
          aria-label={t('files.asList')}
          title={t('files.asList')}
          onClick={() => setView('list')}
        >
          <List aria-hidden="true" size={16} />
        </button>
        <button
          type="button"
          className={styles.viewButton}
          aria-pressed={view === 'cards'}
          aria-label={t('files.asCards')}
          title={t('files.asCards')}
          onClick={() => setView('cards')}
        >
          <LayoutGrid aria-hidden="true" size={16} />
        </button>
      </div>
    </div>
  )
  const tree = (
    <FolderTree
      files={data.files}
      folders={folders}
      open={searching ? undefined : open}
      received={received}
      canWrite={canWrite}
      target={target}
      onOpen={(id) => {
        setQuery('')
        setFolderId(id)
      }}
      onMove={moveInto}
      onChanged={refresh}
    />
  )
  const contents = (
    <div className={styles.contents}>
      <p className={styles.here}>
        {searching
          ? t('files.results', { count: shownFiles.length })
          : [t('files.root'), ...path.map((f) => f.name)].join(' › ')}
      </p>
      {searching && shownFiles.length === 0 && <p className={styles.empty}>{t('files.noResults')}</p>}
      {!searching && shownFolders.length === 0 && shownFiles.length === 0 && uploads.items.length === 0 && (
        <p className={styles.empty}>{nothing ? empty : t('files.emptyFolder')}</p>
      )}
      {view === 'list' ? (
        <ul className={styles.rows} aria-label={t('files.listLabel')}>
          {uploads.items.map((upload) => (
            <UploadRow key={upload.key} upload={upload} onCancel={() => uploads.cancel(upload.key)} />
          ))}
          {shownFolders.map((folder) => (
            <FolderRow
              key={folder.id}
              folder={folder}
              count={countIn(folder.id, data.files, folders)}
              canWrite={canWrite}
              fresh={fresh(folder.id)}
              onOpen={() => setFolderId(folder.id)}
              onMove={moveInto}
              onChanged={refresh}
            />
          ))}
          {shownFiles.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              where={searching ? pathOf(file.folderId) : []}
              fresh={fresh(file.id)}
              selected={selected === file.id}
              onSelect={title ? () => setSelected(file.id) : undefined}
              {...rowProps}
            />
          ))}
        </ul>
      ) : (
        <ul className={cards.list} aria-label={t('files.listLabel')}>
          {shownFolders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              files={data.files}
              folders={folders}
              canWrite={canWrite}
              fresh={fresh(folder.id)}
              onOpen={() => setFolderId(folder.id)}
              onMove={moveInto}
              onChanged={refresh}
            />
          ))}
          {shownFiles.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              where={searching ? pathOf(file.folderId) : []}
              fresh={fresh(file.id)}
              {...rowProps}
            />
          ))}
          {uploads.items.map((upload) => (
            <UploadCard key={upload.key} upload={upload} onCancel={() => uploads.cancel(upload.key)} />
          ))}
        </ul>
      )}
    </div>
  )
  const selectedFile = data.files.find((file) => file.id === selected)
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: soltar es un atajo; «Subir archivos» hace lo mismo con el teclado
    <div
      className={`${styles.zone} ${over ? styles.over : ''}`}
      onDragOver={(event) => {
        if (!canWrite || !event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false)
      }}
      onDrop={drop}
    >
      {title ? (
        // La página: la columna del centro como en las demás vistas (título, botones y lista) y, a los lados, el
        // árbol de carpetas y el archivo elegido
        <div className={styles.layout}>
          <aside className={styles.side}>{tree}</aside>
          <div className={styles.center}>
            {title}
            {tools}
            {contents}
          </div>
          <aside className={styles.detail} aria-label={t('files.detail')}>
            {selectedFile ? (
              <FileDetail
                file={selectedFile}
                where={pathOf(selectedFile.folderId)}
                folders={folders}
                canWrite={canWrite}
                onChanged={refresh}
              />
            ) : (
              <p className={styles.detailHint}>{t('files.pickOne')}</p>
            )}
          </aside>
        </div>
      ) : (
        <>
          {tools}
          <div className={styles.explorer}>
            {tree}
            {contents}
          </div>
        </>
      )}
      {over && <p className={styles.dropHint}>{t('files.dropHere')}</p>}
    </div>
  )
}

/** Cuántos archivos hay en una carpeta, contando los de las que tiene dentro (null: todos) */
function countIn(folderId: string | null, files: WorldFile[], folders: FolderView[]): number {
  if (folderId === null) return files.length
  const inside = new Set([folderId])
  for (let grew = true; grew; ) {
    grew = false
    for (const folder of folders) {
      if (folder.parentId && inside.has(folder.parentId) && !inside.has(folder.id)) {
        inside.add(folder.id)
        grew = true
      }
    }
  }
  return files.filter((file) => file.folderId && inside.has(file.folderId)).length
}

/**
 * El árbol de carpetas: «Todos» y, debajo, cada carpeta con las suyas (se despliegan; la elegida y su ruta, abiertas),
 * cuántos archivos tiene y, a la elegida, su engranaje. Se le sueltan archivos encima para moverlos. Al final, crear una
 * carpeta dentro de la elegida
 */
function FolderTree({
  files,
  folders,
  open,
  received,
  canWrite,
  target,
  onOpen,
  onMove,
  onChanged
}: {
  files: WorldFile[]
  folders: FolderView[]
  /** La elegida (null: todos); al buscar, ninguna */
  open: string | null | undefined
  /** La que acaba de recibir un archivo arrastrado ('todos': lo más alto), que se ilumina un momento */
  received: string | null
  canWrite: boolean
  target: Target
  onOpen: (folderId: string | null) => void
  onMove: (fileId: string, folderId: string | null) => Promise<unknown>
  onChanged: () => Promise<unknown>
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  // La ruta de la elegida, siempre abierta
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const onPath = new Set<string>()
  for (let at = open ? byId.get(open) : undefined; at; at = at.parentId ? byId.get(at.parentId) : undefined) {
    onPath.add(at.id)
  }
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const branch = (parentId: string | null, depth: number) => {
    const children = folders.filter((folder) => folder.parentId === parentId)
    if (children.length === 0) return null
    return (
      <ul className={styles.branch}>
        {children.map((folder) => {
          const hasChildren = folders.some((child) => child.parentId === folder.id)
          const isOpen = expanded.has(folder.id) || onPath.has(folder.id)
          return (
            <li key={folder.id}>
              <div
                className={`${styles.node} ${open === folder.id ? styles.nodeHere : ''} ${received === folder.id ? styles.received : ''}`}
                style={{ paddingInlineStart: `${depth * 0.75}rem` }}
              >
                {hasChildren ? (
                  <button
                    type="button"
                    className={styles.twisty}
                    aria-expanded={isOpen}
                    aria-label={t(isOpen ? 'files.collapse' : 'files.expand', { name: folder.name })}
                    onClick={() => toggle(folder.id)}
                  >
                    <ChevronRight aria-hidden="true" size={14} />
                  </button>
                ) : (
                  <span className={styles.twistySpace} />
                )}
                <FolderTarget folderId={folder.id} canWrite={canWrite} onMove={onMove}>
                  <button
                    type="button"
                    className={styles.nodeButton}
                    aria-current={open === folder.id ? 'true' : undefined}
                    data-move-here={t('files.moveHere')}
                    onClick={() => onOpen(folder.id)}
                  >
                    <Folder aria-hidden="true" size={15} />
                    <span className={styles.nodeName}>{folder.name}</span>
                    <span className={styles.nodeCount}>{countIn(folder.id, files, folders)}</span>
                  </button>
                </FolderTarget>
                {canWrite && open === folder.id && <FolderSettings folder={folder} onChanged={onChanged} small />}
              </div>
              {isOpen && branch(folder.id, depth + 1)}
            </li>
          )
        })}
      </ul>
    )
  }
  return (
    <nav className={styles.tree} aria-label={t('files.path')} data-tour="archivos-carpetas">
      <div
        className={`${styles.node} ${open === null ? styles.nodeHere : ''} ${received === 'todos' ? styles.received : ''}`}
      >
        <FolderTarget folderId={null} canWrite={canWrite} onMove={onMove}>
          <button
            type="button"
            className={styles.nodeButton}
            aria-current={open === null ? 'true' : undefined}
            data-move-here={t('files.moveHere')}
            onClick={() => onOpen(null)}
          >
            <Files aria-hidden="true" size={15} />
            <span className={styles.nodeName}>{t('files.root')}</span>
            <span className={styles.nodeCount}>{files.length}</span>
          </button>
        </FolderTarget>
      </div>
      {branch(null, 0)}
      {canWrite && (
        <NewFolderButton target={target} parentId={open ?? null} onCreated={onChanged} className={styles.newFolder} />
      )}
    </nav>
  )
}

/** Mientras se arrastra un archivo, el árbol marca dónde se puede soltar (base: una clase en el documento) */
function startDragging(event: DragEvent, file: WorldFile) {
  event.dataTransfer.setData(DRAGGED, file.id)
  event.dataTransfer.effectAllowed = 'move'
  document.documentElement.classList.add(styles.draggingFile ?? '')
}
function stopDragging() {
  document.documentElement.classList.remove(styles.draggingFile ?? '')
}

/** Un archivo en una fila de la lista: su miniatura, su nombre (lo abre), dónde está (al buscar), su tamaño y su engranaje */
function FileRow({
  file,
  where,
  folders,
  canWrite,
  fresh,
  selected = false,
  onSelect,
  onChanged
}: {
  file: WorldFile
  where: FolderView[]
  folders: FolderView[]
  canWrite: boolean
  fresh: boolean
  /** El elegido, que sale en el panel de la derecha */
  selected?: boolean
  /** Pulsar la fila (fuera de su nombre y su engranaje) lo elige */
  onSelect?: (() => void) | undefined
  onChanged: () => Promise<unknown>
}) {
  const { t, i18n } = useTranslation()
  const [viewing, setViewing] = useState(false)
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: elegirla es un atajo del ratón; con el teclado, su nombre y su engranaje
    <li
      className={[styles.row, fresh ? styles.appear : '', selected ? styles.selected : ''].filter(Boolean).join(' ')}
      data-file-card={file.id}
      draggable={canWrite}
      onDragStart={(event) => startDragging(event, file)}
      onDragEnd={stopDragging}
      onClick={(event) => {
        if (!(event.target as Element).closest('a, button')) onSelect?.()
      }}
    >
      <span className={styles.rowThumb}>
        <Thumb file={file} small />
      </span>
      <span className={styles.rowText}>
        {file.kind === 'image' ? (
          <button
            type="button"
            className={`${styles.rowName} ${styles.open}`}
            aria-haspopup="dialog"
            onClick={() => setViewing(true)}
          >
            {file.name}
          </button>
        ) : (
          <a
            href={file.url}
            className={styles.rowName}
            target="_blank"
            rel="noopener"
            {...(file.kind === 'other' ? { download: file.name } : {})}
          >
            {file.name}
          </a>
        )}
        {where.length > 0 && <span className={styles.where}>{where.map((folder) => folder.name).join(' › ')}</span>}
      </span>
      <span className={styles.rowMeta}>
        {sizeText(file.size, i18n.language)}
        {file.usedBy > 0 && ` · ${t('files.usedBy', { count: file.usedBy })}`}
      </span>
      {canWrite ? <FileSettings file={file} folders={folders} onChanged={onChanged} small /> : <span />}
      {viewing && <CoverViewer url={file.url} label={file.name} onClose={() => setViewing(false)} />}
    </li>
  )
}

/** De qué tipo es, para decirlo: por su clase y, entre los demás, por su mime */
const typeOf = (file: WorldFile) =>
  file.kind !== 'other'
    ? file.kind
    : file.mime.startsWith('audio/')
      ? 'audio'
      : file.mime.startsWith('video/')
        ? 'video'
        : file.mime.startsWith('text/') || file.mime === 'application/json'
          ? 'text'
          : 'other'

/**
 * El archivo elegido, en el panel de la derecha: su vista previa grande, su nombre, de qué tipo es, cuánto pesa,
 * dónde está y cuántas páginas lo usan; y abrirlo, descargarlo o sus ajustes
 */
function FileDetail({
  file,
  where,
  folders,
  canWrite,
  onChanged
}: {
  file: WorldFile
  where: FolderView[]
  folders: FolderView[]
  canWrite: boolean
  onChanged: () => Promise<unknown>
}) {
  const { t, i18n } = useTranslation()
  const [viewing, setViewing] = useState(false)
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })
  return (
    <div className={styles.detailBody}>
      <div className={styles.preview}>
        <Thumb file={file} />
      </div>
      <h2 className={styles.detailName}>{file.name}</h2>
      <dl className={styles.facts}>
        <dt>{t('files.kindLabel')}</dt>
        <dd>{t(`files.types.${typeOf(file)}`)}</dd>
        <dt>{t('files.sizeLabel')}</dt>
        <dd>{sizeText(file.size, i18n.language)}</dd>
        <dt>{t('files.folder')}</dt>
        <dd>{where.length > 0 ? where.map((folder) => folder.name).join(' › ') : t('files.root')}</dd>
        <dt>{t('files.usedLabel')}</dt>
        <dd>{file.usedBy > 0 ? t('files.usedBy', { count: file.usedBy }) : t('files.unused')}</dd>
        <dt>{t('files.updatedLabel')}</dt>
        <dd>{date.format(new Date(file.updatedAt))}</dd>
      </dl>
      <div className={styles.detailActions}>
        {file.kind === 'image' ? (
          <button type="button" className={list.secondary} aria-haspopup="dialog" onClick={() => setViewing(true)}>
            {t('cover.view')}
          </button>
        ) : (
          <a className={`${list.secondary} ${styles.plain}`} href={file.url} target="_blank" rel="noopener">
            {t('files.open')}
          </a>
        )}
        <a className={`${list.secondary} ${styles.plain}`} href={file.url} download={file.name}>
          {t('files.download')}
        </a>
        {canWrite && <FileSettings file={file} folders={folders} onChanged={onChanged} small />}
      </div>
      {viewing && <CoverViewer url={file.url} label={file.name} onClose={() => setViewing(false)} />}
    </div>
  )
}

/** Una carpeta en una fila: la abre; se le sueltan archivos encima */
function FolderRow({
  folder,
  count,
  canWrite,
  fresh,
  onOpen,
  onMove,
  onChanged
}: {
  folder: FolderView
  count: number
  canWrite: boolean
  fresh: boolean
  onOpen: () => void
  onMove: (fileId: string, folderId: string | null) => Promise<unknown>
  onChanged: () => Promise<unknown>
}) {
  const { t } = useTranslation()
  const [over, setOver] = useState(false)
  return (
    <li
      className={[styles.row, fresh ? styles.appear : '', over ? styles.dropping : ''].filter(Boolean).join(' ')}
      data-file-card={folder.id}
      onDragOver={(event) => {
        if (!canWrite || !event.dataTransfer.types.includes(DRAGGED)) return
        event.preventDefault()
        event.stopPropagation()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        const fileId = event.dataTransfer.getData(DRAGGED)
        if (!fileId) return
        event.preventDefault()
        event.stopPropagation()
        setOver(false)
        void onMove(fileId, folder.id)
      }}
    >
      <span className={`${styles.rowThumb} ${styles.folderThumb}`}>
        <Folder aria-hidden="true" size={18} />
      </span>
      <span className={styles.rowText}>
        <button
          type="button"
          className={`${styles.rowName} ${styles.open}`}
          aria-label={t('files.openFolder', { name: folder.name })}
          onClick={onOpen}
        >
          {folder.name}
        </button>
      </span>
      <span className={styles.rowMeta}>
        {over ? t('files.moveHere') : count > 0 ? t('files.folderFiles', { count }) : t('files.folderEmpty')}
      </span>
      {canWrite ? <FolderSettings folder={folder} onChanged={onChanged} small /> : <span />}
    </li>
  )
}

/** Una subida en una fila: su nombre, su progreso y la X para cancelarla (o el motivo, si falló, y la X para quitarla) */
function UploadRow({ upload, onCancel }: { upload: Upload; onCancel: () => void }) {
  const { t, i18n } = useTranslation()
  const percent = new Intl.NumberFormat(i18n.language, { style: 'percent' }).format(upload.fraction)
  const broken = upload.status === 'failed'
  return (
    <li className={`${styles.row} ${styles.uploadingRow}`}>
      <span className={styles.rowThumb}>
        {upload.preview ? <img src={upload.preview} alt="" /> : <UploadIcon aria-hidden="true" size={16} />}
      </span>
      <span className={styles.rowText}>
        <span className={styles.rowName}>{upload.name}</span>
        {broken ? (
          <span className={styles.error}>{t('files.failed', { error: upload.error })}</span>
        ) : (
          <progress
            className={styles.rowProgress}
            value={upload.fraction}
            max={1}
            aria-label={t('files.progress', { name: upload.name })}
          />
        )}
      </span>
      <span className={styles.rowMeta}>{broken ? '' : percent}</span>
      <button
        type="button"
        className={styles.smallGear}
        aria-label={t(broken ? 'files.dismiss' : 'files.cancelUpload', { name: upload.name })}
        title={t(broken ? 'files.dismiss' : 'files.cancelUpload', { name: upload.name })}
        onClick={onCancel}
      >
        <X aria-hidden="true" size={14} />
      </button>
    </li>
  )
}

/** Donde se suelta un archivo arrastrado para meterlo en una carpeta (o, con null, en lo más alto) */
function FolderTarget({
  folderId,
  canWrite,
  onMove,
  children
}: {
  folderId: string | null
  canWrite: boolean
  onMove: (fileId: string, folderId: string | null) => Promise<unknown>
  children: ReactNode
}) {
  const [over, setOver] = useState(false)
  if (!canWrite) return <>{children}</>
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: soltar es un atajo; la carpeta se elige también en el engranaje
    <span
      className={over ? styles.targetOver : styles.target}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(DRAGGED)) return
        event.preventDefault()
        event.stopPropagation()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        const fileId = event.dataTransfer.getData(DRAGGED)
        if (!fileId) return
        event.preventDefault()
        event.stopPropagation()
        setOver(false)
        void onMove(fileId, folderId)
      }}
    >
      {children}
    </span>
  )
}

/** «Nueva carpeta» (dentro de parentId): el botón y su cuadro, con el nombre */
function NewFolderButton({
  target,
  parentId,
  onCreated,
  className,
  iconSize = 16
}: {
  target: Target
  parentId: string | null
  onCreated: () => Promise<unknown>
  className: string | undefined
  iconSize?: number
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const trigger = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const create = useMutation({
    mutationFn: async () => {
      await api.call('createFolder', { ...target, parentId, name: name.trim() })
      await onCreated()
    },
    onSuccess: () => dialog.current?.close()
  })
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={className}
        aria-haspopup="dialog"
        onClick={() => {
          setName('')
          create.reset()
          setOpen(true)
        }}
      >
        <FolderPlus aria-hidden="true" size={iconSize} strokeWidth={1.5} />
        {t('files.newFolder')}
      </button>
      {open && (
        <Modal
          ref={dialog}
          aria-labelledby={titleId}
          className={dialogStyles.dialog}
          onClose={() => {
            setOpen(false)
            trigger.current?.focus()
          }}
        >
          <form
            className={dialogStyles.body}
            onSubmit={(event) => {
              event.preventDefault()
              create.mutate()
            }}
          >
            <h2 id={titleId}>{t('files.newFolder')}</h2>
            <Field
              label={t('files.folderName')}
              value={name}
              required
              maxLength={120}
              autoComplete="off"
              data-autofocus=""
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <FormError message={create.error ? errorText(create.error) : null} />
            <div className={dialogStyles.actions}>
              <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
                {t('files.cancel')}
              </button>
              <BusyButton type="submit" className={form.button} busy={create.isPending}>
                {t('files.createFolder')}
              </BusyButton>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

/**
 * Una carpeta en su tarjeta: toda ella la abre, se le pueden soltar archivos encima y su engranaje, para quien puede
 * cambiarla, abre su ventana (nombre y borrarla)
 */
function FolderCard({
  folder,
  files,
  folders,
  canWrite,
  fresh,
  onOpen,
  onMove,
  onChanged
}: {
  folder: FolderView
  files: WorldFile[]
  folders: FolderView[]
  canWrite: boolean
  fresh: boolean
  onOpen: () => void
  onMove: (fileId: string, folderId: string | null) => Promise<unknown>
  onChanged: () => Promise<unknown>
}) {
  const { t } = useTranslation()
  const [over, setOver] = useState(false)
  const inside = files.filter((file) => file.folderId === folder.id).length
  const subfolders = folders.filter((child) => child.parentId === folder.id).length
  const counts = [
    subfolders > 0 ? t('files.folderFolders', { count: subfolders }) : null,
    inside > 0 ? t('files.folderFiles', { count: inside }) : null
  ].filter(Boolean)
  const classes = [cards.card, styles.folderCard, fresh ? styles.appear : '', over ? styles.dropping : '']
  return (
    <li
      className={classes.filter(Boolean).join(' ')}
      data-file-card={folder.id}
      onDragOver={(event) => {
        if (!canWrite || !event.dataTransfer.types.includes(DRAGGED)) return
        event.preventDefault()
        event.stopPropagation()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        const fileId = event.dataTransfer.getData(DRAGGED)
        if (!fileId) return
        event.preventDefault()
        event.stopPropagation()
        setOver(false)
        void onMove(fileId, folder.id)
      }}
    >
      <div className={styles.thumb}>
        <Folder aria-hidden="true" size={44} strokeWidth={1.25} />
      </div>
      <div className={cards.body}>
        <button
          type="button"
          className={`${cards.name} ${styles.fileName} ${styles.open}`}
          aria-label={t('files.openFolder', { name: folder.name })}
          onClick={onOpen}
        >
          {folder.name}
        </button>
        <div className={cards.footer}>
          <span className={cards.role}>{counts.length > 0 ? counts.join(' · ') : t('files.folderEmpty')}</span>
          {canWrite && <FolderSettings folder={folder} onChanged={onChanged} />}
        </div>
      </div>
    </li>
  )
}

/** El engranaje de una carpeta: su ventana, con el nombre y la zona de peligro (lo que tiene pasa a la de arriba) */
function FolderSettings({
  folder,
  onChanged,
  small = false
}: {
  folder: FolderView
  onChanged: () => Promise<unknown>
  /** La del árbol: un engranaje pequeño */
  small?: boolean
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const trigger = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const gone = useRef(false)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(folder.name)
  const rename = useMutation({
    mutationFn: async () => {
      await api.call('updateFolder', { folderId: folder.id, name: name.trim() })
      await onChanged()
    }
  })
  const changed = name.trim() !== folder.name
  const remove = async () => {
    await api.call('deleteFolder', { folderId: folder.id })
    gone.current = true
    await vanish(folder.id, dialog.current)
    await onChanged()
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={small ? styles.smallGear : cards.gear}
        aria-label={t('files.folderSettingsOf', { name: folder.name })}
        title={t('files.folderSettingsOf', { name: folder.name })}
        aria-haspopup="dialog"
        onClick={() => {
          setName(folder.name)
          rename.reset()
          gone.current = false
          setOpen(true)
        }}
      >
        <Settings aria-hidden="true" size={small ? 14 : 18} />
      </button>
      {open && (
        <Modal
          ref={dialog}
          aria-labelledby={titleId}
          className={cards.dialog}
          onClose={() => {
            setOpen(false)
            if (!gone.current) trigger.current?.focus()
          }}
        >
          <div className={styles.preview}>
            <Folder aria-hidden="true" size={56} strokeWidth={1.25} />
          </div>
          <form
            className={cards.form}
            onSubmit={(event) => {
              event.preventDefault()
              if (changed) rename.mutate()
            }}
          >
            <h2 id={titleId}>{t('files.folderSettingsOf', { name: folder.name })}</h2>
            <Field
              label={t('files.folderName')}
              value={name}
              required
              maxLength={120}
              autoComplete="off"
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <FormError message={rename.error ? errorText(rename.error) : null} />
            <ChangesBar shown={changed}>
              <BusyButton type="submit" className={form.button} busy={rename.isPending}>
                {t('files.save')}
              </BusyButton>
              <button type="button" className={dialogStyles.cancel} onClick={() => setName(folder.name)}>
                {t('files.cancel')}
              </button>
            </ChangesBar>
          </form>
          <div className={cards.dangerArea}>
            <DangerZone>
              <ConfirmByName
                name={folder.name}
                action={t('files.deleteFolder')}
                title={t('files.deleteTitle', { name: folder.name })}
                warning={t('files.deleteFolderWarning')}
                label={t('files.folderName')}
                typed={false}
                onConfirm={remove}
              />
            </DangerZone>
          </div>
        </Modal>
      )}
    </>
  )
}

/**
 * Lo que se va (un archivo o una carpeta borrados): su ventana se cierra y su tarjeta se desvanece encogiendo un poco;
 * después ya se puede quitar de la lista. Sin animaciones (las pruebas), al momento
 */
async function vanish(id: string, dialog: HTMLDialogElement | null) {
  if (dialog?.open) {
    dialog.style.transition = 'none'
    dialog.close()
  }
  const card = document.querySelector<HTMLElement>(`[data-file-card="${id}"]`)
  if (!card || typeof card.getAnimations !== 'function') return
  card.classList.add(styles.vanishing ?? '')
  await new Promise((resolve) => setTimeout(resolve, 260))
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
  const queue = useRef<Array<{ key: number; file: File; folderId: string | null }>>([])
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
      const to: UploadTarget = { ...target, name: next.file.name, folderId: next.folderId }
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

  /** Sube estos a una carpeta (null: a lo más alto) */
  const add = useCallback(
    (files: File[], folderId: string | null) => {
      // Lo oculto de las carpetas (.DS_Store y compañía) no se sube
      const wanted = files.filter((file) => !file.name.startsWith('.'))
      const added = wanted.map((file) => {
        const key = nextKey.current++
        // Lo que no se admite (un programa, un script…) ni se intenta; el servidor lo comprueba igualmente
        const refused = !looksUploadable(file.name) ? 'BAD_TYPE' : file.size > MAX_FILE_BYTES ? 'TOO_LARGE' : null
        if (!refused) queue.current.push({ key, file, folderId })
        return {
          key,
          name: file.name,
          preview: file.type.startsWith('image/') && !refused ? URL.createObjectURL(file) : null,
          fraction: 0,
          status: refused ? 'failed' : 'waiting',
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
function Thumb({ file, small = false }: { file: WorldFile; small?: boolean }) {
  if (file.kind === 'image') return <img src={file.url} alt="" loading="lazy" />
  const size = small ? 18 : 40
  return file.kind === 'pdf' ? (
    <FileText aria-hidden="true" size={size} strokeWidth={1.25} />
  ) : (
    <FileIcon aria-hidden="true" size={size} strokeWidth={1.25} />
  )
}

/**
 * Un archivo en su tarjeta: toda ella lo abre (una imagen, en grande; lo demás, en otra pestaña), se arrastra a una
 * carpeta y su engranaje, para quien puede cambiarlo, abre su ventana. where: la ruta de su carpeta (al buscar)
 */
function FileCard({
  file,
  where,
  folders,
  canWrite,
  fresh,
  onChanged
}: {
  file: WorldFile
  where: FolderView[]
  folders: FolderView[]
  canWrite: boolean
  fresh: boolean
  onChanged: () => Promise<unknown>
}) {
  const { t, i18n } = useTranslation()
  const [viewing, setViewing] = useState(false)
  const classes = [cards.card, fresh ? styles.appear : ''].filter(Boolean)
  return (
    <li
      className={classes.join(' ')}
      data-file-card={file.id}
      draggable={canWrite}
      onDragStart={(event) => startDragging(event, file)}
      onDragEnd={stopDragging}
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
        {where.length > 0 && <span className={styles.where}>{where.map((folder) => folder.name).join(' › ')}</span>}
        <div className={cards.footer}>
          <span className={cards.role}>
            {sizeText(file.size, i18n.language)}
            {file.usedBy > 0 && ` · ${t('files.usedBy', { count: file.usedBy })}`}
          </span>
          {canWrite && <FileSettings file={file} folders={folders} onChanged={onChanged} />}
        </div>
      </div>
      {viewing && <CoverViewer url={file.url} label={file.name} onClose={() => setViewing(false)} />}
    </li>
  )
}

/** El engranaje de un archivo: abre su ventana */
function FileSettings({
  file,
  folders,
  onChanged,
  small = false
}: {
  file: WorldFile
  folders: FolderView[]
  onChanged: () => Promise<unknown>
  /** La de una fila: un engranaje pequeño */
  small?: boolean
}) {
  const { t } = useTranslation()
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={small ? styles.smallGear : cards.gear}
        aria-label={t('files.settingsOf', { name: file.name })}
        title={t('files.settingsOf', { name: file.name })}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Settings aria-hidden="true" size={small ? 14 : 18} />
      </button>
      {open && (
        <FileDialog
          file={file}
          folders={folders}
          onChanged={onChanged}
          onClose={(gone) => {
            setOpen(false)
            if (!gone) trigger.current?.focus()
          }}
        />
      )}
    </>
  )
}

/** Las carpetas con su ruta («Mapas › Norte»), en el orden de la ruta */
function folderPaths(folders: FolderView[]) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const pathOf = (folder: FolderView): string =>
    folder.parentId && byId.has(folder.parentId)
      ? `${pathOf(byId.get(folder.parentId) as FolderView)} › ${folder.name}`
      : folder.name
  return folders
    .map((folder) => ({ id: folder.id, label: pathOf(folder) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

/**
 * La ventana de un archivo: su vista previa, el nombre («Guardar» y «Cancelar» solo con cambios), su carpeta,
 * reemplazarlo por otro (las páginas que lo usan ven el nuevo) y, al final, la zona de peligro. onClose(gone): si se ha
 * borrado
 */
function FileDialog({
  file,
  folders,
  onChanged,
  onClose
}: {
  file: WorldFile
  folders: FolderView[]
  onChanged: () => Promise<unknown>
  onClose: (gone: boolean) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const announce = useAnnounce()
  const dialog = useRef<HTMLDialogElement>(null)
  const replaceInput = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const folderId = useId()
  const gone = useRef(false)
  const [name, setName] = useState(file.name)
  const rename = useMutation({
    mutationFn: async () => {
      await api.call('renameFile', { fileId: file.id, name: name.trim() })
      await onChanged()
    }
  })
  const move = useMutation({
    mutationFn: async (to: string | null) => {
      await api.call('moveFile', { fileId: file.id, folderId: to })
      await onChanged()
    }
  })
  const replace = useMutation({
    mutationFn: async (chosen: File) => {
      if (chosen.size > MAX_FILE_BYTES) throw new ApiError('TOO_LARGE', 413)
      await api.uploadFile({ fileId: file.id }, chosen)
      await onChanged()
    },
    onSuccess: () => announce(t('files.replaced', { name: file.name }))
  })
  // Borrado, su tarjeta se desvanece y la lista se pone al día
  const remove = async () => {
    await api.call('deleteFile', { fileId: file.id })
    gone.current = true
    await vanish(file.id, dialog.current)
    await onChanged()
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
        {folders.length > 0 && (
          <div className={styles.folderField}>
            <label htmlFor={folderId}>{t('files.folder')}</label>
            <select
              id={folderId}
              value={file.folderId ?? ''}
              disabled={move.isPending}
              onChange={(event) => move.mutate(event.currentTarget.value || null)}
            >
              <option value="">{t('files.noFolder')}</option>
              {folderPaths(folders).map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.label}
                </option>
              ))}
            </select>
            <FormError message={move.error ? errorText(move.error) : null} />
          </div>
        )}
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
            accept={UPLOAD_ACCEPT}
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
