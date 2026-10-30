import { X } from 'lucide-react'
import { type ComponentProps, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './window.module.css'

/**
 * Cuando un cuadro se cierra, espera a que acabe su transición de salida (base.css) para quitarlo; sin transiciones
 * (las pruebas, en jsdom), al momento. Como mucho, un poco más de lo que dura
 */
export function afterExit(element: HTMLElement, done: () => void) {
  const running = typeof element.getAnimations === 'function' ? element.getAnimations() : []
  if (running.length === 0) return done()
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    done()
  }
  void Promise.allSettled(running.map((animation) => animation.finished)).then(finish)
  window.setTimeout(finish, 400)
}

/**
 * Un cuadro encima de la pantalla (dialog modal), que se abre al montarse: con la X arriba a la derecha y, al pulsar
 * fuera, se cierra. Escape también (propio de dialog). onClose: al cerrarse, por lo que sea. Puede ir uno dentro de
 * otro (ver la portada desde la ventana del mundo): al cerrar el de dentro, el de fuera sigue
 */
export function Modal({ ref, onClose, children, ...props }: ComponentProps<'dialog'> & { onClose: () => void }) {
  const { t } = useTranslation()
  const element = useRef<HTMLDialogElement | null>(null)
  // Solo si se pulsó y se soltó fuera: arrastrar desde un campo hasta el fondo (al seleccionar texto) no lo cierra
  const pressedOutside = useRef(false)
  // Al abrirse, el foco va a lo marcado con data-autofocus (el primer campo al crear algo), si lo hay
  useEffect(() => {
    if (!element.current?.open) element.current?.showModal()
    element.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
  }, [])
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: pulsar el fondo es un atajo del ratón; con el teclado, Escape (propio de dialog)
    <dialog
      {...props}
      ref={(node) => {
        element.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      // React pasa el cierre de un cuadro de dentro a los de fuera: solo cuenta el suyo. Se quita al acabar de irse
      onClose={(event) => {
        if (event.target === event.currentTarget) afterExit(event.currentTarget, onClose)
      }}
      onPointerDown={(event) => {
        pressedOutside.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        if (pressedOutside.current && event.target === event.currentTarget) event.currentTarget.close()
      }}
    >
      <button
        type="button"
        className={styles.close}
        aria-label={t('window.close')}
        onClick={() => element.current?.close()}
      >
        <X aria-hidden="true" size={20} />
      </button>
      {children}
    </dialog>
  )
}
