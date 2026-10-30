/**
 * Entrar en un mundo y salir de él (transiciones de vista del navegador): la tarjeta del mundo se convierte en la
 * cabecera de su página, y al volver, al revés, mientras lo demás se acerca o se aleja (base.css). Lo marcado lleva el
 * nombre de transición; solo uno a la vez, el del mundo que se abre o del que se sale
 */
import type { CSSProperties } from 'react'

export const ENTER_WORLD = { types: ['entrar-mundo'] }
export const LEAVE_WORLD = { types: ['salir-mundo'] }
/** Cambiar de pestaña en la barra (dentro de una vista): rápido, sin fuego */
export const SECTION = { types: ['seccion'] }

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
 * Al salir de un mundo (por la llama): de su cabecera, que vuelve a ser tarjeta, sube humo, como de un fuego que se
 * apaga. Unas volutas finas que se retuercen al subir (un filtro de turbulencia, base.css .humo), solo sobre ella
 */
export function leaveWorld() {
  if (typeof document.startViewTransition !== 'function') return
  const header = document.querySelector<HTMLElement>('[data-cabecera-mundo]')
  if (!header) return
  const box = header.getBoundingClientRect()
  const layer = document.createElement('div')
  layer.className = 'humo'
  layer.setAttribute('aria-hidden', 'true')
  Object.assign(layer.style, {
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`
  })
  // El filtro que las retuerce, que se mueve solo; y las volutas, a lo ancho, cada una a su ritmo
  layer.innerHTML = `<svg width="0" height="0" style="position:absolute"><filter id="humo-retorcido"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.035" numOctaves="3" seed="7"><animate attributeName="baseFrequency" dur="2.6s" values="0.012 0.035;0.02 0.05" fill="freeze"/></feTurbulence><feDisplacementMap in="SourceGraphic" scale="46"/></filter></svg>${[
    8, 21, 34, 47, 60, 73, 86
  ]
    .map(
      (x, i) =>
        `<span class="voluta" style="left:${x}%;--giro:${i % 2 ? -14 : 12}deg;animation-delay:${[0, 160, 60, 240, 120, 300, 200][i]}ms"></span>`
    )
    .join('')}`
  document.body.append(layer)
  window.setTimeout(() => layer.remove(), 3200)
}

/** Las brasas: un calor suave que sube desde abajo y unas chispas que se apagan */
function embers() {
  overlay('brasas', 2500)
}

/**
 * Una capa encima de todo, de adorno (base.css, .brasas): va aparte en la transición (su nombre), así que se ve por
 * encima mientras dura; luego se quita
 */
function overlay(className: string, ms: number) {
  if (typeof document.startViewTransition !== 'function') return
  const layer = document.createElement('div')
  layer.className = className
  layer.setAttribute('aria-hidden', 'true')
  document.body.append(layer)
  window.setTimeout(() => layer.remove(), ms)
}

/** Para la tarjeta y la cabecera de ese mundo: su nombre de transición */
export function worldTransition(worldId: string): CSSProperties | undefined {
  return current === worldId ? ({ viewTransitionName: 'mundo-actual' } as CSSProperties) : undefined
}
