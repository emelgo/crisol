import { Link, Outlet } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ThemeToggle } from '../components/theme-toggle.tsx'
import styles from './root.module.css'

export function RootLayout() {
  const { t } = useTranslation()
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          {t('app.name')}
        </Link>
        <ThemeToggle />
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

export function NotFound() {
  const { t } = useTranslation()
  return (
    <section>
      <h1>{t('notFound.title')}</h1>
      <Link to="/">{t('notFound.back')}</Link>
    </section>
  )
}
