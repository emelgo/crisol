import { X } from 'lucide-react'
import { type ComponentProps, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './window.module.css'

/**
 * Un cuadro encima de la pantalla (dialog modal), que se abre al montarse: con la X arriba a la derecha y, al pulsar
 * fuera, se cierra. Escape también (propio de dialog). onClose: al cerrarse, por lo que sea
 */
export function Modal({ ref, onClose, children, ...props }: ComponentProps<'dialog'> & { onClose: () => void }) {
  const { t } = useTranslation()
  const element = useRef<HTMLDialogElement | null>(null)
  // Solo si se pulsó y se soltó fuera: arrastrar desde un campo hasta el fondo (al seleccionar texto) no lo cierra
  const pressedOutside = useRef(false)
  useEffect(() => {
    if (!element.current?.open) element.current?.showModal()
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
      onClose={onClose}
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
