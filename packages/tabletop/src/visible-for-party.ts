/**
 * Lo que ve el grupo, de principio a fin (ADR-0018 §§ 4–6): lo que el servidor calcula para la pantalla de la tele.
 * Cada ficha del grupo ve lo iluminado en su línea de visión, lo que alcanza su visión en la oscuridad (salvo en la
 * oscuridad mágica), lo que alcanza su vista ciega o verdadera y su propia huella; lo que ve el grupo es la unión, más lo
 * destapado a mano, menos lo tapado a mano (que manda siempre). Sin visión automática solo cuenta la niebla a mano.
 * Lo que no depende de las fichas (los índices de los muros, las áreas de las luces, lo iluminado) se prepara aparte con
 * `prepareVision`, para guardarlo por campaña y escena. Puro: sin DOM ni render.
 */

import { manualFog } from './fog.ts'
import { FogGrid } from './fog-grid.ts'
import type { Point } from './geometry.ts'
import { activeLights, ambientLight, LIT_THRESHOLD, type Light, lightPolygon } from './light.ts'
import { darknessEdges, darknessZones, type PartyToken, type TokenSight, tokenSight } from './party-vision.ts'
import { WallIndex } from './wall-index.ts'
import { type DoorStates, type Edge, type Wall, wallEdges } from './walls.ts'

export interface VisionScene {
  /** Tamaño del mapa, en píxeles */
  width: number
  height: number
  /** Píxeles por bit de la niebla (10 por defecto) */
  cellSize?: number
  walls: readonly Wall[]
  doors: DoorStates
  lights: readonly Light[]
  /** 0 de día, 1 noche cerrada */
  darkness: number
  /** Las luces apagadas en la campaña */
  lightsOff?: ReadonlySet<string>
  /** Sin visión automática (un mapa sin muros): solo vale la niebla a mano */
  automatic?: boolean
  /** Desde cuánta luz ven algo los ojos */
  threshold?: number
}

/** Una luz encendida con su área (recortada por los muros) y sus celdas */
export interface LitArea {
  light: Light
  polygon: Point[]
  cells: FogGrid
}

/** Lo que no depende de las fichas: se calcula al cambiar los muros, una puerta o una luz */
export interface PreparedVision {
  scene: VisionScene
  sight: WallIndex<Edge>
  /** La vista con los bordes de la oscuridad mágica, que no se atraviesan */
  sightWithDarkness: WallIndex<Edge>
  light: WallIndex<Edge>
  lit: LitArea[]
  /** Lo que tapa la oscuridad mágica */
  darknessCells: FogGrid
  /** Lo iluminado (por la luz ambiental o por las luces), sin la oscuridad mágica */
  litCells: FogGrid
}

export interface PartyView {
  /** Lo que está a la vista del grupo ahora */
  visible: FogGrid
  /** Lo destapado y lo tapado a mano (lo tapado también se quita de lo explorado) */
  revealed: FogGrid
  covered: FogGrid
  /** Las luces que alumbran algo de lo que se ve, con su área */
  litPolygons: { id: string; polygon: Point[] }[]
  /** Lo que ve cada ficha del grupo */
  sights: TokenSight[]
  /** Las que el grupo ve (o nota con su sentido sísmico) de entre unas fichas: su centro o su borde, a la vista */
  tokensSeen<T extends Point & { radius?: number }>(targets: readonly T[]): T[]
}

export function prepareVision(scene: VisionScene): PreparedVision {
  const template = new FogGrid(Math.ceil(scene.width), Math.ceil(scene.height), scene.cellSize)
  const threshold = scene.threshold ?? LIT_THRESHOLD
  const sightEdges = wallEdges(scene.walls, scene.doors, 'sight')
  const light = new WallIndex(wallEdges(scene.walls, scene.doors, 'light'))
  const sight = new WallIndex(sightEdges)
  const active = activeLights(scene.lights, scene.darkness, scene.lightsOff)
  const zones = darknessZones(active, light)
  const sightWithDarkness = zones.length > 0 ? new WallIndex([...sightEdges, ...darknessEdges(zones)]) : sight
  const darknessCells = template.empty()
  for (const zone of zones) darknessCells.fillPolygon(zone)
  const lit: LitArea[] = []
  for (const l of active) {
    if (l.darkness) continue
    const polygon = lightPolygon(l, light, threshold)
    if (polygon.length < 3) continue
    lit.push({ light: l, polygon, cells: template.empty().fillPolygon(polygon) })
  }
  const litCells = template.empty()
  if (ambientLight(scene.darkness) >= threshold) litCells.fill(true)
  else for (const area of lit) litCells.union(area.cells)
  litCells.subtract(darknessCells)
  return { scene, sight, sightWithDarkness, light, lit, darknessCells, litCells }
}

/** Lo que ve el grupo con lo preparado de la escena, sus fichas y la niebla a mano */
export function partyView(
  prepared: PreparedVision,
  tokens: readonly PartyToken[],
  manualOperations: Iterable<unknown>
): PartyView {
  const { scene, litCells, darknessCells } = prepared
  const { revealed, covered } = manualFog(manualOperations, litCells.width, litCells.height, litCells.cellSize)
  const visible = litCells.empty()
  const sights: TokenSight[] = []
  if (scene.automatic !== false) {
    const unlimited = Math.hypot(scene.width, scene.height) * 2
    const sources = { plain: prepared.sight, withDarkness: prepared.sightWithDarkness }
    const line = litCells.empty()
    const seen = litCells.empty()
    for (const token of tokens) {
      const sight = tokenSight(token, sources, unlimited)
      sights.push(sight)
      line.fill(false).fillPolygon(sight.polygon)
      seen.fill(false)
      if (sight.darkvision > 0) seen.fillCircle(sight.origin, sight.darkvision).subtract(darknessCells)
      seen.union(litCells)
      seen.fillCircle(sight.origin, sight.beyondDarkness)
      seen.fillCircle(sight.origin, sight.footprint)
      visible.union(seen.intersect(line))
    }
  }
  visible.union(revealed).subtract(covered)
  const litPolygons = prepared.lit
    .filter((area) => area.cells.intersects(visible))
    .map((area) => ({ id: area.light.id, polygon: area.polygon }))
  const tokensSeen = <T extends Point & { radius?: number }>(targets: readonly T[]): T[] =>
    targets.filter((target) => {
      const r = (target.radius ?? 0) * 0.5
      const probes = [
        target,
        ...(r > 0
          ? [-1, 1].flatMap((s) => [
              { x: target.x + s * r, y: target.y },
              { x: target.x, y: target.y + s * r }
            ])
          : [])
      ]
      if (probes.some((p) => visible.hasPoint(p))) return true
      if (covered.hasPoint(target)) return false
      return sights.some(
        (s) => s.tremorsense > 0 && Math.hypot(s.origin.x - target.x, s.origin.y - target.y) <= s.tremorsense
      )
    })
  return { visible, revealed, covered, litPolygons, sights, tokensSeen }
}

/** Lo que ve el grupo, preparando la escena cada vez (para guardar lo preparado, `prepareVision` y `partyView`) */
export function visibleForParty(
  input: VisionScene & { tokens: readonly PartyToken[]; manualFog: Iterable<unknown> }
): PartyView {
  return partyView(prepareVision(input), input.tokens, input.manualFog)
}
