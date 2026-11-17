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

/** Si el foco se ha perdido (quedó en body al quitar lo que lo tenía): solo entonces se lleva a otro sitio */
export function focusIsLost() {
  return !document.activeElement || document.activeElement === document.body
}

/**
 * Para el botón que abre algo (una confirmación, un formulario) y desaparece mientras está abierto: `ref`, para el
 * botón, y `back()` al cerrarlo, para que el foco vuelva a él en cuanto reaparezca. Si mientras tanto la persona ya ha
 * llevado el foco a otro sitio (a escribir en el cuerpo de la página), no se le quita
 */
export function useReturnFocus() {
  const pending = useRef(false)
  const ref = useCallback((element: HTMLElement | null) => {
    if (!element || !pending.current) return
    pending.current = false
    if (focusIsLost()) element.focus()
  }, [])
  const back = useCallback(() => {
    pending.current = true
  }, [])
  return { ref, back }
}

/** Donde se escribe: ahí las teclas (Supr, Escape) son del campo; una casilla, un color o un deslizador, no */
const TYPING =
  'textarea, select, input:not([type="checkbox"], [type="radio"], [type="range"], [type="color"], [type="button"])'

/**
 * Si una tecla de un lienzo (el mapa, la pizarra) le toca a él: con el foco en la columna de la página (sus botones, su
 * panel) o en ningún sitio, pero no donde se escribe ni en una ventana o un menú
 */
export function canvasKeyTarget(target: EventTarget | null, root: Element | null | undefined) {
  const element = target instanceof HTMLElement ? target : null
  if (!element || element === document.body) return true
  if (element.isContentEditable || element.closest(`${TYPING}, dialog, [role="dialog"], [role="menu"]`)) return false
  return Boolean(root?.contains(element))
}
