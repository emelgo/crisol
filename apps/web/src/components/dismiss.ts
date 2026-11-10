import { type RefObject, useEffect } from 'react'

/** Abierto: pulsar fuera lo cierra; Escape también, y el foco vuelve a su botón (docs/diseno.md) */
export function useDismiss(
  open: boolean,
  close: () => void,
  root: RefObject<HTMLElement | null>,
  trigger: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!open) return
    // Pulsar su propio botón no cuenta como fuera: lo cierra el clic del botón (si no, se cerraba y se volvía a abrir)
    const outside = (event: Event) => {
      const target = event.target as Node
      if (root.current?.contains(target) || trigger.current?.contains(target)) return
      close()
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      close()
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open, close, root, trigger])
}
