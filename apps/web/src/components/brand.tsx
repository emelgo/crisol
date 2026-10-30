import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './brand.module.css'

// La llama de Lucide (ISC), la marca del Crisol antiguo
const FLAME = 'M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4'

/** La marca de Crisol: la llama, de rojo abajo a naranja arriba */
export function CrisolMark({ size = 24, className }: { size?: number; className?: string }) {
  const id = `llama-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" className={styles.bottom} />
          <stop offset="1" className={styles.top} />
        </linearGradient>
      </defs>
      <path d={FLAME} stroke={`url(#${id})`} />
    </svg>
  )
}

/** Mientras algo carga: la llama, latiendo, en el centro. Sale tras un momento, para no parpadear si carga rápido */
export function Loading({ label, full = false }: { label?: string; full?: boolean }) {
  const { t } = useTranslation()
  return (
    <div role="status" className={full ? `${styles.loading} ${styles.full}` : styles.loading}>
      <CrisolMark size={full ? 48 : 36} className={styles.beat} />
      <span className={styles.hidden}>{label ?? t('app.loading')}</span>
    </div>
  )
}
