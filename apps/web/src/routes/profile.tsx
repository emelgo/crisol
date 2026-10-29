import { Navigate } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useAnnounce } from '../components/announcer.tsx'
import { Field, FormError } from '../components/field.tsx'
import styles from '../components/form.module.css'

export function Profile() {
  const { t } = useTranslation()
  const accounts = useAccounts()
  const announce = useAnnounce()
  const { account, pending } = accounts.useAccount()
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = await accounts.rename(String(new FormData(event.currentTarget).get('name')))
    setStatus(result.ok ? 'saved' : 'error')
    if (result.ok) announce(t('profile.saved'))
  }

  return (
    <section>
      <h1>{t('profile.title')}</h1>
      <p>{account.email}</p>
      <form className={styles.form} onSubmit={submit}>
        <Field label={t('account.name')} name="name" defaultValue={account.name} maxLength={80} required />
        <FormError message={status === 'error' ? t('errors.UNKNOWN') : null} />
        {status === 'saved' && <p>{t('profile.saved')}</p>}
        <button type="submit" className={styles.button}>
          {t('profile.save')}
        </button>
      </form>
    </section>
  )
}
