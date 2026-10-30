import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Bookmark, BookOpen, Folder, Globe, Hash, History, type LucideIcon, Search, Trash2 } from 'lucide-react'
import { type CSSProperties, type MouseEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { historyQuery, trashQuery } from '../api/queries.ts'
import { useNarrow, useWikiPanel, type WikiPanel } from '../wiki/panel.tsx'
import { AccountMenu } from './account-menu.tsx'
import { CrisolMark } from './brand.tsx'
import styles from './ribbon.module.css'
import { useWindow } from './window.tsx'
import { LEAVE_WORLD } from './world-transition.ts'

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
  const windows = useWindow()
  const worldId = useRouterState({ select: (state) => /^\/mundos\/([^/]+)/.exec(state.location.pathname)?.[1] })
  const worlds = useQuery({
    queryKey: ['worlds'],
    queryFn: () => api.call('listWorlds', {}),
    enabled: Boolean(account && worldId)
  })
  // La wiki es solo de quien administra el mundo (hasta el módulo 5)
  const world = worlds.data?.worlds.find((w) => w.id === worldId && w.role === 'master')
  // Historial y Papelera se piden en cuanto el ratón (o el foco) llega a su botón: al abrirlos, ya están
  const queryClient = useQueryClient()
  const prefetchHistory = () => void queryClient.prefetchInfiniteQuery({ ...historyQuery(api, {}), staleTime: 10_000 })
  const prefetchTrash = () => void queryClient.prefetchQuery({ ...trashQuery(api, {}), staleTime: 10_000 })
  // Al entrar en un mundo, «Mundos» sube a la llama y se funde con ella, que se aviva (el mundo se cocina en el crisol);
  // dentro, la llama es la vuelta. Al volver, «Mundos» sale de la llama, sin fuego
  const inWorld = Boolean(worldId)
  const [wasInWorld, setWasInWorld] = useState(inWorld)
  // Recién entrado (en este mismo pintado aún no se ve en phase)
  const justEntered = inWorld && !wasInWorld
  const [phase, setPhase] = useState<'still' | 'merging' | 'emerging'>('still')
  if (inWorld !== wasInWorld) {
    setWasInWorld(inWorld)
    setPhase(inWorld ? 'merging' : 'emerging')
  }
  // Los iconos del mundo (Páginas, Buscar… y los que vengan): al entrar, salen del crisol uno tras otro cuando «Mundos»
  // ya se ha fundido; al volver, suben a él y se van antes de que salga «Mundos». Se quedan mientras se van
  const [panelsWorld, setPanelsWorld] = useState(world?.id ?? null)
  const [panelsMotion, setPanelsMotion] = useState<'none' | 'enter' | 'leave'>('none')
  if (world && world.id !== panelsWorld) {
    setPanelsWorld(world.id)
    setPanelsMotion(justEntered || phase === 'merging' ? 'enter' : 'none')
  }
  if (!world && panelsWorld && panelsMotion !== 'leave') setPanelsMotion('leave')
  const panelsBox = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (panelsMotion !== 'leave') return
    // Sin animaciones (las pruebas), al momento; si no, cuando el último ya se ha ido
    if (typeof panelsBox.current?.getAnimations !== 'function') return setPanelsWorld(null)
    const timer = window.setTimeout(() => setPanelsWorld(null), 650)
    return () => window.clearTimeout(timer)
  }, [panelsMotion])
  const merged = inWorld && phase !== 'merging'
  const worldsItem = [
    styles.item,
    inWorld && phase === 'merging' ? styles.merging : '',
    inWorld && phase !== 'merging' ? styles.merged : '',
    !inWorld && phase === 'emerging' ? styles.emerging : ''
  ]

  return (
    <div className={styles.ribbon}>
      <nav className={styles.sections} aria-label={t('app.sectionsNav')}>
        <Link
          to="/mundos"
          className={phase === 'merging' ? `${styles.brand} ${styles.cooking}` : styles.brand}
          {...(inWorld ? { viewTransition: LEAVE_WORLD } : {})}
          aria-label={t('app.name')}
          translate="no"
        >
          <CrisolMark size={26} />
        </Link>
        {/* Ya fundidos con la llama (dentro de un mundo), «Mundos» y los archivos comunes no están */}
        {merged ? null : (
          <Link
            to="/mundos"
            activeOptions={{ exact: true }}
            className={worldsItem.filter(Boolean).join(' ')}
            data-tour="barra-mundos"
            onAnimationEnd={() => setPhase('still')}
          >
            <Label icon={Globe} text={t('ribbon.worlds')} />
          </Link>
        )}
        {/* Los archivos comunes de la cuenta: fuera de los mundos; dentro, en los «Archivos» de cada uno (ADR-0005).
            Al entrar en un mundo sube a la llama con «Mundos», desde más abajo */}
        {isOwner && !merged && (
          <Link
            to="/archivos"
            className={worldsItem.filter(Boolean).join(' ')}
            style={{ '--rise': '-7.4rem' } as CSSProperties}
          >
            <Label icon={Folder} text={t('ribbon.files')} />
          </Link>
        )}
        {panelsWorld && (
          <div
            ref={panelsBox}
            className={[
              styles.panels,
              panelsMotion === 'enter' ? styles.panelsEnter : '',
              panelsMotion === 'leave' ? styles.panelsLeave : ''
            ]
              .filter(Boolean)
              .join(' ')}
            inert={panelsMotion === 'leave'}
          >
            <WorldPanels worldId={panelsWorld} />
          </div>
        )}
      </nav>
      {/* Abajo y fijo: lo de arriba puede crecer o no caber (al entrar en un mundo) sin moverlo */}
      <div className={styles.foot}>
        {isOwner && (
          <>
            {/* Se abren encima, sin dejar lo que se está viendo */}
            <button
              type="button"
              className={styles.item}
              aria-haspopup="dialog"
              data-tour="barra-historial"
              onPointerEnter={prefetchHistory}
              onFocus={prefetchHistory}
              onClick={() => windows?.open('historial')}
            >
              <Label icon={History} text={t('ribbon.history')} />
            </button>
            <button
              type="button"
              className={styles.item}
              aria-haspopup="dialog"
              data-tour="barra-papelera"
              onPointerEnter={prefetchTrash}
              onFocus={prefetchTrash}
              onClick={() => windows?.open('papelera')}
            >
              <Label icon={Trash2} text={t('ribbon.trash')} />
            </button>
          </>
        )}
        <nav className={styles.account} aria-label={t('app.accountNav')}>
          <AccountMenu variant="ribbon" />
        </nav>
      </div>
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
