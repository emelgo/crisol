/**
 * La vista del grupo en el servidor (docs/specs/vision.md, ADR-0018 §§ 4–6): lee de la base lo de la escena (muros,
 * puertas, luces, guardados en memoria por su versión) y lo de la campaña (sus puertas, su niebla a mano, lo
 * explorado), lo manda al hilo de la visión y guarda lo explorado que crece. Cada vista se guarda en memoria por
 * campaña y escena: mientras no cambie nada de lo que la decide (la escena, las puertas, las fichas, la niebla a
 * mano), no se recalcula
 */
import { createHash } from 'node:crypto'
import { Worker } from 'node:worker_threads'
import { type Database, type scenesRepo, visionRepo } from '@crisol/db'
import {
  type DoorStates,
  distanceToPixels,
  FOG_CELL_SIZE,
  FogGrid,
  type Light,
  type PartyToken,
  type Senses,
  type Wall
} from '@crisol/tabletop'
import type { CropRequest } from './tile-crop.ts'
import {
  MISSING_SCENE,
  type SceneGeometry,
  type ViewRequest,
  type ViewResponse,
  type WalkedPath
} from './vision-compute.ts'

/** El lado del mapa de una escena sin imagen, en píxeles: la niebla necesita un tamaño */
export const NO_IMAGE_SIDE = 8192

/** Una ficha de la escena para la visión: las del grupo miran (con sus sentidos, en píxeles) y todas se pueden ver */
export interface VisionToken {
  id: string
  x: number
  y: number
  /** Radio de su huella, en píxeles */
  radius: number
  party: boolean
  senses?: Senses
}

type SceneRow = Pick<
  scenesRepo.SceneRow,
  'id' | 'worldId' | 'version' | 'updatedAt' | 'width' | 'height' | 'grid' | 'darkness' | 'automaticVision'
>

/**
 * Lo que dice que la escena (sus muros y luces) es la misma: su versión y cuándo cambió. La versión sola no basta:
 * deshacer la devuelve a la de antes, y otro cambio después la vuelve a subir con otro contenido
 */
const sceneStamp = (scene: Pick<SceneRow, 'version' | 'updatedAt'>) => `${scene.version}:${scene.updatedAt.getTime()}`

/** Una ficha que se movió: de dónde a dónde */
export interface WalkedMove {
  tokenId: string
  from: { x: number; y: number }
  to: { x: number; y: number }
}

export interface VisionInput {
  campaignId: string
  scene: SceneRow
  tokens: readonly VisionToken[]
  /** Los caminos recorridos por las fichas del grupo: se explora lo que se ve por ellos */
  walks?: readonly WalkedPath[]
}

export interface VisionResult {
  sceneId: string
  automatic: boolean
  darkness: number
  width: number
  height: number
  cellSize: number
  /** Lo que ve el grupo ahora y lo explorado que se enseña (sin lo tapado a mano), en rejilla y en base64 */
  visible: FogGrid
  explored: FogGrid
  visibleData: string
  exploredData: string
  /** Lo que la pantalla puede ver del mapa: lo explorado y lo visible */
  screenMask: FogGrid
  screenMaskData: Uint8Array
  /** Las luces que alumbran algo de lo visible, recortadas a ello (en base64), con su luz en píxeles */
  lit: Array<{ light: Light; cells: string; originVisible: boolean }>
  seen: ReadonlySet<string>
  /** Si está abierta cada puerta en la campaña, por el id de su muro */
  doors: Readonly<Record<string, boolean>>
  /** Las puertas secretas de la escena */
  secretDoors: ReadonlyArray<{ id: string; open: boolean }>
}

