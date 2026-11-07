/**
 * Lo que calcula el hilo de la visión (docs/specs/vision.md, ADR-0018 § 5): la vista del grupo de una campaña en una
 * escena con el núcleo de `@crisol/tabletop`. Lo que no depende de las fichas (`prepareVision`: los índices de los
 * muros y las áreas de las luces) se guarda por su clave (la escena tal como está y las puertas abiertas de la campaña)
 * hasta que cambie. Lo explorado se va sumando: lo que ven sus fichas ahora (no lo destapado a mano) y lo que vio cada
 * una por su camino. Puro salvo esa memoria: lo usa el hilo y, en las pruebas, quien quiera llamarlo directo
 */
import {
  type DoorStates,
  type Edge,
  FogGrid,
  firstWallOnPath,
  type Light,
  movementEdges,
  type PartyToken,
  type Point,
  type PreparedVision,
  partyView,
  prepareVision,
  type Wall,
  WallIndex
} from '@crisol/tabletop'

/** Lo de la escena que no cambia de una campaña a otra, ya en píxeles */
export interface SceneGeometry {
  width: number
  height: number
  walls: Wall[]
  lights: Light[]
  darkness: number
  automatic: boolean
}

/** Una ficha que el grupo puede ver o no: su centro y su radio, en píxeles */
export interface VisionTarget {
  id: string
  x: number
  y: number
  radius: number
}

/** Una ficha del grupo que se movió: con sus sentidos, de dónde a dónde (donde está ya lo ve) */
export interface WalkedPath {
  token: PartyToken
  from: Point
  to: Point
}

export interface ViewRequest {
  /** La de lo preparado: la escena (su versión y cuándo cambió) y las puertas abiertas de la campaña */
  key: string
  /** Solo hace falta si el hilo aún no tiene preparada esa clave (si falta, contesta `MISSING_SCENE`) */
  scene: SceneGeometry | null
  doors: DoorStates
  party: PartyToken[]
  /** Los caminos recorridos: se explora lo que se ve desde cada casilla, hasta el primer muro que frena el paso o la vista */
  walks: WalkedPath[]
  /** Cada cuánto se mira por el camino (una casilla), en píxeles */
  step: number
  targets: VisionTarget[]
  manual: unknown[]
  /** Lo explorado hasta ahora (comprimido), o null */
  explored: Uint8Array | null
}

export interface ViewResponse {
  /** Lo que ve el grupo ahora */
  visible: Uint8Array
  /** Lo explorado guardado (sin quitarle lo tapado a mano: si se deshace el tapar, vuelve) */
  explored: Uint8Array
  /** Lo explorado que se enseña: sin lo tapado a mano */
  exploredShown: Uint8Array
  exploredChanged: boolean
  /** Las luces que alumbran algo de lo visible: lo que alumbran de ello y si su centro se ve */
  lit: Array<{ id: string; cells: Uint8Array; originVisible: boolean }>
  /** Las fichas que el grupo ve */
  seen: string[]
}

/** Lo que contesta el hilo si le piden una clave que no tiene preparada sin mandarle la escena */
export const MISSING_SCENE = 'MISSING_SCENE'

/** Cuántas escenas preparadas se guardan a la vez en el hilo */
const PREPARED_KEEP = 24
/** Lo preparado de la visión y, para cortar los caminos, los tramos que frenan el paso */
export type Prepared = { vision: PreparedVision; move: WallIndex<Edge> }
const prepared = new Map<string, Prepared>()

/**
 * Cuántos puntos de los caminos se miran como mucho en una vista: cada uno es una vista entera desde allí (unos 3 ms
 * con miles de muros). Si hay más, se espacian
 */
export const MAX_WALK_STEPS = 16

function preparedFor(request: ViewRequest): Prepared {
  const found = prepared.get(request.key)
  if (found) {
    // La última usada, al final: se van primero las más viejas
    prepared.delete(request.key)
    prepared.set(request.key, found)
    return found
  }
  const { scene } = request
  if (!scene) throw new Error(MISSING_SCENE)
  const made = {
    vision: prepareVision({
      width: scene.width,
      height: scene.height,
      walls: scene.walls,
      doors: request.doors,
      lights: scene.lights,
      darkness: scene.darkness,
      automatic: scene.automatic
    }),
    move: new WallIndex(movementEdges(scene.walls, request.doors))
  }
  prepared.set(request.key, made)
  while (prepared.size > PREPARED_KEEP) {
    const oldest = prepared.keys().next().value
    if (oldest === undefined) break
    prepared.delete(oldest)
  }
  return made
}

