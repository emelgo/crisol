/**
 * Una pantalla vacía (o una búsqueda sin nada): un bodegón pequeño de mesa de rol, pintado para Crisol (estilo F,
 * docs/imagenes.md; public/vacios/), encima de lo que se dice y de lo que se puede hacer. De adorno: el lector de
 * pantalla lee solo el texto
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

export function EmptyState({ kind, children }: { kind: EmptyKind; children: ReactNode }) {
  return (
    <div className={styles.empty} data-vacio={kind}>
      <img src={`/vacios/${kind}.webp`} alt="" className={styles.art} width={176} height={176} decoding="async" />
      {children}
    </div>
  )
}
