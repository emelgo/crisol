/**
 * Una pantalla vacía (o una búsqueda sin nada): una sola pieza en el centro (Enrique, 2026-11-12: «una pieza
 * central»): un bodegón de mesa de rol pintado para Crisol (estilo F, docs/imagenes.md; public/vacios/), lo que se dice
 * y, debajo, el botón de crear. De adorno: el lector de pantalla lee solo el texto. small: dentro de una ventana o de
 * una lista (una búsqueda sin nada), más pequeño
 */
import type { ReactNode } from 'react'
import styles from './empty-state.module.css'

export type EmptyKind =
  | 'mundos'
  | 'plantillas'
  | 'etiquetas'
  | 'sistemas'
  | 'archivos'
  | 'historial'
  | 'papelera'
  | 'sin-resultados'

export function EmptyState({
  kind,
  action,
  small = false,
  children
}: {
  kind: EmptyKind
  action?: ReactNode
  small?: boolean
  children: ReactNode
}) {
  return (
    <div className={styles.empty} data-vacio={kind} data-small={small || undefined}>
      <img src={`/vacios/${kind}.webp`} alt="" className={styles.art} width={240} height={240} decoding="async" />
      <div className={styles.text}>{children}</div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
