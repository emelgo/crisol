import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import form from '../components/form.module.css'
import { PageTitle } from '../components/page-title.tsx'
import styles from './home.module.css'

/** La portada: el nombre en grande, para qué es y por dónde seguir */
export function Home() {
  const { t } = useTranslation()
  const { account, pending } = useAccounts().useAccount()
  return (
    <section className={styles.hero}>
      <PageTitle>{t('app.name')}</PageTitle>
      <p className={styles.tagline}>{t('app.tagline')}</p>
      {!pending &&
        (account ? (
          <>
            <p className={styles.greeting}>{t('account.hello', { name: account.name })}</p>
            <Link to="/mundos" className={form.button}>
              {t('worlds.title')}
            </Link>
          </>
        ) : (
          <Link to="/entrar" className={form.button}>
            {t('account.signIn')}
          </Link>
        ))}
    </section>
  )
}
