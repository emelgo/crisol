import { Link, Navigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import form from '../components/form.module.css'
import { PageTitle } from '../components/page-title.tsx'
import styles from './home.module.css'

/** La portada: el nombre en grande, para qué es y entrar. Con sesión no hace falta: lleva directa a Mis mundos */
export function Home() {
  const { t } = useTranslation()
  const { account, pending } = useAccounts().useAccount()
  if (pending) return null
  if (account) return <Navigate to="/mundos" replace />
  return (
    <section className={styles.hero}>
      <PageTitle>{t('app.name')}</PageTitle>
      <p className={styles.tagline}>{t('app.tagline')}</p>
      <Link to="/entrar" className={form.button}>
        {t('account.signIn')}
      </Link>
    </section>
  )
}
