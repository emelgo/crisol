import { useQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NewAccountFields } from '../account/account-fields.tsx'
import { useAccounts } from '../account/context.tsx'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { FormError } from '../components/field.tsx'
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

  if (info.isPending) return <Loading />
  if (!info.data) {
    return (
      <section className={styles.centered}>
        <PageTitle>{t('bootstrap.invalidTitle')}</PageTitle>
        <p className={styles.intro}>{t('bootstrap.invalidBody')}</p>
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
      firstName: String(form.get('firstName')),
      lastName: String(form.get('lastName')),
      email: String(form.get('email')),
      password: String(form.get('password'))
    })
    setBusy(false)
    if (result.ok) await navigate({ to: '/' })
    else setError(t(`errors.${result.code}`, { defaultValue: t('errors.UNKNOWN') }))
  }

  return (
    <section className={styles.centered}>
      <PageTitle>{t('bootstrap.title')}</PageTitle>
      <p className={styles.intro}>{t('bootstrap.intro', { organization: info.data.organizationName })}</p>
      <form className={styles.form} onSubmit={submit}>
        <NewAccountFields />
        <FormError message={error} />
        <BusyButton type="submit" className={styles.button} busy={busy}>
          {t('bootstrap.create')}
        </BusyButton>
      </form>
    </section>
  )
}
