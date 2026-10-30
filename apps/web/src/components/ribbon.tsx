import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  Bookmark,
  BookOpen,
  Folder,
  Globe,
  Hash,
  History,
  type LucideIcon,
  Moon,
  Plug,
  Search,
  Sun,
  Trash2
} from 'lucide-react'
import { type MouseEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { currentTheme, nextTheme, setTheme } from '../theme.ts'
import { useNarrow, useWikiPanel, type WikiPanel } from '../wiki/panel.tsx'
import { AccountMenu } from './account-menu.tsx'
import styles from './ribbon.module.css'

/** Si la cuenta es propietaria de alguna organización: solo ella ve su historial, su papelera y la IA */
function useIsOwner() {
  const api = useApi()
  const { account } = useAccounts().useAccount()
  const organizations = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.call('listOrganizations', {}),
    enabled: Boolean(account)
  })
  return organizations.data?.organizations.some((o) => o.role === 'owner') ?? false
}

/** Lo que va dentro de cada botón: el icono y su nombre debajo, que se entienda sin pasar el ratón */
function Label({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <>
      <Icon aria-hidden="true" size={20} strokeWidth={1.75} />
      <span className={styles.text}>{text}</span>
    </>
  )
}

/**
 * La barra de la izquierda, como en el Crisol antiguo: Mundos; dentro de un mundo que llevas, sus paneles (páginas,
 * buscar y marcadores abren el panel lateral; etiquetas y archivos, su pantalla); abajo, lo del propietario, el tema y
 * la cuenta. La sección actual lleva aria-current (lo pone el Link) o aria-pressed
 */
export function Ribbon() {
  const { t } = useTranslation()
  const api = useApi()
  const { account } = useAccounts().useAccount()
  const isOwner = useIsOwner()
  const worldId = useRouterState({ select: (state) => /^\/mundos\/([^/]+)/.exec(state.location.pathname)?.[1] })
  const worlds = useQuery({
    queryKey: ['worlds'],
    queryFn: () => api.call('listWorlds', {}),
    enabled: Boolean(account && worldId)
  })
  // La wiki es solo de quien administra el mundo (hasta el módulo 5)
  const world = worlds.data?.worlds.find((w) => w.id === worldId && w.role === 'master')

  return (
    <div className={styles.ribbon}>
      <nav className={styles.sections} aria-label={t('app.sectionsNav')}>
        <Link to="/" className={styles.brand} aria-label={t('app.name')} translate="no">
          <span aria-hidden="true" />
        </Link>
        <Link to="/mundos" activeOptions={{ exact: true }} className={styles.item}>
          <Label icon={Globe} text={t('ribbon.worlds')} />
        </Link>
        {world && <WorldPanels worldId={world.id} />}
        <span className={styles.spacer} />
        {isOwner && (
          <>
            <Link to="/historial" className={styles.item}>
              <Label icon={History} text={t('ribbon.history')} />
            </Link>
            <Link to="/papelera" className={styles.item}>
              <Label icon={Trash2} text={t('ribbon.trash')} />
            </Link>
            {/* La IA solo se conecta con la cuenta del propietario (módulo 0) */}
            <Link to="/ia" className={styles.item}>
              <Label icon={Plug} text={t('ribbon.ai')} />
            </Link>
          </>
        )}
      </nav>
      <nav className={styles.account} aria-label={t('app.accountNav')}>
        <AccountMenu variant="ribbon" />
        <ThemeButton />
      </nav>
    </div>
  )
}

/** Los paneles de un mundo. Fuera de la wiki, abrir uno lleva a ella con ese panel abierto */
function WorldPanels({ worldId }: { worldId: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const wikiPanel = useWikiPanel()
  const inWiki = useRouterState({
    select: (state) => new RegExp(`^/mundos/${worldId}/(wiki|buscar|etiquetas|archivos)`).test(state.location.pathname)
  })
  const press = (panel: WikiPanel) => (event: MouseEvent<HTMLButtonElement>) => {
    const trigger = event.currentTarget
    if (inWiki) {
      wikiPanel.toggle(panel, trigger)
      return
    }
    wikiPanel.show(panel, trigger)
    void navigate({ to: '/mundos/$worldId/wiki', params: { worldId } })
  }
  const narrow = useNarrow()
  // Marcado si se ve: en lo estrecho, con el cajón abierto; en lo ancho, si no está recogido
  const pressed = (panel: WikiPanel) =>
    inWiki && wikiPanel.panel === panel && (narrow ? wikiPanel.open : !wikiPanel.collapsed)
  const panels: [WikiPanel, LucideIcon, string][] = [
    ['pages', BookOpen, t('ribbon.pages')],
    ['search', Search, t('ribbon.search')],
    ['bookmarks', Bookmark, t('ribbon.bookmarks')]
  ]
  return (
    <>
      {panels.map(([panel, icon, text]) => (
        <button key={panel} type="button" className={styles.item} aria-pressed={pressed(panel)} onClick={press(panel)}>
          <Label icon={icon} text={text} />
        </button>
      ))}
      <Link to="/mundos/$worldId/etiquetas" params={{ worldId }} className={styles.item}>
        <Label icon={Hash} text={t('ribbon.tags')} />
      </Link>
      <Link to="/mundos/$worldId/archivos" params={{ worldId }} className={styles.item}>
        <Label icon={Folder} text={t('ribbon.files')} />
      </Link>
    </>
  )
}

/** Claro u oscuro: el nombre dice a cuál cambia */
function ThemeButton() {
  const { t } = useTranslation()
  const [theme, setThemeState] = useState(currentTheme)
  const next = nextTheme(theme)
  return (
    <button
      type="button"
      className={styles.item}
      aria-label={next === 'dark' ? t('theme.toDark') : t('theme.toLight')}
      onClick={() => {
        setTheme(next)
        setThemeState(next)
      }}
    >
      <Label icon={next === 'dark' ? Moon : Sun} text={next === 'dark' ? t('theme.dark') : t('theme.light')} />
    </button>
  )
}
