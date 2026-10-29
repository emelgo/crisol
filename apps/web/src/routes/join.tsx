import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { JoinResult } from '../account/client.ts'
import { useAccounts } from '../account/context.tsx'
import { useAnnounce } from '../components/announcer.tsx'
import { Banner } from '../components/banner.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { Field, FormError } from '../components/field.tsx'
import { focusOnMount } from '../components/focus.ts'
import form from '../components/form.module.css'
import list from '../components/list.module.css'
import { PageTitle } from '../components/page-title.tsx'

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
  const announce = useAnnounce()
  const info = useQuery({ queryKey: ['invitation-info', secret], queryFn: () => accounts.invitationInfo(secret) })
  const [error, setError] = useState<string | null>(null)
  const [isMaster, setIsMaster] = useState(false)
  const [busy, setBusy] = useState(false)

  if (pending || info.isPending) return null
  if (!info.data) {
    return (
      <section>
        <PageTitle>{t('join.invalidTitle')}</PageTitle>
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
      announce(t('join.isMaster'))
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
      <Banner
        crumb={worldName}
        title={t('join.title', { campaign: campaignName })}
        detail={masterName ? t('join.byMaster', { master: masterName }) : undefined}
        stats={[]}
      />
      <FormError message={error} />
      {account ? (
        <>
          {/* Con quién se entra: que nadie se una con la cuenta de otro (una sesión que no es la suya) sin verlo */}
          <p>{t('join.signedInAs', { name: account.name, email: account.email })}</p>
          <div className={list.actions}>
            <BusyButton
              className={form.button}
              busy={busy}
              onClick={async () => {
                setBusy(true)
                await after(await accounts.join(secret))
              }}
            >
              {t('join.confirm', { campaign: campaignName })}
            </BusyButton>
            {/* Sale y se queda en el enlace, para entrar o crear la cuenta buena */}
            <button type="button" className={list.secondary} onClick={() => accounts.signOut()}>
              {t('join.otherAccount')}
            </button>
          </div>
          {isMaster && <p>{t('join.isMaster')}</p>}
        </>
      ) : (
        <WithoutSession
          secret={secret}
          onJoined={after}
          onBusy={() => setBusy(true)}
          onSignIn={() => setError(null)}
          busy={busy}
        />
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
  /** Pasa a entrar con la cuenta que ya tiene: el error del alta ya no viene al caso */
  onSignIn: () => void
}) {
  const { t } = useTranslation()
  const accounts = useAccounts()
  const [hasAccount, setHasAccount] = useState(false)
  const [signInError, setSignInError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  const signUpTitle = useId()
  const signInTitle = useId()

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
    setSigningIn(true)
    const result = await accounts.signIn(String(data.get('email')), String(data.get('password')))
    setSigningIn(false)
    if (!result.ok) setSignInError(t(`errors.${result.code}`, { defaultValue: t('errors.UNKNOWN') }))
  }

  // Al cambiar de formulario, el foco va al primer campo del nuevo (el formulario se llama como su título)
  if (hasAccount) {
    return (
      <form className={form.form} aria-labelledby={signInTitle} onSubmit={signIn}>
        <h2 id={signInTitle}>{t('join.signInTitle')}</h2>
        <Field label={t('account.email')} name="email" type="email" autoComplete="email" required ref={focusOnMount} />
        <Field label={t('account.password')} name="password" type="password" autoComplete="current-password" required />
        <FormError message={signInError} />
        <BusyButton type="submit" className={form.button} busy={signingIn}>
          {t('account.signIn')}
        </BusyButton>
      </form>
    )
  }

  return (
    <>
      <form className={form.form} aria-labelledby={signUpTitle} onSubmit={signUp}>
        <h2 id={signUpTitle}>{t('join.signUpTitle')}</h2>
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
        <BusyButton type="submit" className={form.button} busy={props.busy}>
          {t('join.signUp')}
        </BusyButton>
      </form>
      <p>
        <button
          type="button"
          className={list.secondary}
          onClick={() => {
            props.onSignIn()
            setHasAccount(true)
          }}
        >
          {t('join.hasAccount')}
        </button>
      </p>
    </>
  )
}
