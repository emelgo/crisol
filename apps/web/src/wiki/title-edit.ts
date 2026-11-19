/**
 * «Renombrar» (en el menú del árbol de páginas o en el de una plantilla) no abre un cuadro: pone en edición el título de
 * la propia página, con todo elegido para escribir encima (Enrique, 2026-11-19: «el renombrar solo pone en edición la
 * propia página, no abre un cuadro»). Quien lo pide abre la página si hace falta y llama a requestTitleEdit; su título lo
 * toma al montarse (si se acaba de abrir) o al momento (si ya estaba abierta)
 */
import { useEffect, useRef } from 'react'

const EVENT = 'crisol:editar-titulo'

/** La página cuyo título hay que poner en edición en cuanto se vea (si aún no se ha abierto) */
let pending: string | null = null

/** Pone en edición el título de esa página (o de la de esa plantilla): ya, si está abierta; si no, en cuanto se abra */
export function requestTitleEdit(key: string) {
  pending = key
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: key }))
}

/**
 * El título de una página: llama a edit cuando se pide renombrarla (una vez por petición). key: el id de la página, o
 * el de la plantilla si es la página de una plantilla (su menú no sabe el id de su página)
 */
export function useTitleEditRequest(key: string, edit: () => void) {
  const latest = useRef(edit)
  latest.current = edit
  useEffect(() => {
    const take = () => {
      pending = null
      latest.current()
    }
    if (pending === key) take()
    const onRequest = (event: Event) => {
      if ((event as CustomEvent<string>).detail === key) take()
    }
    window.addEventListener(EVENT, onRequest)
    return () => window.removeEventListener(EVENT, onRequest)
  }, [key])
}
