import { useRouterState } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './window.module.css'

/** Lo que se abre encima de la pantalla, sin dejarla: desde la barra lateral y desde el menú de la cuenta */
export type WindowKind = 'historial' | 'papelera' | 'ajustes' | 'perfil'

interface WindowState {
  open: (kind: WindowKind) => void
  /** La que está abierta, si hay una */
  opened: WindowKind | null
}

const WindowContext = createContext<WindowState | null>(null)

/** Para abrir una ventana; fuera del armazón (sin sesión) no hay */
export function useWindow(): WindowState | null {
  return useContext(WindowContext)
}

/**
 * Las ventanas: Historial, Papelera, Ajustes y Perfil se abren encima de lo que se ve (un dialog), y al cerrarlas se
 * sigue donde se estaba, con el foco donde estaba y el título de la pestaña de antes. Sus páginas siguen existiendo
 * por su dirección (/historial…), para los enlaces
 */
export function WindowProvider({
  children,
  render
}: {
  children: ReactNode
  /** Qué pinta cada ventana (las páginas las pone quien la usa, para no atar este armazón a ellas) */
  render: (kind: WindowKind) => ReactNode
}) {
  const [kind, setKind] = useState<WindowKind | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const returnTo = useRef<Element | null>(null)
  const title = useRef('')
  const { t } = useTranslation()
  const open = useCallback((next: WindowKind) => {
    returnTo.current = document.activeElement
    title.current = document.title
    setKind(next)
  }, [])
  useEffect(() => {
    if (kind && !dialog.current?.open) dialog.current?.showModal()
  }, [kind])
  // Si desde la ventana se va a otra página (un enlace del historial…), se cierra y se queda allí
  const path = useRouterState({ select: (state) => state.location.pathname })
  const openedAt = useRef(path)
  useEffect(() => {
    if (kind) openedAt.current = path
  }, [kind])
  useEffect(() => {
    if (path !== openedAt.current && dialog.current?.open) {
      returnTo.current = null
      dialog.current.close()
    }
  }, [path])
  const value = useMemo(() => ({ open, opened: kind }), [open, kind])
  return (
    <WindowContext.Provider value={value}>
      {children}
      {kind && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: pulsar el fondo es un atajo del ratón; con el teclado, Escape (propio de dialog)
        <dialog
          ref={dialog}
          className={styles.window}
          aria-label={t(`window.${kind}`)}
          onClose={() => {
            setKind(null)
            document.title = title.current
            if (returnTo.current instanceof HTMLElement) returnTo.current.focus()
          }}
          // Pulsar fuera de la ventana (en el fondo oscurecido) la cierra
          onClick={(event) => {
            if (event.target === event.currentTarget) dialog.current?.close()
          }}
        >
          <button
            type="button"
            className={styles.close}
            aria-label={t('window.close')}
            onClick={() => dialog.current?.close()}
          >
            <X aria-hidden="true" size={20} />
          </button>
          <div className={styles.body}>{render(kind)}</div>
        </dialog>
      )}
    </WindowContext.Provider>
  )
}