export interface Vision {
  view(input: VisionInput): Promise<VisionResult>
  /** La última vista calculada de una campaña en una escena, si la hay y nada ha cambiado desde entonces */
  peek(campaignId: string, sceneId: string): VisionResult | null
  /** Algo cambió en la mesa de una campaña o en una escena: sus vistas ya no valen para `peek` */
  invalidate(where: { campaignId?: string; sceneId?: string }): void
  /**
   * Unas fichas se acaban de mover de `from` a `to`: la próxima vista de la campaña en la escena explora también lo que
   * se ve desde cada casilla de su camino (si son del grupo). Se apunta aquí para no esperar a calcularlo al moverlas
   */
  walked(campaignId: string, sceneId: string, moves: readonly WalkedMove[]): void
  /** Lo que se apuntó con `walked` y aún no se ha explorado (se saca: lo explora quien lo pide) */
  takeWalked(campaignId: string, sceneId: string): WalkedMove[]
  /** Para lo que se calcula sin nadie esperando: su fallo, al registro */
  report(error: unknown): void
  /** Recorta una tesela con la máscara (en el hilo) */
  crop(request: CropRequest): Promise<Uint8Array>
  /**
   * Hace algo con lo explorado de una campaña en una escena (reiniciar su niebla) sin que una vista se cruce, y lo
   * olvida de la memoria
   */
  reset<T>(campaignId: string, sceneId: string, work: () => Promise<T>): Promise<T>
  close(): Promise<void>
}

const base64 = (bytes: Uint8Array) => Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64')

/** Un hilo al que se le piden cosas y contesta por número, en orden; se arranca la primera vez que hace falta */
function workerClient(onError: (error: unknown) => void) {
  let worker: Worker | null = null
  let next = 1
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()
  const failAll = (error: Error) => {
    for (const { reject } of pending.values()) reject(error)
    pending.clear()
    worker = null
  }
  const start = () => {
    const made = new Worker(new URL('./vision-worker.ts', import.meta.url), {
      execArgv: process.execArgv.filter((arg) => !arg.startsWith('--input-type'))
    })
    made.on('message', (message: { id: number; result?: unknown; error?: string }) => {
      const waiting = pending.get(message.id)
      if (!waiting) return
      pending.delete(message.id)
      if (message.error !== undefined) waiting.reject(new Error(message.error))
      else waiting.resolve(message.result)
    })
    made.on('error', (error) => {
      onError(error)
      failAll(error)
    })
    made.on('exit', (code) => {
      if (worker === made) failAll(new Error(`el hilo de la visión acabó (${code})`))
    })
    // Que no tenga vivo el proceso solo por él
    made.unref()
    return made
  }
  return {
    call<T>(message: object, transfer: ArrayBuffer[] = []): Promise<T> {
      worker ??= start()
      const id = next++
      const target = worker
      return new Promise<T>((resolve, reject) => {
        pending.set(id, { resolve: resolve as (value: unknown) => void, reject })
        target.postMessage({ ...message, id }, transfer)
      })
    },
    async close() {
      const current = worker
      worker = null
      if (current) await current.terminate()
    }
  }
}

/** Los muros de la base, como los usa el núcleo */
const wallOf = (row: visionRepo.WallRow): Wall => ({
  id: row.id,
  a: { x: row.ax, y: row.ay },
  b: { x: row.bx, y: row.by },
  sight: row.sight,
  light: row.light,
  move: row.move,
  direction: row.direction,
  door: row.door,
  locked: row.locked
})

/** Las luces encendidas de la base, con sus radios en píxeles (de la unidad de la rejilla) */
function lightOf(row: visionRepo.LightRow, grid: SceneRow['grid']): Light {
  const px = (units: number) => distanceToPixels(units, grid.distance, grid.size)
  return {
    id: row.id,
    x: row.x,
    y: row.y,
    bright: px(row.bright),
    dim: px(row.dim),
    color: row.color,
    intensity: row.intensity,
    angle: row.angle,
    rotation: row.rotation,
    walls: row.walls,
    darkness: row.darkness,
    ...(row.activeBelowAmbient !== null ? { activeBelowAmbient: row.activeBelowAmbient } : {})
  }
}

/** El tamaño de la niebla de una escena: el de su imagen o, sin ella, uno fijo */
export const visionSize = (scene: Pick<SceneRow, 'width' | 'height'>) => ({
  width: scene.width ?? NO_IMAGE_SIDE,
  height: scene.height ?? NO_IMAGE_SIDE
})

