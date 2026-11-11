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
/** Entrar en un elemento desde su tarjeta (una plantilla): su icono y su nombre van al título, sin fuego */
export const ENTER_ITEM = { types: ['entrar-elemento'] }

/** Volver de un elemento a su lista: al revés, su icono y su nombre vuelven del título a su tarjeta */
export const LEAVE_ITEM = { types: ['salir-elemento'] }

let currentItem: string | null = null

/**
 * Al pulsar la tarjeta de un elemento: su icono y su nombre llevan ya el nombre de transición antes de que se tome la
 * foto de lo de antes (y ningún otro), para que viajen al título de lo que se abre
 */
export function enterItem(id: string, card: Element | null) {
  currentItem = id
  for (const part of ['icono', 'nombre']) {
    for (const other of document.querySelectorAll<HTMLElement>(`[data-elemento="${part}"]`))
      other.style.removeProperty('view-transition-name')
    const mine = card?.querySelector<HTMLElement>(`[data-elemento="${part}"]`)
    mine?.style.setProperty('view-transition-name', `elemento-${part}`)
  }
}

/**
 * Al volver a la lista desde un elemento abierto (root, su vista): su icono y su nombre del título llevan ya el nombre de
 * transición antes de la foto de lo de antes, y en la lista lo recoge su tarjeta (itemTransition)
 */
export function leaveItem(id: string, root: Element | null) {
  currentItem = id
  for (const part of ['icono', 'nombre']) {
    for (const other of document.querySelectorAll<HTMLElement>(`[data-elemento="${part}"]`))
      other.style.removeProperty('view-transition-name')
    root
      ?.querySelector<HTMLElement>(`[data-elemento="${part}"]`)
      ?.style.setProperty('view-transition-name', `elemento-${part}`)
  }
}

/** Para el icono y el nombre del título del elemento abierto: su nombre de transición, si se entró desde su tarjeta */
export function itemTransition(id: string, part: 'icono' | 'nombre'): CSSProperties | undefined {
  return currentItem === id ? ({ viewTransitionName: `elemento-${part}` } as CSSProperties) : undefined
}

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
  // El panel del mundo señalado (Mis mundos) no entra en la foto: la tarjeta es la que se convierte en la cabecera
  for (const panel of document.querySelectorAll<HTMLElement>('[data-vista-previa]')) panel.style.visibility = 'hidden'
  embers()
}

/**
 * Al salir de un mundo (por la llama): como las brasas al entrar, pero apagadas: una bruma gris que sube desde abajo y
 * bocanadas de humo que suben, se ensanchan y se disipan (base.css, .humo)
 */
export function leaveWorld() {
  overlay('humo', 3000)
}

/** Las brasas: un calor suave que sube desde abajo y unas chispas que se apagan */
function embers() {
  overlay('brasas', 2500)
}

/**
 * Una capa encima de todo, de adorno (base.css, .brasas y .humo): va aparte en la transición (su nombre), así que se ve por
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
