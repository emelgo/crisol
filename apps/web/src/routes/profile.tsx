import { Navigate } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PasswordFields } from '../account/account-fields.tsx'
import { useAccounts } from '../account/context.tsx'
import { useAnnounce } from '../components/announcer.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { ChangesBar } from '../components/changes.tsx'
import dialogStyles from '../components/dialog.module.css'
import { Field, FormError } from '../components/field.tsx'
import styles from '../components/form.module.css'
import { PageTitle } from '../components/page-title.tsx'
import page from './settings.module.css'

/** El perfil: tus datos (el nombre de usuario, si no lo tiene otra cuenta) y la contraseña */
export function Profile() {
  const { t } = useTranslation()
  const accounts = useAccounts()
  const { account, pending } = accounts.useAccount()
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  return (
    <section className={page.page}>
      <PageTitle>{t('profile.title')}</PageTitle>
      <ProfileData />
      <PasswordChange email={account.email} name={account.name} />
    </section>
  )
}

function ProfileData() {
  const { t } = useTranslation()
  const accounts = useAccounts()
  const announce = useAnnounce()
  const { account } = accounts.useAccount()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ ok: true } | { ok: false; code: string } | null>(null)
  // «Guardar» y «Cancelar», solo con cambios (docs/diseno.md)
  const [changed, setChanged] = useState(false)
  if (!account) return null
  const differs = (form: HTMLFormElement) => {
    const data = new FormData(form)
    return (
      String(data.get('name')) !== account.name ||
      String(data.get('firstName')) !== (account.firstName ?? '') ||
      String(data.get('lastName')) !== (account.lastName ?? '')
    )
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    const result = await accounts.updateProfile({
      name: String(form.get('name')),
      firstName: String(form.get('firstName')),
      lastName: String(form.get('lastName'))
    })
    setBusy(false)
    setStatus(result)
    if (result.ok) {
      setChanged(false)
      announce(t('profile.saved'))
    }
  }
  return (
    <form
      className={styles.form}
      aria-labelledby="perfil-datos"
      onSubmit={submit}
      onChange={(event) => {
        setStatus(null)
        setChanged(differs(event.currentTarget))
      }}
      onReset={() => {
        setStatus(null)
        setChanged(false)
      }}
    >
      <h2 id="perfil-datos">{t('profile.you')}</h2>
      <Field
        label={t('account.username')}
        hint={t('account.usernameHint')}
        name="name"
        autoComplete="nickname"
        defaultValue={account.name}
        maxLength={80}
        required
      />
      <div className={styles.pair}>
        <Field
          label={t('account.firstName')}
          name="firstName"
          autoComplete="given-name"
          defaultValue={account.firstName ?? ''}
          maxLength={80}
        />
        <Field
          label={t('account.lastName')}
          name="lastName"
          autoComplete="family-name"
          defaultValue={account.lastName ?? ''}
          maxLength={80}
        />
      </div>
      <Field label={t('account.email')} name="email" type="email" value={account.email} readOnly />
      <FormError
        message={status && !status.ok ? t(`errors.${status.code}`, { defaultValue: t('errors.UNKNOWN') }) : null}
      />
      {status?.ok && <p role="status">{t('profile.saved')}</p>}
      <ChangesBar shown={changed}>
        <BusyButton type="submit" className={styles.button} busy={busy}>
          {t('profile.save')}
        </BusyButton>
        <button type="reset" className={dialogStyles.cancel}>
          {t('list.cancel')}
        </button>
      </ChangesBar>
    </form>
  )
}

function PasswordChange({ email, name }: { email: string; name: string }) {
  const { t } = useTranslation()
  const accounts = useAccounts()
  const announce = useAnnounce()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ ok: true } | { ok: false; code: string } | null>(null)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const target = event.currentTarget
    const form = new FormData(target)
    setBusy(true)
    const result = await accounts.changePassword(String(form.get('current')), String(form.get('password')))
    setBusy(false)
    setStatus(result)
    if (result.ok) {
      target.reset()
      announce(t('profile.passwordChanged'))
    }
  }
  return (
    <form className={styles.form} aria-labelledby="perfil-clave" onSubmit={submit}>
      <h2 id="perfil-clave">{t('profile.password')}</h2>
      <Field
        label={t('profile.currentPassword')}
        name="current"
        type="password"
        autoComplete="current-password"
        required
      />
      <PasswordFields personal={[name, email.split('@')[0] ?? '']} label={t('profile.newPassword')} />
      <FormError
        message={status && !status.ok ? t(`errors.${status.code}`, { defaultValue: t('errors.UNKNOWN') }) : null}
      />
      {status?.ok && <p role="status">{t('profile.passwordChanged')}</p>}
      <BusyButton type="submit" className={styles.button} busy={busy}>
        {t('profile.changePassword')}
      </BusyButton>
    </form>
  )
}
