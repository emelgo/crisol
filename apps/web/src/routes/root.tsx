import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { AccountMenu } from '../components/account-menu.tsx'
import { ApprovalQueue } from '../components/approval-queue.tsx'
import { Notices } from '../components/notices.tsx'
import { PageTitle, useFocusHeading } from '../components/page-title.tsx'
import { ThemeToggle } from '../components/theme-toggle.tsx'
import styles from './root.module.css'

export function RootLayout() {
  const { t } = useTranslation()
  const router = useRouter()
  const focusHeading = useFocusHeading()
  // Al llegar a otra página (no al cargar la primera), el foco va a su título
  useEffect(
    () =>
      router.subscribe('onResolved', ({ fromLocation, pathChanged }) => {
        if (fromLocation && pathChanged) focusHeading()
      }),
    [router, focusHeading]
  )
  return (
    <div className={styles.shell}>
      <a href="#contenido" className={styles.skip}>
        {t('app.skipToContent')}
      </a>
      <header className={styles.header}>
        <Link to="/" className={styles.brand} translate="no">
          {t('app.name')}
        </Link>
        <SectionsNav />
        <nav className={styles.nav} aria-label={t('app.accountNav')}>
          <AccountMenu />
          <ThemeToggle />
        </nav>
      </header>
      <main id="contenido" className={styles.main}>
        <ApprovalQueue />
        <Notices />
        <Outlet />
      </main>
    </div>
  )
}

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

/** Las secciones de la cuenta, con la actual marcada (aria-current, que pone el Link) */
function SectionsNav() {
  const { t } = useTranslation()
  const { account } = useAccounts().useAccount()
  const isOwner = useIsOwner()
  if (!account) return null
  return (
    <nav className={styles.sections} aria-label={t('app.sectionsNav')}>
      <Link to="/mundos">{t('worlds.title')}</Link>
      {isOwner && (
        <>
          <Link to="/historial">{t('history.title')}</Link>
          <Link to="/papelera">{t('trash.title')}</Link>
          {/* Claude solo se conecta con la cuenta del propietario (módulo 0) */}
          <Link to="/ia">{t('ai.link')}</Link>
        </>
      )}
    </nav>
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
