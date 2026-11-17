/**
 * Un recuadro que flota junto a su botón (Poner fecha, el clima a mano, la zona, un viaje): la cabecera de todos los
 * cuadros (el título rojo con su raya y la X), cristal tapado, y se cierra con la X, con Escape o pulsando fuera; el foco
 * vuelve al botón (docs/diseno.md)
 */
import { X } from 'lucide-react'
import { type ReactNode, type RefObject, useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDismiss } from '../components/dismiss.ts'
import { Floating } from '../components/floating.tsx'
import styles from './time.module.css'

export function Popover({
  anchor,
  title,
  aside,
  onClose,
  children,
  placement = 'bottom-start',
  width = 'normal'
}: {
  anchor: RefObject<HTMLElement | null>
  title: string
  /** Lo que va a la derecha del título («Generado») */
  aside?: ReactNode
  onClose: () => void
  children: ReactNode
  placement?: 'bottom-start' | 'bottom-end' | 'left-start'
  width?: 'normal' | 'wide'
}) {
  const { t } = useTranslation()
  const box = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const close = () => {
    onClose()
    anchor.current?.focus()
  }
  useDismiss(true, onClose, box, anchor)
  // Al abrirse, el foco entra: a lo elegido o al primer campo
  useEffect(() => {
    const root = box.current
    const first =
      root?.querySelector<HTMLElement>('[data-autofocus]') ??
      root?.querySelector<HTMLElement>('[aria-pressed="true"], input, select, button:not([data-close])')
    first?.focus()
  }, [])
  return (
    <Floating
      anchor={anchor}
      boxRef={box}
      placement={placement}
      className={styles.popover}
      data-width={width}
      role="dialog"
      aria-labelledby={titleId}
    >
      <header className={styles.popHead}>
        <h2 id={titleId}>{title}</h2>
        {aside && <span className={styles.popAside}>{aside}</span>}
        <button
          type="button"
          className={styles.close}
          data-close=""
          aria-label={t('campaignTime.close')}
          onClick={close}
        >
          <X aria-hidden="true" size={16} />
        </button>
      </header>
      {children}
    </Floating>
  )
}
