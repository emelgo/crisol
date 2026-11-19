/**
 * Buscar y elegir un icono de rol (todos los de game-icons.net, más de 4000: @crisol/contracts game-icons-catalog.ts):
 * el buscador arriba (por su nombre o sus palabras en español, o en inglés, sin tildes), los grupos a un lado
 * (Destacados, la selección de siempre, y luego por temas) y la rejilla, que solo pinta las filas a la vista. La lista
 * se pide al abrirlo (game-icons.ts). Abajo, su crédito (CC BY 3.0 lo pide)
 */
import { GAME_ICON_GROUPS, type GameIcon, type GameIconGroup, gameIconId } from '@crisol/contracts'
import { observeElementRect, useVirtualizer } from '@tanstack/react-virtual'
import { Search } from 'lucide-react'
import { type KeyboardEvent, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameIcons } from './game-icons.ts'
import { Icon } from './icon.tsx'
import styles from './icon-browser.module.css'

/** Destacados y los grupos, en su orden */
type Section = 'destacados' | GameIconGroup
const SECTIONS: readonly Section[] = ['destacados', ...GAME_ICON_GROUPS]

/** El dibujo de cada grupo, en su botón */
const SECTION_ICON: Record<Section, string> = {
  destacados: 'star-formation',
  gente: 'person',
  criaturas: 'dragon-head',
  animales: 'wolf-head',
  naturaleza: 'oak',
  lugares: 'mountains',
  edificios: 'castle',
  armas: 'crossed-swords',
  armaduras: 'breastplate',
  objetos: 'knapsack',
  magia: 'magic-swirl',
  religion: 'ankh',
  simbolos: 'flying-flag',
  transporte: 'galleon',
  dinero: 'coins',
  documentos: 'scroll-unfurled',
  comida: 'meat',
  cuerpo: 'heart-organ',
  combate: 'sword-clash',
  ocio: 'perspective-dice-six-faces-random',
  tecnologia: 'gears'
}

/** El lado de cada casilla (2.25rem) y su separación, en píxeles */
const CELL = 36
const GAP = 2
const ROW = CELL + GAP
/** Sin medidas (antes de maquetar, o en las pruebas), las columnas */
const COLUMNS = 8
/** El alto de la rejilla (18.5rem), mientras no se mide */
const LIST_HEIGHT = 296
/** Desde cuántas filas solo se pintan las que se ven */
const VIRTUAL_FROM = 16

