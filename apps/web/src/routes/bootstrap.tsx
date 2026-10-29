import { useQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { Field, FormError } from '../components/field.tsx'
import styles from '../components/form.module.css'
import { PageTitle } from '../components/page-title.tsx'

const route = getRouteApi('/arranque/$secret')

/** Crear la cuenta del propietario con el enlace de `pnpm crisol arranque` */
export function Bootstrap() {
  const { t } = useTranslation()
  const { secret } = route.useParams()
  const accounts = useAccounts()
  const navigate = useNavigate()
  const info = useQuery({ queryKey: ['bootstrap', secret], queryFn: () => accounts.bootstrapInfo(secret) })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (info.isPending) return null
  if (!info.data) {
    return (
      <section>
        <PageTitle>{t('bootstrap.invalidTitle')}</PageTitle>
        <p>{t('bootstrap.invalidBody')}</p>
      </section>
    )
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    const result = await accounts.redeemBootstrap({
      secret,
      name: String(form.get('name')),
      email: String(form.get('email')),
      password: String(form.get('password'))
    })
    setBusy(false)
    if (result.ok) await navigate({ to: '/' })
    else setError(t(`errors.${result.code}`, { defaultValue: t('errors.UNKNOWN') }))
  }

  return (
    <section>
      <PageTitle>{t('bootstrap.title')}</PageTitle>
      <p>
        {t('bootstrap.organization')} <strong>{info.data.organizationName}</strong>
      </p>
      <form className={styles.form} onSubmit={submit}>
        <Field label={t('account.name')} name="name" autoComplete="name" maxLength={80} required />
        <Field label={t('account.email')} name="email" type="email" autoComplete="email" required />
        <Field
          label={t('account.password')}
          hint={t('account.passwordHint')}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          maxLength={128}
          required
        />
        <FormError message={error} />
        <BusyButton type="submit" className={styles.button} busy={busy}>
          {t('bootstrap.create')}
        </BusyButton>
      </form>
    </section>
  )
}
