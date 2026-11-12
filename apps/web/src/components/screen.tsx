/**
 * El esqueleto común de las pantallas (docs/diseno.md, la colocación de Ajustes y de Archivos): el título siempre en
 * el mismo sitio, la columna del centro y, fuera de ella, una ficha a cada lado si hace falta
 */
import type { ReactNode } from 'react'
import { PageTitle } from './page-title.tsx'
import styles from './screen.module.css'

export function Screen({
  title,
  eyebrow,
  emblem,
  actions,
  left,
  right,
  leftLabel,
  rightLabel,
  className,
  children
}: {
  /** El título (h1); sin él, la pantalla pone el suyo dentro de children */
  title?: string
  /** Encima del título, pequeño */
  eyebrow?: ReactNode
  /** Su bodegón (public/vacios/), pequeño, a la derecha del título: el sello de la pantalla cuando ya tiene algo */
  emblem?: string | undefined
  /** A la derecha del título */
  actions?: ReactNode
  left?: ReactNode
  right?: ReactNode
  leftLabel?: string
  rightLabel?: string
  className?: string
  children: ReactNode
}) {
  return (
    <section className={className ? `${styles.layout} ${className}` : styles.layout}>
      <div className={styles.center}>
        {title && (
          <div className={styles.top}>
            <div>
              {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
              <PageTitle>{title}</PageTitle>
            </div>
            {actions}
            {emblem && <img src={`/vacios/${emblem}.webp`} alt="" className={styles.emblem} width={240} height={240} />}
          </div>
        )}
        {children}
      </div>
      {left && (
        <aside className={styles.left} aria-label={leftLabel}>
          {left}
        </aside>
      )}
      {right && (
        <aside className={styles.right} aria-label={rightLabel}>
          {right}
        </aside>
      )}
    </section>
  )
}
