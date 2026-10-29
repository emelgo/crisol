import { Link, useNavigate } from '@tanstack/react-router'
import { type FocusEvent, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import styles from './account-menu.module.css'

/**
 * La cuenta en la barra: el nombre abre un desplegable con el email, el perfil y cerrar sesión.
 * Es un botón que muestra u oculta una lista (no un menú de ARIA): se recorre con el tabulador como el resto.
 * Se cierra con Escape (el foco vuelve al nombre), al pulsar fuera o al salir de él con el tabulador.
 */
export function AccountMenu() {
  const { t } = useTranslation()
  const accounts = useAccounts()
  const { account, pending } = accounts.useAccount()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  // Pulsar fuera lo cierra: solo se escucha mientras está abierto
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  if (pending) return null
  if (!account) {
    return (
      <Link to="/entrar" className={styles.signIn}>
        {t('account.signIn')}
      </Link>
    )
  }

  const leave = (event: FocusEvent<HTMLDivElement>) => {
    if (!root.current?.contains(event.relatedTarget as Node | null)) setOpen(false)
  }

  return (
    <div
      ref={root}
      className={styles.account}
      onBlur={leave}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return
        setOpen(false)
        trigger.current?.focus()
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {account.name}
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
      </button>
      {open && (
        <div id={panelId} className={styles.panel}>
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
