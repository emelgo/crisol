import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, useRouter, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { AccountMenu } from '../components/account-menu.tsx'
import { ApprovalQueue } from '../components/approval-queue.tsx'
import { Notices } from '../components/notices.tsx'
import { PageTitle, useFocusHeading } from '../components/page-title.tsx'
import { Ribbon } from '../components/ribbon.tsx'
import { ThemeToggle } from '../components/theme-toggle.tsx'
import { WikiPanelProvider } from '../wiki/panel.tsx'
import styles from './root.module.css'

export function RootLayout() {
  const { t } = useTranslation()
  const router = useRouter()
  const focusHeading = useFocusHeading()
  const { account, pending } = useAccounts().useAccount()
  // La wiki ocupa todo el ancho: el panel lateral y la página, uno al lado del otro
  const wide = useRouterState({
    select: (state) => /^\/mundos\/[^/]+\/(wiki|etiquetas|archivos|buscar)/.test(state.location.pathname)
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
  // Sin sesión (entrar, unirse a una campaña): una barra sencilla arriba, con la marca, entrar y el tema
  if (!account && !pending) {
    return (
      <div className={styles.shell}>
        {skip}
        <header className={styles.header}>
          <Link to="/" className={styles.brand} translate="no">
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
  // Con sesión: el armazón del Crisol antiguo, con la barra de la izquierda y la de estado abajo
  return (
    <WikiPanelProvider>
      <div className={styles.app}>
        {skip}
        <Ribbon />
        <main id="contenido" className={wide ? styles.wide : styles.main}>
          <ApprovalQueue />
          <Notices />
          <Outlet />
        </main>
        <StatusBar />
      </div>
    </WikiPanelProvider>
  )
}

/** La barra de estado: el mundo en el que estás */
function StatusBar() {
  const api = useApi()
  const { account } = useAccounts().useAccount()
  const worldId = useRouterState({ select: (state) => /^\/mundos\/([^/]+)/.exec(state.location.pathname)?.[1] })
  const worlds = useQuery({
    queryKey: ['worlds'],
    queryFn: () => api.call('listWorlds', {}),
    enabled: Boolean(account && worldId)
  })
  const world = worlds.data?.worlds.find((w) => w.id === worldId)
  return (
    <footer className={styles.status}>
      <span>{world?.name}</span>
    </footer>
  )
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
