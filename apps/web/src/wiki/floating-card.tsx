/**
 * Una ventana flotante junto a un enlace (su vista previa, ADR-0033): encima de todo, fuera de las cajas que la
 * recortarían; bajo el enlace o, si no cabe, encima
 */
import { type ReactNode, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './preview-card.module.css'

/** Dónde se pone: bajo el enlace o, si no cabe, encima; dentro de la ventana */
function placeOf(anchor: HTMLElement) {
  const box = anchor.getBoundingClientRect()
  const width = Math.min(520, window.innerWidth - 16)
  const left = Math.max(8, Math.min(box.left, window.innerWidth - width - 8))
  const below = window.innerHeight - box.bottom
  return below > 260 || below > box.top
    ? { left, top: box.bottom + 6, maxHeight: Math.max(160, below - 16), width }
    : { left, bottom: window.innerHeight - box.top + 6, maxHeight: Math.max(160, box.top - 16), width }
}

export function FloatingCard({
  anchor,
  id,
  onEnter,
  onLeave,
  children
}: {
  anchor: HTMLElement | null
  id: string
  onEnter: () => void
  onLeave: () => void
  children: ReactNode
}) {
  const [place, setPlace] = useState<ReturnType<typeof placeOf> | null>(null)
  useLayoutEffect(() => {
    if (anchor) setPlace(placeOf(anchor))
  }, [anchor])
  if (!anchor || !place) return null
  return createPortal(
    <div
      id={id}
      role="tooltip"
      className={styles.card}
      style={place}
      data-content-card=""
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {children}
    </div>,
    document.body
  )
}
