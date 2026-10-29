import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
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
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          {t('app.name')}
        </Link>
        <nav className={styles.nav} aria-label={t('app.accountNav')}>
          <AccountMenu />
          <ThemeToggle />
        </nav>
      </header>
      <main className={styles.main}>
        <ApprovalQueue />
        <Notices />
        <Outlet />
      </main>
    </div>
  )
}

function AccountMenu() {
  const { t } = useTranslation()
  const accounts = useAccounts()
  const api = useApi()
  const { account, pending } = accounts.useAccount()
  const navigate = useNavigate()
  // Claude solo se conecta con la cuenta del propietario (módulo 0)
  const organizations = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.call('listOrganizations', {}),
    enabled: Boolean(account)
  })
  const isOwner = organizations.data?.organizations.some((o) => o.role === 'owner') ?? false
  if (pending) return null
  if (!account) return <Link to="/entrar">{t('account.signIn')}</Link>
  return (
    <>
      {isOwner && <Link to="/ia">{t('ai.link')}</Link>}
      <Link to="/perfil">{account.name}</Link>
      <button
        type="button"
        className={styles.signOut}
        onClick={async () => {
          await accounts.signOut()
          await navigate({ to: '/entrar' })
        }}
      >
        {t('account.signOut')}
      </button>
    </>
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
