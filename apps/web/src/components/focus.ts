import { useCallback, useRef } from 'react'

/** Qué se puede enfocar dentro de un elemento de una lista */
const CONTROLS = 'a[href], button, input, select, textarea, summary'

/** Para pasar como ref: lleva el foco al elemento en cuanto se monta (es siempre la misma función: solo entonces) */
export function focusOnMount(element: HTMLElement | null) {
  element?.focus()
}

/**
 * Antes de quitar un elemento de una lista, devuelve con qué llevar luego el foco a algo con sentido: el primer
 * control del siguiente (o del anterior) o, si no queda ninguno, el título de la página
 */
export function focusAfterRemoving(item: Element | null | undefined) {
  const neighbours: Element[] = []
  for (let next = item?.nextElementSibling; next; next = next.nextElementSibling) neighbours.push(next)
  for (let previous = item?.previousElementSibling; previous; previous = previous.previousElementSibling) {
    neighbours.push(previous)
  }
  const target = neighbours.map((n) => n.querySelector<HTMLElement>(CONTROLS)).find(Boolean)
  return () => {
    const focused = target?.isConnected ? target : document.querySelector<HTMLElement>('main h1')
    focused?.focus()
  }
}

/**
 * Para el botón que abre algo (una confirmación, un formulario) y desaparece mientras está abierto: `ref`, para el
 * botón, y `back()` al cerrarlo, para que el foco vuelva a él en cuanto reaparezca
 */
export function useReturnFocus() {
  const pending = useRef(false)
  const ref = useCallback((element: HTMLElement | null) => {
    if (!element || !pending.current) return
    pending.current = false
    element.focus()
  }, [])
  const back = useCallback(() => {
    pending.current = true
  }, [])
  return { ref, back }
}
