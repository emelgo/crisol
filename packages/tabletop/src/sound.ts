/**
 * Los sonidos del mapa (docs/specs/sonido-mapa.md): cuánto se oye uno desde un punto. Dentro de su radio, con suavizado,
 * baja con una curva coseno (entero en el centro, nada en el borde); sin él, entero hasta el borde. Los muros que paran
 * el sonido lo frenan (no pasa) o lo amortiguan (pasa más bajo y apagado), según el sonido; uno limitado deja pasar el
 * primero que se cruza. De varios oyentes, manda el que lo oye más fuerte. Puro: lo calcula cada aparato
 */
import type { Point } from './geometry.ts'
import { crossesWall } from './movement.ts'
import { type DoorStates, type Edge, type Wall, wallEdges } from './walls.ts'

export interface MapSound {
  id: string
  x: number
  y: number
  /** En píxeles de la imagen */
  radius: number
  /** 0–1 */
  volume: number
  easing: boolean
  /** Qué hacen los muros que paran el sonido: lo frenan o lo amortiguan */
  walls: 'block' | 'muffle'
}

/** Lo que baja un sonido amortiguado por un muro */
export const MUFFLED_GAIN = 0.35

export interface Heard {
  gain: number
  muffled: boolean
}

const SILENT: Heard = { gain: 0, muffled: false }

/** Los tramos que paran el sonido: sin los que no lo paran ni las puertas abiertas */
export const soundEdges = (walls: readonly Wall[], doors: DoorStates): Edge[] => wallEdges(walls, doors, 'sound')

/** Si los muros tapan el camino del sonido al oyente: uno entero o dos limitados */
function walled(from: Point, to: Point, edges: readonly Edge[]): boolean {
  const minX = Math.min(from.x, to.x)
  const maxX = Math.max(from.x, to.x)
  const minY = Math.min(from.y, to.y)
  const maxY = Math.max(from.y, to.y)
  let limited = 0
  for (const edge of edges) {
    // Solo los que caen cerca del camino
    if (Math.max(edge.a.x, edge.b.x) < minX || Math.min(edge.a.x, edge.b.x) > maxX) continue
    if (Math.max(edge.a.y, edge.b.y) < minY || Math.min(edge.a.y, edge.b.y) > maxY) continue
    if (!crossesWall(from, to, [edge])) continue
    if (!edge.limited) return true
    limited += 1
    if (limited > 1) return true
  }
  return false
}

/** Cuánto se oye un sonido desde un punto (0–1, con su volumen) y si llega amortiguado */
export function hearSound(sound: MapSound, listener: Point, edges: readonly Edge[]): Heard {
  if (sound.radius <= 0 || sound.volume <= 0) return SILENT
  const distance = Math.hypot(listener.x - sound.x, listener.y - sound.y)
  if (distance >= sound.radius) return SILENT
  const falloff = sound.easing ? 0.5 * (1 + Math.cos((Math.PI * distance) / sound.radius)) : 1
  const gain = sound.volume * falloff
  if (!walled(sound, listener, edges)) return { gain, muffled: false }
  return sound.walls === 'muffle' ? { gain: gain * MUFFLED_GAIN, muffled: true } : SILENT
}

/** Los sonidos que se oyen desde unos oyentes, cada uno con el que más lo oye */
export function audibleSounds<S extends MapSound>(
  sounds: readonly S[],
  listeners: readonly Point[],
  edges: readonly Edge[]
): Array<Heard & { sound: S }> {
  const out: Array<Heard & { sound: S }> = []
  for (const sound of sounds) {
    let best = SILENT
    for (const listener of listeners) {
      const heard = hearSound(sound, listener, edges)
      if (heard.gain > best.gain) best = heard
    }
    if (best.gain > 0) out.push({ ...best, sound })
  }
  return out
}
