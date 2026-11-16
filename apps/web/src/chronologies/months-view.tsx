/**
 * La vista «Meses» (lienzo del módulo 8, pantalla 5; Everlore, el «Gantt» de timeline-tab-pane.tsx:1292-1390 y su
 * ventana infinita, 891-926): carriles por grupo (las páginas con fecha, en el suyo; «Sin grupo», fijo al final) por
 * columnas del calendario: en Años, una por año con la era encima; en Meses, una por mes con el año encima (las
 * festividades, más estrechas y con su color); en Días, una por día con el mes encima. Un evento de un día es un punto
 * con su título; un periodo, una barra. La ventana crece por los dos lados al desplazarse; se arrastra el fondo para
 * moverse. El máster arrastra una barra para moverla en el tiempo, renombra un grupo con doble clic, lo reordena
 * arrastrando su nombre y crea otro con «+ Grupo»
 */
import type { ChronologyEntryView, TimelineGroupView } from '@crisol/contracts'
import {
  type CalendarDefinition,
  dateFromDay,
  entryOccurrences,
  packRows,
  type TimeZoom,
  timeBands,
  timeColumns,
  yearStart
} from '@crisol/domain'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import {
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '../components/icon.tsx'
import { colorHex } from '../routes/world-look.ts'
import styles from './chronologies.module.css'
import { entryColor, shownIcon } from './event-card.tsx'
import { columnAt, columnOffsets, columnWidth } from './layout.ts'

/** Lo que abarca la ventana a cada lado del centro, en días, según el zoom */
const HALF: Record<TimeZoom, (meanYear: number) => number> = {
  years: (year) => Math.round(year * 60),
  months: (year) => Math.round(year * 3),
  days: () => 75
}
/** Ancho de la columna de los nombres de los carriles */
const LANE_LABEL = 176
const ROW = 34
/** Lo que se añade al llegar a un borde */
const EDGE = 480

type Lane = { id: string; name: string; color: string | null; kind: 'group' | 'pages' | 'none' }

export function MonthsView({
  definition,
  entries,
  groups,
  zoom,
  focusKey,
  onEdit,
  onShift,
  onGroups
}: {
  definition: CalendarDefinition
  entries: readonly ChronologyEntryView[]
  groups: readonly TimelineGroupView[]
  zoom: TimeZoom
  /** Una entrada a la que ir («Ir a…») */
  focusKey: string | null
  onEdit?: ((entry: ChronologyEntryView) => void) | undefined
  /** El máster: soltar una barra movida (en qué unidad y cuántas) */
  onShift?: ((entry: ChronologyEntryView, unit: 'days' | 'months' | 'years', steps: number) => void) | undefined
  /** El máster: la lista entera de grupos, cambiada */
  onGroups?: ((groups: Array<{ id?: string; name: string; color: TimelineGroupView['color'] }>) => void) | undefined
}) {
  const { t } = useTranslation()
  const scroller = useRef<HTMLDivElement>(null)
  const meanYear = useMemo(() => yearStart(definition, 1) - yearStart(definition, 0), [definition])
  const centerOf = (entry: ChronologyEntryView | undefined) => entry?.startDay ?? yearStart(definition, 0)
  const [range, setRange] = useState(() => {
    const center = centerOf(entries.at(-1))
    const half = HALF[zoom](meanYear)
    return { from: center - half, to: center + half, center }
  })
  // El día que está en el centro de lo que se ve: al cambiar de zoom, sigue en el centro
  const dayAtCenter = useRef<number | null>(null)
  const lastZoom = useRef(zoom)
  useEffect(() => {
    if (lastZoom.current === zoom) return
    lastZoom.current = zoom
    const half = HALF[zoom](meanYear)
    setRange((w) => {
      const center = dayAtCenter.current ?? w.center
      return { from: center - half, to: center + half, center }
    })
  }, [zoom, meanYear])
  const columns = useMemo(() => timeColumns(definition, zoom, range.from, range.to), [definition, zoom, range])
  const { offsets, total } = useMemo(() => columnOffsets(zoom, columns), [zoom, columns])
  const bands = useMemo(() => timeBands(definition, zoom, columns), [definition, zoom, columns])
  const span = { from: columns[0]?.start ?? range.from, to: columns.at(-1)?.end ?? range.to }

  /** El sitio en px de un día (con su parte dentro de la columna) */
  const xOf = (day: number) => {
    const index = columnAt(columns, day)
    const column = columns[index]
    if (!column) return 0
    const width = columnWidth(zoom, column)
    const fraction = Math.min(1, Math.max(0, (day - column.start) / (column.end - column.start + 1)))
    return (offsets[index] ?? 0) + width * fraction
  }

  // Los carriles: los grupos en su orden, las páginas y «Sin grupo» al final
  const hasPages = entries.some((e) => e.kind === 'page')
  const lanes: Lane[] = [
    ...groups.map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color ? colorHex(g.color) : null,
      kind: 'group' as const
    })),
    ...(hasPages ? [{ id: 'pages', name: t('chronologies.lanes.pages'), color: null, kind: 'pages' as const }] : []),
    { id: 'none', name: t('chronologies.lanes.none'), color: null, kind: 'none' as const }
  ]
  const laneOf = (entry: ChronologyEntryView) =>
    entry.kind === 'page'
      ? 'pages'
      : entry.groupId && groups.some((g) => g.id === entry.groupId)
        ? entry.groupId
        : 'none'
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set())

  // Lo que se pinta en cada carril, en filas que no se montan
  const placed = useMemo(() => {
    const byLane = new Map<
      string,
      Array<{ entry: ChronologyEntryView; occurrence: number; x0: number; x1: number; bar: boolean; row: number }>
    >()
    for (const entry of entries) {
      for (const occurrence of entryOccurrences(definition, entry, span.from, span.to)) {
        const x0 = xOf(occurrence.startDay)
        const x1 = Math.max(xOf(occurrence.endDay + 1), x0 + 2)
        const bar = x1 - x0 >= 14
        const lane = laneOf(entry)
        const list = byLane.get(lane) ?? []
        list.push({ entry, occurrence: occurrence.startDay, x0, x1, bar, row: 0 })
        byLane.set(lane, list)
      }
    }
    for (const list of byLane.values()) {
      list.sort((a, b) => a.x0 - b.x0)
      // Lo que ocupa: la barra o, si es más largo, su título
      const rows = packRows(
        list.map((item) => ({ start: item.x0, end: Math.max(item.x1, item.x0 + 26 + item.entry.title.length * 7) }))
      )
      list.forEach((item, index) => {
        item.row = rows[index] ?? 0
      })
    }
    return byLane
    // xOf depende de columns y offsets
  }, [entries, definition, span.from, span.to, columns, offsets])

  // Al crecer la ventana por la izquierda, el desplazamiento se corrige para que no salte
  const pendingShift = useRef<number | null>(null)
  const previousFirst = useRef<number | null>(null)
  useLayoutEffect(() => {
    const element = scroller.current
    if (!element) return
    if (pendingShift.current !== null && previousFirst.current !== null) {
      element.scrollLeft += xOf(previousFirst.current) - pendingShift.current
      pendingShift.current = null
    }
  })

  // Al abrir (y al cambiar de zoom o ir a algo), el centro de la ventana en el centro
  const centered = useRef<string>('')
  useLayoutEffect(() => {
    const element = scroller.current
    if (!element) return
    const key = `${zoom}:${range.center}`
    if (centered.current === key) return
    centered.current = key
    element.scrollLeft = Math.max(0, xOf(range.center) + LANE_LABEL - element.clientWidth / 2)
  })

  // «Ir a…»: la ventana alrededor de esa entrada
  useEffect(() => {
    if (!focusKey) return
    const entry = entries.find((e) => e.key === focusKey)
    if (!entry) return
    const half = HALF[zoom](meanYear)
    setRange({ from: entry.startDay - half, to: entry.startDay + half, center: entry.startDay })
  }, [focusKey, entries, zoom, meanYear])

  const onScroll = () => {
    const element = scroller.current
    if (!element) return
    dayAtCenter.current = dayAt(element.scrollLeft + element.clientWidth / 2 - LANE_LABEL)
    const half = HALF[zoom](meanYear)
    if (element.scrollLeft < EDGE) {
      // Por la izquierda: se recuerda dónde estaba la primera columna para corregir el desplazamiento
      previousFirst.current = columns[0]?.start ?? range.from
      pendingShift.current = 0
      setRange((w) => ({ ...w, from: w.from - half }))
    } else if (element.scrollLeft + element.clientWidth > element.scrollWidth - EDGE) {
      setRange((w) => ({ ...w, to: w.to + half }))
    }
  }
  const dayAt = (x: number) => {
    let index = 0
    while (index < offsets.length - 1 && (offsets[index + 1] ?? 0) <= x) index++
    const column = columns[index]
    return column ? column.start : range.center
  }

  // Arrastrar el fondo para moverse
  const pan = useRef<{ x: number; left: number } | null>(null)
  const onPanStart = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, input, [data-bar]')) return
    const element = scroller.current
    if (!element) return
    pan.current = { x: event.clientX, left: element.scrollLeft }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPanMove = (event: PointerEvent<HTMLDivElement>) => {
    const element = scroller.current
    if (!pan.current || !element) return
    element.scrollLeft = pan.current.left - (event.clientX - pan.current.x)
  }
  const onPanEnd = () => {
    pan.current = null
  }

  // Arrastrar una barra (el máster): se suelta en otra columna
  const drag = useRef<{ key: string; x: number; moved: number } | null>(null)
  const [dragged, setDragged] = useState<{ key: string; dx: number } | null>(null)
  const unit: 'days' | 'months' | 'years' = zoom
  const step = zoom === 'days' ? 36 : zoom === 'years' ? 72 : 88

  const laneHeight = (id: string) =>
    folded.has(id) ? 0 : Math.max(1, ...(placed.get(id) ?? []).map((item) => item.row + 1)) * ROW + 12

  return (
    <div
      ref={scroller}
      className={styles.months}
      onScroll={onScroll}
      onPointerDown={onPanStart}
      onPointerMove={onPanMove}
      onPointerUp={onPanEnd}
      onPointerCancel={onPanEnd}
      style={{ '--lane-label': `${LANE_LABEL}px`, '--row': `${ROW}px` } as CSSProperties}
    >
      <div className={styles.monthsInner} style={{ inlineSize: `${LANE_LABEL + total}px` }}>
        <div className={styles.timeHead}>
          <div className={styles.timeCorner}>{t('chronologies.lanes.title')}</div>
          <div className={styles.timeScale}>
            <div className={styles.bands}>
              {bands.map((band, index) => {
                const start = bands.slice(0, index).reduce((sum, b) => sum + b.span, 0)
                const width = columns.slice(start, start + band.span).reduce((sum, c) => sum + columnWidth(zoom, c), 0)
                return (
                  <span key={`${band.key}-${start}`} className={styles.band} style={{ inlineSize: `${width}px` }}>
                    <span className={styles.bandLabel}>{band.label}</span>
                  </span>
                )
              })}
            </div>
            <div className={styles.columns}>
              {columns.map((column) => (
                <span
                  key={column.key}
                  className={styles.column}
                  data-festival={column.festival || undefined}
                  style={
                    {
                      inlineSize: `${columnWidth(zoom, column)}px`,
                      ...(column.color ? { '--column-color': column.color } : {})
                    } as CSSProperties
                  }
                  title={column.festival ? column.label : undefined}
                >
                  {zoom === 'months' && column.festival ? abbreviation(column.label) : column.label}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.lanes}>
          <div className={styles.gridLines} aria-hidden="true">
            {columns.map((column) => (
              <span
                key={column.key}
                data-festival={column.festival || undefined}
                style={{ inlineSize: `${columnWidth(zoom, column)}px` }}
              />
            ))}
          </div>
          <ul className={styles.laneList} aria-label={t('chronologies.lanes.title')}>
            {lanes.map((lane) => (
              <LaneRow
                key={lane.id}
                lane={lane}
                folded={folded.has(lane.id)}
                height={laneHeight(lane.id)}
                editable={Boolean(onGroups) && lane.kind === 'group'}
                onFold={() =>
                  setFolded((current) => {
                    const next = new Set(current)
                    if (next.has(lane.id)) next.delete(lane.id)
                    else next.add(lane.id)
                    return next
                  })
                }
                onRename={(name) =>
                  onGroups?.(groups.map((g) => ({ id: g.id, name: g.id === lane.id ? name : g.name, color: g.color })))
                }
                onMove={(from, to) => {
                  const moved = groups[from]
                  if (!moved) return
                  const order = groups.filter((g) => g.id !== moved.id)
                  order.splice(Math.max(0, Math.min(order.length, to)), 0, moved)
                  onGroups?.(order.map((g) => ({ id: g.id, name: g.name, color: g.color })))
                }}
                index={groups.findIndex((g) => g.id === lane.id)}
              >
                {(placed.get(lane.id) ?? []).map((item) => {
                  const color = entryColor(
                    item.entry,
                    groups.find((g) => g.id === item.entry.groupId)
                  )
                  const icon = shownIcon(item.entry)
                  const movable = Boolean(onShift) && item.entry.kind === 'event' && !item.entry.converted
                  const dx = dragged?.key === `${item.entry.key}@${item.occurrence}` ? dragged.dx : 0
                  return (
                    <button
                      key={`${item.entry.key}@${item.occurrence}`}
                      type="button"
                      data-bar=""
                      className={styles.bar}
                      data-point={!item.bar || undefined}
                      data-kind={item.entry.kind}
                      data-hidden={item.entry.hidden || undefined}
                      data-dragging={dx !== 0 || undefined}
                      style={
                        {
                          '--entry-color': color,
                          insetInlineStart: `${item.x0 + dx}px`,
                          insetBlockStart: `${item.row * ROW + 6}px`,
                          ...(item.bar ? { inlineSize: `${item.x1 - item.x0}px` } : {})
                        } as CSSProperties
                      }
                      title={item.entry.text}
                      onClick={() => {
                        if (drag.current && Math.abs(drag.current.moved) > 4) return
                        if (item.entry.kind === 'event') onEdit?.(item.entry)
                      }}
                      onPointerDown={
                        movable
                          ? (event) => {
                              drag.current = { key: `${item.entry.key}@${item.occurrence}`, x: event.clientX, moved: 0 }
                              event.currentTarget.setPointerCapture(event.pointerId)
                            }
                          : undefined
                      }
                      onPointerMove={
                        movable
                          ? (event) => {
                              if (!drag.current) return
                              drag.current.moved = event.clientX - drag.current.x
                              if (Math.abs(drag.current.moved) > 4)
                                setDragged({ key: drag.current.key, dx: drag.current.moved })
                            }
                          : undefined
                      }
                      onPointerUp={
                        movable
                          ? () => {
                              const moved = drag.current?.moved ?? 0
                              setDragged(null)
                              const steps = Math.round(moved / step)
                              if (steps !== 0) onShift?.(item.entry, unit, steps)
                              // El clic que sigue no abre el cuadro
                              setTimeout(() => {
                                drag.current = null
                              }, 0)
                            }
                          : undefined
                      }
                    >
                      {!item.bar && <span className={styles.barPoint} data-kind={item.entry.kind} aria-hidden="true" />}
                      {icon && <Icon value={icon} size={12} />}
                      <span className={styles.barText}>
                        {item.entry.title}
                        {item.entry.field ? ` · ${item.entry.field}` : ''}
                      </span>
                    </button>
                  )
                })}
              </LaneRow>
            ))}
          </ul>
          {onGroups && (
            <NewGroup
              onCreate={(name) =>
                onGroups([...groups.map((g) => ({ id: g.id, name: g.name, color: g.color })), { name, color: null }])
              }
            />
          )}
        </div>
      </div>
      <p className={styles.srOnly} aria-live="polite">
        {t('chronologies.window', {
          from: dateLabel(definition, span.from),
          to: dateLabel(definition, span.to)
        })}
      </p>
    </div>
  )
}

const abbreviation = (label: string) =>
  label
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
    .slice(0, 3) || label.slice(0, 2)

function dateLabel(definition: CalendarDefinition, day: number) {
  return String(dateFromDay(definition, day).year)
}

function LaneRow({
  lane,
  folded,
  height,
  editable,
  index,
  onFold,
  onRename,
  onMove,
  children
}: {
  lane: Lane
  folded: boolean
  height: number
  editable: boolean
  index: number
  onFold: () => void
  onRename: (name: string) => void
  onMove: (from: number, to: number) => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(lane.name)
  const id = useId()
  const commit = () => {
    setRenaming(false)
    if (name.trim() && name.trim() !== lane.name) onRename(name.trim())
    else setName(lane.name)
  }
  return (
    <li className={styles.lane}>
      <div className={styles.laneName}>
        <button
          type="button"
          className={styles.laneFold}
          aria-expanded={!folded}
          aria-label={t(folded ? 'chronologies.lanes.unfold' : 'chronologies.lanes.fold', { name: lane.name })}
          onClick={onFold}
        >
          {folded ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        </button>
        <span
          className={styles.laneDot}
          data-kind={lane.kind}
          style={{ '--lane-color': lane.color ?? 'var(--color-muted)' } as CSSProperties}
          aria-hidden="true"
        />
        {renaming ? (
          <input
            className={styles.laneInput}
            value={name}
            maxLength={60}
            aria-label={t('chronologies.lanes.rename', { name: lane.name })}
            // biome-ignore lint/a11y/noAutofocus: se escribe al momento, tras el doble clic
            autoFocus
            onChange={(event) => setName(event.currentTarget.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit()
              if (event.key === 'Escape') {
                setName(lane.name)
                setRenaming(false)
              }
            }}
          />
        ) : (
          <span id={`${id}-name`} className={styles.laneTitle}>
            {editable ? (
              // Su nombre: doble clic (o Intro) para renombrarlo; se arrastra sobre otro para ordenarlo
              <button
                type="button"
                className={styles.laneTitleButton}
                draggable
                title={t('chronologies.lanes.renameHint')}
                onDoubleClick={() => setRenaming(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === 'F2') {
                    event.preventDefault()
                    setRenaming(true)
                  }
                }}
                onDragStart={(event) => {
                  event.dataTransfer.setData('application/x-crisol-grupo', String(index))
                  event.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(event) => {
                  if (event.dataTransfer.types.includes('application/x-crisol-grupo')) event.preventDefault()
                }}
                onDrop={(event) => {
                  const from = Number(event.dataTransfer.getData('application/x-crisol-grupo'))
                  if (Number.isNaN(from) || from === index) return
                  event.preventDefault()
                  onMove(from, index)
                }}
              >
                {lane.name}
              </button>
            ) : (
              lane.name
            )}
            {lane.kind === 'pages' && <small>{t('chronologies.lanes.pagesHint')}</small>}
          </span>
        )}
      </div>
      <div className={styles.laneTrack} style={{ blockSize: `${height}px` }} hidden={folded}>
        {!folded && children}
      </div>
    </li>
  )
}

function NewGroup({ onCreate }: { onCreate: (name: string) => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  if (!open)
    return (
      <button type="button" className={styles.newGroup} onClick={() => setOpen(true)}>
        <Plus size={14} aria-hidden="true" />
        {t('chronologies.lanes.new')}
      </button>
    )
  const commit = () => {
    if (name.trim()) onCreate(name.trim())
    setName('')
    setOpen(false)
  }
  return (
    <div className={styles.newGroup}>
      <input
        className={styles.laneInput}
        value={name}
        maxLength={60}
        aria-label={t('chronologies.lanes.newName')}
        placeholder={t('chronologies.lanes.newName')}
        // biome-ignore lint/a11y/noAutofocus: se abre para escribir su nombre
        autoFocus
        onChange={(event) => setName(event.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
          if (event.key === 'Escape') {
            setName('')
            setOpen(false)
          }
        }}
      />
    </div>
  )
}
