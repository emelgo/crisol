import type { ReactNode } from 'react'
import styles from './changes.module.css'

/** «Guardar» y «Cancelar» cuando hay cambios: a la izquierda, y al aparecer se abren suavemente */
export function ChangesBar({ children }: { children: ReactNode }) {
  return (
    <div className={styles.bar}>
      <div className={styles.inner}>{children}</div>
    </div>
  )
}
