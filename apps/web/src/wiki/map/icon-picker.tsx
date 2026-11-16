/**
 * El icono de un pin: un botón con el de ahora que abre, flotando junto a él (fuera del panel, que se desplaza), el
 * buscador de los iconos de rol del paquete (Enrique, 2026-11-16: «son iconos del paquete que tenemos, no emojis
 * sueltos») y «Sin icono». Escape o pulsar fuera lo cierran y el foco vuelve al botón
 */
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom'
import { ChevronDown, CircleOff } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Icon, iconLabel } from '../../components/icon.tsx'
import { IconBrowser } from '../../components/icon-browser.tsx'
import styles from './map.module.css'

export function IconPicker({
  id,
  value,
  onPick
}: {
  id: string
  value: string | null
  onPick: (icon: string | null) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }
  const pick = (icon: string | null) => {
    onPick(icon)
    close()
  }

  // Junto al botón, donde quepa
  useLayoutEffect(() => {
    const anchor = trigger.current
    const floating = panel.current
    if (!open || !anchor || !floating) return
    return autoUpdate(anchor, floating, () => {
      void computePosition(anchor, floating, {
        strategy: 'fixed',
        placement: 'left-start',
        // A la izquierda del panel (sin taparlo), subiendo lo que haga falta para caber
        middleware: [
          offset(8),
          flip({ padding: 8, crossAxis: false, fallbackPlacements: ['bottom-start', 'top-start'] }),
          shift({ padding: 8, crossAxis: true })
        ]
      }).then(({ x, y }) => Object.assign(floating.style, { left: `${x}px`, top: `${y}px` }))
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const outside = (event: Event) => {
      const target = event.target as Node
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) close(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        className={styles.iconTrigger}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={value ? iconLabel(value) : t('map.pin.noIcon')}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {value ? <Icon value={value} size={20} /> : <CircleOff aria-hidden="true" size={16} />}
        <span>{value ? iconLabel(value) : t('map.pin.noIcon')}</span>
        <ChevronDown aria-hidden="true" size={14} />
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label={t('map.pin.chooseIcon')}
            className={styles.iconPanel}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return
              event.preventDefault()
              event.stopPropagation()
              close()
            }}
          >
            <IconBrowser value={value} onPick={pick} autoFocus />
            {value && (
              <button type="button" className={styles.noIcon} onClick={() => pick(null)}>
                <CircleOff aria-hidden="true" size={15} />
                {t('map.pin.removeIcon')}
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  )
}
