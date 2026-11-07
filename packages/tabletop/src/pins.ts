// Portado de packages/mesa/src/nucleo/chinchetas.ts (Crisol actual, commit 3f68f11)
/**
 * Los pines de la mesa (llevan a páginas): el icono de Lucide y el color con que se pinta cada id guardado, la
 * etiqueta siguiente de los numerados y con letra, y el pin cuya casilla entera lleva a su página. Puro.
 */
import type { Point } from './geometry.ts'
import { cellAt, columnLetters, type Grid } from './grid.ts'

export interface PinIcon {
  /** Icono de Lucide ('' en los de una serie: se pinta su etiqueta) */
  icon: string
  color: string
}

const RED = '#b8433a'
const BLUE = '#3a6db8'
const GOLD = '#c9962c'
const GREEN = '#3e8e5a'
const PURPLE = '#7a4cb0'
const SEA = '#2f8f9b'
const EARTH = '#8a6440'
const STONE = '#6b6f78'

/** Los ids de pin con su icono de Lucide y su color */
const ICONS: Readonly<Record<string, PinIcon>> = {
  pin: { icon: 'map-pin', color: RED },
  location: { icon: 'map-pin', color: GREEN },
  note: { icon: 'scroll-text', color: BLUE },
  treasure: { icon: 'gem', color: GOLD },
  combat: { icon: 'swords', color: '#c46a2b' },
  boss: { icon: 'skull', color: PURPLE },
  lore: { icon: 'book-open', color: SEA },
  trap: { icon: 'triangle-alert', color: EARTH },
  quest: { icon: 'flag', color: '#4b4fb0' },
  important: { icon: 'star', color: GOLD },
  npc: { icon: 'user-round', color: '#b84a7a' },
  secret: { icon: 'eye-off', color: STONE },
  // Lugares
  world: { icon: 'globe', color: GREEN },
  map: { icon: 'map', color: GREEN },
  city: { icon: 'building-2', color: GREEN },
  village: { icon: 'house', color: GREEN },
  castle: { icon: 'castle', color: GREEN },
  tower: { icon: 'tower-control', color: GREEN },
  outpost: { icon: 'tent', color: GREEN },
  port: { icon: 'anchor', color: GREEN },
  farm: { icon: 'wheat', color: GREEN },
  road: { icon: 'route', color: GREEN },
  crossroads: { icon: 'signpost-big', color: GREEN },
  bridge: { icon: 'route', color: GREEN },
  signpost: { icon: 'signpost', color: GREEN },
  camp: { icon: 'tent', color: GREEN },
  forest: { icon: 'trees', color: GREEN },
  jungle: { icon: 'tree-palm', color: GREEN },
  mountain: { icon: 'mountain', color: GREEN },
  hills: { icon: 'mountain-snow', color: GREEN },
  waterfall: { icon: 'waves', color: GREEN },
  swamp: { icon: 'droplets', color: GREEN },
  desert: { icon: 'sun', color: GREEN },
  oasis: { icon: 'tree-palm', color: GREEN },
  island: { icon: 'tree-palm', color: GREEN },
  volcano: { icon: 'flame', color: GREEN },
  cave: { icon: 'mountain', color: GREEN },
  dungeon: { icon: 'door-closed', color: GREEN },
  ruins: { icon: 'landmark', color: GREEN },
  mine: { icon: 'pickaxe', color: GREEN },
  graveyard: { icon: 'cross', color: GREEN },
  'standing-stones': { icon: 'landmark', color: GREEN },
  shrine: { icon: 'church', color: GREEN },
  portal: { icon: 'circle-dashed', color: GREEN },
  lighthouse: { icon: 'lightbulb', color: GREEN },
  shipwreck: { icon: 'ship', color: GREEN },
  house: { icon: 'house', color: GREEN },
  manor: { icon: 'hotel', color: GREEN },
  temple: { icon: 'church', color: GREEN },
  inn: { icon: 'beer', color: GREEN },
  shop: { icon: 'store', color: GREEN },
  smithy: { icon: 'hammer', color: GREEN },
  library: { icon: 'library', color: GREEN },
  stable: { icon: 'warehouse', color: GREEN },
  well: { icon: 'circle-dot', color: GREEN },
  gate: { icon: 'door-open', color: GREEN },
  'secret-door': { icon: 'door-closed', color: GREEN },
  door: { icon: 'door-open', color: GREEN },
  stairs: { icon: 'arrow-down-to-line', color: GREEN },
  trapdoor: { icon: 'lock-keyhole', color: GREEN },
  pit: { icon: 'circle-dot', color: GREEN },
  lever: { icon: 'key-round', color: GREEN },
  cell: { icon: 'lock-keyhole', color: GREEN },
  throne: { icon: 'crown', color: GREEN },
  altar: { icon: 'church', color: GREEN },
  statue: { icon: 'landmark', color: GREEN },
  coffin: { icon: 'box', color: GREEN },
  'ritual-circle': { icon: 'circle-dashed', color: GREEN },
  bed: { icon: 'bed', color: GREEN },
  fireplace: { icon: 'flame-kindling', color: GREEN },
  cauldron: { icon: 'cooking-pot', color: GREEN },
  barrel: { icon: 'cylinder', color: GREEN },
  crate: { icon: 'package', color: GREEN },
  torch: { icon: 'flame', color: GREEN },
  desk: { icon: 'notebook-pen', color: GREEN },
  mirror: { icon: 'scan-face', color: GREEN },
  // Nombres de Lucide que usaban los pines antiguos
  scroll: { icon: 'scroll', color: BLUE },
  coins: { icon: 'coins', color: GOLD },
  swords: { icon: 'swords', color: '#c46a2b' },
  skull: { icon: 'skull', color: PURPLE },
  info: { icon: 'info', color: SEA },
  'alert-triangle': { icon: 'triangle-alert', color: EARTH },
  'map-pin': { icon: 'map-pin', color: RED },
  flag: { icon: 'flag', color: '#4b4fb0' },
  star: { icon: 'star', color: GOLD },
  heart: { icon: 'heart', color: '#b84a7a' },
  eye: { icon: 'eye', color: STONE }
}

