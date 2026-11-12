import { Plus } from 'lucide-react'
import type { ComponentProps } from 'react'
import styles from './new-card.module.css'

/**
 * «Nuevo …», el mismo en todas las listas (mundos, campañas, plantillas, sistemas, personajes, etiquetas): un recuadro
 * más tras el último, vacío y con el borde de línea continua. card, con la forma de una tarjeta; row, de una fila
 */
export function NewCard({
  label,
  shape = 'card',
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { label: string; shape?: 'card' | 'row' }) {
  return (
    <button type={type} {...props} className={[styles[shape], className].filter(Boolean).join(' ')}>
      <Plus aria-hidden="true" size={shape === 'card' ? 24 : 16} strokeWidth={shape === 'card' ? 1.5 : 2} />
      <span className={styles.label}>{label}</span>
    </button>
  )
}
