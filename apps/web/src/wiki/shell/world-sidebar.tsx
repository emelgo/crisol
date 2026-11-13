/**
 * La barra de la izquierda del mundo a pantalla completa (ADR-0027), como la de la Mesa pero a la izquierda: arriba,
 * las pestañas con su icono y su nombre (Páginas y Archivos); debajo, el panel de la abierta. Se pliega a una columna
 * de iconos y se estira arrastrando su borde (o con las flechas, con el foco en él); todo se recuerda en el aparato
 */
import type { Page } from '@crisol/contracts'
import { Link } from '@tanstack/react-router'
import { Folder, type LucideIcon, PanelLeftClose, PanelLeftOpen, Plus, ScrollText } from 'lucide-react'
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import crucible from '../../components/crucible.module.css'
import { justEnteredFull } from '../../components/world-transition.ts'
import { ExportWiki } from '../export.tsx'
import { PagesPanel } from './pages-panel.tsx'
import { clampWidth, SIDE_TABS, SIDE_WIDTH, type SideTab } from './shell-state.ts'
import styles from './world-shell.module.css'

const ICONS: Record<SideTab, LucideIcon> = { pages: ScrollText, files: Folder }

/** Lo que tarda cada icono en salir del crisol y el paso entre uno y otro (como los de la barra de la app) */
const ICON_TIME = 460
const ICON_STEP = 70

/** Cuánto se estira con cada flecha (con Mayúsculas, más) */
const STEP = 16

