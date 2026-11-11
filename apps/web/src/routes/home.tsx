import { Link, Navigate, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { CrisolMark } from '../components/brand.tsx'
import form from '../components/form.module.css'
import { PageTitle } from '../components/page-title.tsx'
import styles from './home.module.css'

/** Lo que hay dentro, en estampas: una imagen de cada parte y lo que es, en una línea */
const STAMPS = [
  { key: 'world', image: '/portada/mundo.webp' },
  { key: 'table', image: '/portada/mesa.webp' },
  { key: 'sheet', image: '/portada/ficha.webp' }
] as const

/** El código de una invitación: de su enlace (…/unirse/código) o el código solo */
export function inviteSecret(text: string): string | null {
  const value = text.trim()
  const fromLink = value.match(/\/unirse\/([^/?#\s]+)/)?.[1]
  const secret = fromLink ?? value
  return /^[\w-]{8,}$/.test(secret) ? secret : null
}

/**
 * La portada (tanda 5): una imagen a toda pantalla con la llama, la frase, «Entrar» y «Tengo una invitación»; debajo,
 * estampas de lo que hay dentro. Con sesión no hace falta: lleva directa a Mis mundos
 */
export function Home() {
  const { t } = useTranslation()
  const { account, pending } = useAccounts().useAccount()
  const [inviting, setInviting] = useState(false)
  // Al volver de pegar el enlace, el foco vuelve a su botón
  const inviteButton = useRef<HTMLButtonElement>(null)
  const back = () => {
    setInviting(false)
    requestAnimationFrame(() => inviteButton.current?.focus())
  }
  if (pending) return null
  if (account) return <Navigate to="/mundos" replace />
  return (
    <div className={styles.home}>
      <div className={styles.hero}>
        <img className={styles.heroImage} src="/portada/portada.webp" alt="" fetchPriority="high" />
        <div className={styles.heroText}>
          <CrisolMark size={72} className={styles.mark} />
          <PageTitle>{t('app.name')}</PageTitle>
          <p className={styles.tagline}>{t('app.tagline')}</p>
          {inviting ? (
            <InviteForm onCancel={back} />
          ) : (
            <div className={styles.actions}>
              <Link to="/entrar" className={form.button}>
                {t('account.signIn')}
              </Link>
              <button ref={inviteButton} type="button" className={styles.secondary} onClick={() => setInviting(true)}>
                {t('home.invite')}
              </button>
            </div>
          )}
        </div>
      </div>
      <section className={styles.inside} aria-label={t('home.inside')}>
        <ul className={styles.stamps}>
          {STAMPS.map((stamp) => (
            <li key={stamp.key} className={styles.stamp}>
              <div className={styles.shot}>
                <img src={stamp.image} alt="" loading="lazy" decoding="async" />
              </div>
              <h2>{t(`home.${stamp.key}`)}</h2>
              <p>{t(`home.${stamp.key}Text`)}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/** Pegar el enlace de la invitación (o su código) y seguir a la campaña */
function InviteForm({ onCancel }: { onCancel: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const id = useId()
  const [text, setText] = useState('')
  const [wrong, setWrong] = useState(false)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const secret = inviteSecret(text)
    if (!secret) return setWrong(true)
    void navigate({ to: '/unirse/$secret', params: { secret } })
  }
  return (
    <form className={styles.invite} onSubmit={submit}>
      <label htmlFor={id}>{t('home.inviteLabel')}</label>
      <div className={styles.inviteRow}>
        <input
          id={id}
          // biome-ignore lint/a11y/noAutofocus: se abre al pulsar «Tengo una invitación»: lo siguiente es pegar el enlace
          autoFocus
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
          value={text}
          aria-invalid={wrong || undefined}
          aria-describedby={wrong ? `${id}-error` : undefined}
          onChange={(event) => {
            setText(event.currentTarget.value)
            setWrong(false)
          }}
        />
        <button type="submit" className={form.button}>
          {t('home.go')}
        </button>
      </div>
      {wrong && (
        <p id={`${id}-error`} className={styles.inviteError} role="alert">
          {t('home.badInvite')}
        </p>
      )}
      <button type="button" className={styles.link} onClick={onCancel}>
        {t('home.back')}
      </button>
    </form>
  )
}
