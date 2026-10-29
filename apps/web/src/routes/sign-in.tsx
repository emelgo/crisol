import { useNavigate } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { Field, FormError } from '../components/field.tsx'
import styles from '../components/form.module.css'

export function SignIn() {
  const { t } = useTranslation()
  const accounts = useAccounts()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    const result = await accounts.signIn(String(form.get('email')), String(form.get('password')))
    setBusy(false)
    if (result.ok) await navigate({ to: '/' })
    else setError(t(`errors.${result.code}`, { defaultValue: t('errors.UNKNOWN') }))
  }

  return (
    <section>
      <h1>{t('account.signIn')}</h1>
      <form className={styles.form} onSubmit={submit}>
        <Field label={t('account.email')} name="email" type="email" autoComplete="email" required />
        <Field label={t('account.password')} name="password" type="password" autoComplete="current-password" required />
        <FormError message={error} />
        <button type="submit" className={styles.button} disabled={busy}>
          {t('account.signIn')}
        </button>
      </form>
    </section>
  )
}
