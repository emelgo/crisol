/**
 * Los archivos: los de un mundo y, aparte, los comunes de la cuenta, que comparten todos sus mundos (ADR-0005; también
 * en su pantalla, fuera de los mundos). En una lista que es su árbol: pulsar una carpeta la despliega en su sitio, con
 * lo suyo sangrado debajo, y la elige; lo que se sube o se crea va a la elegida. Las carpetas solo ordenan (el nombre de
 * un archivo es único en su ámbito); se buscan por nombre y se filtran por tipo o etiqueta, en todas. Se suben con
 * «Subir archivos» o soltándolos encima; cada subida sale con su progreso y se puede cancelar, y al acabar es ya su fila.
 * Archivos y carpetas se mueven arrastrándolos, como las páginas del mundo
 */

import type { FolderView } from '@crisol/contracts'
import { looksUploadable, MAX_FILE_BYTES, TRASH_DAYS, UPLOAD_ACCEPT } from '@crisol/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate } from '@tanstack/react-router'
import {
  ChevronRight,
  File as FileIcon,
  FileText,
  FolderInput,
  FolderPlus,
  Search,
  Settings,
  Tag,
  Trash2,
  Upload as UploadIcon,
  X
} from 'lucide-react'
import {
  type CSSProperties,
  createContext,
  type DragEvent,
  type FocusEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { ApiError, type UploadTarget } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useCodeText, useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { ChangesBar } from '../components/changes.tsx'
import dangerStyles from '../components/danger.module.css'
import { ConfirmByName, DangerZone } from '../components/danger.tsx'
import dialogStyles from '../components/dialog.module.css'
import { Field, FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import { failed, LoadError, SectionError } from '../components/load-error.tsx'
import { Modal } from '../components/modal.tsx'
import { NewCard } from '../components/new-card.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Tour } from '../components/tour.tsx'
import { isInside, type Zone, zoneAt } from '../components/tree/moves.ts'
import cards from '../routes/world-card.module.css'
import { ColorChoices } from '../routes/world-card.tsx'
import { CoverViewer } from '../routes/world-cover.tsx'
import { type FilesMove, type Item, type Listed, movedIn } from './file-order.ts'
import { COMMON, folderChoices, foundTree, matches, type Scope, splitScopes, treeOf, withCommon } from './file-tree.ts'
import styles from './files.module.css'
import { FolderGlyph } from './folder-glyph.tsx'
import { IconChoices } from './icon.tsx'
import type { WorldFile } from './links-context.ts'
import tagStyles from './tags.module.css'
import { addTyped, TagChip, TagsField, useAccountTags, useTagColor } from './tags.tsx'

const route = getRouteApi('/mundos/$worldId/archivos')

const KINDS = ['image', 'pdf', 'other'] as const
type Kind = (typeof KINDS)[number]
/** Cuántas subidas a la vez */
const PARALLEL = 3
/** Cuánto hay que mantener lo arrastrado sobre una carpeta cerrada para que se despliegue sola */
const EXPAND_AFTER = 650
/** Cuánto se ilumina lo recién movido */
const LANDED_FOR = 1400

type Target = { worldId: string } | { organizationId: string }

/** Los archivos de un mundo: la misma pantalla que los comunes, sin el marco de la wiki (solo para quien lo dirige) */
export function WikiFiles() {
  const { t } = useTranslation()
  const { worldId } = route.useParams()
  const api = useApi()
  const { account, pending } = useAccounts().useAccount()
  const worlds = useQuery({
    queryKey: ['worlds'],
    queryFn: () => api.call('listWorlds', {}),
    enabled: Boolean(account)
  })
  const world = worlds.data?.worlds.find((w) => w.id === worldId && w.role === 'master')
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  if (!worlds.data)
    return failed(worlds) ? <LoadError error={worlds.error} onRetry={() => worlds.refetch()} /> : <Loading />
  if (!world) {
    return (
      <section className={styles.page}>
        <PageTitle>{t('wiki.notFound')}</PageTitle>
        <Link to="/mundos">{t('worlds.title')}</Link>
      </section>
    )
  }
  return <FilesPage worldId={worldId} world={world.name} organizationId={world.organizationId} />
}

/** Si la cuenta administra la organización: solo entonces sube y cambia los comunes */
function useOwns(organizationId: string | undefined) {
  const api = useApi()
  const organizations = useQuery({ queryKey: ['organizations'], queryFn: () => api.call('listOrganizations', {}) })
  return organizations.data?.organizations.some((o) => o.id === organizationId && o.role === 'owner') ?? false
}

/** Los de un mundo y, dentro, la carpeta «Comunes»: los de la cuenta, la misma en todos sus mundos */
function FilesPage({ worldId, world, organizationId }: { worldId: string; world: string; organizationId: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const files = useQuery({ queryKey: ['files', worldId], queryFn: () => api.call('listFiles', { worldId }) })
  const ownsCommon = useOwns(organizationId)
  // Las mismas listas mientras no cambien los datos
  const scopes = useMemo(() => files.data && splitScopes(files.data), [files.data])
  return (
    <section className={styles.page}>
      {failed(files) && <SectionError error={files.error} onRetry={() => files.refetch()} />}
      <FilesSection
        target={{ worldId }}
        data={scopes?.own}
        cacheKey={['files', worldId]}
        canWrite
        empty={t('files.empty')}
        title={<PageTitle>{t('files.worldTitle', { world })}</PageTitle>}
        common={{ target: { organizationId }, data: scopes?.common, canWrite: ownsCommon }}
      />
      {files.data && <FilesTour />}
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
      {failed(files) && <SectionError error={files.error} onRetry={() => files.refetch()} />}
      {owned ? (
        <FilesSection
          target={{ organizationId: owned.id }}
          data={files.data}
          cacheKey={['commonFiles']}
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

/** El tutorial guiado de Archivos: subir, la lista y buscar */
function FilesTour() {
  const { t } = useTranslation()
  return (
    <Tour
      id="archivos"
      steps={[
        { target: '[data-tour="archivos-subir"]', text: t('tour.files.upload') },
        { target: '[data-tour="archivos-lista"]', text: t('tour.files.list') },
        { target: '[data-tour="archivos-buscar"]', text: t('tour.files.search') }
      ]}
    />
  )
}

/** Lo elegido para hacer algo de una vez (en la lista de la pantalla); range: con Mayúsculas, el tramo hasta el último */
interface Selection {
  has: (id: string) => boolean
  active: boolean
  toggle: (id: string, what: 'file' | 'folder', range?: boolean) => void
}
const SelectionContext = createContext<Selection | null>(null)

/** La casilla para elegir un archivo o una carpeta (sobre su miniatura; se ve al pasar el ratón o al elegir) */
function Pick({ id, what, name }: { id: string; what: 'file' | 'folder'; name: string }) {
  const { t } = useTranslation()
  const selection = useContext(SelectionContext)
  if (!selection) return null
  return (
    <input
      type="checkbox"
      className={styles.pick}
      checked={selection.has(id)}
      aria-label={t('files.choose', { name })}
      onChange={(event) => {
        const native = event.nativeEvent as Partial<MouseEvent>
        selection.toggle(id, what, Boolean(native.shiftKey))
      }}
    />
  )
}

/**
 * Lo elegido: cuántos y, para todo a la vez, llevarlo a una carpeta, etiquetar los archivos, borrar (con su aviso) o
 * dejar de elegir. Cada cosa, una sola operación (se deshace de una vez)
 */
function ChosenBar({
  items,
  folders,
  onMoved,
  onDone,
  onClear
}: {
  /** Lo elegido, con su nombre y su ámbito */
  items: { kind: 'file' | 'folder'; id: string; name: string; worldId: string | null }[]
  /** Todas las carpetas (para elegir adónde se lleva) */
  folders: FolderView[]
  /** Llevado a una carpeta (null: lo más alto): para dejarla abierta */
  onMoved: (folderId: string | null) => void
  onDone: () => Promise<unknown>
  onClear: () => void
}) {
  const { t } = useTranslation()
  const announce = useAnnounce()
  const [open, setOpen] = useState<'move' | 'tag' | 'delete' | null>(null)
  const files = items.filter((item) => item.kind === 'file')
  const folderIds = items.filter((item) => item.kind === 'folder').map((item) => item.id)
  // Lo del mundo y lo común no van juntos a ninguna carpeta
  const scope = items[0]?.worldId ?? null
  const oneScope = items.every((item) => item.worldId === scope)
  const close = () => setOpen(null)
  const finish = async (said: string) => {
    announce(said)
    close()
    await onDone()
  }
  return (
    // biome-ignore lint/a11y/useSemanticElements: una barra de acciones sobre lo elegido
    <div className={styles.chosenBar} role="group" aria-label={t('files.chosenLabel')}>
      <span className={styles.chosenCount}>{t('files.chosen', { count: items.length })}</span>
      <button
        type="button"
        className={styles.chosenAction}
        aria-haspopup="dialog"
        disabled={!oneScope}
        title={oneScope ? undefined : t('files.mixedScope')}
        onClick={() => setOpen('move')}
      >
        <FolderInput aria-hidden="true" size={16} />
        {t('files.moveChosen')}
      </button>
      <button
        type="button"
        className={styles.chosenAction}
        aria-haspopup="dialog"
        disabled={files.length === 0}
        title={files.length === 0 ? t('files.onlyFilesTag') : undefined}
        onClick={() => setOpen('tag')}
      >
        <Tag aria-hidden="true" size={16} />
        {t('files.tagChosen')}
      </button>
      <button type="button" className={styles.chosenDelete} aria-haspopup="dialog" onClick={() => setOpen('delete')}>
        <Trash2 aria-hidden="true" size={16} />
        {t('files.deleteChosen')}
      </button>
      <button type="button" className={dialogStyles.cancel} onClick={onClear}>
        {t('files.cancel')}
      </button>
      {open === 'move' && (
        <MoveChosen
          files={files.map((item) => item.id)}
          folderIds={folderIds}
          scope={scope}
          folders={folders}
          onMoved={async (dest) => {
            onMoved(dest)
            await finish(t('files.movedMany', { count: items.length }))
          }}
          onClose={close}
        />
      )}
      {open === 'tag' && (
        <TagChosen
          fileIds={files.map((item) => item.id)}
          onTagged={(count) => finish(t('files.taggedMany', { count }))}
          onClose={close}
        />
      )}
      {open === 'delete' && (
        <DeleteChosen items={items} onDeleted={(count) => finish(t('files.deletedMany', { count }))} onClose={close} />
      )}
    </div>
  )
}

/** Cuántos nombres dice la confirmación de borrar lo elegido */
const SHOWN_NAMES = 5

/** Borrar lo elegido: dice qué (hasta cinco por su nombre) y, si hay carpetas, que se van con lo que tienen */
function DeleteChosen({
  items,
  onDeleted,
  onClose
}: {
  items: { kind: 'file' | 'folder'; id: string; name: string }[]
  onDeleted: (files: number) => Promise<unknown>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const folders = items.filter((item) => item.kind === 'folder').length
  const remove = useMutation({
    mutationFn: async () => {
      const ids = (kind: 'file' | 'folder') => items.filter((item) => item.kind === kind).map((item) => item.id)
      const { files } = await api.call('deleteFiles', { fileIds: ids('file'), folderIds: ids('folder') })
      dialog.current?.close()
      await onDeleted(files)
    }
  })
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={dialogStyles.dialog} onClose={onClose}>
      <div className={dialogStyles.body}>
        <h2 id={titleId}>{t('files.deleteChosenTitle', { count: items.length })}</h2>
        {/* Qué se borra: hasta cinco por su nombre y, si hay más, cuántos */}
        <ul className={styles.chosenNames}>
          {items.slice(0, SHOWN_NAMES).map((item) => (
            <li key={item.id}>{item.name}</li>
          ))}
          {items.length > SHOWN_NAMES && <li>{t('files.andMore', { count: items.length - SHOWN_NAMES })}</li>}
        </ul>
        <p className={dialogStyles.description}>
          {folders > 0 ? t('files.deleteChosenFolders') : t('files.deleteChosenWarning')}
        </p>
        <FormError message={remove.error ? errorText(remove.error) : null} />
        <div className={dialogStyles.actions}>
          <BusyButton className={dangerStyles.solid} busy={remove.isPending} onClick={() => remove.mutate()}>
            {t('files.deleteChosen')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('files.cancel')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** Llevar lo elegido a una carpeta de su ámbito (o a ninguna): una sola operación */
function MoveChosen({
  files,
  folderIds,
  scope,
  folders,
  onMoved,
  onClose
}: {
  files: string[]
  folderIds: string[]
  /** De qué ámbito es lo elegido (null: los comunes) */
  scope: string | null
  folders: FolderView[]
  onMoved: (folderId: string | null) => Promise<unknown>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  // Lo más alto: para lo común en un mundo, «Comunes» (FolderField); al servidor, sin carpeta
  const [dest, setDest] = useState<string | null>(null)
  const move = useMutation({
    mutationFn: async () => {
      const folderId = dest === COMMON ? null : dest
      await api.call('moveFiles', { fileIds: files, folderIds, folderId })
      dialog.current?.close()
      await onMoved(dest)
    }
  })
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={dialogStyles.dialog} onClose={onClose}>
      <form
        className={dialogStyles.body}
        onSubmit={(event) => {
          event.preventDefault()
          move.mutate()
        }}
      >
        <h2 id={titleId}>{t('files.moveChosenTitle', { count: files.length + folderIds.length })}</h2>
        <FolderField folders={folders} of={{ worldId: scope }} moving={folderIds} value={dest} onChange={setDest} />
        <FormError message={move.error ? errorText(move.error) : null} />
        <div className={dialogStyles.actions}>
          <BusyButton type="submit" className={form.button} busy={move.isPending}>
            {t('files.moveChosenDo')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('files.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Etiquetar los archivos elegidos: se añaden a las que ya llevan, en una sola operación */
function TagChosen({
  fileIds,
  onTagged,
  onClose
}: {
  fileIds: string[]
  onTagged: (files: number) => Promise<unknown>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const catalog = useAccountTags().data?.tags.map((tag) => tag.name) ?? []
  const [tags, setTags] = useState<string[]>([])
  // Lo que esté a medio escribir también cuenta (así el campo no cambia justo al pulsar «Etiquetar»)
  const [typed, setTyped] = useState('')
  const wanted = addTyped(tags, typed, catalog)
  const tag = useMutation({
    mutationFn: async () => {
      const { files } = await api.call('addFileTags', { fileIds, tags: wanted })
      dialog.current?.close()
      await onTagged(files)
    }
  })
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={dialogStyles.dialog} onClose={onClose}>
      <form
        className={dialogStyles.body}
        onSubmit={(event) => {
          event.preventDefault()
          if (wanted.length > 0) tag.mutate()
        }}
      >
        <h2 id={titleId}>{t('files.tagChosenTitle', { count: fileIds.length })}</h2>
        <TagsField value={tags} onChange={setTags} onPending={setTyped} />
        <FormError message={tag.error ? errorText(tag.error) : null} />
        <div className={dialogStyles.actions}>
          <BusyButton
            type="submit"
            className={form.button}
            busy={tag.isPending}
            aria-disabled={wanted.length === 0 || undefined}
          >
            {t('files.tagChosenDo')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('files.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Los archivos y las carpetas de un ámbito */
/** Delante o detrás de qué hermano de su tipo queda lo que se recoloca */
type Beside = Pick<FilesMove, 'before' | 'after'>
/** De qué ámbito es algo: los del mundo y los comunes no se mezclan */
type Realm = 'mundo' | 'comun'

/**
 * El teclado de una fila (como en Etiquetas): una sola parada del tabulador en la lista (la fila con el foco), flechas
 * para recorrerla y abrir o cerrar carpetas, Alt + flechas para recolocar, Intro para abrir y Espacio para elegir
 */
type RowFocus = {
  ref: (element: HTMLDivElement | null) => void
  tabIndex: number
  onFocus: (event: FocusEvent<HTMLDivElement>) => void
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
}

/** Lo de arrastrar de una fila: sus manejadores y cómo se ve (dónde caería lo arrastrado, apagada, a punto de abrirse…) */
type RowDrag = { attrs: HTMLAttributes<HTMLDivElement> & { 'data-drop'?: Zone | undefined }; className: string }
const NO_DRAG: RowDrag = { attrs: {}, className: '' }

/** Las ya vistas: las que lleguen después (recién subidas o creadas) entran con su animación; al cargar, ninguna */
function useFresh(ids: readonly string[] | undefined) {
  const seen = useRef<Set<string> | null>(null)
  if (ids && !seen.current) seen.current = new Set(ids)
  useEffect(() => {
    for (const id of ids ?? []) seen.current?.add(id)
  }, [ids])
  return (id: string) => Boolean(seen.current && !seen.current.has(id))
}

/**
 * Los archivos de un ámbito, en una lista que es su árbol: cada carpeta se despliega en su sitio, con lo suyo sangrado
 * debajo, y la última pulsada es la elegida (adonde va lo que se sube o se crea). Arriba, buscar y filtrar (en todas,
 * en una lista plana) y subir; también se sueltan encima. Se arrastran como las páginas del mundo: una raya encima o
 * debajo de una fila (va a su carpeta y, si es de su tipo, ahí se recoloca: en el orden que se quiera) o la carpeta
 * resaltada (va dentro). A la izquierda, la vista previa de lo que está bajo el ratón
 */
function FilesSection({
  target,
  data: ownData,
  cacheKey,
  canWrite,
  empty,
  title,
  common
}: {
  target: Target
  /** Sin datos aún: undefined */
  data: Scope | undefined
  /** La consulta de donde salen los datos: lo movido se pone ahí al momento */
  cacheKey: readonly unknown[]
  canWrite: boolean
  empty: string
  /** El título de la página, en la columna del centro */
  title: ReactNode
  /** En un mundo, los comunes de la cuenta: una carpeta más, «Comunes», con las suyas dentro (ADR-0005) */
  common?: { target: { organizationId: string }; data: Scope | undefined; canWrite: boolean }
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const uploads = useUploads()
  const commonLabel = t('files.common')
  // Lo de los comunes cuelga de su carpeta, «Comunes»: lo que en ellos está en lo más alto, dentro de ella
  const data = useMemo<Scope | undefined>(
    () =>
      ownData && common?.data
        ? withCommon(ownData, common.data, { name: commonLabel, organizationId: common.target.organizationId })
        : ownData,
    [ownData, common?.data, common?.target.organizationId, commonLabel]
  )
  const several = useRef<HTMLInputElement>(null)
  // Adónde va lo que se elige en el campo de archivos: lo más alto (null) o la carpeta de cuyo botón se subió
  const uploadPlace = useRef<string | null>(null)
  const center = useRef<HTMLDivElement>(null)
  // Las carpetas desplegadas
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<Kind | 'all'>('all')
  // Lo elegido para borrar de una vez: por id, si es un archivo o una carpeta
  const [chosen, setChosen] = useState<Map<string, 'file' | 'folder'>>(() => new Map())
  // Archivos de fuera (del escritorio) sobre la pantalla, fuera de las filas: van a la elegida
  const [over, setOver] = useState(false)
  // Lo que está bajo el ratón (un archivo o una carpeta), para la vista previa de la izquierda; al irse, nada
  const [hovered, setHovered] = useState<Item | null>(null)
  // Arrastrar: lo arrastrado (al momento, para decidir dónde cae) y, ya empezado, para verlo levantado
  const dragged = useRef<Item | null>(null)
  const [lifted, setLifted] = useState<Item | null>(null)
  // Dónde caería: sobre qué fila y en qué zona (encima, dentro o debajo)
  const [drop, setDrop] = useState<{ id: string; zone: Zone } | null>(null)
  // La carpeta cerrada sobre la que se mantiene lo arrastrado, que se desplegará sola
  const armed = useRef<string | null>(null)
  const armTimer = useRef<number | undefined>(undefined)
  const [arming, setArming] = useState<string | null>(null)
  // Que no admite lo arrastrado (otro ámbito) ya se ha dicho en este arrastre
  const refusedSaid = useRef(false)
  // Lo recién movido, que se ilumina un momento
  const [landed, setLanded] = useState<string | null>(null)
  // Lo movido desde su ventana, cuyo engranaje recibe el foco cuando su fila ya está en su carpeta nueva
  const refocus = useRef<(Item & { dest: string | null }) | null>(null)
  // El teclado de la lista (RowFocus): la fila con el foco, la que lo recibirá al pintarse (tras moverla) y sus elementos
  const rowElements = useRef(new Map<string, HTMLDivElement>())
  const listRef = useRef<HTMLUListElement>(null)
  const [focusedRow, setFocusedRow] = useState<string | null>(null)
  // Lo recolocado con el teclado recibe el foco cuando ya está en su carpeta de destino (al cambiar de carpeta, su fila
  // es otra: la de antes se va)
  const pendingFocus = useRef<(Item & { dest: string | null }) | null>(null)
  const latest = useRef(data)
  latest.current = data
  const keysHintId = useId()
  useEffect(() => {
    // Solo los botones de la fila con el foco entran en el tabulador; a los de las demás se llega con las flechas
    for (const row of listRef.current?.querySelectorAll<HTMLElement>('[data-file-card][tabindex]') ?? []) {
      const active = row.tabIndex === 0
      for (const control of row.querySelectorAll<HTMLElement>('button, a[href], input')) {
        control.tabIndex = active ? 0 : -1
      }
    }
    const wanted = pendingFocus.current
    if (!wanted) return
    const now =
      wanted.kind === 'file'
        ? latest.current?.files.find((file) => file.id === wanted.id)?.folderId
        : latest.current?.folders.find((folder) => folder.id === wanted.id)?.parentId
    const element = rowElements.current.get(wanted.id)
    if ((now ?? null) !== wanted.dest || !element) return
    pendingFocus.current = null
    element.focus()
  })
  // El último que se eligió o se dejó de elegir: con Mayúsculas, se elige el tramo hasta él
  const lastPicked = useRef<string | null>(null)
  // Por qué no se pudo mover lo último (se ve sobre la lista)
  const [moveError, setMoveError] = useState<string | null>(null)
  useEffect(() => {
    const wanted = refocus.current
    if (!wanted || !data) return
    const entry =
      wanted.kind === 'file'
        ? data.files.find((file) => file.id === wanted.id)?.folderId
        : data.folders.find((folder) => folder.id === wanted.id)?.parentId
    if ((entry ?? null) !== wanted.dest) return
    const gear = document.querySelector<HTMLElement>(`[data-file-card="${CSS.escape(wanted.id)}"] [data-settings]`)
    if (!gear) return
    refocus.current = null
    gear.focus()
  })
  const landedTimer = useRef<number | undefined>(undefined)
  const preview = (kind: 'file' | 'folder', id: string) => (shown: boolean) => {
    if (dragged.current) return
    setHovered((current) => (shown ? { kind, id } : current?.id === id ? null : current))
  }
  // Al cambiar de búsqueda o de filtro, nada señalado ni elegido
  useEffect(() => setHovered(null), [query, kind])
  useEffect(() => setChosen(new Map()), [query, kind])
  const stopChoosing = () => setChosen(new Map())
  useEffect(
    () => () => {
      window.clearTimeout(armTimer.current)
      window.clearTimeout(landedTimer.current)
    },
    []
  )
  // Lo de cada carpeta (null: lo más alto): las carpetas primero y luego los archivos, en su orden (por su puesto y, sin
  // él, detrás y por nombre); «Comunes», tras las del mundo
  const kids = useMemo(() => treeOf(data ?? { files: [], folders: [] }), [data])
  const ids = useMemo(() => data && [...data.files.map((f) => f.id), ...(data.folders ?? []).map((f) => f.id)], [data])
  const fresh = useFresh(ids)
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['files'] }),
      queryClient.invalidateQueries({ queryKey: ['commonFiles'] })
    ])
  // Mover (y recolocar): se ve ya en su sitio (sin esperar al servidor); si falla, vuelve como estaba. Luego, la lista
  // de verdad
  const move = useMutation({
    mutationFn: async ({
      item,
      to
    }: {
      item: Item
      to: FilesMove
      name: string
      into: string | null
      /** En su misma carpeta: solo cambia su puesto */
      reorder: boolean
    }) => {
      const beside = to.before ? { before: to.before } : to.after ? { after: to.after } : {}
      if (item.kind === 'file') await api.call('moveFile', { fileId: item.id, folderId: to.folderId, ...beside })
      else await api.call('updateFolder', { folderId: item.id, parentId: to.folderId, ...beside })
    },
    onMutate: async ({ item, to }) => {
      setMoveError(null)
      await queryClient.cancelQueries({ queryKey: cacheKey })
      const before = queryClient.getQueryData<Listed>(cacheKey)
      if (before) queryClient.setQueryData<Listed>(cacheKey, movedIn(before, item, to))
      return { before }
    },
    // Dice adónde ha ido
    onSuccess: (_, { name, into, reorder }) =>
      announce(
        reorder
          ? t('files.reordered', { name })
          : into
            ? t('files.moved', { name, folder: into })
            : t('files.movedToTop', { name })
      ),
    // Si falla, vuelve donde estaba y lo dice, también a la vista (sobre la lista) hasta el siguiente movimiento
    onError: (error, _, context) => {
      if (context?.before) queryClient.setQueryData(cacheKey, context.before)
      setLanded(null)
      setMoveError(errorText(error))
      announce(errorText(error))
    },
    onSettled: () => refresh()
  })
  if (!data) return null
  const folders = data.folders
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const fileById = new Map(data.files.map((file) => [file.id, file]))
  // Si una carpeta es de los comunes (la suya, o una de dentro)
  const inCommon = (folderId: string | null) => {
    for (let at = folderId ? byId.get(folderId) : undefined; at; at = at.parentId ? byId.get(at.parentId) : undefined) {
      if (at.id === COMMON) return true
    }
    return false
  }
  // Adónde va lo que se sube o se crea en una carpeta: su ámbito y la carpeta de verdad (la de «Comunes» es su raíz)
  const placeOf = (folderId: string | null) =>
    common && inCommon(folderId)
      ? { target: common.target as Target, folderId: folderId === COMMON ? null : folderId, canWrite: common.canWrite }
      : { target, folderId, canWrite }
  const canWriteFile = (file: WorldFile) => (file.worldId === null && common ? common.canWrite : canWrite)
  // De qué ámbito es una carpeta, para lo que se le suelta (en los comunes de Inicio no hay «Comunes» y todo es común)
  const scopeAt = (folderId: string | null): Realm => ('worldId' in placeOf(folderId).target ? 'mundo' : 'comun')
  // Si la elegida deja de existir (borrada aquí o en otra pestaña), a lo más alto
  const pathOf = (id: string | null): FolderView[] => {
    const path: FolderView[] = []
    for (let at = id ? byId.get(id) : undefined; at; at = at.parentId ? byId.get(at.parentId) : undefined) {
      path.unshift(at)
    }
    return path
  }
  // Buscar por nombre o #etiqueta (como en las páginas: sin tildes ni mayúsculas; la etiqueta, por su principio)
  const searching = query.trim() !== '' || kind !== 'all'
  const results = searching
    ? data.files.filter((file) => matches(file, query) && (kind === 'all' || file.kind === kind))
    : []
  // Lo encontrado, en su árbol: cada uno dentro de sus carpetas (desplegadas), sin lo demás
  const found = foundTree(results, kids, folders)
  // Lo que se ve, en orden: en el árbol, lo de lo más alto y lo de las carpetas desplegadas
  const visible: Item[] = []
  const tree = searching ? found : kids
  const isOpen = (id: string) => searching || expanded.has(id)
  const walk = (parentId: string | null) => {
    const entry = tree.get(parentId)
    for (const folder of entry?.folders ?? []) {
      visible.push({ kind: 'folder', id: folder.id })
      if (isOpen(folder.id)) walk(folder.id)
    }
    for (const file of entry?.files ?? []) visible.push({ kind: 'file', id: file.id })
  }
  walk(null)
  const isShown = (id: string) => visible.some((item) => item.id === id)
  // Lo elegido que sigue a la vista
  const chosenNow = visible.filter((item) => chosen.has(item.id))
  // Con Mayúsculas, del último que se eligió a este, todo lo que se ve entre medias (lo que se puede elegir)
  const pickable = (item: Item) =>
    item.kind === 'file'
      ? Boolean(fileById.get(item.id) && canWriteFile(fileById.get(item.id) as WorldFile))
      : item.id !== COMMON && placeOf(item.id).canWrite
  const selection = {
    has: (id: string) => chosen.has(id),
    active: chosenNow.length > 0,
    toggle: (id: string, what: 'file' | 'folder', range = false) => {
      const from = range && lastPicked.current ? visible.findIndex((item) => item.id === lastPicked.current) : -1
      const to = visible.findIndex((item) => item.id === id)
      lastPicked.current = id
      setChosen((current) => {
        const next = new Map(current)
        const on = !next.has(id)
        const span =
          from >= 0 && to >= 0
            ? visible.slice(Math.min(from, to), Math.max(from, to) + 1).filter(pickable)
            : [{ kind: what, id }]
        for (const item of span) {
          if (on) next.set(item.id, item.kind)
          else next.delete(item.id)
        }
        return next
      })
    }
  }
  // La parada del tabulador: la fila con el foco, si sigue a la vista; si no, la primera
  const tabStop = focusedRow && isShown(focusedRow) ? focusedRow : visible[0]?.id
  const nothing = data.files.length === 0 && folders.length === 0 && uploads.items.length === 0
  if (nothing && !canWrite && !common?.canWrite) return <p className={styles.empty}>{empty}</p>

  // Pulsar una carpeta la despliega y la elige; otra vez, la pliega y queda elegida su madre
  const toggle = (folder: FolderView) => {
    const open = !expanded.has(folder.id)
    setExpanded((current) => {
      const next = new Set(current)
      if (open) next.add(folder.id)
      else next.delete(folder.id)
      return next
    })
  }
  const expand = (id: string | null) => {
    if (id) setExpanded((current) => (current.has(id) ? current : new Set(current).add(id)))
  }
  // Cuánto tiene una carpeta (sin contar lo de las suyas)
  const countsOf = (id: string) => {
    const entry = kids.get(id)
    const parts = [
      entry?.folders.length ? t('files.folderFolders', { count: entry.folders.length }) : '',
      entry?.files.length ? t('files.folderFiles', { count: entry.files.length }) : ''
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : t('files.folderEmpty')
  }

  // Arrastrar (components/tree/moves.ts). De qué ámbito es lo arrastrado, dónde está y si puede ir a una carpeta
  // (null: lo más alto): de su ámbito, donde se pueda escribir y, una carpeta, no dentro de sí misma. A su misma
  // carpeta, solo para recolocarlo (junto a uno de su tipo) en otro puesto
  const realmOf = (item: Item): Realm =>
    (item.kind === 'file' ? fileById.get(item.id) : byId.get(item.id))?.worldId === null ? 'comun' : 'mundo'
  const parentOfItem = (item: Item) =>
    (item.kind === 'file' ? fileById.get(item.id)?.folderId : byId.get(item.id)?.parentId) ?? null
  // Los de su tipo en una carpeta, en su orden («Comunes» no cuenta: no es una carpeta de verdad)
  const siblingIds = (kind: Item['kind'], dest: string | null) =>
    (kind === 'file'
      ? (kids.get(dest)?.files ?? [])
      : (kids.get(dest)?.folders ?? []).filter((f) => f.id !== COMMON)
    ).map((entry) => entry.id)
  // Delante o detrás de una fila de su tipo, ahí se recoloca; sobre una del otro tipo, solo dice a qué carpeta va
  const besideOf = (item: Item, row: { id: string; kind: Item['kind'] }, zone: Zone): Beside | undefined => {
    if (zone === 'inside' || row.id === item.id) return undefined
    if (row.id === COMMON) {
      // Delante de «Comunes» (siempre tras las del mundo): detrás de la última del mundo
      const last =
        item.kind === 'folder' && zone === 'before'
          ? siblingIds('folder', null)
              .filter((id) => id !== item.id)
              .at(-1)
          : undefined
      return last ? { after: last } : undefined
    }
    if (row.kind !== item.kind) return undefined
    return zone === 'before' ? { before: row.id } : { after: row.id }
  }
  // Si recolocarlo ahí lo deja donde ya estaba
  const stays = (item: Item, dest: string | null, beside: Beside) => {
    const ids = siblingIds(item.kind, dest)
    const rest = ids.filter((id) => id !== item.id)
    const at = rest.indexOf(beside.before ?? beside.after ?? '')
    if (at < 0) return false
    rest.splice(beside.before ? at : at + 1, 0, item.id)
    return rest.join() === ids.join()
  }
  const canDropIn = (item: Item | 'files', dest: string | null, beside?: Beside) => {
    if (!placeOf(dest).canWrite) return false
    if (item === 'files') return true
    if (realmOf(item) !== scopeAt(dest)) return false
    if (item.kind === 'folder' && dest !== null && isInside((id) => byId.get(id)?.parentId, dest, item.id)) return false
    return parentOfItem(item) !== dest || (beside !== undefined && !stays(item, dest, beside))
  }
  // Archivos de fuera (del escritorio), no una fila de la lista
  const external = (event: DragEvent) =>
    !dragged.current && Array.from(event.dataTransfer?.types ?? []).includes('Files')
  const disarm = () => {
    window.clearTimeout(armTimer.current)
    if (armed.current === null) return
    armed.current = null
    setArming(null)
  }
  // Mantenido sobre una carpeta cerrada, se despliega sola (mientras, una raya se llena bajo su fila)
  const arm = (id: string) => {
    if (armed.current === id) return
    disarm()
    armed.current = id
    setArming(id)
    armTimer.current = window.setTimeout(() => {
      armed.current = null
      setArming(null)
      expand(id)
    }, EXPAND_AFTER)
  }
  const endDrag = () => {
    dragged.current = null
    setLifted(null)
    setDrop(null)
    disarm()
  }
  // Soltado: la carpeta de destino queda abierta, con lo movido (en su puesto, si se recoloca) iluminado un momento
  const moveTo = (item: Item, dest: string | null, beside?: Beside) => {
    expand(dest)
    window.clearTimeout(landedTimer.current)
    setLanded(item.id)
    landedTimer.current = window.setTimeout(() => setLanded(null), LANDED_FOR)
    move.mutate({
      item,
      to: { folderId: placeOf(dest).folderId, ...beside },
      name: (item.kind === 'file' ? fileById.get(item.id)?.name : byId.get(item.id)?.name) ?? '',
      into: dest ? (byId.get(dest)?.name ?? null) : null,
      reorder: parentOfItem(item) === dest
    })
  }
  /** Lo de arrastrar de una fila: la suya (id, madre, si es una carpeta y si está abierta) y su ámbito */
  const dragOf = (
    row: { id: string; parentId: string | null; kind: Item['kind']; name: string; open?: boolean },
    movable: boolean,
    realm: Realm
  ): RowDrag => {
    // Dónde caería: en el centro de una carpeta, dentro; si no, en su carpeta (encima o debajo de la fila) y, si la fila
    // es de su tipo, junto a ella
    const landing = (event: DragEvent<HTMLElement>, item: Item | 'files') => {
      const box = event.currentTarget.getBoundingClientRect()
      const zone = zoneAt((event.clientY - box.top) / (box.height || 1), row.kind === 'folder')
      const beside = item === 'files' ? undefined : besideOf(item, row, zone)
      return { zone, dest: zone === 'inside' ? row.id : row.parentId, beside }
    }
    const here = drop?.id === row.id ? drop.zone : undefined
    // Lo que no admite lo arrastrado (los comunes, para lo del mundo, y al revés), apagado: «no se puede»
    const dimmed = lifted !== null && lifted.id !== row.id && realm !== realmOf(lifted)
    // Encima: dónde caería, o nada si no se puede. También al entrar (Chromium, al pasar a otra fila, avisa solo con
    // dragenter: el dragover llega después)
    const hover = (event: DragEvent<HTMLElement>) => {
      const item = external(event) ? 'files' : dragged.current
      if (!item) return
      const { zone, dest, beside } = landing(event, item)
      if (!canDropIn(item, dest, beside)) {
        // Para los lectores de pantalla, una vez: de otro ámbito no se puede
        if (item !== 'files' && realmOf(item) !== scopeAt(dest) && !refusedSaid.current) {
          refusedSaid.current = true
          announce(t('files.otherScope'))
        }
        setDrop((current) => (current?.id === row.id ? null : current))
        if (armed.current === row.id) disarm()
        return
      }
      event.preventDefault()
      event.dataTransfer.dropEffect = item === 'files' ? 'copy' : 'move'
      setDrop((current) => (current?.id === row.id && current.zone === zone ? current : { id: row.id, zone }))
      if (zone === 'inside' && row.kind === 'folder' && !row.open) arm(row.id)
      else if (armed.current === row.id) disarm()
    }
    return {
      className: [
        dimmed ? styles.dimmed : '',
        arming === row.id ? styles.arming : '',
        landed === row.id ? styles.received : ''
      ]
        .filter(Boolean)
        .join(' '),
      attrs: {
        draggable: movable,
        'data-drop': here,
        onDragStart: (event) => {
          // Su imagen o su enlace también se arrastran: de una fila que no se mueve, nada
          if (!movable) return
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', row.name)
          dragged.current = { kind: row.kind, id: row.id }
          refusedSaid.current = false
          setHovered(null)
          // Levantado (y apagado lo que no lo admite) cuando el navegador ya ha sacado la imagen del arrastre
          window.setTimeout(() => {
            if (dragged.current?.id === row.id) setLifted(dragged.current)
          })
        },
        onDragEnd: endDrag,
        onDragEnter: hover,
        onDragOver: hover,
        onDragLeave: (event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
          setDrop((current) => (current?.id === row.id ? null : current))
          if (armed.current === row.id) disarm()
        },
        onDrop: (event) => {
          const item = external(event) ? 'files' : dragged.current
          if (!item) return
          const { dest, beside } = landing(event, item)
          if (!canDropIn(item, dest, beside)) return
          event.preventDefault()
          event.stopPropagation()
          endDrag()
          if (item !== 'files') moveTo(item, dest, beside)
          else {
            // Del escritorio: se suben ahí
            setOver(false)
            expand(dest)
            const to = placeOf(dest)
            void droppedFiles(event.dataTransfer).then((list) => uploads.add(list, to.target, to.folderId, dest))
          }
        }
      }
    }
  }
  // Archivos del escritorio sobre la pantalla: si una fila los recibe, la raya o el resalte dicen dónde (sin el aviso de
  // la pantalla); si no, van a la elegida
  const hoverZone = (event: DragEvent) => {
    if (!external(event)) return
    if (event.defaultPrevented) {
      if (over) setOver(false)
      return
    }
    if (!placeOf(null).canWrite) return
    event.preventDefault()
    setOver(true)
  }
  // Soltados en la pantalla, fuera de las filas: a lo más alto
  const dropOnZone = async (event: DragEvent) => {
    if (!external(event)) return
    event.preventDefault()
    setOver(false)
    setDrop(null)
    disarm()
    const here = placeOf(null)
    if (here.canWrite) uploads.add(await droppedFiles(event.dataTransfer), here.target, here.folderId, null)
  }

  // Mover desde su ventana («Carpeta»): como al soltarlo y, ya en su carpeta nueva, el foco vuelve a su engranaje
  const moveFromDialog = (item: Item) => (dest: string | null) => {
    refocus.current = { ...item, dest }
    // Abierto todo el camino hasta ella, para verlo dentro
    setExpanded((current) => new Set([...current, ...pathOf(dest).map((folder) => folder.id)]))
    moveTo(item, dest)
  }
  // El teclado de la lista: flechas para recorrer, abrir y cerrar; Alt + flechas para recolocar (arriba y abajo entre
  // los de su tipo; derecha, dentro de la carpeta de encima; izquierda, fuera de la suya); Intro abre y Espacio elige
  const focusRow = (index: number) => {
    const item = visible[Math.max(0, Math.min(visible.length - 1, index))]
    if (item) rowElements.current.get(item.id)?.focus()
  }
  const keyMove = (item: Item, key: string): { dest: string | null; beside?: Beside } | null => {
    const parent = parentOfItem(item)
    const ids = siblingIds(item.kind, parent)
    const at = ids.indexOf(item.id)
    if (key === 'ArrowUp' && at > 0) return { dest: parent, beside: { before: ids[at - 1] as string } }
    if (key === 'ArrowDown' && at >= 0 && at < ids.length - 1) {
      return { dest: parent, beside: { after: ids[at + 1] as string } }
    }
    if (key === 'ArrowRight') {
      // La carpeta de encima, en su misma carpeta: para una carpeta, la anterior; para un archivo, la última (los
      // archivos van tras las carpetas). «Comunes» no cuenta, y ha de ser de su ámbito
      const there = (kids.get(parent)?.folders ?? []).filter((folder) => folder.id !== COMMON)
      const target = there[item.kind === 'folder' ? there.findIndex((f) => f.id === item.id) - 1 : there.length - 1]
      if (!target || scopeAt(target.id) !== realmOf(item)) return null
      return { dest: target.id }
    }
    if (key === 'ArrowLeft' && parent && parent !== COMMON) {
      const grandparent = byId.get(parent)?.parentId ?? null
      return item.kind === 'folder' ? { dest: grandparent, beside: { after: parent } } : { dest: grandparent }
    }
    return null
  }
  const onRowKey = (item: Item, event: KeyboardEvent<HTMLDivElement>) => {
    // Las teclas de sus botones son suyas
    if (event.target !== event.currentTarget) return
    const index = visible.findIndex((each) => each.id === item.id)
    const folder = item.kind === 'folder' ? byId.get(item.id) : undefined
    if (event.altKey && event.key.startsWith('Arrow')) {
      event.preventDefault()
      if (searching || !pickable(item)) return
      const to = keyMove(item, event.key)
      if (!to) return
      pendingFocus.current = { ...item, dest: to.dest }
      moveTo(item, to.dest, to.beside)
      return
    }
    if (event.key === 'ArrowDown') focusRow(index + 1)
    else if (event.key === 'ArrowUp') focusRow(index - 1)
    else if (event.key === 'Home') focusRow(0)
    else if (event.key === 'End') focusRow(visible.length - 1)
    else if (event.key === 'ArrowRight' && folder) {
      if (isOpen(folder.id)) focusRow(index + 1)
      else toggle(folder)
    } else if (event.key === 'ArrowLeft') {
      const parent = parentOfItem(item)
      if (folder && isOpen(folder.id) && !searching) toggle(folder)
      else if (parent) rowElements.current.get(parent)?.focus()
    } else if (event.key === 'Enter') {
      if (folder) toggle(folder)
      else event.currentTarget.querySelector<HTMLElement>('[data-row-open]')?.click()
    } else if (event.key === ' ' && pickable(item)) selection.toggle(item.id, item.kind, event.shiftKey)
    else return
    event.preventDefault()
  }
  const focusOf = (item: Item): RowFocus => ({
    ref: (element) => {
      if (element) rowElements.current.set(item.id, element)
      else rowElements.current.delete(item.id)
    },
    tabIndex: tabStop === item.id ? 0 : -1,
    // Con el foco en la fila, su vista previa a la izquierda (como al pasar el ratón)
    onFocus: (event) => {
      setFocusedRow(item.id)
      if (event.target === event.currentTarget && !dragged.current) setHovered(item)
    },
    onKeyDown: (event) => onRowKey(item, event)
  })
  const rowProps = { folders, onChanged: refresh }
  const uploadRow = (upload: Upload, depth: number) => (
    <UploadRow key={`subida-${upload.key}`} upload={upload} depth={depth} onCancel={() => uploads.cancel(upload.key)} />
  )
  const itemClass = (id: string) => (lifted?.id === id ? `${styles.item} ${styles.lifted}` : styles.item)
  // Un nivel del árbol: lo que se sube ahí, sus carpetas (con lo suyo debajo si están desplegadas) y sus archivos
  const level = (parentId: string | null, depth: number): ReactNode[] => {
    const entry = tree.get(parentId)
    return [
      ...(searching
        ? []
        : uploads.items.filter((upload) => upload.place === parentId).map((upload) => uploadRow(upload, depth))),
      ...(entry?.folders ?? []).map((folder) => {
        const open = isOpen(folder.id)
        const writable = placeOf(folder.id).canWrite && folder.id !== COMMON
        const inside = open ? level(folder.id, depth + 1) : []
        return (
          <li key={folder.id} className={itemClass(folder.id)}>
            <FolderRow
              folder={folder}
              depth={depth}
              open={open}
              counts={countsOf(folder.id)}
              canWrite={writable}
              fresh={fresh(folder.id)}
              drag={
                searching
                  ? NO_DRAG
                  : dragOf(
                      { id: folder.id, parentId: folder.parentId ?? null, kind: 'folder', name: folder.name, open },
                      writable,
                      scopeAt(folder.id)
                    )
              }
              {...(placeOf(folder.id).canWrite && !searching
                ? {
                    onUpload: () => uploadInto(folder.id),
                    newFolder: { target: placeOf(folder.id).target, parentId: placeOf(folder.id).folderId }
                  }
                : {})}
              focus={focusOf({ kind: 'folder', id: folder.id })}
              onToggle={() => toggle(folder)}
              onPreview={preview('folder', folder.id)}
              folders={folders}
              onMove={moveFromDialog({ kind: 'folder', id: folder.id })}
              onChanged={refresh}
            />
            {inside.length > 0 && (
              <ul className={styles.kids} style={{ '--depth': depth } as CSSProperties}>
                {inside}
              </ul>
            )}
          </li>
        )
      }),
      ...(entry?.files ?? []).map((file) => (
        <li key={file.id} className={itemClass(file.id)}>
          <FileRow
            file={file}
            depth={depth}
            where={[]}
            fresh={fresh(file.id)}
            canWrite={canWriteFile(file)}
            drag={
              searching
                ? NO_DRAG
                : dragOf(
                    { id: file.id, parentId: file.folderId ?? null, kind: 'file', name: file.name },
                    canWriteFile(file),
                    file.worldId === null ? 'comun' : 'mundo'
                  )
            }
            focus={focusOf({ kind: 'file', id: file.id })}
            onPreview={preview('file', file.id)}
            onMove={moveFromDialog({ kind: 'file', id: file.id })}
            {...rowProps}
          />
        </li>
      ))
    ]
  }
  // Subir: el botón de arriba, a lo más alto; el de cada carpeta, a ella (el mismo campo de archivos)
  const uploadInto = (folderId: string | null) => {
    uploadPlace.current = folderId
    several.current?.click()
  }
  // Eligiendo, la barra de lo elegido tapa la de herramientas, en su mismo sitio y con su alto: la lista no se mueve bajo
  // el cursor (Enrique no lo pidió: salió en la crítica de la tanda 2)
  const choosing = chosenNow.length > 0
  const tools = (
    <div className={styles.tools} data-covered={choosing || undefined}>
      {placeOf(null).canWrite && (
        <>
          <button
            type="button"
            className={`${form.button} ${styles.uploadButton}`}
            data-tour="archivos-subir"
            onClick={() => uploadInto(null)}
          >
            <UploadIcon aria-hidden="true" size={16} />
            <span className={styles.uploadLabel}>{t('files.upload')}</span>
          </button>
          <input
            ref={several}
            type="file"
            multiple
            accept={UPLOAD_ACCEPT}
            hidden
            onChange={(event) => {
              const place = uploadPlace.current
              const here = placeOf(place)
              uploads.add([...(event.currentTarget.files ?? [])], here.target, here.folderId, place)
              // Lo que sube a una carpeta, a la vista en ella
              expand(place)
              event.currentTarget.value = ''
            }}
          />
        </>
      )}
      <label className={styles.search} data-tour="archivos-buscar">
        <Search aria-hidden="true" size={16} />
        <input
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
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
    </div>
  )
  const newHere = placeOf(null)
  const contents = (
    <SelectionContext value={selection}>
      <div className={styles.contents} data-selecting={selection.active || undefined}>
        {searching && <p className={styles.here}>{t('files.results', { count: results.length })}</p>}
        {moveError && <FormError message={moveError} />}
        {searching && results.length === 0 && (
          <p className={styles.empty}>
            {!query.trim()
              ? t('files.noKind')
              : query.trim().startsWith('#')
                ? t('files.noMatch')
                : t('files.noResults')}
          </p>
        )}
        {!searching && nothing && <p className={styles.empty}>{empty}</p>}
        <ul
          ref={listRef}
          className={styles.rows}
          aria-label={t('files.listLabel')}
          aria-describedby={keysHintId}
          data-tour="archivos-lista"
        >
          {level(null, 0)}
          {/* «Nueva carpeta», una fila más tras la última (docs/diseno.md): dentro de la elegida */}
          {!searching && newHere.canWrite && (
            <li className={styles.newItem}>
              <NewFolder
                target={newHere.target}
                parentId={newHere.folderId}
                label={t('files.newFolder')}
                onCreated={refresh}
              />
            </li>
          )}
        </ul>
        <p id={keysHintId} className={styles.hidden}>
          {t('files.keysHint')}
        </p>
      </div>
    </SelectionContext>
  )
  // Solo si sigue a la vista (al plegar su carpeta, su fila se va sin que el ratón «salga» de ella)
  const hoveredFile = hovered?.kind === 'file' && isShown(hovered.id) ? fileById.get(hovered.id) : undefined
  const hoveredFolder = hovered?.kind === 'folder' && isShown(hovered.id) ? byId.get(hovered.id) : undefined
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: soltar es un atajo; «Subir archivos» hace lo mismo con el teclado
    <div
      className={`${styles.zone} ${over ? styles.over : ''}`}
      onDragEnter={hoverZone}
      onDragOver={hoverZone}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        setOver(false)
        if (!dragged.current) {
          setDrop(null)
          disarm()
        }
      }}
      onDrop={dropOnZone}
    >
      {/* La columna del centro como en las demás vistas (título, botones y lista) y, a la izquierda, la vista previa */}
      <div className={styles.layout}>
        <div ref={center} className={styles.center}>
          {title}
          <div className={styles.toolbar}>
            {tools}
            {choosing && (
              <ChosenBar
                items={chosenNow.map((item) => {
                  const entry = item.kind === 'file' ? fileById.get(item.id) : byId.get(item.id)
                  return { ...item, name: entry?.name ?? '', worldId: entry?.worldId ?? null }
                })}
                folders={folders}
                onMoved={(dest) => {
                  setExpanded((current) => new Set([...current, ...pathOf(dest).map((folder) => folder.id)]))
                }}
                onDone={async () => {
                  stopChoosing()
                  await refresh()
                }}
                onClear={stopChoosing}
              />
            )}
          </div>
          {contents}
        </div>
        <aside className={styles.detail} aria-label={t('files.detail')}>
          {hoveredFile ? (
            <FileDetail file={hoveredFile} where={pathOf(hoveredFile.folderId)} />
          ) : hoveredFolder ? (
            <FolderDetail folder={hoveredFolder} files={data.files} folders={folders} />
          ) : null}
        </aside>
      </div>
      {over && <p className={styles.dropHint}>{t('files.dropHere')}</p>}
    </div>
  )
}

/** Un archivo en una fila: su miniatura, su nombre (lo abre), dónde está (al buscar), su tamaño y su engranaje */
function FileRow({
  file,
  depth,
  where,
  folders,
  canWrite,
  fresh,
  drag,
  focus,
  onPreview,
  onMove,
  onChanged
}: {
  file: WorldFile
  /** Lo honda que está en el árbol (0: lo más alto) */
  depth: number
  where: FolderView[]
  folders: FolderView[]
  canWrite: boolean
  fresh: boolean
  drag: RowDrag
  focus: RowFocus
  /** Llevarlo a otra carpeta desde su ventana (null: lo más alto) */
  onMove: (dest: string | null) => void
  /** Al pasar el ratón (true) y al irse (false): para la vista previa */
  onPreview: (shown: boolean) => void
  onChanged: () => Promise<unknown>
}) {
  const { i18n } = useTranslation()
  return (
    <div
      {...drag.attrs}
      {...focus}
      className={[styles.row, styles.treeRow, fresh ? styles.appear : '', drag.className].filter(Boolean).join(' ')}
      style={{ '--depth': depth } as CSSProperties}
      data-file-card={file.id}
      onPointerEnter={() => onPreview(true)}
      onPointerLeave={() => onPreview(false)}
      // Al abrir algo suyo (su engranaje, la imagen en grande), la vista previa se va
      onClickCapture={(event) => {
        if ((event.target as Element).closest('[aria-haspopup="dialog"]')) onPreview(false)
      }}
    >
      {canWrite && <Pick id={file.id} what="file" name={file.name} />}
      <span className={styles.chevron} aria-hidden="true" />
      <span className={styles.rowThumb}>
        <Thumb file={file} small />
      </span>
      <span className={styles.rowText}>
        <FileName file={file} className={styles.rowName} />
        {where.length > 0 && <span className={styles.where}>{where.map((folder) => folder.name).join(' › ')}</span>}
        <FileTags tags={file.tags} />
      </span>
      <span className={styles.rowMeta}>{sizeText(file.size, i18n.language)}</span>
      {canWrite ? <FileSettings file={file} folders={folders} onMove={onMove} onChanged={onChanged} /> : <span />}
    </div>
  )
}

/** Las etiquetas de un archivo, en su fila */
function FileTags({ tags }: { tags: readonly string[] }) {
  const colorOf = useTagColor()
  if (tags.length === 0) return null
  return (
    <span className={tagStyles.rowChips}>
      {tags.map((tag) => (
        <TagChip key={tag} name={tag} color={colorOf(tag)} />
      ))}
    </span>
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
 * El archivo bajo el ratón, en la vista previa de la izquierda: grande, su nombre, de qué tipo es, sus medidas si es
 * una imagen, cuánto pesa, dónde está y cuándo cambió (abrirlo y lo demás, en su fila)
 */
function FileDetail({ file, where }: { file: WorldFile; where: FolderView[] }) {
  const { t, i18n } = useTranslation()
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })
  // Las medidas de una imagen, al cargarla en la vista previa
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  useEffect(() => setSize(null), [file.id])
  return (
    <div className={styles.detailBody}>
      <div className={styles.preview}>
        {file.kind === 'image' ? (
          <img
            src={file.url}
            alt=""
            onLoad={(event) =>
              setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
            }
          />
        ) : (
          <Thumb file={file} />
        )}
      </div>
      <h2 className={styles.detailName}>{file.name}</h2>
      <dl className={styles.facts}>
        <dt>{t('files.kindLabel')}</dt>
        <dd>{t(`files.types.${typeOf(file)}`)}</dd>
        {size && (
          <>
            <dt>{t('files.dimensions')}</dt>
            <dd>{t('files.pixels', { width: size.width, height: size.height })}</dd>
          </>
        )}
        <dt>{t('files.sizeLabel')}</dt>
        <dd>{sizeText(file.size, i18n.language)}</dd>
        {where.length > 0 && (
          <>
            <dt>{t('files.folder')}</dt>
            <dd>{where.map((folder) => folder.name).join(' › ')}</dd>
          </>
        )}
        {/* Dónde se usa, antes de pensar en borrarlo */}
        {file.usedBy > 0 && (
          <>
            <dt>{t('files.usedLabel')}</dt>
            <dd>{t('files.usedBy', { count: file.usedBy })}</dd>
          </>
        )}
        <dt>{t('files.updatedLabel')}</dt>
        <dd>{date.format(new Date(file.updatedAt))}</dd>
      </dl>
    </div>
  )
}

/** Todo lo que hay dentro de una carpeta, también en las suyas: archivos y carpetas */
function contentsOf(folderId: string, files: WorldFile[], folders: FolderView[]) {
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
  return {
    files: files.filter((file) => file.folderId && inside.has(file.folderId)),
    subfolders: inside.size - 1
  }
}

/**
 * La carpeta bajo el ratón, en la vista previa de la izquierda: cuántos archivos y carpetas tiene, cuánto ocupa todo,
 * de qué tipos y sus primeras imágenes
 */
function FolderDetail({ folder, files, folders }: { folder: FolderView; files: WorldFile[]; folders: FolderView[] }) {
  const { t, i18n } = useTranslation()
  const inside = contentsOf(folder.id, files, folders)
  const total = inside.files.reduce((sum, file) => sum + file.size, 0)
  const byType = Map.groupBy(inside.files, typeOf)
  const images = inside.files.filter((file) => file.kind === 'image').slice(0, 4)
  return (
    <div className={styles.detailBody}>
      <div className={`${styles.preview} ${styles.folderPreview}`}>
        <FolderGlyph folder={folder} open size={56} strokeWidth={1.25} />
      </div>
      <h2 className={styles.detailName}>{folder.name}</h2>
      <dl className={styles.facts}>
        <dt>{t('files.filesLabel')}</dt>
        <dd>
          {inside.files.length > 0 ? t('files.folderFiles', { count: inside.files.length }) : t('files.folderEmpty')}
        </dd>
        {inside.subfolders > 0 && (
          <>
            <dt>{t('files.foldersLabel')}</dt>
            <dd>{t('files.folderFolders', { count: inside.subfolders })}</dd>
          </>
        )}
        {total > 0 && (
          <>
            <dt>{t('files.sizeLabel')}</dt>
            <dd>{sizeText(total, i18n.language)}</dd>
          </>
        )}
        {byType.size > 0 && (
          <>
            <dt>{t('files.kindLabel')}</dt>
            <dd>{[...byType].map(([type, list]) => t(`files.counts.${type}`, { count: list.length })).join(' · ')}</dd>
          </>
        )}
      </dl>
      {images.length > 0 && (
        <div className={styles.minigrid}>
          {images.map((file) => (
            <img key={file.id} src={file.url} alt="" loading="lazy" />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Una carpeta en su fila: su flecha (gira al abrirla), su icono, su nombre, cuánto tiene y su engranaje. Pulsarla (toda
 * la fila) la despliega en su sitio y la elige, o la pliega; con el teclado, también la flecha derecha la abre y la
 * izquierda la cierra
 */
function FolderRow({
  folder,
  depth,
  open,
  counts,
  canWrite,
  fresh,
  drag,
  focus,
  onUpload,
  newFolder,
  onToggle,
  onPreview,
  folders,
  onMove,
  onChanged
}: {
  folder: FolderView
  depth: number
  open: boolean
  counts: string
  /** Todas las carpetas, para llevarla a otra desde su ventana (onMove; null: lo más alto) */
  folders: FolderView[]
  onMove: (dest: string | null) => void
  /** Subir a ella y crear una dentro: dos botones que salen al pasar el ratón (si se puede escribir en ella) */
  onUpload?: () => void
  newFolder?: { target: Target; parentId: string | null }
  /** Se puede cambiar (la de «Comunes» en un mundo, no: ni se renombra ni se borra) */
  canWrite: boolean
  fresh: boolean
  drag: RowDrag
  focus: RowFocus
  onToggle: () => void
  /** Al pasar el ratón (true) y al irse (false): para la vista previa */
  onPreview: (shown: boolean) => void
  onChanged: () => Promise<unknown>
}) {
  const { t } = useTranslation()
  const classes = [styles.row, styles.treeRow, fresh ? styles.appear : '', drag.className]
  return (
    <div
      {...drag.attrs}
      {...focus}
      className={classes.filter(Boolean).join(' ')}
      style={{ '--depth': depth } as CSSProperties}
      data-file-card={folder.id}
      onPointerEnter={() => onPreview(true)}
      onPointerLeave={() => onPreview(false)}
      // Al abrir algo suyo (su engranaje), la vista previa se va
      onClickCapture={(event) => {
        if ((event.target as Element).closest('[aria-haspopup="dialog"]')) onPreview(false)
      }}
    >
      {canWrite && <Pick id={folder.id} what="folder" name={folder.name} />}
      <span className={styles.chevron} data-open={open} aria-hidden="true">
        <ChevronRight size={16} />
      </span>
      <span className={`${styles.rowThumb} ${styles.folderThumb}`}>
        <FolderGlyph folder={folder} open={open} />
      </span>
      <span className={styles.rowText}>
        <button
          type="button"
          className={`${styles.rowName} ${styles.open}`}
          aria-expanded={open}
          onClick={onToggle}
          onKeyDown={(event) => {
            if ((event.key === 'ArrowRight' && !open) || (event.key === 'ArrowLeft' && open)) {
              event.preventDefault()
              onToggle()
            }
          }}
        >
          {folder.name}
        </button>
      </span>
      {/* Cuánto tiene; al pasar el ratón (o con el foco), en su sitio, subir a ella y crear una dentro */}
      <span className={styles.folderMeta}>
        <span className={styles.rowMeta}>{counts}</span>
        {(onUpload || newFolder) && (
          <span className={styles.rowActions}>
            {onUpload && (
              <button
                type="button"
                className={styles.smallGear}
                aria-label={t('files.uploadInto', { folder: folder.name })}
                title={t('files.uploadHere')}
                onClick={onUpload}
              >
                <UploadIcon aria-hidden="true" size={15} />
              </button>
            )}
            {newFolder && (
              <NewFolder
                shape="icon"
                target={newFolder.target}
                parentId={newFolder.parentId}
                label={t('files.newFolderIn', { folder: folder.name })}
                onCreated={onChanged}
              />
            )}
          </span>
        )}
      </span>
      {canWrite ? <FolderSettings folder={folder} folders={folders} onMove={onMove} onChanged={onChanged} /> : <span />}
    </div>
  )
}

/** Una subida en una fila: su nombre, su progreso y la X para cancelarla (o el motivo, si falló, y la X para quitarla) */
function UploadRow({ upload, depth, onCancel }: { upload: Upload; depth: number; onCancel: () => void }) {
  const { t, i18n } = useTranslation()
  const percent = new Intl.NumberFormat(i18n.language, { style: 'percent' }).format(upload.fraction)
  const broken = upload.status === 'failed'
  return (
    <li className={styles.item}>
      <div
        className={`${styles.row} ${styles.treeRow} ${styles.uploadingRow}`}
        style={{ '--depth': depth } as CSSProperties}
      >
        <span className={styles.chevron} aria-hidden="true" />
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
      </div>
    </li>
  )
}

/** «Nueva carpeta» (dentro de parentId): una fila más al final de la lista, y su cuadro con el nombre */
function NewFolder({
  target,
  parentId,
  label,
  shape = 'row',
  onCreated
}: {
  target: Target
  parentId: string | null
  /** «Nueva carpeta» (al final de la lista, en lo más alto) o «Nueva carpeta en …» (el icono de una carpeta) */
  label: string
  /** row: la fila del final; icon: el botón pequeño de una carpeta */
  shape?: 'row' | 'icon'
  onCreated: () => Promise<unknown>
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
      {shape === 'icon' ? (
        <button
          ref={trigger}
          type="button"
          className={styles.smallGear}
          aria-label={label}
          title={t('files.newFolderHere')}
          aria-haspopup="dialog"
          onClick={() => {
            setName('')
            create.reset()
            setOpen(true)
          }}
        >
          <FolderPlus aria-hidden="true" size={15} />
        </button>
      ) : (
        <NewCard
          ref={trigger}
          shape="row"
          label={label}
          className={styles.newFolder}
          aria-haspopup="dialog"
          onClick={() => {
            setName('')
            create.reset()
            setOpen(true)
          }}
        />
      )}
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
            <h2 id={titleId}>{label}</h2>
            <Field
              label={t('files.folderName')}
              value={name}
              required
              maxLength={120}
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
              data-autofocus=""
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <FormError message={create.error ? errorText(create.error) : null} />
            <div className={dialogStyles.actions}>
              <BusyButton type="submit" className={form.button} busy={create.isPending}>
                {t('files.createFolder')}
              </BusyButton>
              <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
                {t('files.cancel')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

/** El engranaje de una carpeta: abre su ventana */
/**
 * «Carpeta»: en cuál está un archivo o una carpeta (las de su ámbito, con su camino) o en ninguna. Los valores son los
 * del árbol de la pantalla: lo común que no está en ninguna, en un mundo, cuelga de «Comunes»
 */
function FolderField({
  folders,
  of,
  moving,
  value,
  onChange
}: {
  folders: FolderView[]
  /** Lo que se cambia de sitio: su ámbito */
  of: { worldId: string | null }
  /** Las carpetas que se mueven: ellas y las suyas no salen */
  moving?: string | readonly string[]
  value: string | null
  onChange: (folderId: string | null) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  // Lo más alto: para lo común en un mundo, «Comunes»
  const top = of.worldId === null && folders.some((folder) => folder.id === COMMON) ? COMMON : null
  return (
    <div className={form.field}>
      <label htmlFor={id}>{t('files.folder')}</label>
      <select
        id={id}
        value={value === top ? '' : (value ?? '')}
        onChange={(event) => onChange(event.currentTarget.value || top)}
      >
        <option value="">{t('files.noFolder')}</option>
        {folderChoices(folders, of.worldId, moving).map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function FolderSettings({
  folder,
  folders,
  onMove,
  onChanged
}: {
  folder: FolderView
  folders: FolderView[]
  onMove: (dest: string | null) => void
  onChanged: () => Promise<unknown>
}) {
  const { t } = useTranslation()
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.smallGear}
        data-settings=""
        aria-label={t('files.folderSettingsOf', { name: folder.name })}
        title={t('files.folderSettingsOf', { name: folder.name })}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Settings aria-hidden="true" size={14} />
      </button>
      {open && (
        <FolderDialog
          folder={folder}
          folders={folders}
          onMove={onMove}
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

/**
 * La ventana de una carpeta: su nombre, en qué carpeta está y, en la zona de peligro, borrarla con lo que tiene.
 * onClose(gone): si se borró
 */
function FolderDialog({
  folder,
  folders,
  onMove,
  onChanged,
  onClose
}: {
  folder: FolderView
  folders: FolderView[]
  onMove: (dest: string | null) => void
  onChanged: () => Promise<unknown>
  onClose: (gone: boolean) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const gone = useRef(false)
  const [name, setName] = useState(folder.name)
  const [color, setColor] = useState(folder.color)
  const [icon, setIcon] = useState(folder.icon)
  const startParent = folder.parentId ?? null
  const [parent, setParent] = useState(startParent)
  const renamed = name.trim() !== folder.name
  const restyled = color !== folder.color || icon !== folder.icon
  const moved = parent !== startParent
  const rename = useMutation({
    mutationFn: async () => {
      if (renamed || restyled) {
        await api.call('updateFolder', {
          folderId: folder.id,
          ...(renamed ? { name: name.trim() } : {}),
          ...(color !== folder.color ? { color } : {}),
          ...(icon !== folder.icon ? { icon } : {})
        })
        await onChanged()
      }
    },
    // A otra carpeta: la ventana se cierra y se ve ya en su sitio
    onSuccess: () => {
      if (!moved) return
      dialog.current?.close()
      onMove(parent)
    }
  })
  const changed = renamed || restyled || moved
  const remove = async () => {
    await api.call('deleteFolder', { folderId: folder.id })
    gone.current = true
    await vanish(folder.id, dialog.current)
    await onChanged()
  }
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={cards.dialog} onClose={() => onClose(gone.current)}>
      <div className={`${styles.preview} ${styles.iconPreview}`}>
        <FolderGlyph folder={{ color, icon }} size={44} strokeWidth={1.25} />
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
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <FolderField folders={folders} of={folder} moving={folder.id} value={parent} onChange={setParent} />
        <IconChoices value={icon} onChange={setIcon} />
        <ColorChoices value={color} onChange={setColor} />
        <FormError message={rename.error ? errorText(rename.error) : null} />
        <ChangesBar shown={changed}>
          <BusyButton type="submit" className={form.button} busy={rename.isPending}>
            {t('files.save')}
          </BusyButton>
          <button
            type="button"
            className={dialogStyles.cancel}
            onClick={() => {
              setName(folder.name)
              setColor(folder.color)
              setIcon(folder.icon)
              setParent(startParent)
            }}
          >
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
  )
}

/**
 * Lo que se va (un archivo o una carpeta borrados): su ventana se cierra y su fila se desvanece encogiendo un poco;
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
  /** La carpeta de la lista bajo la que sale mientras sube (null: lo más alto) */
  place: string | null
}

/**
 * La cola de subidas: unas pocas a la vez, cada una con su progreso. Al acabar, se quita (ya es su
 * fila); la que falla se queda con el motivo hasta quitarla. Cancelar una la corta o la saca de la cola
 */
function useUploads() {
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

/** El nombre de un archivo, que lo abre (toda su fila): una imagen, en grande; lo demás, en otra pestaña */
function FileName({ file, className }: { file: WorldFile; className: string | undefined }) {
  const trigger = useRef<HTMLButtonElement>(null)
  const [viewing, setViewing] = useState(false)
  return (
    <>
      {file.kind === 'image' ? (
        <button
          ref={trigger}
          type="button"
          className={[className, styles.open].filter(Boolean).join(' ')}
          aria-haspopup="dialog"
          data-row-open=""
          onClick={() => setViewing(true)}
        >
          {file.name}
        </button>
      ) : (
        <a
          href={file.url}
          className={className}
          data-row-open=""
          target="_blank"
          rel="noopener"
          {...(file.kind === 'other' ? { download: file.name } : {})}
        >
          {file.name}
        </a>
      )}
      {viewing && (
        <CoverViewer
          url={file.url}
          label={file.name}
          onClose={() => {
            setViewing(false)
            trigger.current?.focus()
          }}
        />
      )}
    </>
  )
}

/** El engranaje de un archivo: abre su ventana */
function FileSettings({
  file,
  folders,
  onMove,
  onChanged
}: {
  file: WorldFile
  folders: FolderView[]
  onMove: (dest: string | null) => void
  onChanged: () => Promise<unknown>
}) {
  const { t } = useTranslation()
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.smallGear}
        data-settings=""
        aria-label={t('files.settingsOf', { name: file.name })}
        title={t('files.settingsOf', { name: file.name })}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Settings aria-hidden="true" size={14} />
      </button>
      {open && (
        <FileDialog
          file={file}
          folders={folders}
          onMove={onMove}
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

/**
 * La ventana de un archivo: su vista previa, el nombre y su carpeta («Guardar» y «Cancelar» solo con cambios), sus
 * etiquetas y, al final, la zona de peligro. onClose(gone): si se ha borrado
 */
function FileDialog({
  file,
  folders,
  onMove,
  onChanged,
  onClose
}: {
  file: WorldFile
  folders: FolderView[]
  onMove: (dest: string | null) => void
  onChanged: () => Promise<unknown>
  onClose: (gone: boolean) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const gone = useRef(false)
  const [name, setName] = useState(file.name)
  const startFolder = file.folderId ?? null
  const [folderId, setFolderId] = useState(startFolder)
  // Las etiquetas también esperan a «Guardar», como el nombre y la carpeta, con lo que esté a medio escribir (así el
  // campo no cambia justo al pulsar «Guardar»); `round` lo vacía al guardar o cancelar
  const catalog = useAccountTags().data?.tags.map((tag) => tag.name) ?? []
  const [tags, setTags] = useState<string[]>(file.tags)
  const [typed, setTyped] = useState('')
  const [round, setRound] = useState(0)
  const nextTags = addTyped(tags, typed, catalog)
  const renamed = name.trim() !== file.name
  const moved = folderId !== startFolder
  const retagged = nextTags.length !== file.tags.length || nextTags.some((tag, index) => tag !== file.tags[index])
  const resetTags = (to: string[]) => {
    setTags(to)
    setTyped('')
    setRound((n) => n + 1)
  }
  const rename = useMutation({
    mutationFn: async () => {
      if (renamed) await api.call('renameFile', { fileId: file.id, name: name.trim() })
      if (retagged) await api.call('setFileTags', { fileId: file.id, tags: nextTags })
      if (renamed || retagged) await onChanged()
      return nextTags
    },
    // A otra carpeta: la ventana se cierra y se ve ya en su sitio
    onSuccess: (saved) => {
      resetTags(saved)
      if (!moved) return
      dialog.current?.close()
      onMove(folderId)
    }
  })
  // Borrado, su fila se desvanece y la lista se pone al día
  const remove = async () => {
    await api.call('deleteFile', { fileId: file.id })
    gone.current = true
    await vanish(file.id, dialog.current)
    await onChanged()
  }
  const changed = renamed || moved || retagged
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
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          spellCheck={false}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <FolderField folders={folders} of={file} value={folderId} onChange={setFolderId} />
        <TagsField key={round} value={tags} onChange={setTags} onPending={setTyped} />
        <FormError message={rename.error ? errorText(rename.error) : null} />
        {/* Al final, como en las demás ventanas */}
        <ChangesBar shown={changed}>
          <BusyButton type="submit" className={form.button} busy={rename.isPending}>
            {t('files.save')}
          </BusyButton>
          <button
            type="button"
            className={dialogStyles.cancel}
            onClick={() => {
              setName(file.name)
              setFolderId(startFolder)
              resetTags(file.tags)
            }}
          >
            {t('files.cancel')}
          </button>
        </ChangesBar>
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
