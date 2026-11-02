import type { PageSummary } from '@crisol/contracts'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useVirtualizer } from '@tanstack/react-virtual'
import { BookCopy, FileText, House } from 'lucide-react'
import { type CSSProperties, type DragEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import styles from './tree.module.css'

/** A partir de cuántas filas visibles solo se pintan las que se ven */
const VIRTUAL_FROM = 300
const ROW_HEIGHT = 34

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

type Zone = 'before' | 'inside' | 'after'
/** Cómo se recoloca una página: lo que se pide a movePage */
type Move = { parentId: string | null; before?: string; after?: string }

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
  const [drop, setDrop] = useState<{ id: string; zone: Zone } | null>(null)
  const dragged = useRef<string | null>(null)
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
      queryFn: () => api.call('listPageChildren', { worldId, parentId })
    }))
  })
  // La portada del mundo (como la «Home» de Everlore): la primera de lo más alto, con su casa, y no se arrastra
  const homeId = useQuery({
    queryKey: ['pages', worldId, 'home'],
    queryFn: () => api.call('getWorldHome', { worldId })
  }).data?.pageId
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
  const move = async (page: PageSummary, to: Move) => {
    try {
      await api.call('movePage', { pageId: page.id, ...to })
      if (to.parentId) setOpen(to.parentId, true)
      await queryClient.invalidateQueries({ queryKey: ['pages', worldId] })
      pendingFocus.current = true
      setFocusedId(page.id)
      const parent = titleOf(to.parentId)
      announce(
        parent ? t('wiki.movedInto', { title: page.title, parent }) : t('wiki.movedToTop', { title: page.title })
      )
    } catch (error) {
      announce(errorText(error))
    }
  }

  // Alt + flechas: arriba y abajo entre hermanas; derecha, dentro de la de encima; izquierda, detrás de su madre
  const keyboardMove = (row: Row, key: string): Move | null => {
    const siblings = siblingsOf(row.page)
    const at = siblings.findIndex((p) => p.id === row.page.id)
    const previous = siblings[at - 1]
    const next = siblings[at + 1]
    if (key === 'ArrowUp' && previous) return { parentId: row.page.parentId, before: previous.id }
    if (key === 'ArrowDown' && next) return { parentId: row.page.parentId, after: next.id }
    if (key === 'ArrowRight' && previous) return { parentId: previous.id }
    if (key === 'ArrowLeft' && row.page.parentId) {
      const parent = rows.find((r) => r.page.id === row.page.parentId)?.page
      return { parentId: parent?.parentId ?? null, after: row.page.parentId }
    }
    return null
  }

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

  // Arrastrar: el cuarto de arriba de una fila, delante; el de abajo, detrás; el resto, dentro
  const zoneOf = (event: DragEvent<HTMLElement>): Zone => {
    const box = event.currentTarget.getBoundingClientRect()
    const y = (event.clientY - box.top) / (box.height || 1)
    return y < 0.25 ? 'before' : y > 0.75 ? 'after' : 'inside'
  }
  const onDrop = (row: Row, zone: Zone) => {
    const id = dragged.current
    dragged.current = null
    setDrop(null)
    const page = rows.find((r) => r.page.id === id)?.page
    if (!page || page.id === row.page.id) return
    const to: Move =
      zone === 'inside'
        ? { parentId: row.page.id }
        : { parentId: row.page.parentId, ...(zone === 'before' ? { before: row.page.id } : { after: row.page.id }) }
    void move(page, to)
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
        style={{ ...style, paddingInlineStart: `${(row.level - 1) * 0.875}rem` }}
        data-drop={drop?.id === page.id ? drop.zone : undefined}
        aria-level={row.level}
        aria-setsize={row.setsize}
        aria-posinset={row.posinset}
        aria-expanded={page.hasChildren ? row.expanded : undefined}
        aria-current={page.id === currentId ? 'page' : undefined}
        tabIndex={page.id === tabStop ? 0 : -1}
        onFocus={() => setFocusedId(page.id)}
        onKeyDown={(event) => onKeyDown(row, event)}
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
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', page.title)
        }}
        onDragEnd={() => {
          dragged.current = null
          setDrop(null)
        }}
        onDragOver={(event) => {
          if (!dragged.current) return
          event.preventDefault()
          const zone = zoneOf(event)
          if (drop?.id !== page.id || drop.zone !== zone) setDrop({ id: page.id, zone })
        }}
        onDragLeave={() => setDrop(null)}
        onDrop={(event) => {
          event.preventDefault()
          onDrop(row, zoneOf(event))
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
        {/* Su icono, si tiene; si no, el de página (las que tienen dentro, el de varias) */}
        <span aria-hidden="true" className={styles.icon}>
          {page.icon ?? (page.hasChildren ? <BookCopy size={15} /> : <FileText size={15} />)}
        </span>
        <span className={styles.title} data-untitled={page.title === t('wiki.untitled') || undefined}>
          {page.title}
        </span>
        {/* La portada del mundo, con su casa a la derecha (como en LegendKeeper) */}
        {page.id === homeId && <House aria-hidden="true" size={15} className={styles.home} />}
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
    </div>
  )
}
