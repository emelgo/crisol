import { Link, Outlet, useRouter, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { GroupKnowledge } from '../campaign/group-knowledge.tsx'
import { CampaignSettings } from '../campaign/settings.tsx'
import { AccountMenu } from '../components/account-menu.tsx'
import { Ambient } from '../components/ambient.tsx'
import { ApprovalQueue } from '../components/approval-queue.tsx'
import { Backdrop } from '../components/backdrop.tsx'
import { CrisolMark, Loading } from '../components/brand.tsx'
import { Notices } from '../components/notices.tsx'
import { PageTitle, useFocusHeading } from '../components/page-title.tsx'
import { RevealNotices } from '../components/reveal-notices.tsx'
import { Ribbon, useMasteredWorld } from '../components/ribbon.tsx'
import { Screen } from '../components/screen.tsx'
import { type WindowKind, WindowProvider } from '../components/window.tsx'
import { DiceProvider } from '../dice/context.tsx'
import { DicePanel } from '../dice/panel.tsx'
import { DiceTray } from '../dice/tray.tsx'
import { WikiPanelProvider } from '../wiki/panel.tsx'
import { WithCampaign } from './campaign.tsx'
import { OrganizationHistory, WorldHistoryWindow } from './history.tsx'
import { Profile } from './profile.tsx'
import styles from './root.module.css'
import settingsStyles from './settings.module.css'
import { Settings } from './settings.tsx'
import { OrganizationTrash, WorldTrashWindow } from './trash.tsx'

export function RootLayout() {
  const { t } = useTranslation()
  const router = useRouter()
  const focusHeading = useFocusHeading()
  const { account, pending } = useAccounts().useAccount()
  // La wiki ocupa todo el ancho: el panel lateral y la página, uno al lado del otro; Mis mundos, los archivos comunes y
  // las etiquetas, con su columna en el centro y paneles a los lados
  // Con sesión, toda vista ocupa el ancho y se pone su esqueleto (components/screen.tsx: el título siempre en el
  // mismo sitio); solo las sueltas de cuenta (perfil, ajustes, historial y papelera abiertos por su dirección, el
  // consentimiento) van en la columna de siempre
  const wide = useRouterState({
    select: (state) =>
      !/^\/(perfil|ajustes|historial|papelera|oauth\/|mundos\/[^/]+\/(historial|papelera)$)/.test(
        state.location.pathname
      )
  })
  // La Mesa va sola, a pantalla completa y en su pestaña (ADR-0021): sin la barra de la izquierda
  const bare = useRouterState({
    select: (state) => /^\/mundos\/[^/]+\/campanas\/[^/]+\/mesa\/?$/.test(state.location.pathname)
  })
  // La portada (sin sesión): a toda pantalla, con su imagen (sin las que van pasando detrás)
  const home = useRouterState({ select: (state) => state.location.pathname === '/' })
  // Imprimir: solo la hoja, sin nada de la interfaz; la pantalla de la tele, igual: solo el mapa
  const printing = useRouterState({
    select: (state) =>
      /^\/mundos\/[^/]+\/imprimir\//.test(state.location.pathname) ||
      /^\/mundos\/[^/]+\/campanas\/[^/]+\/pantalla\/?$/.test(state.location.pathname)
  })
  // Al llegar a otra página (no al cargar la primera), el foco va a su título
  useEffect(
    () =>
      router.subscribe('onResolved', ({ fromLocation, pathChanged }) => {
        if (fromLocation && pathChanged) focusHeading()
      }),
    [router, focusHeading]
  )
  if (printing) {
    return (
      <main id="contenido">
        <Outlet />
      </main>
    )
  }
  const skip = (
    <a href="#contenido" className={styles.skip}>
      {t('app.skipToContent')}
    </a>
  )
  // Mientras llega la sesión, la llama en el centro
  if (pending) return <Loading full />
  // Sin sesión (entrar, unirse a una campaña): una barra sencilla arriba, con la marca, entrar y el tema
  if (!account) {
    return (
      <div className={styles.shell}>
        {skip}
        <header className={styles.header}>
          <Link to="/" className={styles.brand} translate="no">
            <CrisolMark size={28} />
            {t('app.name')}
          </Link>
          <nav className={styles.nav} aria-label={t('app.accountNav')}>
            <AccountMenu />
          </nav>
        </header>
        <main id="contenido" className={home ? styles.full : styles.main}>
          <Outlet />
        </main>
        {/* Detrás de todo (fijo), las imágenes que van pasando, como en LegendKeeper; al final, para que su crédito
            no vaya antes que «Saltar al contenido» */}
        {!home && <Backdrop />}
      </div>
    )
  }
  // Con sesión: el armazón del Crisol antiguo, con la barra de la izquierda
  return (
    <WindowProvider render={(kind) => <WindowContent kind={kind} />}>
      <WikiPanelProvider>
        <DiceProvider>
          <DiceTray>
            <div className={bare ? styles.bare : styles.app}>
              {skip}
              {/* Detrás de todo, el fondo de ambiente para el cristal (la Mesa tiene su mapa) */}
              {!bare && <Ambient />}
              {!bare && <Ribbon />}
              <main id="contenido" className={wide ? styles.wide : styles.main}>
                <ApprovalQueue />
                <Notices />
                <RevealNotices />
                <Outlet />
              </main>
              <DicePanel />
            </div>
          </DiceTray>
        </DiceProvider>
      </WikiPanelProvider>
    </WindowProvider>
  )
}

/**
 * Lo que se abre encima de la pantalla: las mismas páginas que tienen su dirección. Dentro de un mundo que se dirige,
 * su historial y su papelera; fuera, los de toda la cuenta
 */
/** Lo de una ventana de la barra, en la misma columna que Ajustes: el título de todas en el mismo sitio */
function WindowContent({ kind }: { kind: WindowKind }) {
  return <div className={settingsStyles.page}>{windowBody(kind)}</div>
}

function windowBody(kind: WindowKind) {
  if (kind === 'historial') return <HistoryWindow />
  if (kind === 'papelera') return <TrashWindow />
  if (kind === 'ajustes') return <Settings />
  if (kind === 'revelado') return <GroupKnowledgeWindow />
  if (kind === 'campana') return <CampaignSettingsWindow />
  return <Profile />
}

function HistoryWindow() {
  const worldId = useMasteredWorld()
  return worldId ? <WorldHistoryWindow worldId={worldId} /> : <OrganizationHistory />
}

function TrashWindow() {
  const worldId = useMasteredWorld()
  return worldId ? <WorldTrashWindow worldId={worldId} /> : <OrganizationTrash />
}

/** «Lo que sabe el grupo» de la campaña en la que se está (docs/specs/revelar.md) */
function GroupKnowledgeWindow() {
  const path = useRouterState({ select: (state) => state.location.pathname })
  const match = /^\/mundos\/([^/]+)\/campanas\/([^/]+)/.exec(path)
  return match?.[1] && match[2] ? <GroupKnowledge worldId={match[1]} campaignId={match[2]} /> : null
}

/** Los ajustes de la campaña en la que se está (ADR-0021: se abren encima desde su barra) */
function CampaignSettingsWindow() {
  const { t } = useTranslation()
  return (
    <WithCampaign>
      {({ worldName, campaign }) =>
        campaign.role === 'master' ? (
          <>
            <PageTitle>{t('window.campana')}</PageTitle>
            <CampaignSettings campaign={campaign} worldName={worldName} />
          </>
        ) : null
      }
    </WithCampaign>
  )
}

export function NotFound() {
  const { t } = useTranslation()
  const { account } = useAccounts().useAccount()
  const back = (
    <Link to="/" className={styles.link}>
      {t('notFound.back')}
    </Link>
  )
  // Con sesión, en el esqueleto de todas las pantallas (el título en su sitio)
  if (account) return <Screen title={t('notFound.title')}>{back}</Screen>
  return (
    <section>
      <PageTitle>{t('notFound.title')}</PageTitle>
      {back}
    </section>
  )
}
