/**
 * La barra de la derecha de la Mesa (lienzo «Campaña en la Mesa», como la de Foundry VTT): arriba, las pestañas con su
 * icono y su nombre; debajo, el panel de la abierta. Se abre la última que se usó (la primera vez, Escenas) y se pliega
 * a una columna de iconos para que el mapa ocupe todo
 */
import {
  BookOpen,
  type LucideIcon,
  Map as MapIcon,
  PanelRightClose,
  PanelRightOpen,
  ScrollText,
  Shield,
  Swords,
  Users
} from 'lucide-react'
import { type KeyboardEvent, type ReactNode, useCallback, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './sidebar.module.css'

export const SIDEBAR_TABS = ['scenes', 'combat', 'characters', 'compendium', 'pages', 'settings'] as const
export type SidebarTab = (typeof SIDEBAR_TABS)[number]

/** Cómo va cada pestaña en la dirección (?panel=), en español como las rutas */
export const PANEL_SLUGS: Record<SidebarTab, string> = {
  combat: 'combate',
  scenes: 'escenas',
  characters: 'personajes',
  compendium: 'compendio',
  pages: 'paginas',
  settings: 'campana'
}

export const ICONS: Record<SidebarTab, LucideIcon> = {
  combat: Swords,
  scenes: MapIcon,
  characters: Users,
  compendium: BookOpen,
  pages: ScrollText,
  settings: Shield
}

export function tabOfSlug(slug: string | undefined): SidebarTab | null {
  // «ajustes», el nombre de antes de la pestaña Campaña (enlaces guardados)
  if (slug === 'ajustes') return 'settings'
  return SIDEBAR_TABS.find((tab) => PANEL_SLUGS[tab] === slug) ?? null
}

const TAB_KEY = 'crisol.mesa.pestana'
const FOLDED_KEY = 'crisol.mesa.plegada'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Sin almacenamiento (ventana privada…): no se recuerda, sin más
  }
}

/**
 * La pestaña abierta: la que pida la dirección; si no, la última que se usó (si la puede ver quien mira); si no, la
 * primera de las que se le dan
 */
export function useSidebarTab(allowed: readonly SidebarTab[], asked: SidebarTab | null) {
  const [tab, setTabState] = useState<SidebarTab>(() => {
    const last = read(TAB_KEY) as SidebarTab | null
    if (asked && allowed.includes(asked)) return asked
    if (last && allowed.includes(last)) return last
    return allowed.includes('scenes') ? 'scenes' : (allowed[0] ?? 'combat')
  })
  const setTab = useCallback((next: SidebarTab) => {
    write(TAB_KEY, next)
    setTabState(next)
  }, [])
  return [tab, setTab] as const
}

export function useSidebarFolded() {
  const [folded, setFoldedState] = useState(() => read(FOLDED_KEY) === '1')
  const setFolded = useCallback((next: boolean) => {
    write(FOLDED_KEY, next ? '1' : null)
    setFoldedState(next)
  }, [])
  return [folded, setFolded] as const
}

export interface SidebarItem {
  key: SidebarTab
  /** Lo que va en el panel (solo se pinta el de la abierta) */
  content: () => ReactNode
  /** Un punto rojo en su icono: algo nuevo (un combate en marcha…) */
  dot?: boolean
}

export function TableSidebar({
  items,
  tab,
  onTab,
  folded,
  onFold,
  actions
}: {
  items: SidebarItem[]
  tab: SidebarTab
  onTab: (tab: SidebarTab) => void
  folded: boolean
  onFold: (folded: boolean) => void
  /** Lo que va junto al título del panel (crear una escena…) */
  actions?: ReactNode
}) {
  const { t } = useTranslation()
  const ids = useId()
  const current = items.find((item) => item.key === tab) ?? items[0]
  const move = (event: KeyboardEvent, keys: [string, string]) => {
    const step = event.key === keys[1] ? 1 : event.key === keys[0] ? -1 : 0
    const at = items.findIndex((item) => item.key === tab)
    const target =
      event.key === 'Home'
        ? items[0]
        : event.key === 'End'
          ? items.at(-1)
          : step
            ? items[(at + step + items.length) % items.length]
            : null
    if (!target) return
    event.preventDefault()
    onTab(target.key)
    document.getElementById(`${ids}-${target.key}`)?.focus()
  }
  if (folded) {
    return (
      <aside className={`${styles.sidebar} ${styles.folded}`} aria-label={t('tabletop.panel')} data-mesa-side="folded">
        <button
          type="button"
          className={styles.fold}
          aria-label={t('tabletop.sidebar.unfold')}
          title={t('tabletop.sidebar.unfold')}
          onClick={() => onFold(false)}
        >
          <PanelRightOpen aria-hidden="true" size={18} />
        </button>
        {/* Plegada, cada icono despliega la barra en su pestaña */}
        <ul className={styles.icons}>
          {items.map((item) => {
            const Icon = ICONS[item.key]
            return (
              <li key={item.key}>
                <button
                  type="button"
                  className={styles.icon}
                  aria-label={t(`tabletop.sidebar.${item.key}`)}
                  title={t(`tabletop.sidebar.${item.key}`)}
                  onClick={() => {
                    onTab(item.key)
                    onFold(false)
                  }}
                >
                  <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
                  {item.dot && (
                    <>
                      <i className={styles.dot} aria-hidden="true" />
                      <span className={styles.hidden}>{t('tabletop.sidebar.attention')}</span>
                    </>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </aside>
    )
  }
  return (
    <aside className={styles.sidebar} aria-label={t('tabletop.panel')} data-mesa-side="open">
      <div className={styles.tabs} role="tablist" aria-label={t('tabletop.panel')} data-tour="mesa-barra">
        {items.map((item) => {
          const Icon = ICONS[item.key]
          const selected = item.key === tab
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`${ids}-${item.key}`}
              className={styles.tab}
              aria-selected={selected}
              aria-controls={`${ids}-panel`}
              tabIndex={selected ? 0 : -1}
              data-tour={`mesa-${PANEL_SLUGS[item.key]}`}
              onClick={() => onTab(item.key)}
              onKeyDown={(event) => move(event, ['ArrowLeft', 'ArrowRight'])}
            >
              <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
              <span>{t(`tabletop.sidebar.${item.key}`)}</span>
              {item.dot && (
                <>
                  <i className={styles.dot} aria-hidden="true" />
                  <span className={styles.hidden}>{t('tabletop.sidebar.attention')}</span>
                </>
              )}
            </button>
          )
        })}
      </div>
      <div className={styles.head}>
        <h2 className={styles.title}>{t(`tabletop.sidebar.${tab}`)}</h2>
        {actions}
        <button
          type="button"
          className={styles.fold}
          aria-label={t('tabletop.sidebar.fold')}
          title={t('tabletop.sidebar.fold')}
          onClick={() => onFold(true)}
        >
          <PanelRightClose aria-hidden="true" size={18} />
        </button>
      </div>
      <div className={styles.body} role="tabpanel" id={`${ids}-panel`} aria-labelledby={`${ids}-${tab}`}>
        {current?.content()}
      </div>
    </aside>
  )
}
