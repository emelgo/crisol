import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  BookOpen,
  Dices,
  Folder,
  Globe,
  Hash,
  History,
  House,
  LayoutTemplate,
  LogOut,
  type LucideIcon,
  ScrollText,
  Settings,
  Shield,
  Swords,
  Trash2,
  User,
  Users
} from 'lucide-react'
import { type CSSProperties, type MouseEvent, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { historyQuery, trashQuery } from '../api/queries.ts'
import { useDice } from '../dice/context.tsx'
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
  // Dentro de una campaña, la barra es la suya (como la de un mundo): su inicio, su compendio y los dados
  const campaignId = useRouterState({
    select: (state) => /^\/mundos\/[^/]+\/campanas\/([^/]+)/.exec(state.location.pathname)?.[1]
  })
  const campaigns = useQuery({
    queryKey: ['campaigns', worldId],
    queryFn: () => api.call('listCampaigns', { worldId: worldId ?? '' }),
    enabled: Boolean(account && worldId && campaignId)
  })
  const campaign = campaigns.data?.campaigns.find((c) => c.id === campaignId)
  // Su papel en la campaña: las criaturas en juego, solo del máster
  const campaignRole = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.call('getCampaign', { campaignId: campaignId ?? '' }),
    enabled: Boolean(account && campaignId)
  }).data?.campaign.role
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
  const prefetchTemplates = () =>
    void queryClient.prefetchQuery({
      queryKey: ['templates'],
      queryFn: () => api.call('listTemplates', {}),
      staleTime: 10_000
    })
  const prefetchSystems = () =>
    void queryClient.prefetchQuery({
      queryKey: ['systems'],
      queryFn: () => api.call('listSystems', {}),
      staleTime: 10_000
    })
  // Al entrar en un mundo, «Mundos» sube a la llama y se funde con ella, que se aviva (el mundo se cocina en el crisol);
  // dentro, la llama es la vuelta. Al volver, «Mundos» sale de la llama, sin fuego
  const inWorld = Boolean(worldId)
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
  // Entrar en una campaña (o volver al mundo): sus iconos salen del crisol, como al entrar en el mundo
  const [panelsCampaign, setPanelsCampaign] = useState(campaignId ?? null)
  if (world && (campaignId ?? null) !== panelsCampaign) {
    setPanelsCampaign(campaignId ?? null)
    setPanelsMotion('enter')
    if (campaignId) setFlame('fire')
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
      <MobileMenu
        world={inWorld && world ? world : null}
        campaign={
          inWorld && world && campaignId
            ? { id: campaignId, name: campaign?.name ?? '', master: campaignRole === 'master' }
            : null
        }
        master={master}
        isOwner={isOwner}
      />
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
            viewTransition={SECTION}
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
            viewTransition={SECTION}
            className={worldsItem.filter(Boolean).join(' ')}
            style={{ '--rise': '-7.4rem' } as CSSProperties}
            data-tour="barra-archivos"
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
            onPointerEnter={prefetchTags}
            onFocus={prefetchTags}
          >
            <Label icon={Hash} text={t('ribbon.tags')} />
          </Link>
        )}
        {/* Las plantillas de página de la cuenta (ADR-0009): fuera de los mundos, como las etiquetas */}
        {isOwner && !merged && (
          <Link
            to="/plantillas"
            viewTransition={SECTION}
            className={worldsItem.filter(Boolean).join(' ')}
            style={{ '--rise': '-15rem' } as CSSProperties}
            data-tour="barra-plantillas"
            onPointerEnter={prefetchTemplates}
            onFocus={prefetchTemplates}
          >
            <Label icon={LayoutTemplate} text={t('ribbon.templates')} />
          </Link>
        )}
        {/* Los sistemas de reglas de la cuenta (ADR-0011), junto a las plantillas */}
        {isOwner && !merged && (
          <Link
            to="/sistemas"
            viewTransition={SECTION}
            className={worldsItem.filter(Boolean).join(' ')}
            style={{ '--rise': '-18.8rem' } as CSSProperties}
            data-tour="barra-sistemas"
            onPointerEnter={prefetchSystems}
            onFocus={prefetchSystems}
          >
            <Label icon={ScrollText} text={t('ribbon.systems')} />
          </Link>
        )}
        {panelsWorld && (
          <div
            key={panelsCampaign ?? panelsWorld}
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
            {panelsCampaign ? (
              <CampaignPanels
                worldId={panelsWorld}
                campaignId={panelsCampaign}
                name={campaign?.name ?? ''}
                master={campaignRole === 'master'}
              />
            ) : (
              <WorldPanels worldId={panelsWorld} worldName={world?.name ?? ''} master={panelsMaster} />
            )}
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

/**
 * Lo de un mundo: su Inicio y, para quien lo dirige, los paneles de su wiki. Fuera de la wiki, abrir uno
 * lleva a ella con ese panel abierto
 */
function WorldPanels({ worldId, worldName, master }: { worldId: string; worldName: string; master: boolean }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  // Lo de cada pestaña se pide al acercarse a su botón: al llegar, ya está (sin un momento en blanco)
  const prefetch = (queryKey: unknown[], queryFn: () => Promise<unknown>) => () =>
    void queryClient.prefetchQuery({ queryKey, queryFn, staleTime: 10_000 })
  const prefetchHome = prefetch(['campaigns', worldId], () => api.call('listCampaigns', { worldId }))
  // Quien lo dirige: sus páginas, buscar y sus marcadores (el mundo se abre en su portada, la primera del árbol)
  if (master) return <WikiPanels worldId={worldId} worldName={worldName} />
  // Quien juega, sin páginas: su Inicio con sus campañas, y los dados
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
      >
        <Label icon={House} text={t('ribbon.home')} />
      </Link>
      <DiceButton />
    </>
  )
}

/**
 * Lo de una campaña, en su propia vista (como un mundo): su inicio (con su nombre), su compendio y los dados, que
 * tiran en ella
 */
function CampaignPanels({
  worldId,
  campaignId,
  name,
  master
}: {
  worldId: string
  campaignId: string
  name: string
  /** Quien la dirige: también lo que está en juego */
  master: boolean
}) {
  const { t } = useTranslation()
  const { setCampaign } = useDice()
  useEffect(() => setCampaign(worldId, campaignId), [setCampaign, worldId, campaignId])
  return (
    <>
      <Link
        to="/mundos/$worldId/campanas/$campaignId"
        params={{ worldId, campaignId }}
        activeOptions={{ exact: true }}
        className={styles.item}
        viewTransition={SECTION}
        data-tour="barra-campana"
      >
        <Label icon={Shield} text={name} />
      </Link>
      <Link
        to="/mundos/$worldId/campanas/$campaignId/personajes"
        params={{ worldId, campaignId }}
        className={styles.item}
        viewTransition={SECTION}
        data-tour="barra-personajes"
      >
        <Label icon={Users} text={t('ribbon.characters')} />
      </Link>
      <Link
        to="/mundos/$worldId/campanas/$campaignId/compendio"
        params={{ worldId, campaignId }}
        className={styles.item}
        viewTransition={SECTION}
        data-tour="barra-compendio"
      >
        <Label icon={BookOpen} text={t('ribbon.compendium')} />
      </Link>
      {master && (
        <Link
          to="/mundos/$worldId/campanas/$campaignId/en-juego"
          params={{ worldId, campaignId }}
          className={styles.item}
          viewTransition={SECTION}
          data-tour="barra-en-juego"
        >
          <Label icon={Swords} text={t('ribbon.inPlay')} />
        </Link>
      )}
      <DiceButton />
    </>
  )
}

/** «Dados»: abre y cierra la ficha de dados del mundo (la excepción a una barra con solo el mundo y Archivos) */
function DiceButton() {
  const { t } = useTranslation()
  const dice = useDice()
  return (
    <button
      type="button"
      className={styles.item}
      aria-pressed={dice.open}
      data-tour="barra-dados"
      onClick={dice.toggle}
    >
      <Label icon={Dices} text={t('ribbon.dice')} />
    </button>
  )
}

/** Los paneles de la wiki de un mundo */
function WikiPanels({ worldId, worldName }: { worldId: string; worldName: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const wikiPanel = useWikiPanel()
  const inWiki = useRouterState({
    select: (state) =>
      new RegExp(`^/mundos/${worldId}(/(wiki/[^/]+|wiki|buscar|etiquetas))?/?$`).test(state.location.pathname)
  })
  const press = (panel: WikiPanel) => (event: MouseEvent<HTMLButtonElement>) => {
    const trigger = event.currentTarget
    if (inWiki) {
      wikiPanel.toggle(panel, trigger)
      return
    }
    wikiPanel.show(panel, trigger)
    // Fuera de las páginas, la portada del mundo con esa vista
    void navigate({ to: '/mundos/$worldId', params: { worldId }, viewTransition: SECTION })
  }
  const narrow = useNarrow()
  // Cada uno abre su panel (o lo recoge si ya está abierto); marcado si es el que se ve: en lo estrecho, con el cajón
  // abierto; en lo ancho, si no está recogido
  const shown = (panel: WikiPanel) =>
    inWiki && wikiPanel.panel === panel && (narrow ? wikiPanel.open : !wikiPanel.collapsed)
  const buttons: { panel: WikiPanel; icon: LucideIcon; text: string; tour: string }[] = [
    // El mundo (sus páginas, con su nombre), las plantillas y los archivos
    { panel: 'pages', icon: Globe, text: worldName, tour: 'barra-wiki' }
  ]
  return (
    <>
      {buttons.map((button) => (
        <button
          key={button.panel}
          type="button"
          className={styles.item}
          aria-pressed={shown(button.panel)}
          data-tour={button.tour}
          onClick={press(button.panel)}
        >
          <Label icon={button.icon} text={button.text} />
        </button>
      ))}
      {/* Los archivos, en su pantalla (como antes) */}
      <Link
        to="/mundos/$worldId/archivos"
        params={{ worldId }}
        className={styles.item}
        viewTransition={SECTION}
        data-tour="barra-archivos-mundo"
      >
        <Label icon={Folder} text={t('ribbon.files')} />
      </Link>
      <DiceButton />
    </>
  )
}

/** La llama de Crisol, como un icono más del menú (Mis mundos sigue siendo la llama, como en la barra) */
function FlameIcon(_: { 'aria-hidden'?: 'true'; size?: number; strokeWidth?: number }) {
  return <CrisolMark size={22} />
}

/**
 * En el móvil, en vez de la barra: la llama, sola, abajo en el centro. Al tocarla sube una hoja con todas las secciones
 * de donde se está (fuera de los mundos, Mis mundos, Archivos, Etiquetas, Historial y Papelera; dentro, las del mundo y
 * la vuelta a Mis mundos) y, debajo, la cuenta
 */
function MobileMenu({
  world,
  campaign,
  master,
  isOwner
}: {
  world: { id: string; name: string } | null
  campaign: { id: string; name: string; master: boolean } | null
  master: boolean
  isOwner: boolean
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const accounts = useAccounts()
  const windows = useWindow()
  const wikiPanel = useWikiPanel()
  const dice = useDice()
  const path = useRouterState({ select: (state) => state.location.pathname })
  const trigger = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [open, setOpen] = useState(false)
  // Cierra la hoja y luego hace lo elegido
  const then = (action: () => void) => () => {
    dialog.current?.close()
    action()
  }
  const go = (to: string) => then(() => void navigate({ to, viewTransition: SECTION } as never))
  type Entry = { key: string; icon: LucideIcon | typeof FlameIcon; text: string; current: boolean; run: () => void }
  const leave: Entry = {
    key: 'mundos',
    icon: FlameIcon,
    text: t('ribbon.worlds'),
    current: false,
    run: then(() => {
      leaveWorld()
      void navigate({ to: '/mundos', viewTransition: LEAVE_WORLD })
    })
  }
  const diceEntry: Entry = {
    key: 'dados',
    icon: Dices,
    text: t('ribbon.dice'),
    current: dice.open,
    run: then(() => {
      if (!dice.open) dice.toggle()
    })
  }
  const entries: Entry[] =
    world && campaign
      ? [
          leave,
          {
            key: 'campana',
            icon: Shield,
            text: campaign.name,
            current: path === `/mundos/${world.id}/campanas/${campaign.id}`,
            run: go(`/mundos/${world.id}/campanas/${campaign.id}`)
          },
          {
            key: 'personajes',
            icon: Users,
            text: t('ribbon.characters'),
            current: path.startsWith(`/mundos/${world.id}/campanas/${campaign.id}/personajes`),
            run: go(`/mundos/${world.id}/campanas/${campaign.id}/personajes`)
          },
          {
            key: 'compendio',
            icon: BookOpen,
            text: t('ribbon.compendium'),
            current: path.startsWith(`/mundos/${world.id}/campanas/${campaign.id}/compendio`),
            run: go(`/mundos/${world.id}/campanas/${campaign.id}/compendio`)
          },
          // Las criaturas en juego: del máster (hasta el módulo 5)
          ...(campaign.master
            ? [
                {
                  key: 'en-juego',
                  icon: Swords,
                  text: t('ribbon.inPlay'),
                  current: path.startsWith(`/mundos/${world.id}/campanas/${campaign.id}/en-juego`),
                  run: go(`/mundos/${world.id}/campanas/${campaign.id}/en-juego`)
                }
              ]
            : []),
          diceEntry
        ]
      : world
        ? [
            {
              key: 'mundos',
              icon: FlameIcon,
              text: t('ribbon.worlds'),
              current: false,
              run: then(() => {
                leaveWorld()
                void navigate({ to: '/mundos', viewTransition: LEAVE_WORLD })
              })
            },
            // «Inicio», solo para quien juega (quien lo dirige tiene sus páginas, que se abren en la portada)
            ...(master
              ? []
              : [
                  {
                    key: 'inicio',
                    icon: House,
                    text: t('ribbon.home'),
                    current: path === `/mundos/${world.id}`,
                    run: go(`/mundos/${world.id}`)
                  }
                ]),
            ...(master
              ? [
                  ...(['pages'] as const).map((panel) => ({
                    key: panel,
                    icon: Globe,
                    text: world.name,
                    current: wikiPanel.open && wikiPanel.panel === panel,
                    // Abre el cajón con esa vista (y, si no se está en las páginas, la portada del mundo)
                    run: then(() => {
                      wikiPanel.show(panel, trigger.current)
                      if (!/^\/mundos\/[^/]+(\/(wiki\/[^/]+|buscar))?\/?$/.test(path)) {
                        void navigate({
                          to: '/mundos/$worldId',
                          params: { worldId: world.id },
                          viewTransition: SECTION
                        })
                      }
                    })
                  })),
                  {
                    key: 'archivos',
                    icon: Folder,
                    text: t('ribbon.files'),
                    current: path === `/mundos/${world.id}/archivos`,
                    run: go(`/mundos/${world.id}/archivos`)
                  }
                ]
              : []),
            // Los dados: la hoja de dados sube desde abajo
            {
              key: 'dados',
              icon: Dices,
              text: t('ribbon.dice'),
              current: dice.open,
              run: then(() => {
                if (!dice.open) dice.toggle()
              })
            }
          ]
        : [
            {
              key: 'mundos',
              icon: FlameIcon,
              text: t('ribbon.worlds'),
              current: path === '/mundos',
              run: go('/mundos')
            },
            ...(isOwner
              ? [
                  {
                    key: 'archivos',
                    icon: Folder,
                    text: t('ribbon.files'),
                    current: path === '/archivos',
                    run: go('/archivos')
                  },
                  {
                    key: 'etiquetas',
                    icon: Hash,
                    text: t('ribbon.tags'),
                    current: path === '/etiquetas',
                    run: go('/etiquetas')
                  },
                  {
                    key: 'plantillas',
                    icon: LayoutTemplate,
                    text: t('ribbon.templates'),
                    current: path.startsWith('/plantillas'),
                    run: go('/plantillas')
                  },
                  {
                    key: 'sistemas',
                    icon: ScrollText,
                    text: t('ribbon.systems'),
                    current: path.startsWith('/sistemas'),
                    run: go('/sistemas')
                  }
                ]
              : [])
          ]
  if (isOwner) {
    entries.push(
      {
        key: 'historial',
        icon: History,
        text: t('ribbon.history'),
        current: false,
        run: then(() => windows?.open('historial', trigger.current))
      },
      {
        key: 'papelera',
        icon: Trash2,
        text: t('ribbon.trash'),
        current: false,
        run: then(() => windows?.open('papelera', trigger.current))
      }
    )
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`${styles.menuButton} ${styles.mobileOnly}`}
        aria-label={t('ribbon.menu')}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-tour="menu-movil"
        onClick={() => setOpen(true)}
      >
        <CrisolMark size={26} />
      </button>
      {open && (
        <Modal
          ref={dialog}
          aria-labelledby={titleId}
          className={`${dialogStyles.dialog} ${styles.menu}`}
          onClose={() => setOpen(false)}
        >
          <h2 id={titleId} className={styles.menuTitle}>
            {world ? world.name : t('app.name')}
          </h2>
          <ul className={styles.menuGrid}>
            {entries.map((entry) => (
              <li key={entry.key}>
                <button
                  type="button"
                  className={styles.menuTile}
                  aria-current={entry.current ? 'page' : undefined}
                  onClick={entry.run}
                >
                  <entry.icon aria-hidden="true" size={22} strokeWidth={1.75} />
                  {entry.text}
                </button>
              </li>
            ))}
          </ul>
          <ul className={styles.moreList}>
            <li>
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
