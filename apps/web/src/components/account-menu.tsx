import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { LogOut, Settings, User } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { aiSettingsQuery } from '../api/queries.ts'
import { shownPath } from '../shown-path.ts'
import styles from './account-menu.module.css'
import { useApprovals } from './approval-queue.tsx'
import { useWindow } from './window.tsx'

/**
 * La cuenta. Sin sesión (barra de arriba), «Entrar». Con sesión (barra de la izquierda), un círculo con la inicial que
 * abre un desplegable a su lado: quién eres, Perfil, Ajustes (donde va el tema) y cerrar sesión.
 * Es un botón que muestra u oculta una lista (no un menú de ARIA): se recorre con el tabulador como el resto.
 * Se cierra con Escape (el foco vuelve al botón), al pulsar fuera o al salir de él con el tabulador.
 */
/** variant: bar (sin sesión, arriba), ribbon (la inicial, abajo en la barra) o header (la inicial, en la cabecera del mundo) */
export function AccountMenu({ variant = 'bar' }: { variant?: 'bar' | 'ribbon' | 'header' }) {
  const { t } = useTranslation()
  const accounts = useAccounts()
  const { account, pending } = accounts.useAccount()
  const navigate = useNavigate()
  // En «Entrar», el enlace a entrar sobra
  const signingIn = useRouterState({ select: (state) => shownPath(state) === '/entrar' })
  const [open, setOpen] = useState(false)
  // Cerrado, se queda un momento mientras se va (animado); luego se quita
  const [shown, setShown] = useState(false)
  if (open && !shown) setShown(true)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const waiting = useApprovals().data?.pending.length ?? 0
  const windows = useWindow()
  const api = useApi()
  const queryClient = useQueryClient()

  // Al abrirlo, lo que necesita Ajustes (la IA, si es el propietario) se pide ya: al abrir Ajustes, está
  useEffect(() => {
    if (!open) return
    const organizations = queryClient.getQueryData<{ organizations: { role: string }[] }>(['organizations'])
    if (organizations?.organizations.some((o) => o.role === 'owner')) {
      void queryClient.prefetchQuery({ ...aiSettingsQuery(api), staleTime: 10_000 })
    }
  }, [open, api, queryClient])

  // Mientras está abierto: pulsar fuera o llevar el foco fuera lo cierra; Escape también, y el foco vuelve al botón
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

  useEffect(() => {
    if (open || !shown) return
    if (typeof panel.current?.getAnimations !== 'function') return setShown(false)
    const timer = window.setTimeout(() => setShown(false), 400)
    return () => window.clearTimeout(timer)
  }, [open, shown])

  // Fijo en la pantalla, al lado del botón: así no lo recorta la barra (que se desplaza) ni se sale de la ventana
  useLayoutEffect(() => {
    const anchor = trigger.current
    const element = panel.current
    if (!open || !anchor || !element) return
    return autoUpdate(anchor, element, () => {
      void computePosition(anchor, element, {
        strategy: 'fixed',
        placement: variant === 'ribbon' ? 'right-end' : 'bottom-end',
        // Si no cabe, se da la vuelta o se desplaza hasta caber entero en la ventana
        middleware: [offset(8), flip({ padding: 12 }), shift({ padding: 12, crossAxis: true })]
      }).then(({ x, y }) => Object.assign(element.style, { left: `${x}px`, top: `${y}px` }))
    })
  }, [open, variant])

  if (pending) return null
  if (!account) {
    if (signingIn) return null
    return (
      <Link to="/entrar" className={styles.signIn}>
        {t('account.signIn')}
      </Link>
    )
  }

  const initial = account.name.trim().charAt(0).toLocaleUpperCase('es')
  return (
    <div ref={root} className={styles.account} data-variant={variant}>
      <button
        ref={trigger}
        type="button"
        className={variant === 'bar' ? styles.trigger : styles.avatar}
        data-tour="cuenta"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {variant !== 'bar' ? (
          <>
            <span aria-hidden="true">{initial}</span>
            <span className={styles.hidden}>{account.name}</span>
            {waiting > 0 && (
              <span aria-hidden="true" className={styles.badge}>
                {waiting}
              </span>
            )}
          </>
        ) : (
          account.name
        )}
      </button>
      {shown && (
        <div
          ref={panel}
          id={panelId}
          className={open ? styles.panel : `${styles.panel} ${styles.closing}`}
          inert={!open}
          aria-hidden={open ? undefined : true}
          onAnimationEnd={() => {
            if (!open) setShown(false)
          }}
        >
          <div className={styles.who}>
            <span aria-hidden="true" className={styles.whoAvatar}>
              {initial}
            </span>
            <span className={styles.whoText}>
              <strong>{account.name}</strong>
              <span className={styles.email}>{account.email}</span>
            </span>
          </div>
          <ul className={styles.items}>
            <li>
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => {
                  setOpen(false)
                  windows?.open('perfil', trigger.current)
                }}
              >
                <User aria-hidden="true" size={18} />
                {t('profile.title')}
              </button>
            </li>
            <li>
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => {
                  setOpen(false)
                  windows?.open('ajustes', trigger.current)
                }}
              >
                <Settings aria-hidden="true" size={18} />
                {t('settings.title')}
              </button>
            </li>
            <li className={styles.separated}>
              <button
                type="button"
                onClick={async () => {
                  setOpen(false)
                  await accounts.signOut()
                  await navigate({ to: '/entrar' })
                }}
              >
                <LogOut aria-hidden="true" size={18} />
                {t('account.signOut')}
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
