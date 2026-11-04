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
    const outside = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) close()
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