/** Lo explorado guardado, si sigue siendo del mismo tamaño que el mapa; si no (otra imagen), vacío */
function exploredOf(data: Uint8Array | null, template: FogGrid): FogGrid {
  if (!data) return template.empty()
  try {
    const grid = FogGrid.decode(data)
    if (grid.width === template.width && grid.height === template.height && grid.cellSize === template.cellSize)
      return grid
  } catch {
    // Dañado: se empieza de cero
  }
  return template.empty()
}

/**
 * Los puntos desde los que se mira por los caminos: una casilla cada vez, desde donde estaba hasta antes de donde está
 * o del primer muro que frena el paso o la vista (lo de detrás no lo vio: saltó). Como mucho `MAX_WALK_STEPS`
 */
export function walkSteps(walks: readonly WalkedPath[], step: number, ready: Prepared): PartyToken[] {
  const usable = walks.flatMap(({ token, from, to }) => {
    const distance = Math.hypot(to.x - from.x, to.y - from.y)
    if (distance === 0) return []
    const cuts = [firstWallOnPath(from, to, ready.move), firstWallOnPath(from, to, ready.vision.sight)]
    const cut = Math.min(1, ...cuts.filter((t): t is number => t !== null))
    // Hasta antes del muro (encima de él ya sería verlo desde el otro lado) o de donde está
    const length = cut < 1 ? Math.max(0, cut * distance - 1) : distance
    return [{ token, from, to, distance, length }]
  })
  const total = usable.reduce((sum, walk) => sum + walk.length, 0)
  const stride = Math.max(step > 0 ? step : 100, total / MAX_WALK_STEPS)
  const points = usable.flatMap(({ token, from, to, distance, length }) => {
    const count = Math.max(1, Math.ceil(length / stride))
    return Array.from({ length: count }, (_, i) => {
      const k = (i * stride) / distance
      return { ...token, x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k }
    })
  })
  if (points.length <= MAX_WALK_STEPS) return points
  // Muchos caminos cortos: los repartidos a lo largo de todos
  return Array.from(
    { length: MAX_WALK_STEPS },
    (_, i) => points[Math.floor((i * points.length) / MAX_WALK_STEPS)]
  ).filter((p): p is PartyToken => p !== undefined)
}

export function computeView(request: ViewRequest): ViewResponse {
  const own = preparedFor(request)
  const ready = own.vision
  const view = partyView(ready, request.party, request.manual)
  // Las fichas del grupo se ven siempre, su huella al menos: también sin visión automática (con ella ya va dentro)
  if (ready.scene.automatic === false)
    for (const token of request.party) {
      const radius = Math.max(token.radius ?? 0, 1)
      view.visible.fillCircle(token, radius)
      view.sighted.fillCircle(token, radius)
    }
  const explored = exploredOf(request.explored, view.visible)
  const before = explored.count()
  // Solo lo que ven las fichas: lo destapado a mano no (si se deshace, vuelve a taparse)
  explored.union(view.sighted)
  // Lo que se vio desde cada punto del camino (sin la niebla a mano: lo tapado se quita al enseñarlo)
  if (ready.scene.automatic !== false)
    for (const step of walkSteps(request.walks, request.step, own))
      explored.union(partyView(ready, [step], []).sighted.subtract(view.covered))
  const shown = explored.clone().subtract(view.covered)
  return {
    visible: view.visible.encode(),
    explored: explored.encode(),
    exploredShown: shown.encode(),
    exploredChanged: explored.count() !== before,
    lit: view.litPolygons.map((area) => {
      const light = ready.lit.find((l) => l.light.id === area.id)?.light
      return {
        id: area.id,
        cells: area.cells.encode(),
        originVisible: light ? view.visible.hasPoint(light) : false
      }
    }),
    seen: [...new Set([...request.party.map((t) => t.id), ...view.tokensSeen(request.targets).map((t) => t.id)])]
  }
}

/** Olvida lo preparado de una escena (para las pruebas) */
export function forgetPrepared(): void {
  prepared.clear()
}
