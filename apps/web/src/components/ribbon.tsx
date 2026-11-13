import type { SystemSummary } from '@crisol/contracts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  BookOpen,
  Flag,
  Folder,
  Globe,
  Hash,
  History,
  House,
  Layers,
  LayoutTemplate,
  LogOut,
  type LucideIcon,
  MountainSnow,
  NotebookPen,
  Scale,
  ScrollText,
  Settings,
  Shield,
  Trash2,
  User
} from 'lucide-react'
import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useDice } from '../dice/context.tsx'
import { shownPath } from '../shown-path.ts'
import { SystemWindow } from '../systems/screen.tsx'
import { SystemIcon, systemCoverUrl } from '../systems/system-look.tsx'
import { useNarrow, useWikiPanel, type WikiPanel } from '../wiki/panel.tsx'
import { AccountMenu } from './account-menu.tsx'
import { useAmbient } from './ambient.tsx'
import { CrisolMark } from './brand.tsx'
import crucible from './crucible.module.css'
import dialogStyles from './dialog.module.css'
import { Modal } from './modal.tsx'
import styles from './ribbon.module.css'
import { spaceOf } from './spaces.ts'
import { useWindow } from './window.tsx'
import { useHistoryAndTrash, useIsOwner } from './world-hooks.ts'
import { justLeftFull, LEAVE_ITEM, LEAVE_WORLD, leaveItem, leaveWorld, SECTION, smoke } from './world-transition.ts'

/** Lo que tarda cada icono del mundo en salir del crisol (o en subir a él) y el paso entre uno y otro: aquí y solo aquí
 * (el nav se los pasa al CSS como --icon-time y --icon-step) */
const ICON_TIME = 460
const ICON_STEP = 70

