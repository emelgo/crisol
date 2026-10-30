import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  BookOpen,
  Ellipsis,
  Folder,
  Globe,
  Hash,
  History,
  House,
  LogOut,
  type LucideIcon,
  Settings,
  Swords,
  Trash2,
  User
} from 'lucide-react'
import { type CSSProperties, type MouseEvent, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { historyQuery, trashQuery } from '../api/queries.ts'
import { useNarrow, useWikiPanel, type WikiPanel } from '../wiki/panel.tsx'
import { AccountMenu } from './account-menu.tsx'
import { CrisolMark } from './brand.tsx'
import dialogStyles from './dialog.module.css'
import { Modal } from './modal.tsx'
import styles from './ribbon.module.css'
import { useWindow } from './window.tsx'
import { LEAVE_WORLD, leaveWorld, SECTION } from './world-transition.ts'

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

/** El mundo en el que se está, si lo dirige la cuenta (su historial, su papelera y su wiki son suyos) */
export function useMasteredWorld() {
  const api = useApi()
  const { account } = useAccounts().useAccount()
  const worldId = useRouterState({ select: (state) => /^\/mundos\/([^/]+)/.exec(state.location.pathname)?.[1] })
  const worlds = useQuery({
    queryKey: ['worlds'],
    queryFn: () => api.call('listWorlds', {}),
    enabled: Boolean(account && worldId)
  })
  return worlds.data?.worlds.find((w) => w.id === worldId && w.role === 'master')?.id
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
 * La barra de la izquierda, como en el Crisol antiguo: Mundos, los archivos comunes y las etiquetas de la cuenta;
 * dentro de un mundo que llevas, sus paneles (la wiki abre el panel lateral; archivos, su pantalla); abajo, lo del
 * propietario, el tema y la cuenta. La sección actual lleva aria-current (lo pone el Link) o aria-pressed
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
  const world = worlds.data?.worlds.find((w) => w.id === worldId)
  // La wiki es solo de quien administra el mundo (hasta el módulo 5); dentro de él, su historial y su papelera
  const master = world?.role === 'master'
  // Historial y Papelera se piden en cuanto el ratón (o el foco) llega a su botón: al abrirlos, ya están
  const queryClient = useQueryClient()
  const scope = master && world ? { worldId: world.id } : {}
  const prefetchHistory = () =>
    void queryClient.prefetchInfiniteQuery({ ...historyQuery(api, scope), staleTime: 10_000 })
  const prefetchTrash = () => void queryClient.prefetchQuery({ ...trashQuery(api, scope), staleTime: 10_000 })
  const prefetchCommon = () =>
    void queryClient.prefetchQuery({
      queryKey: ['commonFiles'],
      queryFn: () => api.call('listCommonFiles', {}),
      staleTime: 10_000
    })
  const prefetchTags = () =>
    void queryClient.prefetchQuery({
      queryKey: ['tags'],
      queryFn: () => api.call('listAccountTags', {}),
      staleTime: 10_000
    })
  // Al entrar en un mundo, «Mundos» sube a la llama y se funde con ella, que se aviva (el mundo se cocina en el crisol);
  // dentro, la llama es la vuelta. Al volver, «Mundos» sale de la llama, sin fuego
  const inWorld = Boolean(worldId)
  const narrow = useNarrow()
  const [wasInWorld, setWasInWorld] = useState(inWorld)
  // Recién entrado (en este mismo pintado aún no se ve en phase)
  const justEntered = inWorld && !wasInWorld
  const [phase, setPhase] = useState<'still' | 'merging' | 'emerging'>('still')
  // La llama: al entrar, se aviva y suelta chispas; al salir, se aplaca y echa humo. Con su propio tiempo, más largo
  // que el de «Mundos»
  const [flame, setFlame] = useState<'still' | 'fire' | 'smoke'>('still')
  if (inWorld !== wasInWorld) {
    setWasInWorld(inWorld)
    setPhase(inWorld ? 'merging' : 'emerging')
    setFlame(inWorld ? 'fire' : 'smoke')
  }
  // Por si la animación no acaba (en el móvil no la hay): se queda quieto al rato
  useEffect(() => {
    if (phase === 'still') return
    const timer = window.setTimeout(() => setPhase('still'), 1300)
    return () => window.clearTimeout(timer)
  }, [phase])
  useEffect(() => {
    if (flame === 'still') return
    const timer = window.setTimeout(() => setFlame('still'), flame === 'fire' ? 3000 : 3400)
    return () => window.clearTimeout(timer)
  }, [flame])
  // Los iconos del mundo (Inicio, Campañas, Páginas… y los que vengan): al entrar, salen del crisol uno tras otro
  // cuando «Mundos» ya se ha fundido; al volver, suben a él y se van antes de que salga «Mundos». Se quedan (todos)
  // mientras se van
  const [panelsWorld, setPanelsWorld] = useState(world?.id ?? null)
  const [panelsMaster, setPanelsMaster] = useState(master)
  const [panelsMotion, setPanelsMotion] = useState<'none' | 'enter' | 'leave'>('none')
  if (world && world.id !== panelsWorld) {
    setPanelsWorld(world.id)
    setPanelsMotion(justEntered || phase === 'merging' ? 'enter' : 'none')
  }
  if (world && master !== panelsMaster) setPanelsMaster(master)
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
          activeOptions={{ exact: true }}
          className={[styles.brand, flame === 'fire' ? styles.cooking : '', flame === 'smoke' ? styles.smoking : '']
            .filter(Boolean)
            .join(' ')}
          // Dentro de un mundo, salir de él; fuera, como «Mundos»: el cambio rápido de sección
          {...(inWorld ? { viewTransition: LEAVE_WORLD, onClick: leaveWorld } : { viewTransition: SECTION })}
          data-tour="barra-llama"
          data-slot="3"
          aria-label={t('app.name')}
          translate="no"
        >
          <CrisolMark size={26} />
          <span className={styles.brandText} aria-hidden="true">
            {t('app.name')}
          </span>
        </Link>
        {/* Ya fundidos con la llama (dentro de un mundo), «Mundos» y los archivos comunes no están */}
        {merged ? null : (
          <Link
            to="/mundos"
            activeOptions={{ exact: true }}
            viewTransition={SECTION}
            className={[...worldsItem, styles.desktopOnly].filter(Boolean).join(' ')}
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
            viewTransition={SECTION}
            className={worldsItem.filter(Boolean).join(' ')}
            style={{ '--rise': '-7.4rem' } as CSSProperties}
            data-tour="barra-archivos"
            data-slot="1"
            // Se piden al acercarse: al llegar, ya están
            onPointerEnter={prefetchCommon}
            onFocus={prefetchCommon}
          >
            <Label icon={Folder} text={t('ribbon.files')} />
          </Link>
        )}
        {/* Las etiquetas de la cuenta (ADR-0006): fuera de los mundos; dentro, se filtra por ellas en la wiki y los
            archivos */}
        {isOwner && !merged && (
          <Link
            to="/etiquetas"
            viewTransition={SECTION}
            className={worldsItem.filter(Boolean).join(' ')}
            style={{ '--rise': '-11.2rem' } as CSSProperties}
            data-tour="barra-etiquetas"
            data-slot="2"
            onPointerEnter={prefetchTags}
            onFocus={prefetchTags}
          >
            <Label icon={Hash} text={t('ribbon.tags')} />
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
            data-tour="barra-mundo"
          >
            <WorldPanels worldId={panelsWorld} master={panelsMaster} />
          </div>
        )}
        {/* En el móvil, fuera de los mundos, el historial cabe en la barra (dentro, va en «Más») */}
        {isOwner && !inWorld && narrow && (
          <button
            type="button"
            className={`${styles.item} ${styles.mobileOnly}`}
            data-slot="4"
            aria-haspopup="dialog"
            onClick={() => windows?.open('historial')}
          >
            <Label icon={History} text={t('ribbon.history')} />
          </button>
        )}
        <MoreSheet worldId={inWorld && master && world ? world.id : null} isOwner={isOwner} history={inWorld} />
      </nav>
      {/* Abajo y fijo: lo de arriba puede crecer o no caber (al entrar en un mundo) sin moverlo */}
      <div className={`${styles.foot} ${styles.desktopOnly}`}>
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

/**
 * Lo de un mundo: su Inicio, sus campañas y, para quien lo dirige, los paneles de su wiki. Fuera de la wiki, abrir uno
 * lleva a ella con ese panel abierto
 */
function WorldPanels({ worldId, master }: { worldId: string; master: boolean }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  // Lo de cada pestaña se pide al acercarse a su botón: al llegar, ya está (sin un momento en blanco)
  const prefetch = (queryKey: unknown[], queryFn: () => Promise<unknown>) => () =>
    void queryClient.prefetchQuery({ queryKey, queryFn, staleTime: 10_000 })
  const prefetchHome = master
    ? prefetch(['pages', worldId, 'recent'], () => api.call('listRecentPages', { worldId }))
    : prefetch(['campaigns', worldId], () => api.call('listCampaigns', { worldId }))
  const prefetchCampaigns = prefetch(['campaigns', worldId], () => api.call('listCampaigns', { worldId }))
  return (
    <>
      <Link
        to="/mundos/$worldId"
        params={{ worldId }}
        activeOptions={{ exact: true }}
        className={styles.item}
        viewTransition={SECTION}
        onPointerEnter={prefetchHome}
        onFocus={prefetchHome}
        data-tour="barra-inicio"
        data-slot="1"
      >
        <Label icon={House} text={t('ribbon.home')} />
      </Link>
      <Link
        to="/mundos/$worldId/campanas"
        params={{ worldId }}
        className={styles.item}
        viewTransition={SECTION}
        onPointerEnter={prefetchCampaigns}
        onFocus={prefetchCampaigns}
        data-tour="barra-campanas"
        data-slot="2"
      >
        <Label icon={Swords} text={t('ribbon.campaigns')} />
      </Link>
      {master && <WikiPanels worldId={worldId} />}
    </>
  )
}

/** Los paneles de la wiki de un mundo */
function WikiPanels({ worldId }: { worldId: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const prefetchFiles = () =>
    void queryClient.prefetchQuery({
      queryKey: ['files', worldId],
      queryFn: () => api.call('listFiles', { worldId }),
      staleTime: 10_000
    })
  const navigate = useNavigate()
  const wikiPanel = useWikiPanel()
  const inWiki = useRouterState({
    select: (state) => new RegExp(`^/mundos/${worldId}/(wiki|buscar|etiquetas)`).test(state.location.pathname)
  })
  const press = (panel: WikiPanel) => (event: MouseEvent<HTMLButtonElement>) => {
    const trigger = event.currentTarget
    if (inWiki) {
      wikiPanel.toggle(panel, trigger)
      return
    }
    wikiPanel.show(panel, trigger)
    void navigate({ to: '/mundos/$worldId/wiki', params: { worldId }, viewTransition: SECTION })
  }
  const narrow = useNarrow()
  // Marcado si se ve su panel: en lo estrecho, con el cajón abierto; en lo ancho, si no está recogido
  // La wiki: abre su panel (páginas; buscar y marcadores, en sus pestañas)
  return (
    <>
      <button
        type="button"
        className={styles.item}
        aria-pressed={inWiki && (narrow ? wikiPanel.open : !wikiPanel.collapsed)}
        data-tour="barra-wiki"
        data-slot="4"
        onClick={press(inWiki ? wikiPanel.panel : 'pages')}
      >
        <Label icon={BookOpen} text={t('ribbon.wiki')} />
      </button>
      <Link
        to="/mundos/$worldId/archivos"
        params={{ worldId }}
        className={`${styles.item} ${styles.desktopOnly}`}
        viewTransition={SECTION}
        onPointerEnter={prefetchFiles}
        onFocus={prefetchFiles}
        data-tour="barra-archivos-mundo"
      >
        <Label icon={Folder} text={t('ribbon.files')} />
      </Link>
    </>
  )
}

/**
 * En el móvil, «Más»: lo que no cabe en la barra de abajo (de un mundo, sus archivos; el historial, la
 * papelera y la cuenta), en una hoja que sube desde abajo
 */
function MoreSheet({
  worldId,
  isOwner,
  history
}: {
  worldId: string | null
  isOwner: boolean
  /** Si lleva el historial (fuera de los mundos va en la barra) */
  history: boolean
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const accounts = useAccounts()
  const { account } = accounts.useAccount()
  const windows = useWindow()
  const trigger = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [open, setOpen] = useState(false)
  // Cierra la hoja y luego hace lo elegido
  const then = (action: () => void) => () => {
    dialog.current?.close()
    action()
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`${styles.item} ${styles.mobileOnly}`}
        data-slot="5"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Label icon={Ellipsis} text={t('ribbon.more')} />
      </button>
      {open && (
        <Modal
          ref={dialog}
          aria-labelledby={titleId}
          className={`${dialogStyles.dialog} ${styles.more}`}
          onClose={() => setOpen(false)}
        >
          <h2 id={titleId} className={styles.moreTitle}>
            {account?.name}
          </h2>
          <ul className={styles.moreList}>
            {worldId && (
              <li>
                <button
                  type="button"
                  onClick={then(() => void navigate({ to: '/mundos/$worldId/archivos', params: { worldId } }))}
                >
                  <Folder aria-hidden="true" size={18} />
                  {t('ribbon.files')}
                </button>
              </li>
            )}
            {isOwner && (
              <>
                {history && (
                  <li>
                    <button type="button" onClick={then(() => windows?.open('historial', trigger.current))}>
                      <History aria-hidden="true" size={18} />
                      {t('ribbon.history')}
                    </button>
                  </li>
                )}
                <li>
                  <button type="button" onClick={then(() => windows?.open('papelera', trigger.current))}>
                    <Trash2 aria-hidden="true" size={18} />
                    {t('ribbon.trash')}
                  </button>
                </li>
              </>
            )}
            <li className={styles.moreSeparated}>
              <button type="button" onClick={then(() => windows?.open('perfil', trigger.current))}>
                <User aria-hidden="true" size={18} />
                {t('profile.title')}
              </button>
            </li>
            <li>
              <button type="button" onClick={then(() => windows?.open('ajustes', trigger.current))}>
                <Settings aria-hidden="true" size={18} />
                {t('settings.title')}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={then(async () => {
                  await accounts.signOut()
                  await navigate({ to: '/entrar' })
                })}
              >
                <LogOut aria-hidden="true" size={18} />
                {t('account.signOut')}
              </button>
            </li>
          </ul>
        </Modal>
      )}
    </>
  )
}
