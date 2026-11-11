/**
 * El menú común (plan de la revisión: «Exportar» que no parecía un desplegable; «⋯» de la página): un botón y su panel,
 * que flota junto a él sin que lo recorte ninguna caja. Escape o pulsar fuera lo cierran y el foco vuelve al botón. Dentro,
 * filas (MenuItem) y grupos que se despliegan en su sitio con su flecha (MenuGroup), como «Versiones»
 */
import { ChevronRight } from 'lucide-react'
import { type ButtonHTMLAttributes, type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react'
import { Floating } from './floating.tsx'
import styles from './menu.module.css'

export function Menu({
  label,
  icon,
  className,
  children
}: {
  /** Lo que dice el botón al lector de pantalla y al pasar el ratón («Más acciones») */
  label: string
  icon: ReactNode
  className?: string
  /** Lo de dentro; close lo cierra (antes de abrir una ventana, por ejemplo) */
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()
  const close = useCallback(() => setOpen(false), [])
  // Abierto: pulsar fuera lo cierra; Escape también, y el foco vuelve al botón
  useEffect(() => {
    if (!open) return
    const outside = (event: Event) => {
      const target = event.target as Node
      if (panel.current?.contains(target) || trigger.current?.contains(target)) return
      setOpen(false)
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])
  return (
    <>
      <button
        type="button"
        ref={trigger}
        className={className}
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {icon}
      </button>
      {open && (
        <Floating anchor={trigger} boxRef={panel} placement="bottom-end" id={id} className={styles.panel}>
          {children(close)}
        </Floating>
      )}
    </>
  )
}

/** Una fila del menú: una acción */
export function MenuItem({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={className ? `${styles.item} ${className}` : styles.item} {...props}>
      {children}
    </button>
  )
}

/** Un grupo que se despliega en su sitio, con su flecha que gira al abrirse (como los submenús del árbol) */
export function MenuGroup({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className={styles.group}>
      <button
        type="button"
        className={styles.item}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {icon}
        {label}
        <ChevronRight aria-hidden="true" size={14} className={styles.chevron} />
      </button>
      {open && (
        <div id={id} className={styles.sub}>
          {children}
        </div>
      )}
    </div>
  )
}
