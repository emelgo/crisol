/**
 * Entrar en un mundo y salir de él (transiciones de vista del navegador): la tarjeta del mundo se convierte en la
 * cabecera de su página, y al volver, al revés, mientras lo demás se acerca o se aleja (base.css). Lo marcado lleva el
 * nombre de transición; solo uno a la vez, el del mundo que se abre o del que se sale
 */
import type { CSSProperties } from 'react'

export const ENTER_WORLD = { types: ['entrar-mundo'] }
export const LEAVE_WORLD = { types: ['salir-mundo'] }
/**
 * Entrar en el mundo que se dirige y salir de él, que va a pantalla completa (ADR-0027): lo mismo, y además la barra de
 * la app sale con el contenido al entrar y vuelve a entrar al salir
 */
export const ENTER_WORLD_FULL = { types: ['entrar-mundo', 'pantalla-completa'] }
export const LEAVE_WORLD_FULL = { types: ['salir-mundo', 'pantalla-completa'] }
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
export function enterWorld(worldId: string, card: Element | null, full = false) {
  current = worldId
  if (full) riseIntoFlame()
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
 * bocanadas de humo que suben, se ensanchan y se disipan (base.css, .humo). Del mundo a pantalla completa, el espejo de
 * entrar (Enrique, 2026-11-16: «debe ser la animación inversa a cuando entramos»): su cabecera fina vuelve a ser su
 * tarjeta de Mis mundos (las dos con el nombre mundo-actual), sus iconos suben al crisol y la barra de la app vuelve.
 * Fuera de él, la cabecera no vuelve a ser tarjeta: el mundo se aleja entero (la cabecera grande, con otra forma, se
 * veía estirada al encoger; Enrique, 2026-11-12)
 */
export function leaveWorld() {
  const full = leavingFull()
  current = full?.worldId ?? null
  for (const named of document.querySelectorAll<HTMLElement>('[style*="view-transition-name"]')) {
    if (named !== full?.header && named.style.viewTransitionName === 'mundo-actual')
      named.style.removeProperty('view-transition-name')
  }
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

/** Cuánto vale «recién»: lo que tarda en montarse lo nuevo dentro de la transición, con margen */
const RECENT = 1500
/** Lo que tarda cada icono en subir al crisol y el paso entre uno y otro (los de la barra: components/ribbon.tsx) */
const ICON_TIME = 460
const ICON_STEP = 70
let enteredFullAt = 0
let leftFullAt = 0
let leftIcons = 0

/** Recién entrado en un mundo a pantalla completa desde su tarjeta: la llama de su cabecera se aviva y salen sus iconos */
export const justEnteredFull = () => Date.now() - enteredFullAt < RECENT

/**
 * Recién salido de un mundo a pantalla completa por su llama: la barra de la app, que vuelve, expulsa a «Mundos» cuando
 * los iconos del mundo ya han subido (leave: cuánto tardan en subir todos), y su llama echa humo
 */
export const justLeftFull = () =>
  Date.now() - leftFullAt < RECENT ? { leave: leftIcons > 0 ? (leftIcons - 1) * ICON_STEP + ICON_TIME : 0 } : null

/** Quita un nombre de transición puesto a mano cuando la transición ya ha acabado */
const later = (clear: () => void) => window.setTimeout(clear, 3000)

/**
 * Al entrar en un mundo a pantalla completa (ADR-0027), lo de la barra de la app («Mundos», Plantillas…) sube a la
 * llama y se funde con ella, como antes: cada uno va aparte en la transición, con lo que tiene que subir (--sube-N, en
 * la raíz: de ella lo leen sus pseudoelementos; base.css). La llama de la barra se convierte en la de la cabecera
 */
function riseIntoFlame() {
  enteredFullAt = Date.now()
  const flame = document.querySelector<HTMLElement>('[data-tour="barra-llama"]')
  const box = flame?.getBoundingClientRect()
  if (!flame || !box) return
  flame.style.setProperty('view-transition-name', 'llama')
  const center = box.top + box.height / 2
  const root = document.documentElement
  const items = [...document.querySelectorAll<HTMLElement>('[data-rise]')].slice(0, 6)
  items.forEach((item, i) => {
    const at = item.getBoundingClientRect()
    item.style.setProperty('view-transition-name', `sube-${i}`)
    root.style.setProperty(`--sube-${i}`, `${Math.round(center - (at.top + at.height / 2))}px`)
  })
  later(() => {
    for (let i = 0; i < items.length; i++) root.style.removeProperty(`--sube-${i}`)
  })
}

/**
 * Al salir de un mundo a pantalla completa: su cabecera se convierte en su tarjeta (mundo-actual), su barra se aleja con
 * lo demás y los iconos de la barra suben al crisol del último al primero (cada uno aparte en la transición, con su
 * retraso: --sale-N). Devuelve la cabecera y su mundo; fuera de él, nada
 */
function leavingFull(): { header: HTMLElement; worldId: string } | null {
  const header = document.querySelector<HTMLElement>('[data-cabecera-mundo]')
  const worldId = /^\/mundos\/([^/]+)/.exec(window.location.pathname)?.[1]
  if (!header || !worldId) return null
  leftFullAt = Date.now()
  header.style.setProperty('view-transition-name', 'mundo-actual')
  const root = document.documentElement
  const icons = [...document.querySelectorAll<HTMLElement>('[data-world-icons] > *')].slice(0, 6)
  leftIcons = icons.length
  icons.forEach((icon, i) => {
    icon.style.setProperty('view-transition-name', `icono-mundo-${i}`)
    root.style.setProperty(`--sale-${i}`, `${(icons.length - 1 - i) * ICON_STEP}ms`)
  })
  later(() => {
    for (let i = 0; i < icons.length; i++) root.style.removeProperty(`--sale-${i}`)
  })
  return { header, worldId }
}
