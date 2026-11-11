import type { PageSummary } from '@crisol/contracts'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useVirtualizer } from '@tanstack/react-virtual'
import { BookCopy, Eye, FileText, House } from 'lucide-react'
import { type CSSProperties, type DragEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import {
  dropMove as dropMoveIn,
  keyboardMove as keyboardMoveIn,
  type Move,
  outdentTarget as outdentTargetIn,
  type Zone,
  zoneAt
} from '../components/tree/moves.ts'
import { TemplateIcon } from '../templates/icons.tsx'
import { useTemplates } from '../templates/picker.tsx'
import styles from './tree.module.css'
import { TreeMenu } from './tree-menu.tsx'

/** A partir de cuántas filas visibles solo se pintan las que se ven */
const VIRTUAL_FROM = 300
const ROW_HEIGHT = 34
/** Cuánto hay que llevar a la izquierda lo que se arrastra para sacarlo un nivel */
const OUTDENT_STEP = 24

/** Las subpáginas de una página (o el primer nivel): la misma consulta que la lista de subpáginas de la página */
export const childrenKey = (worldId: string, parentId: string | null) => [
  'pages',
  worldId,
  'children',
  parentId ?? 'raiz'
]

interface Row {
  page: PageSummary
  level: number
  posinset: number
  setsize: number
  expanded: boolean
}

/** Cómo se recoloca una página: lo que se pide a movePage */

interface Props {
  worldId: string
  /** La página abierta: va marcada y sus antepasados, desplegados */
  currentId?: string | undefined
  /** De la primera a la abierta */
  path?: readonly { id: string }[] | undefined
  onNavigate?: () => void
}

/**
 * El árbol de la wiki (patrón ARIA de árbol de navegación): una sola parada del tabulador, flechas para moverse,
 * desplegar y plegar, y Alt + flechas para recolocar. También se arrastra. Cada rama se pide al desplegarla
 */
export function PageTree({ worldId, currentId, path, onNavigate }: Props) {
  const { t } = useTranslation()
  const hintId = useId()
  const api = useApi()
  const queryClient = useQueryClient()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const [focusedId, setFocusedId] = useState<string | null>(null)
  // Dónde caería lo que se arrastra; con level, detrás de la de ese nivel (llevándolo a la izquierda)
  const [drop, setDrop] = useState<{ id: string; zone: Zone; level?: number } | null>(null)
  const dragged = useRef<string | null>(null)
  const dragStartX = useRef(0)
  const [menu, setMenu] = useState<{ page: PageSummary; x: number; y: number } | null>(null)
  const items = useRef(new Map<string, HTMLAnchorElement>())
  const pendingFocus = useRef(false)
  const scroller = useRef<HTMLDivElement>(null)

  // Al abrir una página, sus antepasados se despliegan
  const ancestors = (path ?? []).slice(0, -1).map((p) => p.id)
  const ancestorsKey = ancestors.join('/')
  useEffect(() => {
    if (!ancestorsKey) return
    setExpanded((current) => new Set([...current, ...ancestorsKey.split('/')]))
  }, [ancestorsKey])

  const parents = [null, ...expanded]
  const lists = useQueries({
    queries: parents.map((parentId) => ({
      queryKey: childrenKey(worldId, parentId),
      queryFn: () => api.call('listPageChildren', { worldId, parentId }),
      // Recién puestas (al mover, sin esperar al servidor), no se vuelven a pedir al desplegar: llegarían sin lo movido.
      // Lo que cambia en el servidor las invalida igual
      staleTime: 2_000
    }))
  })
  // La portada del mundo (como la «Home» de Everlore): la primera de lo más alto, con su casa, y no se arrastra
  const homeId = useQuery({
    queryKey: ['pages', worldId, 'home'],
    queryFn: () => api.call('getWorldHome', { worldId })
  }).data?.pageId
  // Las que conoce alguna campaña (ADR-0017): un ojo gris al lado, para quien lleva la wiki
  const known = new Set(
    useQuery({
      queryKey: ['pages', worldId, 'known'],
      queryFn: () => api.call('listKnownPages', { worldId })
    }).data?.pageIds ?? []
  )
  const childrenOf = new Map(
    parents.map((parentId, i) => {
      const pages = lists[i]?.data?.pages
      const home = parentId === null ? pages?.find((page) => page.id === homeId) : undefined
      return [parentId, home && pages ? [home, ...pages.filter((page) => page !== home)] : pages]
    })
  )
  const root = lists[0]

  // Las filas visibles, en orden de lectura: cada página seguida de sus subpáginas si está desplegada
  const rows: Row[] = []
  const visit = (parentId: string | null, level: number) => {
    const list = childrenOf.get(parentId) ?? []
    list.forEach((page, index) => {
      const open = page.hasChildren && expanded.has(page.id)
      rows.push({ page, level, posinset: index + 1, setsize: list.length, expanded: open })
      if (open) visit(page.id, level + 1)
    })
  }
  visit(null, 1)

  const indexOf = (id: string) => rows.findIndex((row) => row.page.id === id)
  const tabStop = focusedId && indexOf(focusedId) >= 0 ? focusedId : (currentId ?? rows[0]?.page.id)

  const virtual = rows.length > VIRTUAL_FROM
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
    enabled: virtual
  })

  // El foco va a la fila cuando ya está pintada (al pasar a una que estaba fuera de la vista, tras desplazarse)
  useEffect(() => {
    if (!pendingFocus.current || !focusedId) return
    const element = items.current.get(focusedId)
    if (element) {
      pendingFocus.current = false
      element.focus()
    }
  })

  const focusRow = (index: number) => {
    const row = rows[Math.max(0, Math.min(rows.length - 1, index))]
    if (!row) return
    pendingFocus.current = true
    if (virtual) virtualizer.scrollToIndex(indexOf(row.page.id))
    setFocusedId(row.page.id)
  }
  const setOpen = (id: string, open: boolean) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (open) next.add(id)
      else next.delete(id)
      return next
    })

  const siblingsOf = (page: PageSummary) => childrenOf.get(page.parentId) ?? []
  const titleOf = (id: string | null) => rows.find((row) => row.page.id === id)?.page.title
  type Children = { pages: PageSummary[] }
  /** Lo movido se ve ya en su sitio, sin esperar al servidor (si falla, se vuelve a pedir el árbol tal cual está) */
  const moveInCache = (page: PageSummary, to: Move) => {
    void queryClient.cancelQueries({ queryKey: ['pages', worldId, 'children'] })
    const moved = { ...page, parentId: to.parentId }
    let emptied = false
    queryClient.setQueryData<Children>(childrenKey(worldId, page.parentId), (data) => {
      if (!data) return data
      const pages = data.pages.filter((p) => p.id !== page.id)
      emptied = pages.length === 0
      return { ...data, pages }
    })
    // A una madre cuyas subpáginas aún no se tenían: ya, con ella sola (las demás llegan al confirmar el servidor)
    queryClient.setQueryData<Children>(childrenKey(worldId, to.parentId), (data) => {
      if (!data) return { pages: [moved] }
      const pages = data.pages.filter((p) => p.id !== page.id)
      const anchor = to.before ?? to.after
      let at = anchor ? pages.findIndex((p) => p.id === anchor) : -1
      if (at < 0) at = pages.length
      else if (to.after) at += 1
      pages.splice(at, 0, moved)
      return { ...data, pages }
    })
    // La madre nueva ya tiene dentro; la de antes, quizá ya no
    queryClient.setQueriesData<Children>({ queryKey: ['pages', worldId, 'children'] }, (data) => {
      if (!data) return data
      let changed = false
      const pages = data.pages.map((p) => {
        const has = p.id === to.parentId ? true : p.id === page.parentId && emptied ? false : p.hasChildren
        if (has === p.hasChildren) return p
        changed = true
        return { ...p, hasChildren: has }
      })
      return changed ? { ...data, pages } : data
    })
  }
  const move = async (page: PageSummary, to: Move) => {
    moveInCache(page, to)
    // La madre nueva se despliega ya, con lo movido dentro (sin esperar al servidor)
    if (to.parentId) setOpen(to.parentId, true)
    pendingFocus.current = true
    setFocusedId(page.id)
    try {
      await api.call('movePage', { pageId: page.id, ...to })
      const parent = titleOf(to.parentId)
      announce(
        parent ? t('wiki.movedInto', { title: page.title, parent }) : t('wiki.movedToTop', { title: page.title })
      )
    } catch (error) {
      announce(errorText(error))
    } finally {
      void queryClient.invalidateQueries({ queryKey: ['pages', worldId] })
    }
  }

  // Alt + flechas: arriba y abajo entre hermanas; derecha, dentro de la de encima; izquierda, detrás de su madre
  const keyboardMove = (row: Row, key: string): Move | null =>
    keyboardMoveIn(row.page, siblingsOf(row.page), (id) => rows.find((r) => r.page.id === id)?.page, key)

  const onKeyDown = (row: Row, event: KeyboardEvent<HTMLAnchorElement>) => {
    const index = indexOf(row.page.id)
    if (event.altKey && event.key.startsWith('Arrow')) {
      event.preventDefault()
      const to = keyboardMove(row, event.key)
      if (to) void move(row.page, to)
      return
    }
    switch (event.key) {
      case 'ArrowDown':
        focusRow(index + 1)
        break
      case 'ArrowUp':
        focusRow(index - 1)
        break
      case 'ArrowRight':
        if (row.page.hasChildren && !row.expanded) setOpen(row.page.id, true)
        else if (row.expanded) focusRow(index + 1)
        break
      case 'ArrowLeft':
        if (row.expanded) setOpen(row.page.id, false)
        else if (row.page.parentId) focusRow(indexOf(row.page.parentId))
        break
      case 'Home':
        focusRow(0)
        break
      case 'End':
        focusRow(rows.length - 1)
        break
      default:
        return
    }
    event.preventDefault()
  }

  // Arrastrar (components/tree/moves.ts): el cuarto de arriba de una fila, delante; el de abajo, detrás; el resto, dentro
  const zoneOf = (event: DragEvent<HTMLElement>): Zone => {
    const box = event.currentTarget.getBoundingClientRect()
    return zoneAt((event.clientY - box.top) / (box.height || 1))
  }
  const rowOf = (id: string) => rows.find((r) => r.page.id === id)
  const parentOf = (id: string) => rowOf(id)?.page.parentId
  /** Llevarlo a la izquierda lo saca de su madre: la fila del nivel al que va, o null si no se lleva a la izquierda */
  const outdentTarget = (row: Row, zone: Zone, clientX: number): Row | null =>
    outdentTargetIn(
      row,
      (r) => r.page,
      rowOf,
      zone,
      Math.floor((dragStartX.current - clientX) / OUTDENT_STEP),
      dragged.current
    )
  /** Adónde iría al soltar, o null si no se puede (dentro de sí misma) */
  const dropMove = (page: PageSummary, row: Row, zone: Zone, clientX: number): Move | null =>
    dropMoveIn(page, row.page, zone, parentOf, outdentTarget(row, zone, clientX)?.page ?? null)

  const onDrop = (row: Row, zone: Zone, clientX: number) => {
    const page = rows.find((r) => r.page.id === dragged.current)?.page
    const to = page ? dropMove(page, row, zone, clientX) : null
    dragged.current = null
    setDrop(null)
    if (page && to) void move(page, to)
  }

  const renderRow = (row: Row, style?: CSSProperties) => {
    const { page } = row
    return (
      <Link
        key={page.id}
        ref={(element: HTMLAnchorElement | null) => {
          if (element) items.current.set(page.id, element)
          else items.current.delete(page.id)
        }}
        role="treeitem"
        to="/mundos/$worldId/wiki/$pageId"
        params={{ worldId, pageId: page.id }}
        className={styles.item}
        style={
          {
            ...style,
            paddingInlineStart: `${(row.level - 1) * 0.875}rem`,
            ...(drop?.id === page.id && drop.level ? { '--drop-indent': `${(drop.level - 1) * 0.875}rem` } : {})
          } as CSSProperties
        }
        data-drop={drop?.id === page.id ? drop.zone : undefined}
        data-outdent={drop?.id === page.id && drop.level ? '' : undefined}
        aria-level={row.level}
        aria-setsize={row.setsize}
        aria-posinset={row.posinset}
        aria-expanded={page.hasChildren ? row.expanded : undefined}
        aria-current={page.id === currentId ? 'page' : undefined}
        tabIndex={page.id === tabStop ? 0 : -1}
        onFocus={() => setFocusedId(page.id)}
        // Al pasar por encima, la página se pide ya: al pulsar, sale sin esperar
        onMouseEnter={() => {
          void queryClient.prefetchQuery({
            queryKey: ['pages', worldId, 'page', page.id],
            queryFn: () => api.call('getPage', { pageId: page.id }),
            staleTime: 10_000
          })
        }}
        onKeyDown={(event) => {
          // La tecla de menú (o Mayús+F10): el menú de la página, junto a la fila
          if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
            event.preventDefault()
            const box = event.currentTarget.getBoundingClientRect()
            setMenu({ page, x: box.left + 24, y: box.bottom })
            return
          }
          onKeyDown(row, event)
        }}
        // Con el botón derecho, el menú de la página (como en Everlore)
        onContextMenu={(event) => {
          event.preventDefault()
          setMenu({ page, x: event.clientX, y: event.clientY })
        }}
        onClick={(event) => {
          // La flecha despliega o pliega (con el teclado, las flechas del teclado); el resto de la fila abre la página
          if (event.target instanceof Element && event.target.closest('[data-toggle]')) {
            event.preventDefault()
            setOpen(page.id, !row.expanded)
          } else onNavigate?.()
        }}
        draggable={page.id !== homeId}
        onDragStart={(event) => {
          dragged.current = page.id
          dragStartX.current = event.clientX
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', page.title)
        }}
        onDragEnd={() => {
          dragged.current = null
          setDrop(null)
        }}
        onDragOver={(event) => {
          const moving = rows.find((r) => r.page.id === dragged.current)?.page
          if (!moving) return
          const zone = zoneOf(event)
          // Dentro de sí misma no se puede soltar: ni marca ni preventDefault (el navegador lo muestra prohibido)
          if (!dropMove(moving, row, zone, event.clientX)) {
            if (drop) setDrop(null)
            return
          }
          event.preventDefault()
          const out = outdentTarget(row, zone, event.clientX)
          if (out) {
            if (drop?.id !== page.id || drop.zone !== 'after' || drop.level !== out.level)
              setDrop({ id: page.id, zone: 'after', level: out.level })
          } else if (page.id === dragged.current) {
            if (drop) setDrop(null)
          } else if (drop?.id !== page.id || drop.zone !== zone || drop.level) setDrop({ id: page.id, zone })
        }}
        onDragLeave={() => setDrop(null)}
        onDrop={(event) => {
          event.preventDefault()
          onDrop(row, zoneOf(event), event.clientX)
        }}
      >
        {/* Solo un dibujo para el lector de pantalla: lo que dice es aria-expanded */}
        <span aria-hidden="true" className={styles.toggle} data-toggle={page.hasChildren || undefined}>
          {page.hasChildren && (
            <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.chevron} data-open={row.expanded}>
              <path d="M9 6l6 6-6 6" />
            </svg>
          )}
        </span>
        {/* Su icono, si tiene; si no, el de su plantilla, o el de página (las que tienen dentro, el de varias) */}
        <span aria-hidden="true" className={styles.icon}>
          {page.icon ?? <PageKindIcon template={page.template ?? null} hasChildren={page.hasChildren} />}
        </span>
        <span className={styles.title} data-untitled={page.title === t('wiki.untitled') || undefined}>
          {page.title}
        </span>
        {/* La portada del mundo, con su casa a la derecha (como en LegendKeeper) */}
        {page.id === homeId && <House aria-hidden="true" size={15} className={styles.home} />}
        {known.has(page.id) && <Eye aria-label={t('whoKnows.known')} role="img" size={13} className={styles.known} />}
      </Link>
    )
  }

  if (!root?.data) return root?.isError ? <p role="alert">{errorText(root.error)}</p> : null
  if (rows.length === 0) return <p className={styles.empty}>{t('wiki.empty')}</p>

  return (
    <div ref={scroller} className={styles.scroller} data-virtual={virtual || undefined}>
      <div
        role="tree"
        aria-label={t('wiki.pages')}
        aria-describedby={hintId}
        className={styles.tree}
        style={virtual ? { blockSize: virtualizer.getTotalSize(), position: 'relative' } : undefined}
      >
        {virtual
          ? virtualizer.getVirtualItems().map((item) => {
              const row = rows[item.index]
              return row
                ? renderRow(row, {
                    position: 'absolute',
                    insetInline: 0,
                    transform: `translateY(${item.start}px)`,
                    blockSize: ROW_HEIGHT
                  })
                : null
            })
          : rows.map((row) => renderRow(row))}
      </div>
      {/* Cómo se recoloca: para los lectores de pantalla (con el ratón se ve al arrastrar) */}
      <p id={hintId} className={styles.hint}>
        {t('wiki.moveHint')}
      </p>
      {menu && (
        <TreeMenu
          worldId={worldId}
          page={menu.page}
          at={{ x: menu.x, y: menu.y }}
          isHome={menu.page.id === homeId}
          openPath={(path ?? []).map((p) => p.id)}
          onClose={(returnFocus) => {
            const id = menu.page.id
            setMenu(null)
            if (returnFocus) items.current.get(id)?.focus()
          }}
        />
      )}
    </div>
  )
}

/** El dibujo de una página sin icono: el de su plantilla; si no, el de página o el de varias */
function PageKindIcon({ template, hasChildren }: { template: string | null; hasChildren: boolean }) {
  const found = useTemplates().data?.templates.find((each) => each.id === template)
  if (found) {
    return <TemplateIcon icon={found.icon} size={15} />
  }
  return hasChildren ? <BookCopy size={15} /> : <FileText size={15} />
}
