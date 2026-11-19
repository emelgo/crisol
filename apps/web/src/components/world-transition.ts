/**
 * Las transiciones de la app (el estándar, docs/diseno.md, «Transiciones»; duraciones y curvas en tokens.css, --motion-*):
 * dentro de una vista (SECTION), fundido corto; entrar y salir de un espacio (un mundo, una campaña), la imagen de su
 * tarjeta viaja a la portada y vuelve a ella, en espejo, mientras lo demás se acerca o se aleja (base.css); entrar en un
 * elemento (una plantilla, un sistema), su icono y su nombre viajan al título. Lo que viaja lleva el nombre de
 * transición; solo uno a la vez, el del mundo que se abre o del que se sale
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
 * Lo que viaja entre la tarjeta y la portada: solo la imagen (data-portada-imagen), del tamaño en que se ve. Con la
 * tarjeta entera (con su texto) o una imagen más alta que su hueco, la foto se estiraba y salía enorme al salir (Enrique,
 * 2026-11-19: «no haciéndola grande sin sentido»)
 */
function coverOf(root: Element | null | undefined): HTMLElement | null {
  if (!root) return null
  if (root.matches('[data-portada-imagen]')) return root as HTMLElement
  // Dentro (la imagen de una tarjeta) o alrededor (la franja que enseña la portada del mundo en su página)
  return root.querySelector<HTMLElement>('[data-portada-imagen]') ?? root.closest<HTMLElement>('[data-portada-imagen]')
}

/**
 * El mundo que se abre (al pulsar su tarjeta): la imagen de su tarjeta lleva el nombre ya, antes de que se tome la foto
 * de lo de antes, y ninguna otra (la del mundo del que se salió antes aún lo tiene: con el nombre repetido, no habría
 * transición). Y sube el calor del crisol: unas brasas
 */
export function enterWorld(worldId: string, card: Element | null) {
  current = worldId
  const cover = coverOf(card)
  for (const other of document.querySelectorAll<HTMLElement>('[style*="view-transition-name"]')) {
    if (other !== cover && other.style.viewTransitionName === 'mundo-actual')
      other.style.removeProperty('view-transition-name')
  }
  cover?.style.setProperty('view-transition-name', 'mundo-actual')
  // El panel del mundo señalado (Mis mundos) no entra en la foto: la tarjeta es la que se convierte en la cabecera
  for (const panel of document.querySelectorAll<HTMLElement>('[data-vista-previa]')) panel.style.visibility = 'hidden'
  embers()
}

/**
 * Al salir de un mundo o de una campaña (por la llama), el espejo de entrar (Enrique, 2026-11-19): la imagen de su
 * portada, si está a la vista (data-mundo-portada), lleva ya el nombre antes de la foto de lo de antes, se encoge y
 * viaja a la imagen de su tarjeta, que lo recoge en Mis mundos (worldTransition); lo demás se aleja. Sin imagen, nada
 * viaja: un fundido. Y en vez de las brasas, humo: una bruma gris y bocanadas que suben y se disipan (base.css, .humo)
 */
export function leaveWorld(id: string | null = null) {
  current = id
  for (const named of document.querySelectorAll<HTMLElement>('[style*="view-transition-name"]')) {
    if (named.style.viewTransitionName === 'mundo-actual') named.style.removeProperty('view-transition-name')
  }
  const header = id ? document.getElementById('contenido')?.querySelector<HTMLElement>('[data-mundo-portada]') : null
  const cover = coverOf(header)
  // A la vista: ni por encima de la ventana ni escondida (con la cabecera pegada arriba, la franja no se ve)
  if (cover && cover.getBoundingClientRect().bottom > 0 && getComputedStyle(cover).visibility !== 'hidden')
    cover.style.setProperty('view-transition-name', 'mundo-actual')
  smoke()
}

/** Las brasas: un calor suave que sube desde abajo y unas chispas que se apagan (también al entrar en un sistema) */
export function embers() {
  overlay('brasas', 2500)
}

/** El humo de salir, sin más (al salir de un sistema: su icono y su nombre vuelven a su tarjeta) */
export function smoke() {
  overlay('humo', 3000)
}

/**
 * Una capa encima de todo, de adorno (base.css, .brasas y .humo): va aparte en la transición (su nombre), así que se ve por
 * encima mientras dura; luego se quita. Nunca a mitad de una transición de vista: es una de sus capas, y quitarla la
 * cortaría en seco (el salto del final, si la transición tardaba en llegar); ya apagada, espera a que acabe
 */
function overlay(className: string, ms: number) {
  if (typeof document.startViewTransition !== 'function') return
  // Una sola de cada (dos llevarían el mismo nombre y no habría transición)
  if (document.querySelector(`body > .${className}`)) return
  const layer = document.createElement('div')
  layer.className = className
  layer.setAttribute('aria-hidden', 'true')
  document.body.append(layer)
  const remove = () => {
    if (transitioning()) window.setTimeout(remove, 200)
    else layer.remove()
  }
  window.setTimeout(remove, ms)
}

/** Si hay una transición de vista en marcha (sin saberlo el navegador, no) */
function transitioning() {
  try {
    return document.documentElement.matches(':active-view-transition')
  } catch {
    return false
  }
}

/** Para la imagen de la tarjeta y de la portada de ese mundo (data-portada-imagen): su nombre de transición */
export function worldTransition(worldId: string): CSSProperties | undefined {
  return current === worldId ? ({ viewTransitionName: 'mundo-actual' } as CSSProperties) : undefined
}
