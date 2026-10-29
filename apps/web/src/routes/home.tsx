import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { PageTitle } from '../components/page-title.tsx'

export function Home() {
  const { t } = useTranslation()
  const { account, pending } = useAccounts().useAccount()
  return (
    <section>
      <PageTitle>{t('app.name')}</PageTitle>
      <p>{t('app.tagline')}</p>
      {!pending &&
        (account ? (
          <>
            <p>{t('account.hello', { name: account.name })}</p>
            <Link to="/mundos">{t('worlds.title')}</Link>
          </>
        ) : (
          <Link to="/entrar">{t('account.signIn')}</Link>
        ))}
    </section>
  )
}
