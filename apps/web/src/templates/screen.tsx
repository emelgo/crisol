/**
 * «Plantillas», en la zona de Mis mundos (ADR-0009, ADR-0024): como Archivos, la lista es el árbol. Las carpetas se
 * despliegan en su sitio, se arrastra (y con el teclado, Alt y las flechas) para meter en una carpeta o recolocar, y la
 * vista previa va a la izquierda (portada, icono, campos, pestañas y en cuántas páginas se usa). «Plantilla nueva» y
 * «Nueva carpeta», fijos
 */
import type { PageTemplate, TemplateFolder, TemplateView } from '@crisol/contracts'
import { bySiblingPlace, placeAmong } from '@crisol/domain'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate } from '@tanstack/react-router'
import { ChevronRight, Plus, Search, Settings } from 'lucide-react'
import {
  type CSSProperties,
  type DragEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import type { ActionOutput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { ChangesBar } from '../components/changes.tsx'
import { ConfirmByName, DangerZone } from '../components/danger.tsx'
import dialogStyles from '../components/dialog.module.css'
import { Field, FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { Modal } from '../components/modal.tsx'
import { NewCard } from '../components/new-card.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Tour } from '../components/tour.tsx'
import { isInside, type Zone, zoneAt } from '../components/tree/moves.ts'
import { ENTER_ITEM, enterItem, itemTransition } from '../components/world-transition.ts'
import cards from '../routes/world-card.module.css'
import { ColorChoices } from '../routes/world-card.tsx'
import { plain } from '../wiki/file-tree.ts'
import files from '../wiki/files.module.css'
import { FolderGlyph } from '../wiki/folder-glyph.tsx'
import { IconChoices } from '../wiki/icon.tsx'
import { TemplateIcon } from './icons.tsx'
import { useTemplates } from './picker.tsx'
import styles from './screen.module.css'
import { treeOf } from './tree.ts'

type Listed = ActionOutput<'listTemplates'>
/** Algo de la lista: una plantilla o una carpeta */
type Item = { kind: 'template' | 'folder'; id: string }
type Beside = { before?: string; after?: string }
type RowFocus = Pick<HTMLAttributes<HTMLDivElement>, 'tabIndex' | 'onFocus' | 'onKeyDown'> & {
  ref: (element: HTMLDivElement | null) => void
}
type RowDrag = { attrs: HTMLAttributes<HTMLDivElement> & { 'data-drop'?: Zone | undefined }; className: string }
const NO_DRAG: RowDrag = { attrs: {}, className: '' }
/** Lo arrastrado, mantenido sobre una carpeta cerrada, la abre a este rato */
const EXPAND_AFTER = 650
/** Lo recién movido se ilumina este rato */
const LANDED_FOR = 1400

/** La lista con algo ya movido (para verlo en su sitio sin esperar al servidor), con los puestos como el servidor */
function movedIn(list: Listed, item: Item, to: { folderId: string | null } & Beside): Listed {
  type Entry = { id: string; name: string; position: string | null }
  const place = <T extends Entry>(
    entries: readonly T[],
    parentOf: (entry: T) => string | null,
    put: (entry: T, position: string | null) => T
  ) => {
    const anchor = to.before ?? to.after
    const siblings = entries
      .filter((entry) => parentOf(entry) === to.folderId && entry.id !== item.id)
      .sort(bySiblingPlace)
    const places =
      anchor === undefined
        ? new Map<string, string>()
        : new Map(
            placeAmong(siblings, item.id, to.before ? { before: to.before } : { after: anchor }).map(
              (p) => [p.id, p.position] as const
            )
          )
    return entries.map((entry) => {
      if (entry.id === item.id) return put(entry, places.get(item.id) ?? null)
      const position = places.get(entry.id)
      return position === undefined ? entry : { ...entry, position }
    })
  }
  return item.kind === 'template'
    ? {
        ...list,
        templates: place(
          list.templates,
          (each) => each.folderId,
          (each, position) => ({ ...each, folderId: to.folderId, position })
        )
      }
    : {
        ...list,
        folders: place(
          list.folders,
          (each) => each.parentId,
          (each, position) => ({ ...each, parentId: to.folderId, position })
        )
      }
}

export function TemplatesScreen() {
  const { t } = useTranslation()
  const { account, pending } = useAccounts().useAccount()
  const templates = useTemplates()
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  return (
    <section className={files.page}>
      {failed(templates) && <LoadError error={templates.error} onRetry={() => templates.refetch()} />}
      {templates.data ? <TemplatesTree data={templates.data} /> : <PageTitle>{t('templates.title')}</PageTitle>}
    </section>
  )
}

function TemplatesTree({ data }: { data: Listed }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const create = useNewTemplate()
  const keysHintId = useId()
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const [hovered, setHovered] = useState<Item | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  // Arrastrar: lo arrastrado, si ya se ve levantado, dónde caería y la carpeta cerrada que se abrirá sola
  const dragged = useRef<Item | null>(null)
  const [lifted, setLifted] = useState<Item | null>(null)
  const [drop, setDrop] = useState<{ id: string; zone: Zone } | null>(null)
  const armed = useRef<string | null>(null)
  const armTimer = useRef<number | undefined>(undefined)
  const [arming, setArming] = useState<string | null>(null)
  const [landed, setLanded] = useState<string | null>(null)
  const landedTimer = useRef<number | undefined>(undefined)
  // El teclado: una sola parada del tabulador (la fila con el foco) y, tras recolocar, el foco a la fila en su sitio
  const rowElements = useRef(new Map<string, HTMLDivElement>())
  const listRef = useRef<HTMLUListElement>(null)
  const [focusedRow, setFocusedRow] = useState<string | null>(null)
  const pendingFocus = useRef<(Item & { dest: string | null }) | null>(null)
  const latest = useRef(data)
  latest.current = data
  useEffect(
    () => () => {
      window.clearTimeout(armTimer.current)
      window.clearTimeout(landedTimer.current)
    },
    []
  )
  useEffect(() => {
    // Solo los botones de la fila con el foco entran en el tabulador; a los de las demás se llega con las flechas
    for (const row of listRef.current?.querySelectorAll<HTMLElement>('[data-file-card][tabindex]') ?? []) {
      const wanted = row.tabIndex === 0 ? 0 : -1
      for (const control of row.querySelectorAll<HTMLElement>('button, a[href]')) {
        if (control.tabIndex !== wanted) control.tabIndex = wanted
      }
    }
    const wanted = pendingFocus.current
    if (!wanted) return
    const now =
      wanted.kind === 'template'
        ? latest.current.templates.find((each) => each.id === wanted.id)?.folderId
        : latest.current.folders.find((each) => each.id === wanted.id)?.parentId
    const element = rowElements.current.get(wanted.id)
    if ((now ?? null) !== wanted.dest || !element) return
    pendingFocus.current = null
    element.focus()
  })
  const kids = useMemo(() => treeOf(data.folders, data.templates), [data])
  const byId = useMemo(() => new Map(data.folders.map((folder) => [folder.id, folder])), [data.folders])
  const templateById = useMemo(() => new Map(data.templates.map((each) => [each.id, each])), [data.templates])
  // Buscar por nombre (sin tildes ni mayúsculas): lo encontrado, dentro de sus carpetas, desplegadas
  const searching = query.trim() !== ''
  const found = useMemo(() => {
    if (!searching) return null
    const wanted = plain(query.trim())
    const hits = data.templates.filter((each) => plain(each.name).includes(wanted))
    const folderIds = new Set<string>()
    for (const hit of hits) {
      for (let id = hit.folderId; id; id = byId.get(id)?.parentId ?? null) folderIds.add(id)
    }
    return {
      hits,
      tree: treeOf(
        data.folders.filter((folder) => folderIds.has(folder.id)),
        hits
      )
    }
  }, [searching, query, data, byId])
  const tree = found?.tree ?? kids
  const isOpen = (id: string) => searching || expanded.has(id)
  const visible: Item[] = []
  const walk = (parentId: string | null) => {
    const entry = tree.get(parentId)
    for (const folder of entry?.folders ?? []) {
      visible.push({ kind: 'folder', id: folder.id })
      if (isOpen(folder.id)) walk(folder.id)
    }
    for (const each of entry?.templates ?? []) visible.push({ kind: 'template', id: each.id })
  }
  walk(null)
  const isShown = (id: string) => visible.some((item) => item.id === id)
  const tabStop = focusedRow && isShown(focusedRow) ? focusedRow : visible[0]?.id
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const expand = (id: string | null) => {
    if (id) setExpanded((current) => (current.has(id) ? current : new Set(current).add(id)))
  }
  const pathOf = (id: string | null): TemplateFolder[] => {
    const path: TemplateFolder[] = []
    for (let at = id ? byId.get(id) : undefined; at; at = at.parentId ? byId.get(at.parentId) : undefined) {
      path.unshift(at)
    }
    return path
  }
  // Cuánto tiene una carpeta (sin contar lo de las suyas)
  const countsOf = (id: string) => {
    const entry = kids.get(id)
    const parts = [
      entry?.folders.length ? t('files.folderFolders', { count: entry.folders.length }) : '',
      entry?.templates.length ? t('templates.folderTemplates', { count: entry.templates.length }) : ''
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : t('files.folderEmpty')
  }
  const parentOfItem = (item: Item) =>
    (item.kind === 'template' ? templateById.get(item.id)?.folderId : byId.get(item.id)?.parentId) ?? null
  const nameOf = (item: Item) =>
    (item.kind === 'template' ? templateById.get(item.id)?.name : byId.get(item.id)?.name) ?? ''
  const siblingIds = (kind: Item['kind'], dest: string | null) =>
    (kind === 'template' ? (kids.get(dest)?.templates ?? []) : (kids.get(dest)?.folders ?? [])).map((each) => each.id)
  // Delante o detrás de una fila de su tipo, ahí se recoloca; sobre una del otro tipo, solo dice a qué carpeta va
  const besideOf = (item: Item, row: Item, zone: Zone): Beside | undefined => {
    if (zone === 'inside' || row.id === item.id || row.kind !== item.kind) return undefined
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
  const canDropIn = (item: Item, dest: string | null, beside?: Beside) => {
    if (item.kind === 'folder' && dest !== null && isInside((id) => byId.get(id)?.parentId, dest, item.id)) return false
    return parentOfItem(item) !== dest || (beside !== undefined && !stays(item, dest, beside))
  }
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['templates'] })
  // Mover (y recolocar): se ve ya en su sitio; si falla, vuelve como estaba. Luego, la lista de verdad
  const move = useMutation({
    mutationFn: async ({
      item,
      to
    }: {
      item: Item
      to: { folderId: string | null } & Beside
      name: string
      into: string | null
      reorder: boolean
    }) => {
      const beside = to.before ? { before: to.before } : to.after ? { after: to.after } : {}
      if (item.kind === 'template') {
        await api.call('moveTemplate', { templateId: item.id, folderId: to.folderId, ...beside })
      } else await api.call('updateTemplateFolder', { folderId: item.id, parentId: to.folderId, ...beside })
    },
    onMutate: async ({ item, to }) => {
      setMoveError(null)
      await queryClient.cancelQueries({ queryKey: ['templates'] })
      const before = queryClient.getQueryData<Listed>(['templates'])
      if (before) queryClient.setQueryData<Listed>(['templates'], movedIn(before, item, to))
      return { before }
    },
    onSuccess: (_, { name, into, reorder }) =>
      announce(
        reorder
          ? t('files.reordered', { name })
          : into
            ? t('files.moved', { name, folder: into })
            : t('files.movedToTop', { name })
      ),
    onError: (error, _, context) => {
      if (context?.before) queryClient.setQueryData(['templates'], context.before)
      setMoveError(errorText(error))
    },
    onSettled: refresh
  })
  const moveTo = (item: Item, dest: string | null, beside?: Beside) => {
    expand(dest)
    window.clearTimeout(landedTimer.current)
    setLanded(item.id)
    landedTimer.current = window.setTimeout(() => setLanded(null), LANDED_FOR)
    move.mutate({
      item,
      to: { folderId: dest, ...beside },
      name: nameOf(item),
      into: dest ? (byId.get(dest)?.name ?? null) : null,
      reorder: parentOfItem(item) === dest
    })
  }
  // Desde su ventana («Carpeta»): como al soltarlo, con todo el camino abierto para verlo dentro
  const moveFromDialog = (item: Item) => (dest: string | null) => {
    setExpanded((current) => new Set([...current, ...pathOf(dest).map((folder) => folder.id)]))
    moveTo(item, dest)
  }
  const disarm = () => {
    window.clearTimeout(armTimer.current)
    if (armed.current === null) return
    armed.current = null
    setArming(null)
  }
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
  /** Lo de arrastrar de una fila: en el centro de una carpeta, dentro; arriba o abajo, en su carpeta, junto a ella */
  const dragOf = (row: Item & { parentId: string | null; name: string; open?: boolean }): RowDrag => {
    const landing = (event: DragEvent<HTMLElement>, item: Item) => {
      const box = event.currentTarget.getBoundingClientRect()
      const zone = zoneAt((event.clientY - box.top) / (box.height || 1), row.kind === 'folder')
      return { zone, dest: zone === 'inside' ? row.id : row.parentId, beside: besideOf(item, row, zone) }
    }
    const hover = (event: DragEvent<HTMLElement>) => {
      const item = dragged.current
      if (!item) return
      const { zone, dest, beside } = landing(event, item)
      if (!canDropIn(item, dest, beside)) {
        setDrop((current) => (current?.id === row.id ? null : current))
        if (armed.current === row.id) disarm()
        return
      }
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setDrop((current) => (current?.id === row.id && current.zone === zone ? current : { id: row.id, zone }))
      if (zone === 'inside' && row.kind === 'folder' && !row.open) arm(row.id)
      else if (armed.current === row.id) disarm()
    }
    return {
      className: [arming === row.id ? files.arming : '', landed === row.id ? files.received : '']
        .filter(Boolean)
        .join(' '),
      attrs: {
        draggable: true,
        'data-drop': drop?.id === row.id ? drop.zone : undefined,
        onDragStart: (event) => {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', row.name)
          dragged.current = { kind: row.kind, id: row.id }
          setHovered(null)
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
          const item = dragged.current
          if (!item) return
          const { dest, beside } = landing(event, item)
          if (!canDropIn(item, dest, beside)) return
          event.preventDefault()
          event.stopPropagation()
          endDrag()
          moveTo(item, dest, beside)
        }
      }
    }
  }
  // El teclado de la lista, como Archivos: flechas para recorrer, abrir y cerrar; Alt + flechas para recolocar (arriba
  // y abajo entre las de su tipo; derecha, dentro de la carpeta de encima; izquierda, fuera de la suya); Intro abre
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
      // La carpeta de encima, en su misma carpeta: para una carpeta, la anterior; para una plantilla, la última
      const there = kids.get(parent)?.folders ?? []
      const target = there[item.kind === 'folder' ? there.findIndex((f) => f.id === item.id) - 1 : there.length - 1]
      return target ? { dest: target.id } : null
    }
    if (key === 'ArrowLeft' && parent) {
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
      if (searching) return
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
      else toggle(folder.id)
    } else if (event.key === 'ArrowLeft') {
      const parent = parentOfItem(item)
      if (folder && isOpen(folder.id) && !searching) toggle(folder.id)
      else if (parent) rowElements.current.get(parent)?.focus()
    } else if (event.key === 'Enter') {
      if (folder) toggle(folder.id)
      else event.currentTarget.querySelector<HTMLElement>('[data-row-open]')?.click()
    } else return
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
  const preview = (item: Item) => (shown: boolean) => {
    if (dragged.current) return
    setHovered((current) => (shown ? item : current?.id === item.id ? null : current))
  }
  const itemClass = (id: string) => (lifted?.id === id ? `${files.item} ${files.lifted}` : files.item)
  const level = (parentId: string | null, depth: number): ReactNode[] => {
    const entry = tree.get(parentId)
    return [
      ...(entry?.folders ?? []).map((folder) => {
        const open = isOpen(folder.id)
        const item: Item = { kind: 'folder', id: folder.id }
        return (
          <li key={folder.id} className={itemClass(folder.id)}>
            <FolderRow
              folder={folder}
              depth={depth}
              open={open}
              counts={countsOf(folder.id)}
              folders={data.folders}
              drag={searching ? NO_DRAG : dragOf({ ...item, parentId: folder.parentId, name: folder.name, open })}
              focus={focusOf(item)}
              onToggle={() => toggle(folder.id)}
              onPreview={preview(item)}
              onMove={moveFromDialog(item)}
            />
            {open && <ul className={files.kids}>{level(folder.id, depth + 1)}</ul>}
          </li>
        )
      }),
      ...(entry?.templates ?? []).map((each) => {
        const item: Item = { kind: 'template', id: each.id }
        return (
          <li key={each.id} className={itemClass(each.id)}>
            <TemplateRow
              template={each}
              depth={depth}
              where={searching ? pathOf(each.folderId) : []}
              folders={data.folders}
              drag={searching ? NO_DRAG : dragOf({ ...item, parentId: each.folderId, name: each.name })}
              focus={focusOf(item)}
              onPreview={preview(item)}
              onMove={moveFromDialog(item)}
            />
          </li>
        )
      })
    ]
  }
  const hoveredTemplate = hovered?.kind === 'template' && isShown(hovered.id) ? templateById.get(hovered.id) : undefined
  const hoveredFolder = hovered?.kind === 'folder' && isShown(hovered.id) ? byId.get(hovered.id) : undefined
  const nothing = data.templates.length === 0 && data.folders.length === 0
  return (
    <div className={files.layout}>
      <div className={files.center}>
        <PageTitle>{t('templates.title')}</PageTitle>
        <div className={files.toolbar}>
          <div className={files.tools}>
            <button
              type="button"
              className={`${form.button} ${files.uploadButton}`}
              data-tour="plantillas-nueva"
              disabled={create.isPending}
              onClick={() => create.mutate()}
            >
              <Plus aria-hidden="true" size={16} />
              <span className={files.uploadLabel}>{t('templates.new')}</span>
            </button>
            <label className={files.search}>
              <Search aria-hidden="true" size={16} />
              <input
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
                type="search"
                value={query}
                placeholder={t('templates.search')}
                aria-label={t('templates.search')}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
            </label>
          </div>
        </div>
        <div className={files.contents}>
          <FormError message={create.errorText ?? moveError} />
          {searching && found?.hits.length === 0 && <p className={files.empty}>{t('templates.noneFound')}</p>}
          {!searching && nothing && <p className={files.empty}>{t('templates.empty')}</p>}
          <ul ref={listRef} className={files.rows} aria-label={t('templates.listLabel')} aria-describedby={keysHintId}>
            {level(null, 0)}
            {/* «Nueva carpeta», una fila más tras la última */}
            {!searching && (
              <li className={files.newItem}>
                <NewTemplateFolder label={t('templates.newFolder')} onCreated={refresh} />
              </li>
            )}
          </ul>
          <p id={keysHintId} className={files.hidden}>
            {t('templates.keysHint')}
          </p>
        </div>
      </div>
      <aside className={files.detail} aria-label={t('templates.preview')}>
        {hoveredTemplate ? (
          <TemplatePreview template={hoveredTemplate} where={pathOf(hoveredTemplate.folderId)} />
        ) : hoveredFolder ? (
          <FolderPreview folder={hoveredFolder} count={countsOf(hoveredFolder.id)} />
        ) : null}
      </aside>
      <Tour id="plantillas" steps={[{ target: '[data-tour="plantillas-nueva"]', text: t('tour.templates.create') }]} />
    </div>
  )
}

/** La miniatura de una plantilla: su portada (con su encuadre) y, encima, su icono */
function TemplateThumb({ template, size }: { template: TemplateView; size: number }) {
  const cover = template.cover
  return (
    <span
      className={styles.thumb}
      data-cover={cover ? '' : undefined}
      style={
        cover
          ? ({
              backgroundImage: `url(/api/files/${cover.fileId})`,
              backgroundPosition: `${cover.x}% ${cover.y}%`
            } as CSSProperties)
          : undefined
      }
    >
      <TemplateIcon icon={template.icon} size={size} />
    </span>
  )
}

/** Sus pestañas en una línea: «Texto» (su texto, siempre) y las añadidas */
function useTabsLine() {
  const { t } = useTranslation()
  return (template: TemplateView) => [t('pageTabs.text'), ...template.tabs.map((tab) => tab.name)].join(', ')
}

/** Una plantilla en su fila: su miniatura, su nombre (la abre), sus pestañas, en cuántas páginas se usa y su engranaje */
function TemplateRow({
  template,
  depth,
  where,
  folders,
  drag,
  focus,
  onPreview,
  onMove
}: {
  template: TemplateView
  depth: number
  /** Al buscar, en qué carpetas está */
  where: TemplateFolder[]
  folders: TemplateFolder[]
  drag: RowDrag
  focus: RowFocus
  onPreview: (shown: boolean) => void
  onMove: (dest: string | null) => void
}) {
  const { t } = useTranslation()
  const tabsLine = useTabsLine()
  const [settings, setSettings] = useState(false)
  const gear = useRef<HTMLButtonElement>(null)
  return (
    <div
      {...drag.attrs}
      {...focus}
      className={[files.row, files.treeRow, drag.className].filter(Boolean).join(' ')}
      style={{ '--depth': depth } as CSSProperties}
      data-file-card={template.id}
      onPointerEnter={() => onPreview(true)}
      onPointerLeave={() => onPreview(false)}
      onClickCapture={(event) => {
        if ((event.target as Element).closest('[aria-haspopup="dialog"]')) onPreview(false)
      }}
    >
      <span className={files.chevron} aria-hidden="true" />
      {/* Entrar es entrar: su icono y su nombre viajan al título de la plantilla abierta (y vuelven al salir) */}
      <span
        className={files.rowThumb}
        aria-hidden="true"
        data-elemento="icono"
        style={itemTransition(template.id, 'icono')}
      >
        <TemplateThumb template={template} size={18} />
      </span>
      <span className={files.rowText}>
        <Link
          to="/plantillas/$templateId"
          params={{ templateId: template.id }}
          className={`${files.rowName} ${files.open}`}
          data-row-open=""
          draggable={false}
          viewTransition={ENTER_ITEM}
          onClick={(event) => enterItem(template.id, event.currentTarget.closest('[data-file-card]'))}
        >
          <span data-elemento="nombre" style={itemTransition(template.id, 'nombre')}>
            {template.name}
          </span>
        </Link>
        <span className={files.where}>
          {where.length > 0 ? where.map((folder) => folder.name).join(' › ') : tabsLine(template)}
        </span>
      </span>
      <span className={files.rowMeta}>
        {template.uses > 0 ? t('templates.uses', { count: template.uses }) : t('templates.unused')}
      </span>
      <button
        ref={gear}
        type="button"
        className={files.smallGear}
        data-settings=""
        aria-label={t('templates.settingsOf', { name: template.name })}
        title={t('templates.settingsOf', { name: template.name })}
        aria-haspopup="dialog"
        onClick={() => setSettings(true)}
      >
        <Settings aria-hidden="true" size={14} />
      </button>
      {settings && (
        <TemplateSettings
          template={template}
          folder={{ folders, value: template.folderId, onMove }}
          onClose={(gone) => {
            setSettings(false)
            if (!gone) gear.current?.focus()
          }}
        />
      )}
    </div>
  )
}

/** Una carpeta en su fila: su flecha, su icono, su nombre (la despliega), cuánto tiene y su engranaje */
function FolderRow({
  folder,
  depth,
  open,
  counts,
  folders,
  drag,
  focus,
  onToggle,
  onPreview,
  onMove
}: {
  folder: TemplateFolder
  depth: number
  open: boolean
  counts: string
  folders: TemplateFolder[]
  drag: RowDrag
  focus: RowFocus
  onToggle: () => void
  onPreview: (shown: boolean) => void
  onMove: (dest: string | null) => void
}) {
  const { t } = useTranslation()
  const [settings, setSettings] = useState(false)
  const gear = useRef<HTMLButtonElement>(null)
  return (
    <div
      {...drag.attrs}
      {...focus}
      className={[files.row, files.treeRow, drag.className].filter(Boolean).join(' ')}
      style={{ '--depth': depth } as CSSProperties}
      data-file-card={folder.id}
      onPointerEnter={() => onPreview(true)}
      onPointerLeave={() => onPreview(false)}
      onClickCapture={(event) => {
        if ((event.target as Element).closest('[aria-haspopup="dialog"]')) onPreview(false)
      }}
    >
      <span className={files.chevron} data-open={open} aria-hidden="true">
        <ChevronRight size={16} />
      </span>
      <span className={`${files.rowThumb} ${files.folderThumb}`}>
        <FolderGlyph folder={folder} open={open} />
      </span>
      <span className={files.rowText}>
        <button
          type="button"
          className={`${files.rowName} ${files.open}`}
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
      <span className={files.rowMeta}>{counts}</span>
      <button
        ref={gear}
        type="button"
        className={files.smallGear}
        data-settings=""
        aria-label={t('templates.settingsOf', { name: folder.name })}
        title={t('templates.settingsOf', { name: folder.name })}
        aria-haspopup="dialog"
        onClick={() => setSettings(true)}
      >
        <Settings aria-hidden="true" size={14} />
      </button>
      {settings && (
        <TemplateFolderDialog
          folder={folder}
          folders={folders}
          onMove={onMove}
          onClose={(gone) => {
            setSettings(false)
            if (!gone) gear.current?.focus()
          }}
        />
      )}
    </div>
  )
}

/** La plantilla bajo el ratón (o con el foco), a la izquierda: su portada, su icono, sus campos, sus pestañas y sus usos */
function TemplatePreview({ template, where }: { template: TemplateView; where: TemplateFolder[] }) {
  const { t } = useTranslation()
  const tabsLine = useTabsLine()
  return (
    <div className={files.detailBody}>
      <div className={`${files.preview} ${styles.previewCover}`}>
        <TemplateThumb template={template} size={44} />
      </div>
      <h2 className={files.detailName}>{template.name}</h2>
      <dl className={files.facts}>
        <dt>{t('templates.fields')}</dt>
        <dd>
          {template.fields.length > 0 ? template.fields.map((field) => field.name).join(', ') : t('templates.none')}
        </dd>
        <dt>{t('templates.tabs')}</dt>
        <dd>{tabsLine(template)}</dd>
        <dt>{t('templates.usesLabel')}</dt>
        <dd>{template.uses > 0 ? t('templates.uses', { count: template.uses }) : t('templates.unused')}</dd>
        {where.length > 0 && (
          <>
            <dt>{t('files.folder')}</dt>
            <dd>{where.map((folder) => folder.name).join(' › ')}</dd>
          </>
        )}
      </dl>
    </div>
  )
}

function FolderPreview({ folder, count }: { folder: TemplateFolder; count: string }) {
  const { t } = useTranslation()
  return (
    <div className={files.detailBody}>
      <div className={`${files.preview} ${files.folderPreview}`}>
        <FolderGlyph folder={folder} open size={56} strokeWidth={1.25} />
      </div>
      <h2 className={files.detailName}>{folder.name}</h2>
      <dl className={files.facts}>
        <dt>{t('templates.inside')}</dt>
        <dd>{count}</dd>
      </dl>
    </div>
  )
}

/** «Carpeta»: en cuál está una plantilla o una carpeta (con su camino) o en ninguna */
function FolderField({
  folders,
  moving,
  value,
  onChange
}: {
  folders: TemplateFolder[]
  /** La carpeta que se mueve: ella y las suyas no salen */
  moving?: string
  value: string | null
  onChange: (folderId: string | null) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const tree = treeOf(folders, [])
  const choices: { id: string; label: string }[] = []
  const walk = (parentId: string | null, path: string[]) => {
    for (const folder of tree.get(parentId)?.folders ?? []) {
      if (folder.id === moving) continue
      const next = [...path, folder.name]
      choices.push({ id: folder.id, label: next.join(' › ') })
      walk(folder.id, next)
    }
  }
  walk(null, [])
  return (
    <div className={form.field}>
      <label htmlFor={id}>{t('files.folder')}</label>
      <select id={id} value={value ?? ''} onChange={(event) => onChange(event.currentTarget.value || null)}>
        <option value="">{t('files.noFolder')}</option>
        {choices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/** «Nueva carpeta»: una fila más al final de la lista, y su cuadro con el nombre */
function NewTemplateFolder({ label, onCreated }: { label: string; onCreated: () => Promise<unknown> }) {
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
      await api.call('createTemplateFolder', { parentId: null, name: name.trim() })
      await onCreated()
    },
    onSuccess: () => dialog.current?.close()
  })
  return (
    <>
      <NewCard
        ref={trigger}
        shape="row"
        label={label}
        className={files.newFolder}
        aria-haspopup="dialog"
        onClick={() => {
          setName('')
          create.reset()
          setOpen(true)
        }}
      />
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
              label={t('templates.name')}
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
                {t('templates.createFolder')}
              </BusyButton>
              <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
                {t('templates.cancel')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

/** La ventana de una carpeta: su nombre, en qué carpeta está, su icono y su color, y borrarla con lo que tiene */
function TemplateFolderDialog({
  folder,
  folders,
  onMove,
  onClose
}: {
  folder: TemplateFolder
  folders: TemplateFolder[]
  onMove: (dest: string | null) => void
  onClose: (gone: boolean) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const gone = useRef(false)
  const [name, setName] = useState(folder.name)
  const [color, setColor] = useState(folder.color)
  const [icon, setIcon] = useState(folder.icon)
  const [parent, setParent] = useState(folder.parentId)
  const renamed = name.trim() !== folder.name
  const restyled = color !== folder.color || icon !== folder.icon
  const moved = parent !== folder.parentId
  const changed = renamed || restyled || moved
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['templates'] })
  const save = useMutation({
    mutationFn: async () => {
      if (renamed || restyled) {
        await api.call('updateTemplateFolder', {
          folderId: folder.id,
          ...(renamed ? { name: name.trim() } : {}),
          ...(color !== folder.color ? { color } : {}),
          ...(icon !== folder.icon ? { icon } : {})
        })
        await refresh()
      }
    },
    onSuccess: () => {
      if (!moved) return
      dialog.current?.close()
      onMove(parent)
    }
  })
  const remove = async () => {
    await api.call('deleteTemplateFolder', { folderId: folder.id })
    gone.current = true
    dialog.current?.close()
    await refresh()
  }
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={cards.dialog} onClose={() => onClose(gone.current)}>
      <div className={`${files.preview} ${files.iconPreview}`}>
        <FolderGlyph folder={{ color, icon }} size={44} strokeWidth={1.25} />
      </div>
      <form
        className={cards.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (changed) save.mutate()
        }}
      >
        <h2 id={titleId}>{t('templates.settingsOf', { name: folder.name })}</h2>
        <Field
          label={t('templates.name')}
          value={name}
          required
          maxLength={120}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <FolderField folders={folders} moving={folder.id} value={parent} onChange={setParent} />
        <IconChoices value={icon} onChange={setIcon} />
        <ColorChoices value={color} onChange={setColor} />
        <FormError message={save.error ? errorText(save.error) : null} />
        <ChangesBar shown={changed}>
          <BusyButton type="submit" className={form.button} busy={save.isPending}>
            {t('templates.save')}
          </BusyButton>
          <button
            type="button"
            className={dialogStyles.cancel}
            onClick={() => {
              setName(folder.name)
              setColor(folder.color)
              setIcon(folder.icon)
              setParent(folder.parentId)
            }}
          >
            {t('templates.cancel')}
          </button>
        </ChangesBar>
      </form>
      <div className={cards.dangerArea}>
        <DangerZone>
          <ConfirmByName
            name={folder.name}
            action={t('templates.deleteFolder')}
            title={t('templates.deleteFolderTitle', { name: folder.name })}
            warning={t('templates.deleteFolderWarning')}
            label={t('templates.name')}
            typed={false}
            onConfirm={remove}
          />
        </DangerZone>
      </div>
    </Modal>
  )
}

/** Para comparar nombres como el servidor: sin mayúsculas, tildes ni espacios de más */
const nameKey = (name: string) =>
  name.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim()

/**
 * «Plantilla nueva»: crea «Plantilla sin título» (con un número si ya hay una así) y la abre con el título listo para
 * escribir, como una página nueva
 */
export function useNewTemplate() {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const templates = useTemplates().data?.templates ?? []
  const create = useMutation({
    mutationFn: () => {
      const base = t('templates.untitled')
      const taken = new Set(templates.map((each) => nameKey(each.name)))
      let name = base
      for (let n = 2; taken.has(nameKey(name)); n++) name = `${base} ${n}`
      return api.call('createTemplate', { name })
    },
    onSuccess: async (created) => {
      // Ya en la lista, para que su página la encuentre al abrirse (la lista de verdad llega después)
      queryClient.setQueryData<Listed>(['templates'], (old) =>
        old ? { ...old, templates: [...old.templates.filter((each) => each.id !== created.id), created] } : old
      )
      void queryClient.invalidateQueries({ queryKey: ['templates'] })
      await navigate({ to: '/plantillas/$templateId', params: { templateId: created.id }, search: { nuevo: true } })
    }
  })
  return {
    mutate: () => create.mutate(),
    isPending: create.isPending,
    errorText: create.error ? errorText(create.error) : null
  }
}

/**
 * La ventana de una plantilla: su nombre, su icono, en qué carpeta está (folder: desde la lista) y borrarla.
 * onClose(gone): si se borró
 */
export function TemplateSettings({
  template,
  folder,
  onClose
}: {
  template: PageTemplate
  folder?: { folders: TemplateFolder[]; value: string | null; onMove: (dest: string | null) => void }
  onClose: (gone: boolean) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const gone = useRef(false)
  const [name, setName] = useState(template.name)
  const [icon, setIcon] = useState(template.icon)
  const [parent, setParent] = useState(folder?.value ?? null)
  const restyled = name.trim() !== template.name || icon !== template.icon
  const moved = folder !== undefined && parent !== folder.value
  const changed = restyled || moved
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['templates'] })
  const save = useMutation({
    mutationFn: async () => {
      if (restyled) {
        await api.call('updateTemplate', {
          templateId: template.id,
          ...(name.trim() !== template.name ? { name: name.trim() } : {}),
          ...(icon !== template.icon ? { icon } : {})
        })
        await refresh()
      }
    },
    onSuccess: () => {
      dialog.current?.close()
      // A otra carpeta: se ve ya en su sitio
      if (moved) folder?.onMove(parent)
    }
  })
  const remove = async () => {
    await api.call('deleteTemplate', { templateId: template.id })
    gone.current = true
    dialog.current?.close()
    await refresh()
  }
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={cards.dialog} onClose={() => onClose(gone.current)}>
      <form
        className={cards.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (changed && name.trim()) save.mutate()
        }}
      >
        <h2 id={titleId}>{t('templates.settingsOf', { name: template.name })}</h2>
        <Field
          label={t('templates.name')}
          value={name}
          required
          maxLength={60}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          onChange={(event) => setName(event.currentTarget.value)}
        />
        {folder && <FolderField folders={folder.folders} value={parent} onChange={setParent} />}
        <IconChoices value={icon} onChange={setIcon} />
        <FormError message={save.error ? errorText(save.error) : null} />
        <ChangesBar shown={changed}>
          <BusyButton type="submit" className={form.button} busy={save.isPending}>
            {t('templates.save')}
          </BusyButton>
          <button
            type="button"
            className={dialogStyles.cancel}
            onClick={() => {
              setName(template.name)
              setIcon(template.icon)
              setParent(folder?.value ?? null)
            }}
          >
            {t('templates.cancel')}
          </button>
        </ChangesBar>
      </form>
      <div className={cards.dangerArea}>
        <DangerZone>
          <ConfirmByName
            name={template.name}
            action={t('templates.delete')}
            title={t('templates.deleteTitle', { name: template.name })}
            warning={t('templates.deleteWarning')}
            label={t('templates.name')}
            onConfirm={remove}
          />
        </DangerZone>
      </div>
    </Modal>
  )
}
