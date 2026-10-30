import { type ReactNode, useEffect, useState } from 'react'
import styles from './changes.module.css'

/**
 * «Guardar» y «Cancelar» cuando hay cambios (shown): a la izquierda, y al aparecer y al irse se abren y se cierran
 * suavemente. Mientras se va, ya no se puede pulsar ni se anuncia
 */
export function ChangesBar({ shown, children }: { shown: boolean; children: ReactNode }) {
  const [present, setPresent] = useState(shown)
  if (shown && !present) setPresent(true)
  // Por si no hay animación (movimiento reducido, o sin pintar): se quita igual, un poco después
  useEffect(() => {
    if (shown || !present) return
    const timer = window.setTimeout(() => setPresent(false), 400)
    return () => window.clearTimeout(timer)
  }, [shown, present])
  if (!present) return null
  return (
    <div
      className={shown ? styles.bar : `${styles.bar} ${styles.closing}`}
      inert={!shown}
      aria-hidden={shown ? undefined : true}
      onAnimationEnd={() => {
        if (!shown) setPresent(false)
      }}
    >
      <div className={styles.inner}>{children}</div>
    </div>
  )
}
