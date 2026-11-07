/**
 * Las fichas en la mesa (docs/specs/fichas.md), lo que no es dibujo: qué ficha hay bajo el cursor, cuáles caen en un
 * recuadro, dónde queda una al soltarla (libre o pegada a la rejilla con Mayús), las flechas, la formación de un
 * encuentro y el estado en palabras. Puro: lo usan la mesa, la tele y sus pruebas
 */
import type { SceneGrid } from '@crisol/contracts'
import { type Point, type Rect, snapToken } from '@crisol/tabletop'
import { coreGrid } from './view.ts'

/** Lo que hace falta de una ficha para colocarla */
export interface Placed {
  id: string
  x: number
  y: number
  size: number
}

/** El lado de una casilla en píxeles del mapa (sin rejilla, uno razonable) */
export const cellSide = (grid: SceneGrid) => (grid.type === 'none' ? 100 : grid.size)

/** El radio de una ficha en píxeles del mapa: su tamaño en casillas, un poco menos que la casilla */
export const tokenRadius = (token: Pick<Placed, 'size'>, grid: SceneGrid) => (token.size * cellSide(grid) * 0.92) / 2

/** La ficha que hay en un punto del mapa: la de encima (la última pintada) */
export function tokenAt<T extends Placed>(tokens: readonly T[], point: Point, grid: SceneGrid): T | null {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i] as T
    if (Math.hypot(point.x - token.x, point.y - token.y) <= tokenRadius(token, grid)) return token
  }
  return null
}

/** Las fichas cuyo centro cae en un recuadro (en píxeles del mapa, en cualquier sentido) */
export function tokensIn<T extends Placed>(tokens: readonly T[], a: Point, b: Point): T[] {
  const box: Rect = {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y)
  }
  return tokens.filter((t) => t.x >= box.x && t.x <= box.x + box.width && t.y >= box.y && t.y <= box.y + box.height)
}

/** Dónde queda una ficha soltada: libre o, con Mayús, en su casilla (según su tamaño) */
export function dropAt(point: Point, size: number, grid: SceneGrid, snap: boolean): Point {
  const core = coreGrid(grid)
  return snap && core
    ? snapToken(core, point, size)
    : { x: Math.round(point.x * 10) / 10, y: Math.round(point.y * 10) / 10 }
}

/**
 * Arrastrar varias: todas se mueven lo mismo que la que se lleva; con Mayús, la que se lleva pega a la rejilla y las
 * demás la siguen con su separación
 */
export function dragMoves(
  tokens: readonly Placed[],
  lead: Placed,
  to: Point,
  grid: SceneGrid,
  snap: boolean
): Array<{ tokenId: string; x: number; y: number }> {
  const at = dropAt(to, lead.size, grid, snap)
  const dx = at.x - lead.x
  const dy = at.y - lead.y
  return tokens.map((t) => ({ tokenId: t.id, x: t.x + dx, y: t.y + dy }))
}

/** Las flechas: una casilla en esa dirección */
export function arrowMoves(
  tokens: readonly Placed[],
  key: string,
  grid: SceneGrid
): Array<{ tokenId: string; x: number; y: number }> | null {
  const step = cellSide(grid)
  const delta: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step]
  }
  const d = delta[key]
  if (!d || tokens.length === 0) return null
  return tokens.map((t) => ({ tokenId: t.id, x: t.x + d[0], y: t.y + d[1] }))
}

/**
 * La formación de un encuentro con las fichas elegidas: por cada clave del compendio, sus copias con su sitio en
 * casillas desde la de arriba a la izquierda del grupo (redondeado a casillas enteras)
 */
export function formationOf(
  members: ReadonlyArray<{ key: string; unique: boolean; x: number; y: number }>,
  grid: SceneGrid
): Array<{ key: string; unique: boolean; at: Array<{ dx: number; dy: number }> }> {
  if (members.length === 0) return []
  const cell = cellSide(grid)
  const x0 = Math.min(...members.map((m) => m.x))
  const y0 = Math.min(...members.map((m) => m.y))
  const groups = new Map<string, { key: string; unique: boolean; at: Array<{ dx: number; dy: number }> }>()
  for (const m of members) {
    const id = `${m.key}|${m.unique}`
    const group = groups.get(id) ?? { key: m.key, unique: m.unique, at: [] }
    group.at.push({ dx: Math.round((m.x - x0) / cell), dy: Math.round((m.y - y0) / cell) })
    groups.set(id, group)
  }
  return [...groups.values()]
}

/** De una vida, cómo está en palabras (como lo ven los jugadores en el módulo 5) */
export function lifeState(life: { value: number; max: number } | null) {
  if (!life || life.max <= 0) return null
  if (life.value <= 0) return 'down' as const
  if (life.value >= life.max) return 'unhurt' as const
  if (life.value <= life.max / 4) return 'dying' as const
  if (life.value <= life.max / 2) return 'bloodied' as const
  return 'hurt' as const
}

/** La inicial de un rótulo (para el disco de una ficha sin imagen) */
export const initialOf = (label: string) => (label.trim()[0] ?? '?').toLocaleUpperCase('es')
