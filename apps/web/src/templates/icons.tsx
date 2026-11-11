/** El icono de una plantilla: su emoji, como el de una página (ADR-0024); sin él, el dibujo de plantilla */
import { LayoutTemplate } from 'lucide-react'
import styles from './icons.module.css'

export function TemplateIcon({ icon, size = 16 }: { icon: string | null; size?: number }) {
  if (!icon) return <LayoutTemplate aria-hidden="true" size={size} />
  return (
    <span className={styles.emoji} style={{ fontSize: size }} aria-hidden="true">
      {icon}
    </span>
  )
}