export function WorldSidebar({
  worldId,
  current,
  tab,
  onTab,
  folded,
  onFold,
  width,
  onWidth,
  onNewPage,
  files
}: {
  worldId: string
  current: Page | undefined
  tab: SideTab
  onTab: (tab: SideTab) => void
  folded: boolean
  onFold: (folded: boolean) => void
  width: number
  onWidth: (width: number) => void
  onNewPage: () => void
  /** Lo de la pestaña Archivos (la lista-árbol del mundo) */
  files?: ReactNode
}) {
  const { t } = useTranslation()
  const ids = useId()
  // Recién entrado desde su tarjeta: sus iconos salen del crisol uno tras otro (crucible.module.css), como los de la barra
  const [emerging, setEmerging] = useState(justEnteredFull)
  useEffect(() => {
    if (!emerging) return
    const timer = window.setTimeout(() => setEmerging(false), 4000)
    return () => window.clearTimeout(timer)
  }, [emerging])
  const emerge = emerging ? `${crucible.emerge} ${crucible.emergeIn}` : ''
  const icons = { '--icon-time': `${ICON_TIME}ms`, '--icon-step': `${ICON_STEP}ms` } as CSSProperties
  const aside = useRef<HTMLElement>(null)
  const move = (event: KeyboardEvent) => {
    const at = SIDE_TABS.indexOf(tab)
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    const target =
      event.key === 'Home'
        ? SIDE_TABS[0]
        : event.key === 'End'
          ? SIDE_TABS.at(-1)
          : step
            ? SIDE_TABS[(at + step + SIDE_TABS.length) % SIDE_TABS.length]
            : undefined
    if (!target) return
    event.preventDefault()
    onTab(target)
    document.getElementById(`${ids}-${target}`)?.focus()
  }
  // Estirar arrastrando el borde: el ancho sigue al puntero (se guarda al soltar)
  const resize = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    const left = aside.current?.getBoundingClientRect().left ?? 0
    const shell = aside.current?.closest<HTMLElement>('[data-world-shell]')
    const follow = (moved: globalThis.PointerEvent) =>
      shell?.style.setProperty('--side-width', `${clampWidth(moved.clientX - left)}px`)
    const done = (ended: globalThis.PointerEvent) => {
      handle.removeEventListener('pointermove', follow)
      handle.removeEventListener('pointerup', done)
      handle.removeEventListener('pointercancel', done)
      onWidth(clampWidth(ended.clientX - left))
    }
    handle.addEventListener('pointermove', follow)
    handle.addEventListener('pointerup', done)
    handle.addEventListener('pointercancel', done)
  }
  const resizeKey = (event: KeyboardEvent) => {
    const step = event.shiftKey ? STEP * 4 : STEP
    const next =
      event.key === 'ArrowRight'
        ? width + step
        : event.key === 'ArrowLeft'
          ? width - step
          : event.key === 'Home'
            ? SIDE_WIDTH.min
            : event.key === 'End'
              ? SIDE_WIDTH.max
              : null
    if (next === null) return
    event.preventDefault()
    onWidth(clampWidth(next))
  }

  // Al plegar o desplegar con su botón, el foco pasa al botón que hace lo contrario (si no, cae al cuerpo)
  const toggled = useRef(false)
  const foldButton = useRef<HTMLButtonElement>(null)
  const unfoldButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!toggled.current) return
    toggled.current = false
    ;(folded ? unfoldButton : foldButton).current?.focus()
  }, [folded])

  if (folded) {
    return (
      <aside className={`${styles.side} ${styles.sideFolded}`} aria-label={t('worldShell.side')} data-side="folded">
        <button
          ref={unfoldButton}
          type="button"
          className={styles.iconButton}
          aria-label={t('worldShell.unfold')}
          title={t('worldShell.unfold')}
          onClick={() => {
            toggled.current = true
            onFold(false)
          }}
        >
          <PanelLeftOpen aria-hidden="true" size={18} />
        </button>
        {/* Plegada, cada icono despliega la barra en su pestaña */}
        <ul className={`${styles.sideIcons} ${emerge}`} style={icons} data-world-icons="">
          {SIDE_TABS.map((key) => {
            const Icon = ICONS[key]
            return (
              <li key={key}>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={t(`worldShell.tabs.${key}`)}
                  title={t(`worldShell.tabs.${key}`)}
                  aria-current={key === tab ? 'true' : undefined}
                  onClick={() => {
                    onTab(key)
                    onFold(false)
                  }}
                >
                  <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
                </button>
              </li>
            )
          })}
        </ul>
      </aside>
    )
  }
  return (
    <aside ref={aside} className={styles.side} aria-label={t('worldShell.side')} data-side="open">
      <div
        className={`${styles.sideTabs} ${emerge}`}
        style={icons}
        role="tablist"
        aria-label={t('worldShell.side')}
        data-world-icons=""
      >
        {SIDE_TABS.map((key) => {
          const Icon = ICONS[key]
          const selected = key === tab
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`${ids}-${key}`}
              className={styles.sideTab}
              aria-selected={selected}
              aria-controls={`${ids}-panel`}
              tabIndex={selected ? 0 : -1}
              data-tour={`mundo-${key === 'pages' ? 'paginas' : 'archivos'}`}
              onClick={() => onTab(key)}
              onKeyDown={move}
            >
              <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
              <span>{t(`worldShell.tabs.${key}`)}</span>
            </button>
          )
        })}
      </div>
      <div className={styles.sideHead}>
        <h2 className={styles.sideTitle}>{t(`worldShell.tabs.${tab}`)}</h2>
        {tab === 'pages' ? (
          <>
            <ExportWiki worldId={worldId} className={styles.iconButton} />
            <button
              type="button"
              className={styles.iconButton}
              aria-label={t('wiki.newPage')}
              title={t('wiki.newPage')}
              aria-haspopup="dialog"
              onClick={onNewPage}
            >
              <Plus aria-hidden="true" size={16} />
            </button>
          </>
        ) : (
          <Link to="/mundos/$worldId/archivos" params={{ worldId }} className={styles.seeAll}>
            {t('worldShell.seeAll')}
          </Link>
        )}
        <button
          ref={foldButton}
          type="button"
          className={styles.iconButton}
          aria-label={t('worldShell.fold')}
          title={t('worldShell.fold')}
          onClick={() => {
            toggled.current = true
            onFold(true)
          }}
        >
          <PanelLeftClose aria-hidden="true" size={18} />
        </button>
      </div>
      <div className={styles.sideBody} role="tabpanel" id={`${ids}-panel`} aria-labelledby={`${ids}-${tab}`}>
        {tab === 'pages' ? <PagesPanel worldId={worldId} current={current} /> : files}
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: un separador que se mueve (ARIA), no una raya <hr> */}
      <div
        className={styles.resize}
        role="separator"
        aria-orientation="vertical"
        aria-label={t('worldShell.resize')}
        aria-valuemin={SIDE_WIDTH.min}
        aria-valuemax={SIDE_WIDTH.max}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={resize}
        onKeyDown={resizeKey}
      />
    </aside>
  )
}
