import { Link, Outlet, useRouter, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { AccountMenu } from '../components/account-menu.tsx'
import { ApprovalQueue } from '../components/approval-queue.tsx'
import { CrisolMark, Loading } from '../components/brand.tsx'
import { Notices } from '../components/notices.tsx'
import { PageTitle, useFocusHeading } from '../components/page-title.tsx'
import { Ribbon, useMasteredWorld } from '../components/ribbon.tsx'
import { ThemeToggle } from '../components/theme-toggle.tsx'
import { type WindowKind, WindowProvider } from '../components/window.tsx'
import { DiceProvider } from '../dice/context.tsx'
import { DicePanel } from '../dice/panel.tsx'
import { DiceTray } from '../dice/tray.tsx'
import { WikiPanelProvider } from '../wiki/panel.tsx'
import { OrganizationHistory, WorldHistoryWindow } from './history.tsx'
import { Profile } from './profile.tsx'
import styles from './root.module.css'
import { Settings } from './settings.tsx'
import { OrganizationTrash, WorldTrashWindow } from './trash.tsx'

export function RootLayout() {
  const { t } = useTranslation()
  const router = useRouter()
  const focusHeading = useFocusHeading()
  const { account, pending } = useAccounts().useAccount()
  // La wiki ocupa todo el ancho: el panel lateral y la página, uno al lado del otro; Mis mundos, los archivos comunes y
  // las etiquetas, con su columna en el centro y paneles a los lados
  const wide = useRouterState({
    select: (state) =>
      /^\/mundos\/[^/]+\/(wiki|etiquetas|archivos|buscar)/.test(state.location.pathname) ||
      /^\/mundos\/[^/]+\/campanas\/[^/]+\/(compendio|personajes|biblioteca)/.test(state.location.pathname) ||
      /^\/mundos\/[^/]+\/?$/.test(state.location.pathname) ||
      state.location.pathname === '/archivos' ||
      state.location.pathname === '/etiquetas' ||
      state.location.pathname === '/mundos'
  })
  // Imprimir: solo la hoja, sin nada de la interfaz
  const printing = useRouterState({ select: (state) => /^\/mundos\/[^/]+\/imprimir\//.test(state.location.pathname) })
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
            <ThemeToggle />
          </nav>
        </header>
        <main id="contenido" className={styles.main}>
          <Outlet />
        </main>
      </div>
    )
  }
  // Con sesión: el armazón del Crisol antiguo, con la barra de la izquierda
  return (
    <WindowProvider render={(kind) => <WindowContent kind={kind} />}>
      <WikiPanelProvider>
        <DiceProvider>
          <DiceTray>
            <div className={styles.app}>
              {skip}
              <Ribbon />
              <main id="contenido" className={wide ? styles.wide : styles.main}>
                <ApprovalQueue />
                <Notices />
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
function WindowContent({ kind }: { kind: WindowKind }) {
  const worldId = useMasteredWorld()
  if (kind === 'historial') return worldId ? <WorldHistoryWindow worldId={worldId} /> : <OrganizationHistory />
  if (kind === 'papelera') return worldId ? <WorldTrashWindow worldId={worldId} /> : <OrganizationTrash />
  if (kind === 'ajustes') return <Settings />
  return <Profile />
}

export function NotFound() {
  const { t } = useTranslation()
  return (
    <section>
      <PageTitle>{t('notFound.title')}</PageTitle>
      <Link to="/">{t('notFound.back')}</Link>
    </section>
  )
}
