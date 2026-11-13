/**
 * La lista-árbol de los archivos de un ámbito: pulsar una carpeta la despliega en su sitio, con lo suyo sangrado debajo.
 * Se buscan por nombre y se filtran por tipo o etiqueta; se suben con «Subir archivos» o soltándolos encima, y se
 * mueven arrastrándolos, como las páginas del mundo. En la pantalla de Archivos (screen) o, en pequeño, en la barra del
 * mundo (side), donde pulsar un archivo lo abre en el centro
 */

import type { FolderView } from '@crisol/contracts'
import { UPLOAD_ACCEPT } from '@crisol/domain'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Upload as UploadIcon } from 'lucide-react'
import {
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { EmptyState, TitleEmblem } from '../components/empty-state.tsx'
import { FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import { isInside, type Zone, zoneAt } from '../components/tree/moves.ts'
import { ChosenBar } from './file-chosen.tsx'
import { NewFolder } from './file-dialogs.tsx'
import { type FilesMove, type Item, type Listed, movedIn } from './file-order.ts'
import { FileDetail, FolderDetail } from './file-parts.tsx'
import {
  FileRow,
  FolderRow,
  NO_DRAG,
  type Pick,
  type RowDrag,
  type RowFocus,
  SelectionContext,
  UploadRow
} from './file-rows.tsx'
import { foundTree, isRoot, matches, rootFolder, type Scope, treeOf, withRoot } from './file-tree.ts'
import { droppedFiles, type Target, type Upload, useUploads } from './file-uploads.ts'
import styles from './files.module.css'
import type { WorldFile } from './links-context.ts'

export const KINDS = ['image', 'pdf', 'other'] as const

export type Kind = (typeof KINDS)[number]

/** Cuánto hay que mantener lo arrastrado sobre una carpeta cerrada para que se despliegue sola */
export const EXPAND_AFTER = 650

/** Cuánto se ilumina lo recién movido */
export const LANDED_FOR = 1400

/** Los archivos y las carpetas de un ámbito */
/** Delante o detrás de qué hermano de su tipo queda lo que se recoloca */
export type Beside = Pick<FilesMove, 'before' | 'after'>

/** De qué ámbito es algo: los del mundo y los comunes no se mezclan */
/** De qué ámbito es algo: su mundo o «comun» (lo de uno no va a otro) */
export type Realm = string

/** Otro ámbito, colgando de su raíz: en un mundo, los comunes («Comunes»); en los comunes, cada mundo */
export interface OtherScope {
  id: string
  name: string
  worldId: string | null
  organizationId: string
  color?: FolderView['color']
  target: Target
  data: Scope | undefined
  canWrite: boolean
}

export const NO_OTHERS: OtherScope[] = []

export const realmOfTarget = (target: Target): Realm => ('worldId' in target ? target.worldId : 'comun')

/** Las ya vistas: las que lleguen después (recién subidas o creadas) entran con su animación; al cargar, ninguna */
export function useFresh(ids: readonly string[] | undefined) {
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
 * resaltada (va dentro). A la izquierda, la vista previa de lo que está bajo el ratón. En la barra del mundo (side), en
 * pequeño: buscar, subir y el árbol; pulsar un archivo lo abre en el centro (onOpenFile), sin elegir varios ni vista
 * previa (eso, en «Ver todos»)
 */
export function FilesSection({
  target,
  data: ownData,
  cacheKey,
  canWrite,
  empty,
  title,
  others = NO_OTHERS,
  variant = 'screen',
  onOpenFile,
  currentFileId
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
  /**
   * Otros ámbitos, cada uno una carpeta más con lo suyo dentro: en un mundo, los comunes de la cuenta («Comunes»,
   * ADR-0005); en los comunes, los mundos
   */
  others?: OtherScope[]
  /** screen: la pantalla de Archivos; side: en pequeño, en la barra del mundo a pantalla completa (ADR-0027) */
  variant?: 'screen' | 'side'
  /** Pulsar un archivo: abrirlo en el centro (sin él, como siempre: una imagen en grande, lo demás en otra pestaña) */
  onOpenFile?: (file: WorldFile) => void
  /** El archivo abierto en el centro, marcado en su fila */
  currentFileId?: string | undefined
}) {
  const { t } = useTranslation()
  const side = variant === 'side'
  const api = useApi()
  const queryClient = useQueryClient()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const uploads = useUploads()
  // Lo de cada otro ámbito cuelga de su carpeta: lo que en él está en lo más alto, dentro de ella (others llega ya
  // memorizado: la misma lista mientras no cambien los datos)
  const data = useMemo<Scope | undefined>(
    () =>
      ownData &&
      others.reduce<Scope>((all, other) => (other.data ? withRoot(all, other.data, rootFolder(other)) : all), ownData),
    [ownData, others]
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
        const wanted = active ? 0 : -1
        if (control.tabIndex !== wanted) control.tabIndex = wanted
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
  // De qué otro ámbito es una carpeta (su raíz, o una de dentro); de ninguno, si es de este
  const otherOf = (folderId: string | null) => {
    for (let at = folderId ? byId.get(folderId) : undefined; at; at = at.parentId ? byId.get(at.parentId) : undefined) {
      const other = others.find((each) => each.id === at?.id)
      if (other) return other
    }
    return undefined
  }
  // Adónde va lo que se sube o se crea en una carpeta: su ámbito y la carpeta de verdad (la raíz de otro ámbito es su
  // lo más alto)
  const placeOf = (folderId: string | null) => {
    const other = otherOf(folderId)
    return other
      ? { target: other.target, folderId: folderId === other.id ? null : folderId, canWrite: other.canWrite }
      : { target, folderId, canWrite }
  }
  const canWriteFile = (file: WorldFile) =>
    others.find((other) => realmOfTarget(other.target) === (file.worldId ?? 'comun'))?.canWrite ?? canWrite
  // De qué ámbito es una carpeta, para lo que se le suelta
  const scopeAt = (folderId: string | null): Realm => realmOfTarget(placeOf(folderId).target)
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
      : !isRoot(item.id) && placeOf(item.id).canWrite
  const selection = {
    has: (id: string) => chosen.has(id),
    active: chosenNow.length > 0,
    toggle: (id: string, what: 'file' | 'folder', range = false) => {
      // En la barra no se eligen varios (en «Ver todos», sí)
      if (side) return
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
  if (nothing && !canWrite && !others.some((other) => other.canWrite)) return <p className={styles.empty}>{empty}</p>

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
    (item.kind === 'file' ? fileById.get(item.id) : byId.get(item.id))?.worldId ?? 'comun'
  const parentOfItem = (item: Item) =>
    (item.kind === 'file' ? fileById.get(item.id)?.folderId : byId.get(item.id)?.parentId) ?? null
  // Los de su tipo en una carpeta, en su orden («Comunes» no cuenta: no es una carpeta de verdad)
  const siblingIds = (kind: Item['kind'], dest: string | null) =>
    (kind === 'file'
      ? (kids.get(dest)?.files ?? [])
      : (kids.get(dest)?.folders ?? []).filter((f) => !isRoot(f.id))
    ).map((entry) => entry.id)
  // Delante o detrás de una fila de su tipo, ahí se recoloca; sobre una del otro tipo, solo dice a qué carpeta va
  const besideOf = (item: Item, row: { id: string; kind: Item['kind'] }, zone: Zone): Beside | undefined => {
    if (zone === 'inside' || row.id === item.id) return undefined
    if (isRoot(row.id)) {
      // Delante de una raíz de otro ámbito (siempre tras las propias): detrás de la última propia
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
      const there = (kids.get(parent)?.folders ?? []).filter((folder) => !isRoot(folder.id))
      const target = there[item.kind === 'folder' ? there.findIndex((f) => f.id === item.id) - 1 : there.length - 1]
      if (!target || scopeAt(target.id) !== realmOf(item)) return null
      return { dest: target.id }
    }
    if (key === 'ArrowLeft' && parent && !isRoot(parent)) {
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
        const writable = placeOf(folder.id).canWrite && !isRoot(folder.id)
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
            {...(onOpenFile ? { onOpen: () => onOpenFile(file) } : {})}
            current={file.id === currentFileId}
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
          placeholder={t(side ? 'worldShell.searchFiles' : 'files.search')}
          aria-label={t(side ? 'worldShell.searchFiles' : 'files.search')}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </label>
      {!side && (
        // biome-ignore lint/a11y/useSemanticElements: unos botones que filtran, no un formulario
        <div className={styles.kinds} role="group" aria-label={t('files.kinds')}>
          {(['all', ...KINDS] as const).map((k) => (
            <button key={k} type="button" className={styles.kind} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {k === 'all' ? t('files.all') : t(`files.groups.${k}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
  const newHere = placeOf(null)
  const contents = (
    <SelectionContext value={side ? null : selection}>
      <div className={styles.contents} data-selecting={selection.active || undefined}>
        {searching && <p className={styles.here}>{t('files.results', { count: results.length })}</p>}
        {moveError && <FormError message={moveError} />}
        {searching && results.length === 0 && (
          <EmptyState kind="sin-resultados" small>
            <p className={styles.empty}>
              {!query.trim()
                ? t('files.noKind')
                : query.trim().startsWith('#')
                  ? t('files.noMatch')
                  : t('files.noResults')}
            </p>
          </EmptyState>
        )}
        {!searching && nothing && (
          <EmptyState kind="archivos">
            <p className={styles.empty}>{empty}</p>
          </EmptyState>
        )}
        <ul
          ref={listRef}
          className={styles.rows}
          aria-label={t(side ? 'worldShell.filesList' : 'files.listLabel')}
          aria-describedby={keysHintId}
          data-tour="archivos-lista"
        >
          {level(null, 0)}
          {/* «Nueva carpeta», una fila más tras la última (docs/diseno.md): dentro de la elegida */}
          {!searching && newHere.canWrite && !nothing && (
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
      data-variant={variant}
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
      {/* La columna del centro como en las demás vistas (título, botones y lista) y, a la izquierda, la vista previa; en
          la barra del mundo, solo los botones y la lista */}
      {side ? (
        <>
          <div className={styles.toolbar}>{tools}</div>
          {contents}
        </>
      ) : (
        <div className={styles.layout}>
          <div ref={center} className={styles.center}>
            <TitleEmblem kind="archivos" show={!nothing}>
              {title}
            </TitleEmblem>
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
      )}
      {over && <p className={styles.dropHint}>{t('files.dropHere')}</p>}
    </div>
  )
}
