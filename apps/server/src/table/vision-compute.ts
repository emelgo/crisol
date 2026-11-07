/**
 * Lo que calcula el hilo de la visión (docs/specs/vision.md, ADR-0018 § 5): la vista del grupo de una campaña en una
 * escena con el núcleo de `@crisol/tabletop`. Lo que no depende de las fichas (`prepareVision`: los índices de los
 * muros y las áreas de las luces) se guarda por su clave (la escena tal como está y las puertas abiertas de la campaña)
 * hasta que cambie. Lo explorado se va sumando: lo que ve el grupo ahora y lo que vio en cada punto del camino de una ficha.
 * Puro salvo esa memoria: lo usa el hilo y, en las pruebas, quien quiera llamarlo directo
 */
import {
  type DoorStates,
  FogGrid,
  type Light,
  type PartyToken,
  type PreparedVision,
  partyView,
  prepareVision,
  type Wall
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

export interface ViewRequest {
  /** La de lo preparado: la escena (su versión y cuándo cambió) y las puertas abiertas de la campaña */
  key: string
  /** Solo hace falta si el hilo aún no tiene preparada esa clave (si falta, contesta `MISSING_SCENE`) */
  scene: SceneGeometry | null
  doors: DoorStates
  party: PartyToken[]
  /** Los puntos de los caminos recorridos (cada ficha con sus sentidos): se explora lo que se ve desde cada uno */
  paths: PartyToken[]
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
const prepared = new Map<string, PreparedVision>()

function preparedFor(request: ViewRequest): PreparedVision {
  const found = prepared.get(request.key)
  if (found) {
    // La última usada, al final: se van primero las más viejas
    prepared.delete(request.key)
    prepared.set(request.key, found)
    return found
  }
  const { scene } = request
  if (!scene) throw new Error(MISSING_SCENE)
  const made = prepareVision({
    width: scene.width,
    height: scene.height,
    walls: scene.walls,
    doors: request.doors,
    lights: scene.lights,
    darkness: scene.darkness,
    automatic: scene.automatic
  })
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

export function computeView(request: ViewRequest): ViewResponse {
  const ready = preparedFor(request)
  const view = partyView(ready, request.party, request.manual)
  // Las fichas del grupo se ven siempre, su huella al menos: también sin visión automática (con ella ya va dentro)
  if (ready.scene.automatic === false)
    for (const token of request.party) view.visible.fillCircle(token, Math.max(token.radius ?? 0, 1))
  const explored = exploredOf(request.explored, view.visible)
  const before = explored.count()
  explored.union(view.visible)
  // Lo que se vio desde cada punto del camino (sin la niebla a mano: lo tapado se quita al enseñarlo)
  if (ready.scene.automatic !== false)
    for (const step of request.paths) explored.union(partyView(ready, [step], []).visible.subtract(view.covered))
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