/** Lo que va dentro de cada botón: el icono y su nombre debajo, que se entienda sin pasar el ratón */
function Label({ icon: Icon, glyph, text }: { icon: LucideIcon; glyph?: ReactNode; text: string }) {
  return (
    <>
      {glyph ?? <Icon aria-hidden="true" size={20} strokeWidth={1.75} />}
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
  const worldId = useRouterState({ select: (state) => /^\/mundos\/([^/]+)/.exec(shownPath(state))?.[1] })
  const worlds = useQuery({
    queryKey: ['worlds'],
    queryFn: () => api.call('listWorlds', {}),
    enabled: Boolean(account && worldId)
  })
  const world = worlds.data?.worlds.find((w) => w.id === worldId)
  // Un sistema abierto: la barra es la suya, como la de un mundo (components/spaces.ts)
  const systemId = useRouterState({
    select: (state) => {
      const space = spaceOf(shownPath(state))
      return space?.kind === 'system' ? space.id : undefined
    }
  })
  const systems = useQuery({
    queryKey: ['systems'],
    queryFn: () => api.call('listSystems', {}),
    enabled: Boolean(account && systemId)
  })
  const system = systems.data?.systems.find((each) => each.id === systemId)
  const [systemSettings, setSystemSettings] = useState(false)
  const navigate = useNavigate()
  // Una plantilla abierta: «Plantillas» vuelve a la lista como «‹ Plantillas» (su icono y su nombre, a su tarjeta)
  const openTemplate = useRouterState({
    select: (state) => /^\/plantillas\/([^/]+)/.exec(shownPath(state))?.[1]
  })
  // Dentro de una campaña, la barra es la suya (como la de un mundo): su inicio, su compendio y los dados
  const campaignId = useRouterState({
    select: (state) => /^\/mundos\/[^/]+\/campanas\/([^/]+)/.exec(shownPath(state))?.[1]
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
  const { prefetchHistory, prefetchTrash, openHistory, openTrash } = useHistoryAndTrash(
    master && world ? world.id : undefined
  )
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
  // En un espacio (un mundo o un sistema): lo de la cuenta sube a la llama y salen sus iconos
  const inWorld = Boolean(worldId || systemId)
  const [wasInWorld, setWasInWorld] = useState(inWorld)
  // Recién entrado (en este mismo pintado aún no se ve en phase)
  const justEntered = inWorld && !wasInWorld
  // Recién salido de un mundo a pantalla completa (ADR-0027): la barra vuelve y, como antes, la llama expulsa a
  // «Mundos» cuando los iconos del mundo ya han subido, y echa humo
  const [returning] = useState(justLeftFull)
  const [phase, setPhase] = useState<'still' | 'merging' | 'emerging'>(returning ? 'emerging' : 'still')
  const sections = useRef<HTMLElement>(null)
  // La llama: al entrar, se aviva y suelta chispas; al salir, se aplaca y echa humo. Con su propio tiempo, más largo
  // que el de «Mundos»
  const [flame, setFlame] = useState<'still' | 'fire' | 'smoke'>(returning ? 'smoke' : 'still')
  useLayoutEffect(() => {
    if (returning) sections.current?.style.setProperty('--leave', `${returning.leave}ms`)
  }, [returning])
  if (inWorld !== wasInWorld) {
    setWasInWorld(inWorld)
    setPhase(inWorld ? 'merging' : 'emerging')
    setFlame(inWorld ? 'fire' : 'smoke')
  }
  // Por si la animación no acaba (en el móvil no la hay): se queda quieto al rato
  useEffect(() => {
    if (phase === 'still') return
    const timer = window.setTimeout(() => setPhase('still'), 2600)
    return () => window.clearTimeout(timer)
  }, [phase])
  useEffect(() => {
    if (flame === 'still') return
    const timer = window.setTimeout(
      () => {
        setFlame('still')
        sections.current?.style.removeProperty('--leave')
      },
      flame === 'fire' ? 3000 : 4500
    )
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
  // Los del sistema, igual
  const [panelsSystem, setPanelsSystem] = useState(systemId ?? null)
  if (systemId && systemId !== panelsSystem) {
    setPanelsSystem(systemId)
    setPanelsMotion(justEntered || phase === 'merging' ? 'enter' : 'none')
  }
  if (!world && panelsWorld && panelsMotion !== 'leave') setPanelsMotion('leave')
  if (!systemId && panelsSystem && panelsMotion !== 'leave') setPanelsMotion('leave')
  const panelsBox = useRef<HTMLDivElement>(null)
  // Al volver, el espejo de entrar: los iconos suben al crisol del último al primero, al mismo paso y con la misma
  // duración con que salieron, y después sale «Mundos» (--leave: cuánto tardan en subir todos). Antes de pintar, para
  // que «Mundos» empiece ya esperando
  useLayoutEffect(() => {
    if (panelsMotion !== 'leave') return
    // Sin animaciones (las pruebas), al momento; si no, cuando el último ya se ha ido
    const gone = () => {
      setPanelsWorld(null)
      setPanelsSystem(null)
    }
    if (typeof panelsBox.current?.getAnimations !== 'function') return gone()
    const icons = panelsBox.current.childElementCount
    const leave = icons > 0 ? (icons - 1) * ICON_STEP + ICON_TIME : 0
    sections.current?.style.setProperty('--leave', `${leave}ms`)
    const timer = window.setTimeout(gone, leave)
    return () => window.clearTimeout(timer)
  }, [panelsMotion])
  // Cuánto sube cada uno («Mundos» y lo de la cuenta) hasta el centro de la llama: se mide al fundirse (aún en su
  // sitio) y se guarda para cuando vuelvan a salir de ella, que llegan cerrados; sin medida, la que lleva escrita
  const rises = useRef(new Map<string, string>())
  useLayoutEffect(() => {
    if (phase === 'still') return
    const brand = sections.current?.querySelector('[data-tour="barra-llama"]')?.getBoundingClientRect()
    if (!brand) return
    const flame = brand.top + brand.height / 2
    for (const item of sections.current?.querySelectorAll<HTMLElement>('[data-rise]') ?? []) {
      const key = item.dataset.tour ?? ''
      if (phase === 'merging') {
        const at = item.getBoundingClientRect()
        rises.current.set(key, `${Math.round(flame - (at.top + at.height / 2))}px`)
      }
      const rise = rises.current.get(key)
      if (rise) item.style.setProperty('--rise', rise)
    }
  }, [phase])
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
      />
      <nav
        ref={sections}
        className={styles.sections}
        aria-label={t('app.sectionsNav')}
        style={{ '--icon-time': `${ICON_TIME}ms`, '--icon-step': `${ICON_STEP}ms` } as CSSProperties}
      >
        <Link
          // Dentro de un sistema, la llama vuelve a Sistemas; si no, a Mis mundos
          to={systemId ? '/sistemas' : '/mundos'}
          activeOptions={{ exact: true }}
          className={[styles.brand, flame === 'fire' ? crucible.cooking : '', flame === 'smoke' ? crucible.smoking : '']
            .filter(Boolean)
            .join(' ')}
          // Dentro de un mundo, salir de él; de un sistema, al revés que al entrar (su icono y su nombre vuelven a su
          // tarjeta) y con humo; fuera, como «Mundos»: el cambio rápido de sección
          {...(systemId
            ? {
                viewTransition: LEAVE_ITEM,
                onClick: () => {
                  leaveItem(systemId, document.getElementById('contenido'))
                  smoke()
                }
              }
            : inWorld
              ? { viewTransition: LEAVE_WORLD, onClick: leaveWorld }
              : { viewTransition: SECTION })}
          data-tour="barra-llama"
          aria-label={t('app.name')}
          translate="no"
        >
          <CrisolMark size={26} />
        </Link>
        {/* Ya fundidos con la llama (dentro de un mundo), «Mundos» y lo demás de la cuenta no están */}
        {merged ? null : (
          <Link
            to="/mundos"
            activeOptions={{ exact: true }}
            viewTransition={SECTION}
            className={worldsItem.filter(Boolean).join(' ')}
            data-tour="barra-mundos"
            data-rise=""
            onAnimationEnd={() => setPhase('still')}
          >
            <Label icon={Globe} text={t('ribbon.worlds')} />
          </Link>
        )}
        {/* Las plantillas de página de la cuenta (ADR-0009): fuera de los mundos, tras «Mundos» */}
        {isOwner && !merged && (
          <Link
            to="/plantillas"
            viewTransition={openTemplate ? LEAVE_ITEM : SECTION}
            onClick={() => {
              if (openTemplate) leaveItem(openTemplate, document.getElementById('contenido'))
            }}
            className={worldsItem.filter(Boolean).join(' ')}
            style={{ '--rise': '-7.4rem' } as CSSProperties}
            data-tour="barra-plantillas"
            data-rise=""
            onPointerEnter={prefetchTemplates}
            onFocus={prefetchTemplates}
          >
            <Label icon={LayoutTemplate} text={t('ribbon.templates')} />
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
            data-rise=""
            onPointerEnter={prefetchTags}
            onFocus={prefetchTags}
          >
            <Label icon={Hash} text={t('ribbon.tags')} />
          </Link>
        )}
        {/* Los sistemas de reglas de la cuenta (ADR-0011), tras las etiquetas */}
        {isOwner && !merged && (
          <Link
            to="/sistemas"
            viewTransition={SECTION}
            className={worldsItem.filter(Boolean).join(' ')}
            style={{ '--rise': '-15rem' } as CSSProperties}
            data-tour="barra-sistemas"
            data-rise=""
            onPointerEnter={prefetchSystems}
            onFocus={prefetchSystems}
          >
            <Label icon={ScrollText} text={t('ribbon.systems')} />
          </Link>
        )}
        {/* Los archivos comunes de la cuenta: fuera de los mundos; dentro, en los «Archivos» de cada uno (ADR-0005).
            El último de la barra (Enrique, 2026-11-11). Al entrar en un mundo sube a la llama con «Mundos», desde más
            abajo */}
        {isOwner && !merged && (
          <Link
            to="/archivos"
            viewTransition={SECTION}
            className={worldsItem.filter(Boolean).join(' ')}
            style={{ '--rise': '-18.8rem' } as CSSProperties}
            data-tour="barra-archivos"
            data-rise=""
            // Se piden al acercarse: al llegar, ya están
            onPointerEnter={prefetchCommon}
            onFocus={prefetchCommon}
          >
            <Label icon={Folder} text={t('ribbon.files')} />
          </Link>
        )}
        {(panelsWorld || panelsSystem) && (
          <div
            key={panelsSystem ?? panelsCampaign ?? panelsWorld ?? ''}
            ref={panelsBox}
            className={[
              styles.panels,
              crucible.emerge,
              panelsMotion === 'enter' ? crucible.emergeIn : '',
              panelsMotion === 'leave' ? crucible.emergeOut : ''
            ]
              .filter(Boolean)
              .join(' ')}
            inert={panelsMotion === 'leave'}
            data-tour="barra-mundo"
          >
            {panelsSystem ? (
              <SystemPanels
                systemId={panelsSystem}
                name={system?.name ?? ''}
                icon={system?.icon ?? null}
                cover={system ?? null}
              />
            ) : panelsCampaign && panelsWorld ? (
              <CampaignPanels
                worldId={panelsWorld}
                campaignId={panelsCampaign}
                name={campaign?.name ?? ''}
                master={campaignRole === 'master'}
              />
            ) : panelsWorld ? (
              <WorldPanels worldId={panelsWorld} worldName={world?.name ?? ''} master={panelsMaster} />
            ) : null}
          </div>
        )}
      </nav>
      {/* Abajo y fijo: lo de arriba puede crecer o no caber (al entrar en un mundo) sin moverlo */}
      <div className={styles.foot}>
        {/* También en la campaña: el historial y la papelera de su mundo */}
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
              onClick={() => openHistory()}
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
              onClick={() => openTrash()}
            >
              <Label icon={Trash2} text={t('ribbon.trash')} />
            </button>
          </>
        )}
        {/* Los ajustes del sistema: su ventana, encima (los de serie no se cambian) */}
        {panelsSystem && system && !system.builtIn && (
          <button
            type="button"
            className={styles.item}
            aria-haspopup="dialog"
            data-tour="barra-ajustes-sistema"
            onClick={() => setSystemSettings(true)}
          >
            <Label icon={Settings} text={t('ribbon.systemSettings')} />
          </button>
        )}
        {systemSettings && system && (
          <SystemWindow
            system={system}
            onClose={(gone) => {
              setSystemSettings(false)
              if (gone) void navigate({ to: '/sistemas', viewTransition: LEAVE_WORLD })
            }}
          />
        )}
        {/* Los ajustes de la campaña: se abren encima (ADR-0021) */}
        {panelsCampaign && campaignRole === 'master' && (
          <button
            type="button"
            className={styles.item}
            aria-haspopup="dialog"
            data-tour="barra-ajustes-campana"
            onClick={(event) => windows?.open('campana', event.currentTarget)}
          >
            <Label icon={Settings} text={t('ribbon.campaignSettings')} />
          </button>
        )}
        <nav className={styles.account} aria-label={t('app.accountNav')}>
          <AccountMenu variant="ribbon" />
        </nav>
      </div>
    </div>
  )
}

/**
 * Lo de un sistema (su espacio, revisión tanda 6): su Inicio (la portada y los libros) y sus Reglas (el editor a mano,
 * tanda 8). El compendio, con el libro por dentro
 */
function SystemPanels({
  systemId,
  name,
  icon,
  cover
}: {
  systemId: string
  name: string
  icon: string | null
  cover: Pick<SystemSummary, 'cover'> | null
}) {
  const { t } = useTranslation()
  // Su portada, detrás, en todo su espacio (no solo en su Inicio): la barra vive mientras se está en él
  useAmbient(cover ? systemCoverUrl(cover) : null)
  // Dentro de un libro, también se está en su compendio
  const inBook = useRouterState({ select: (state) => shownPath(state).startsWith(`/sistemas/${systemId}/libros/`) })
  return (
    <>
      <Link
        to="/sistemas/$systemId"
        params={{ systemId }}
        activeOptions={{ exact: true }}
        className={styles.item}
        viewTransition={SECTION}
        data-tour="barra-inicio"
      >
        <Label icon={ScrollText} glyph={<SystemIcon icon={icon} size={20} />} text={name || t('ribbon.home')} />
      </Link>
      <Link
        to="/sistemas/$systemId/compendio"
        params={{ systemId }}
        className={styles.item}
        viewTransition={SECTION}
        data-tour="barra-compendio"
        {...(inBook ? { 'aria-current': 'page' as const } : {})}
      >
        <Label icon={BookOpen} text={t('ribbon.compendium')} />
      </Link>
      <Link
        to="/sistemas/$systemId/reglas"
        params={{ systemId }}
        className={styles.item}
        viewTransition={SECTION}
        data-tour="barra-reglas"
      >
        <Label icon={Scale} text={t('ribbon.rules')} />
      </Link>
    </>
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
  )
}

/**
 * Lo de una campaña, en su propio espacio (ADR-0021): ella, con su nombre (su Inicio), Mesa (con sus
 * personajes), Libros, Compendio y Aventuras; quien juega, sin Libros ni Aventuras. Las páginas del mundo, en la Mesa
 * (Enrique, 2026-11-10: «en la campaña solo gestionamos las cosas de la campaña»). Los dados tiran en ella
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
  master: boolean
}) {
  const { t } = useTranslation()
  const { setCampaign } = useDice()
  useEffect(() => setCampaign(worldId, campaignId), [setCampaign, worldId, campaignId])
  const params = { worldId, campaignId }
  type Section = {
    to:
      | '/mundos/$worldId/campanas/$campaignId'
      | '/mundos/$worldId/campanas/$campaignId/personajes'
      | '/mundos/$worldId/campanas/$campaignId/libros'
      | '/mundos/$worldId/campanas/$campaignId/compendio'
      | '/mundos/$worldId/campanas/$campaignId/aventuras'
      | '/mundos/$worldId/campanas/$campaignId/notas'
    icon: LucideIcon
    text: string
    tour: string
    exact?: boolean
    master?: boolean
    player?: boolean
  }
  const sections: Section[] = [
    // La campaña, con su nombre (como el mundo en la suya): su Inicio
    { to: '/mundos/$worldId/campanas/$campaignId', icon: Shield, text: name, tour: 'barra-inicio', exact: true },
    // La Mesa: sus personajes, quién está y abrirla en otra pestaña (Enrique, 2026-11-10: «personajes y mesa podemos
    // unirlo dentro de la campaña y luego se abre la mesa en otra pestaña»)
    {
      to: '/mundos/$worldId/campanas/$campaignId/personajes',
      icon: Layers,
      text: t('ribbon.table'),
      tour: 'barra-mesa'
    },
    {
      to: '/mundos/$worldId/campanas/$campaignId/libros',
      icon: BookOpen,
      text: t('ribbon.books'),
      tour: 'barra-libros',
      master: true
    },
    {
      to: '/mundos/$worldId/campanas/$campaignId/compendio',
      icon: ScrollText,
      text: t('ribbon.compendium'),
      tour: 'barra-compendio'
    },
    {
      to: '/mundos/$worldId/campanas/$campaignId/aventuras',
      icon: Flag,
      text: t('ribbon.adventures'),
      tour: 'barra-aventuras',
      master: true
    },
    // Las notas de quien juega (docs/specs/notas-jugador.md); el máster las lee desde el Inicio
    {
      to: '/mundos/$worldId/campanas/$campaignId/notas',
      icon: NotebookPen,
      text: t('ribbon.notes'),
      tour: 'barra-notas',
      player: true
    }
  ]
  return (
    <>
      {sections
        .filter((section) => (master ? !section.player : !section.master))
        .map((section) => (
          <Link
            key={section.to}
            to={section.to}
            params={params}
            activeOptions={{ exact: section.exact ?? false }}
            className={styles.item}
            viewTransition={SECTION}
            data-tour={section.tour}
          >
            <Label icon={section.icon} text={section.text} />
          </Link>
        ))}
    </>
  )
}

/** Los paneles de la wiki de un mundo */
function WikiPanels({ worldId, worldName }: { worldId: string; worldName: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const wikiPanel = useWikiPanel()
  const inWiki = useRouterState({
    select: (state) => new RegExp(`^/mundos/${worldId}(/(wiki/[^/]+|wiki|buscar|etiquetas))?/?$`).test(shownPath(state))
  })
  const atHome = useRouterState({
    select: (state) => new RegExp(`^/mundos/${worldId}/?$`).test(shownPath(state))
  })
  const narrow = useNarrow()
  // El mundo lleva a su portada; su columna (el árbol) está siempre, fija: no se recoge (Enrique, 2026-11-11). En lo
  // estrecho, donde es un cajón, lo abre
  const press = (panel: WikiPanel) => (event: MouseEvent<HTMLButtonElement>) => {
    const trigger = event.currentTarget
    if (inWiki && narrow) {
      wikiPanel.toggle(panel, trigger)
      return
    }
    wikiPanel.show(panel, trigger)
    if (!atHome) void navigate({ to: '/mundos/$worldId', params: { worldId }, viewTransition: SECTION })
  }
  // Marcado si se está en sus páginas (en lo estrecho, con el cajón abierto)
  const shown = (panel: WikiPanel) => inWiki && wikiPanel.panel === panel && (narrow ? wikiPanel.open : true)
  const buttons: { panel: WikiPanel; icon: LucideIcon; text: string; tour: string }[] = [
    // El mundo (sus páginas, con su nombre), las plantillas y los archivos
    // El mundo, con su icono propio (no el globo de «Mundos», que es de donde se viene; Enrique, 2026-11-12)
    { panel: 'pages', icon: MountainSnow, text: worldName, tour: 'barra-wiki' }
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
    </>
  )
}

/** La llama de Crisol, como un icono más del menú (Mis mundos sigue siendo la llama, como en la barra) */
function FlameIcon(_: { 'aria-hidden'?: 'true'; size?: number; strokeWidth?: number }) {
  return <CrisolMark size={22} />
}

/**
 * En el móvil, en vez de la barra: la llama, sola, abajo en el centro. Al tocarla sube una hoja con las secciones de
 * donde se está y, debajo, la cuenta. El móvil es de la jugadora (docs/diseno.md: el máster trabaja en el PC): solo
 * lo suyo (Mis mundos, su campaña, las páginas que conoce, sus personajes, el compendio, el grupo y lo que está en juego)
 */
function MobileMenu({
  world,
  campaign,
  master
}: {
  world: { id: string; name: string } | null
  campaign: { id: string; name: string; master: boolean } | null
  master: boolean
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const accounts = useAccounts()
  const windows = useWindow()
  const _wikiPanel = useWikiPanel()
  const path = useRouterState({ select: (state) => shownPath(state) })
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
  type Entry = {
    key: string
    icon: LucideIcon | typeof FlameIcon
    text: string
    current: boolean
    href: string
    run: () => void
  }
  const leave: Entry = {
    key: 'mundos',
    icon: FlameIcon,
    text: t('ribbon.worlds'),
    current: false,
    href: '/mundos',
    run: then(() => {
      leaveWorld()
      void navigate({ to: '/mundos', viewTransition: LEAVE_WORLD })
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
            href: `/mundos/${world.id}/campanas/${campaign.id}`,
            run: go(`/mundos/${world.id}/campanas/${campaign.id}`)
          },
          // Como en el escritorio (ADR-0021): la campaña, la Mesa (con sus personajes) y el compendio
          {
            key: 'mesa',
            icon: Layers,
            text: t('ribbon.table'),
            current: path.startsWith(`/mundos/${world.id}/campanas/${campaign.id}/personajes`),
            href: `/mundos/${world.id}/campanas/${campaign.id}/personajes`,
            run: go(`/mundos/${world.id}/campanas/${campaign.id}/personajes`)
          },
          {
            key: 'compendio',
            icon: ScrollText,
            text: t('ribbon.compendium'),
            current: path.startsWith(`/mundos/${world.id}/campanas/${campaign.id}/compendio`),
            href: `/mundos/${world.id}/campanas/${campaign.id}/compendio`,
            run: go(`/mundos/${world.id}/campanas/${campaign.id}/compendio`)
          },
          // Sus notas (el móvil es de la jugadora)
          ...(campaign.master
            ? []
            : [
                {
                  key: 'notas',
                  icon: NotebookPen,
                  text: t('ribbon.notes'),
                  current: path.startsWith(`/mundos/${world.id}/campanas/${campaign.id}/notas`),
                  href: `/mundos/${world.id}/campanas/${campaign.id}/notas`,
                  run: go(`/mundos/${world.id}/campanas/${campaign.id}/notas`)
                }
              ])
        ]
      : world
        ? [
            {
              key: 'mundos',
              icon: FlameIcon,
              text: t('ribbon.worlds'),
              current: false,
              href: '/mundos',
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
                    href: `/mundos/${world.id}`,
                    run: go(`/mundos/${world.id}`)
                  }
                ])
          ]
        : [
            {
              key: 'mundos',
              icon: FlameIcon,
              text: t('ribbon.worlds'),
              current: path === '/mundos',
              href: '/mundos',
              run: go('/mundos')
            }
          ]
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
                {/* Un enlace (se abre en otra pestaña o con pulsación larga); al tocarlo, con su transición */}
                <a
                  href={entry.href}
                  className={styles.menuTile}
                  aria-current={entry.current ? 'page' : undefined}
                  onClick={(event) => {
                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                    event.preventDefault()
                    entry.run()
                  }}
                >
                  <entry.icon aria-hidden="true" size={22} strokeWidth={1.75} />
                  {entry.text}
                </a>
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
