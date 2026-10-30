/**
 * Entrar en un mundo y salir de él (transiciones de vista del navegador): la tarjeta del mundo se convierte en la
 * cabecera de su página, y al volver, al revés, mientras lo demás se acerca o se aleja (base.css). Lo marcado lleva el
 * nombre de transición; solo uno a la vez, el del mundo que se abre o del que se sale
 */
import type { CSSProperties } from 'react'

export const ENTER_WORLD = { types: ['entrar-mundo'] }
export const LEAVE_WORLD = { types: ['salir-mundo'] }

let current: string | null = null

/**
 * El mundo que se abre (al pulsar su tarjeta): ella lleva el nombre ya, antes de que se tome la foto de lo de antes, y
 * ninguna otra (la del mundo del que se salió antes aún lo tiene: con el nombre repetido, no habría transición). Y sube
 * el calor del crisol: unas brasas
 */
export function enterWorld(worldId: string, card: Element | null) {
  current = worldId
  for (const other of document.querySelectorAll<HTMLElement>('[style*="view-transition-name"]')) {
    if (other !== card && other.style.viewTransitionName === 'mundo-actual')
      other.style.removeProperty('view-transition-name')
  }
  if (card instanceof HTMLElement) card.style.setProperty('view-transition-name', 'mundo-actual')
  embers()
}

/**
 * Las brasas: un calor suave que sube desde abajo y unas chispas que se apagan (base.css, .brasas). Va aparte en la
 * transición (su nombre), así que se ve por encima mientras dura; luego se quita
 */
function embers() {
  if (typeof document.startViewTransition !== 'function') return
  const heat = document.createElement('div')
  heat.className = 'brasas'
  heat.setAttribute('aria-hidden', 'true')
  document.body.append(heat)
  window.setTimeout(() => heat.remove(), 1800)
}

/** Para la tarjeta y la cabecera de ese mundo: su nombre de transición */
export function worldTransition(worldId: string): CSSProperties | undefined {
  return current === worldId ? ({ viewTransitionName: 'mundo-actual' } as CSSProperties) : undefined
}