export function createVision(db: Database, onError: (error: unknown) => void = () => {}): Vision {
  const views = workerClient(onError)
  const crops = workerClient(onError)
  const geometries = new Map<string, { stamp: string; geometry: SceneGeometry; walls: visionRepo.WallRow[] }>()
  const explored = new Map<string, Uint8Array | null>()
  const results = new Map<string, { hash: string; result: VisionResult }>()
  const locks = new Map<string, Promise<unknown>>()
  const pendingWalks = new Map<string, WalkedMove[]>()
  /** Lo explorado que se está guardando, por campaña y escena (para guardarlo en orden) */
  const saving = new Map<string, Promise<void>>()
  /** Las claves de lo preparado que ya tiene el hilo (si lo olvidó, contesta y se le vuelve a mandar) */
  const sent = new Set<string>()
  /** Las vistas que siguen valiendo tal cual (sin que haya cambiado nada desde que se calcularon) */
  const fresh = new Set<string>()

  /** En orden por campaña y escena: dos vistas a la vez no se pisan lo explorado */
  const serial = <T>(key: string, work: () => Promise<T>): Promise<T> => {
    const before = locks.get(key) ?? Promise.resolve()
    const run = before.then(work, work)
    const done = run.catch(() => undefined)
    locks.set(key, done)
    void done.then(() => {
      if (locks.get(key) === done) locks.delete(key)
    })
    return run
  }

  async function geometryOf(scene: SceneRow) {
    const stamp = sceneStamp(scene)
    const found = geometries.get(scene.id)
    if (found && found.stamp === stamp) return found
    const [walls, lights] = await Promise.all([visionRepo.listWalls(db, scene.id), visionRepo.listLights(db, scene.id)])
    const made = {
      stamp,
      walls,
      geometry: {
        ...visionSize(scene),
        walls: walls.map(wallOf),
        lights: lights.filter((l) => l.enabled).map((l) => lightOf(l, scene.grid)),
        darkness: scene.darkness,
        automatic: scene.automaticVision
      }
    }
    geometries.set(scene.id, made)
    // Pocas escenas a la vez: se van las más viejas
    if (geometries.size > 32) geometries.delete(geometries.keys().next().value as string)
    return made
  }

  async function compute(input: VisionInput): Promise<VisionResult> {
    const { scene, campaignId } = input
    const key = `${campaignId}:${scene.id}`
    const [{ geometry, walls }, state, fog] = await Promise.all([
      geometryOf(scene),
      visionRepo.findSceneState(db, campaignId, scene.id),
      visionRepo.listFog(db, campaignId, scene.id)
    ])
    const doors: Record<string, boolean> = {}
    const doorStates: Record<string, { open: boolean }> = {}
    for (const wall of walls) {
      if (!wall.door) continue
      const open = state?.doors[wall.id]?.open ?? wall.open
      doors[wall.id] = open
      doorStates[wall.id] = { open }
    }
    const party = input.tokens
      .filter((t) => t.party)
      .map(
        (t): PartyToken => ({ id: t.id, x: t.x, y: t.y, radius: t.radius, ...(t.senses ? { senses: t.senses } : {}) })
      )
    const targets = input.tokens.map((t) => ({ id: t.id, x: t.x, y: t.y, radius: t.radius }))
    const manual = fog.map((row) => ({ ...row.operation, id: row.id }))
    // Lo preparado y la vista dependen de lo que hay, no de versiones (deshacer las repite): la escena y las puertas
    // abiertas de esta campaña
    const openDoors = Object.keys(doors)
      .filter((id) => doors[id])
      .sort()
    const doorsDigest = createHash('sha1').update(openDoors.join(',')).digest('base64url')
    const stamp = sceneStamp(scene)
    const hash = JSON.stringify([stamp, doorsDigest, party, targets, fog.map((f) => f.id)])
    const walks = input.walks ?? []
    const cached = results.get(key)
    if (cached && cached.hash === hash && walks.length === 0) {
      fresh.add(key)
      return cached.result
    }
    if (!explored.has(key)) explored.set(key, (await visionRepo.findExplored(db, campaignId, scene.id))?.data ?? null)
    const before = explored.get(key) ?? null
    const request: ViewRequest = {
      key: `${scene.id}:${stamp}:${doorsDigest}`,
      scene: geometry,
      doors: doorStates as DoorStates,
      party,
      walks: [...walks],
      step: scene.grid.size,
      targets,
      manual,
      explored: before
    }
    // La escena (miles de muros) viaja al hilo solo si aún no la tiene preparada
    const known = sent.has(request.key)
    const response = await views
      .call<ViewResponse>({ type: 'view', request: known ? { ...request, scene: null } : request })
      .catch((error: unknown) => {
        if (!(error instanceof Error) || error.message !== MISSING_SCENE) throw error
        return views.call<ViewResponse>({ type: 'view', request })
      })
    sent.add(request.key)
    if (sent.size > 64) sent.delete(sent.keys().next().value as string)
    if (response.exploredChanged || !before) {
      explored.set(key, response.explored)
      // Se guarda sin hacer esperar a la pantalla, en orden (la memoria ya lo tiene)
      const data = response.explored
      const write = (saving.get(key) ?? Promise.resolve())
        .then(() => visionRepo.saveExplored(db, campaignId, scene.id, data))
        .catch(onError)
      saving.set(key, write)
      void write.then(() => {
        if (saving.get(key) === write) saving.delete(key)
      })
    }
    const visible = FogGrid.decode(response.visible)
    const shown = FogGrid.decode(response.exploredShown)
    const screenMask = shown.clone().union(visible)
    const lights = new Map(geometry.lights.map((l) => [l.id, l]))
    const result: VisionResult = {
      sceneId: scene.id,
      automatic: scene.automaticVision,
      darkness: scene.darkness,
      ...visionSize(scene),
      cellSize: FOG_CELL_SIZE,
      visible,
      explored: shown,
      visibleData: base64(response.visible),
      exploredData: base64(response.exploredShown),
      screenMask,
      screenMaskData: screenMask.encode(),
      lit: response.lit.flatMap((area) => {
        const light = lights.get(area.id)
        return light ? [{ light, cells: base64(area.cells), originVisible: area.originVisible }] : []
      }),
      seen: new Set(response.seen),
      doors,
      secretDoors: walls.filter((w) => w.door === 'secret').map((w) => ({ id: w.id, open: doors[w.id] ?? false }))
    }
    results.set(key, { hash, result })
    fresh.add(key)
    if (results.size > 64) {
      const oldest = results.keys().next().value as string
      results.delete(oldest)
      fresh.delete(oldest)
    }
    return result
  }

  return {
    view(input) {
      return serial(`${input.campaignId}:${input.scene.id}`, () => compute(input))
    },
    peek(campaignId, sceneId) {
      const key = `${campaignId}:${sceneId}`
      return fresh.has(key) ? (results.get(key)?.result ?? null) : null
    },
    invalidate({ campaignId, sceneId }) {
      for (const key of fresh) {
        const [c, s] = key.split(':')
        if ((campaignId === undefined || c === campaignId) && (sceneId === undefined || s === sceneId))
          fresh.delete(key)
      }
    },
    walked(campaignId, sceneId, moves) {
      const key = `${campaignId}:${sceneId}`
      // Como mucho unos cuantos caminos por explorar (si nadie mira en mucho rato, los últimos)
      const list = [...(pendingWalks.get(key) ?? []), ...moves].slice(-200)
      pendingWalks.set(key, list)
      fresh.delete(key)
    },
    takeWalked(campaignId, sceneId) {
      const key = `${campaignId}:${sceneId}`
      const list = pendingWalks.get(key) ?? []
      pendingWalks.delete(key)
      return list
    },
    report(error) {
      onError(error)
    },
    crop(request) {
      const own = request.bytes.slice()
      return crops.call<Uint8Array>({ type: 'crop', request: { ...request, bytes: own } }, [own.buffer])
    },
    reset(campaignId, sceneId, work) {
      const key = `${campaignId}:${sceneId}`
      return serial(key, async () => {
        await saving.get(key)
        try {
          return await work()
        } finally {
          explored.delete(key)
          results.delete(key)
          fresh.delete(key)
        }
      })
    },
    async close() {
      await Promise.all([...saving.values()])
      await Promise.all([views.close(), crops.close()])
    }
  }
}
