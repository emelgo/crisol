import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'

export function Home() {
  const { t } = useTranslation()
  const { account, pending } = useAccounts().useAccount()
  return (
    <section>
      <h1>{t('app.name')}</h1>
      <p>{t('app.tagline')}</p>
      {!pending &&
        (account ? (
          <p>{t('account.hello', { name: account.name })}</p>
        ) : (
          <Link to="/entrar">{t('account.signIn')}</Link>
        ))}
    </section>
  )
}