/** Los iconos que se ofrecen para un pin nuevo (sin contar los numerados y con letra) */
export const PIN_ICONS = [
  'pin',
  'note',
  'treasure',
  'combat',
  'boss',
  'lore',
  'trap',
  'quest',
  'important',
  'npc',
  'secret',
  'location',
  'city',
  'castle',
  'inn',
  'dungeon',
  'cave',
  'forest',
  'mountain',
  'temple'
] as const

export type PinSeries = 'number' | 'letter'
export const isPinSeries = (icon: unknown): icon is PinSeries => icon === 'number' || icon === 'letter'

/** Cómo se pinta un pin de ese icono guardado: un id de la tabla, un nombre de Lucide o una serie */
export function pinIcon(icon: unknown): PinIcon {
  if (isPinSeries(icon)) return { icon: '', color: STONE }
  const fallback = ICONS.pin as PinIcon
  if (typeof icon !== 'string' || !icon) return fallback
  return ICONS[icon] ?? (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(icon) ? { icon, color: RED } : fallback)
}

/** La siguiente etiqueta libre de la serie (1, 2, 3… o A, B, C…), mirando las de los pines que ya hay */
export function nextPinLabel(series: PinSeries, used: readonly unknown[]): string {
  const taken = new Set(used.filter((u): u is string => typeof u === 'string'))
  for (let n = 1; ; n++) {
    const label = series === 'number' ? String(n) : columnLetters(n)
    if (!taken.has(label)) return label
  }
}

/** El pin de casilla entera (`cell`) que contiene `p`, el de más arriba si hay varios; o null */
export function linkedCellAt<T extends Point & { cell?: unknown }>(
  pins: readonly T[],
  grid: Grid | null,
  p: Point
): T | null {
  if (!grid) return null
  const target = cellAt(grid, p)
  for (let i = pins.length - 1; i >= 0; i--) {
    const pin = pins[i] as T
    if (pin.cell !== true) continue
    const own = cellAt(grid, pin)
    if (own.q === target.q && own.r === target.r) return pin
  }
  return null
}