export function IconBrowser({
  value,
  onPick,
  autoFocus = false
}: {
  value: string | null
  onPick: (icon: string) => void
  autoFocus?: boolean
}) {
  const { t } = useTranslation()
  const catalog = useGameIcons()
  const [query, setQuery] = useState('')
  const headingId = useId()
  const chosenId = gameIconId(value)
  const chosen = catalog?.gameIcon(value) ?? null
  // Al abrir, Destacados; con uno elegido que no lo es, su grupo
  const [picked, setPicked] = useState<Section | null>(null)
  const section: Section = picked ?? (chosen && !chosen.featured ? chosen.group : 'destacados')
  const searching = query.trim() !== ''
  const shown: readonly GameIcon[] = !catalog
    ? []
    : searching
      ? catalog.searchGameIcons(query)
      : section === 'destacados'
        ? catalog.FEATURED_GAME_ICONS
        : catalog.searchGameIcons('', section)

  // Las columnas, según el ancho de la rejilla
  const scroller = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(COLUMNS)
  useLayoutEffect(() => {
    const element = scroller.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const width = element.clientWidth
      if (width > 0) setColumns(Math.max(1, Math.floor((width + GAP) / ROW)))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const rows = Math.ceil(shown.length / columns)
  const virtual = rows > VIRTUAL_FROM
  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW,
    overscan: 4,
    enabled: virtual,
    // Sin alto todavía (antes de maquetar), el de la rejilla
    observeElementRect: (instance, report) =>
      observeElementRect(instance, (rect) =>
        report(rect.height > 0 ? rect : { width: rect.width, height: LIST_HEIGHT })
      )
  })

  // Una sola parada del tabulador en la rejilla (la elegida o la primera); las flechas la recorren, Inicio y Fin
  const [focusAt, setFocusAt] = useState<string | null>(null)
  const indexOf = (id: string | null) => (id ? shown.findIndex((icon) => icon.id === id) : -1)
  const stopAt = [indexOf(focusAt), indexOf(chosenId), 0].find((at) => at >= 0) ?? 0
  const stop = shown[stopAt]?.id ?? null
  const pendingFocus = useRef(false)
  useEffect(() => {
    if (!pendingFocus.current || !stop) return
    const button = scroller.current?.querySelector<HTMLElement>(`[data-icono="${stop}"]`)
    if (button) {
      pendingFocus.current = false
      button.focus()
    }
  })
  // Al cambiar de grupo o de búsqueda, arriba del todo (o en la elegida, al abrir)
  const firstScroll = useRef(true)
  useEffect(() => {
    if (!catalog) return
    const element = scroller.current
    if (!element) return
    const at = firstScroll.current ? indexOf(chosenId) : -1
    firstScroll.current = false
    if (at >= 0 && virtual) virtualizer.scrollToIndex(Math.floor(at / columns), { align: 'center' })
    else if (at >= 0) element.querySelector(`[data-icono="${chosenId}"]`)?.scrollIntoView?.({ block: 'nearest' })
    else element.scrollTop = 0
  }, [catalog, section, query])

  const onGridKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.target instanceof HTMLElement) || !event.target.dataset.icono) return
    const moves: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: columns,
      ArrowUp: -columns,
      Home: -stopAt,
      End: shown.length - 1 - stopAt
    }
    const step = moves[event.key]
    if (step === undefined) return
    event.preventDefault()
    const next = Math.max(0, Math.min(shown.length - 1, stopAt + step))
    const icon = shown[next]
    if (!icon) return
    pendingFocus.current = true
    if (virtual) virtualizer.scrollToIndex(Math.floor(next / columns))
    setFocusAt(icon.id)
  }

  // Los grupos: una parada; arriba y abajo (o a los lados, si van en fila) pasan al de al lado y lo enseñan
  const sectionList = useRef<HTMLDivElement>(null)
  const current = searching ? null : section
  const choose = (next: Section, focus = false) => {
    setPicked(next)
    setQuery('')
    setFocusAt(null)
    if (focus) sectionList.current?.querySelector<HTMLElement>(`[data-grupo="${next}"]`)?.focus()
  }
  const onSectionKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = SECTIONS.indexOf(current ?? section)
    const moves: Record<string, number> = {
      ArrowDown: 1,
      ArrowRight: 1,
      ArrowUp: -1,
      ArrowLeft: -1,
      Home: -at,
      End: SECTIONS.length - 1 - at
    }
    const step = moves[event.key]
    if (step === undefined) return
    event.preventDefault()
    const next = SECTIONS[Math.max(0, Math.min(SECTIONS.length - 1, at + step))]
    if (next) choose(next, true)
  }

  const cell = (icon: GameIcon) => (
    <button
      key={icon.id}
      type="button"
      className={styles.choice}
      title={icon.label}
      aria-label={icon.label}
      aria-pressed={chosenId === icon.id}
      tabIndex={icon.id === stop ? 0 : -1}
      data-icono={icon.id}
      onFocus={() => setFocusAt(icon.id)}
      onClick={() => onPick(`gi:${icon.id}`)}
    >
      <Icon value={`gi:${icon.id}`} size={22} />
    </button>
  )
  const row = (index: number) => shown.slice(index * columns, index * columns + columns).map(cell)
  const gridStyle = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }

  return (
    <div className={styles.browser}>
      <label className={styles.search}>
        <Search aria-hidden="true" size={15} />
        <input
          type="search"
          value={query}
          placeholder={t('icon.search')}
          aria-label={t('icon.search')}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          // biome-ignore lint/a11y/noAutofocus: se abre para buscar, dentro de su caja
          autoFocus={autoFocus}
          onChange={(event) => {
            setQuery(event.currentTarget.value)
            setFocusAt(null)
          }}
        />
      </label>
      <div className={styles.body}>
        <div
          ref={sectionList}
          role="toolbar"
          aria-orientation="vertical"
          aria-label={t('icon.sections')}
          className={styles.sections}
          onKeyDown={onSectionKey}
        >
          {SECTIONS.map((each) => (
            <button
              key={each}
              type="button"
              aria-pressed={each === current}
              tabIndex={each === (current ?? section) ? 0 : -1}
              data-grupo={each}
              className={styles.section}
              onClick={() => choose(each)}
            >
              <Icon value={`gi:${SECTION_ICON[each]}`} size={16} />
              <span>{t(`icon.groups.${each}`)}</span>
            </button>
          ))}
        </div>
        <div className={styles.results}>
          <p id={headingId} className={styles.heading} aria-live="polite">
            {!catalog
              ? t('icon.loading')
              : searching
                ? t('icon.found', { count: shown.length })
                : `${t(`icon.groups.${section}`)} · ${shown.length}`}
          </p>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: las flechas recorren los botones de dentro */}
          <div ref={scroller} className={styles.list} onKeyDown={onGridKey}>
            {catalog && shown.length === 0 && <p className={styles.none}>{t('icon.noneFound')}</p>}
            {shown.length > 0 && (
              // biome-ignore lint/a11y/useSemanticElements: un grupo de botones con su rótulo, no un formulario
              <div role="group" aria-labelledby={headingId} className={styles.rows}>
                {virtual ? (
                  <div className={styles.virtual} style={{ blockSize: virtualizer.getTotalSize() }}>
                    {virtualizer.getVirtualItems().map((item) => (
                      <div
                        key={item.key}
                        className={styles.row}
                        style={{ ...gridStyle, transform: `translateY(${item.start}px)` }}
                      >
                        {row(item.index)}
                      </div>
                    ))}
                  </div>
                ) : (
                  Array.from({ length: rows }, (_, index) => (
                    <div key={index} className={styles.row} style={gridStyle}>
                      {row(index)}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <p className={styles.credit}>
        {t('icon.creditBefore')}{' '}
        <a href="https://game-icons.net" target="_blank" rel="noreferrer">
          game-icons.net
        </a>
        {t('icon.creditAfter')}
      </p>
    </div>
  )
}
