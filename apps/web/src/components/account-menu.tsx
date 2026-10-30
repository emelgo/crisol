import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import styles from './account-menu.module.css'

/**
 * La cuenta en la barra: el nombre abre un desplegable con el email, el perfil y cerrar sesión.
 * Es un botón que muestra u oculta una lista (no un menú de ARIA): se recorre con el tabulador como el resto.
 * Se cierra con Escape (el foco vuelve al nombre), al pulsar fuera o al salir de él con el tabulador.
 */
/** La cuenta: en la barra de arriba, con su nombre (sin sesión); en la de la izquierda, con su inicial */
export function AccountMenu({ variant = 'bar' }: { variant?: 'bar' | 'ribbon' }) {
  const { t } = useTranslation()
  const accounts = useAccounts()
  const { account, pending } = accounts.useAccount()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  // Mientras está abierto: pulsar fuera o llevar el foco fuera lo cierra; Escape también, y el foco vuelve al nombre
  useEffect(() => {
    if (!open) return
    const outside = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  if (pending) return null
  if (!account) {
    return (
      <Link to="/entrar" className={styles.signIn}>
        {t('account.signIn')}
      </Link>
    )
  }

  return (
    <div ref={root} className={styles.account}>
      <button
        ref={trigger}
        type="button"
        className={variant === 'ribbon' ? styles.avatar : styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {variant === 'ribbon' ? (
          <>
            <span aria-hidden="true">{account.name.trim().charAt(0).toLocaleUpperCase('es')}</span>
            <span className={styles.hidden}>{account.name}</span>
          </>
        ) : (
          account.name
        )}
        {variant === 'bar' && (
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        )}
      </button>
      {open && (
        <div id={panelId} className={variant === 'ribbon' ? `${styles.panel} ${styles.fromRibbon}` : styles.panel}>
          <p className={styles.email}>{account.email}</p>
          <ul className={styles.items}>
            <li>
              <Link to="/perfil" onClick={() => setOpen(false)}>
                {t('profile.title')}
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={async () => {
                  setOpen(false)
                  await accounts.signOut()
                  await navigate({ to: '/entrar' })
                }}
              >
                {t('account.signOut')}
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
