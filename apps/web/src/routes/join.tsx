import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { JoinResult } from '../account/client.ts'
import { useAccounts } from '../account/context.tsx'
import { Field, FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import list from '../components/list.module.css'

const route = getRouteApi('/unirse/$secret')

/**
 * Unirse a una campaña con su enlace. Abrirla no une a nadie (los bots de vista previa la abren): unirse es un botón,
 * o crear la cuenta aquí mismo.
 */
export function Join() {
  const { t } = useTranslation()
  const { secret } = route.useParams()
  const accounts = useAccounts()
  const { account, pending } = accounts.useAccount()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const info = useQuery({ queryKey: ['invitation-info', secret], queryFn: () => accounts.invitationInfo(secret) })
  const [error, setError] = useState<string | null>(null)
  const [isMaster, setIsMaster] = useState(false)
  const [busy, setBusy] = useState(false)

  if (pending || info.isPending) return null
  if (!info.data) {
    return (
      <section>
        <h1>{t('join.invalidTitle')}</h1>
        <p>{t('join.invalidBody')}</p>
      </section>
    )
  }

  /** Tras unirse: a la campaña (o, si es su máster, decirlo) */
  const after = async (result: JoinResult) => {
    setBusy(false)
    // El enlace dejó de valer con la página abierta: se dice, en vez de seguir ofreciéndolo
    if (!result.ok && result.code === 'INVALID_LINK') {
      queryClient.setQueryData(['invitation-info', secret], null)
      return
    }
    if (!result.ok) {
      setError(
        t(`join.errors.${result.code}`, {
          defaultValue: t(`errors.${result.code}`, { defaultValue: t('errors.UNKNOWN') })
        })
      )
      return
    }
    if (result.status === 'master') {
      setIsMaster(true)
      return
    }
    await queryClient.invalidateQueries()
    await navigate({
      to: '/mundos/$worldId/campanas/$campaignId',
      params: { worldId: result.worldId, campaignId: result.campaignId }
    })
  }

  const { campaignName, worldName, masterName } = info.data
  return (
    <section>
      <h1>{t('join.title', { campaign: campaignName })}</h1>
      <p>{masterName ? t('join.byMaster', { world: worldName, master: masterName }) : worldName}</p>
      <FormError message={error} />
      {account ? (
        <>
          <button
            type="button"
            className={form.button}
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await after(await accounts.join(secret))
            }}
          >
            {t('join.confirm', { campaign: campaignName })}
          </button>
          {isMaster && <p role="status">{t('join.isMaster')}</p>}
        </>
      ) : (
        <WithoutSession secret={secret} onJoined={after} onBusy={() => setBusy(true)} busy={busy} />
      )}
      <p>
        <Link to="/">{t('app.name')}</Link>
      </p>
    </section>
  )
}

/** Sin sesión: crear la cuenta (y unirse) o entrar con la que ya hay (y luego confirmar) */
function WithoutSession(props: {
  secret: string
  busy: boolean
  onBusy: () => void
  onJoined: (r: JoinResult) => Promise<void>
}) {
  const { t } = useTranslation()
  const accounts = useAccounts()
  const [hasAccount, setHasAccount] = useState(false)
  const [signInError, setSignInError] = useState<string | null>(null)

  const signUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    props.onBusy()
    await props.onJoined(
      await accounts.signUpAndJoin({
        secret: props.secret,
        name: String(data.get('name')),
        email: String(data.get('email')),
        password: String(data.get('password'))
      })
    )
  }
  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const result = await accounts.signIn(String(data.get('email')), String(data.get('password')))
    if (!result.ok) setSignInError(t(`errors.${result.code}`, { defaultValue: t('errors.UNKNOWN') }))
  }

  if (hasAccount) {
    return (
      <form className={form.form} onSubmit={signIn}>
        <h2>{t('join.signInTitle')}</h2>
        <Field label={t('account.email')} name="email" type="email" autoComplete="email" required />
        <Field label={t('account.password')} name="password" type="password" autoComplete="current-password" required />
        <FormError message={signInError} />
        <button type="submit" className={form.button}>
          {t('account.signIn')}
        </button>
      </form>
    )
  }

  return (
    <>
      <form className={form.form} onSubmit={signUp}>
        <h2>{t('join.signUpTitle')}</h2>
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
        <button type="submit" className={form.button} disabled={props.busy}>
          {t('join.signUp')}
        </button>
      </form>
      <p>
        <button type="button" className={list.secondary} onClick={() => setHasAccount(true)}>
          {t('join.hasAccount')}
        </button>
      </p>
    </>
  )
}
