/**
 * Entrar en un mundo y salir de él (transiciones de vista del navegador): la tarjeta del mundo se convierte en la
 * cabecera de su página, y al volver, al revés, mientras lo demás se acerca o se aleja (base.css). Lo marcado lleva el
 * nombre de transición; solo uno a la vez, el del mundo que se abre o del que se sale
 */
import type { CSSProperties } from 'react'

export const ENTER_WORLD = { types: ['entrar-mundo'] }
export const LEAVE_WORLD = { types: ['salir-mundo'] }

let current: string | null = null

/** El mundo que se abre (al pulsar su tarjeta): ella lleva el nombre ya, antes de que se tome la foto de lo de antes */
export function enterWorld(worldId: string, card: Element | null) {
  current = worldId
  if (card instanceof HTMLElement) card.style.setProperty('view-transition-name', 'mundo-actual')
}

/** Para la tarjeta y la cabecera de ese mundo: su nombre de transición */
export function worldTransition(worldId: string): CSSProperties | undefined {
  return current === worldId ? ({ viewTransitionName: 'mundo-actual' } as CSSProperties) : undefined
}
