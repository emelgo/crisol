/**
 * Las escenas de Foundry VTT, de la v10 a la v14, pasadas a lo que guarda una escena de Crisol
 * (docs/specs/escenas-foundry.md): su imagen, su rejilla (las cuatro hexagonales a nuestras dos, con su
 * desplazamiento), sus muros con sus restricciones, sus puertas, sus luces, su oscuridad, sus fichas y sus notas, todo
 * en píxeles de la imagen (sin el margen). Una escena con varias plantas (v14) da una escena por planta.
 *
 * Formato de las escenas de Foundry VTT (sus documentos de la v9 a la 14.369), leído de sus archivos; el margen sale de
 * `calculateDimensions` de `common/grid/square.mjs` y `common/grid/hexagonal.mjs` (y `_calculatePreV10Dimensions`, el
 * de los hexágonos antiguos) y el desplazamiento de las hexagonales de `getTopLeftPoint`, de Foundry VTT 14.369
 * (Foundry Gaming LLC; uso privado, ADR-0014; docs/terceros.md)
 */
import type { FoundryDocument } from './manifest.ts'

export type SceneRestriction = 'none' | 'limited' | 'full'

export interface ConvertedWall {
  a: { x: number; y: number }
  b: { x: number; y: number }
  sight: SceneRestriction
  light: SceneRestriction
  move: SceneRestriction
  sound: SceneRestriction
  direction: 'both' | 'left' | 'right'
  door: 'door' | 'secret' | null
  locked: boolean
  open: boolean
}

export interface ConvertedLight {
  x: number
  y: number
  /** En la unidad de la rejilla, como en Foundry */
  bright: number
  dim: number
  color: string
  intensity: number
  angle: number
  /** 0 arriba, 90 a la derecha (en Foundry, 0 es abajo) */
  rotation: number
  walls: boolean
  darkness: boolean
  enabled: boolean
  activeBelowAmbient: number | null
}

export interface ConvertedToken {
  id: string
  /** El actor al que apunta (en el mundo donde se hizo, o en la aventura) */
  actorId: string | null
  name: string
  /** El centro, en píxeles de la imagen */
  x: number
  y: number
  /** En casillas */
  size: number
  hidden: boolean
  faction: 'hostile' | 'neutral'
  /** Enlazada a su actor: la única; si no, una copia */
  unique: boolean
}

export interface ConvertedNote {
  x: number
  y: number
  label: string
  entryId: string | null
  pageId: string | null
}

export interface ConvertedGrid {
  type: 'square' | 'hex-rows' | 'hex-columns' | 'none'
  size: number
  offsetX: number
  offsetY: number
  distance: number
  units: string
  visible: boolean
  color: string
  opacity: number
}

export interface ConvertedScene {
  /** El id de la escena de Foundry; con varias plantas, «escena.planta» */
  id: string
  sourceId: string
  name: string
  /** La planta, si la escena tiene más de una */
  level: { id: string; name: string } | null
  /** La ruta de su imagen de fondo (la de Foundry: modules/…), o null */
  background: string | null
  thumb: string | null
  /** Lo que mide la imagen en la escena (el fondo se estira a esto) */
  width: number
  height: number
  grid: ConvertedGrid
  initialView: { x: number; y: number; scale: number } | null
  darkness: number
  automaticVision: boolean
  walls: ConvertedWall[]
  lights: ConvertedLight[]
  tokens: ConvertedToken[]
  notes: ConvertedNote[]
  /** Lo que no se trae, contado: regiones, tiles, dibujos, sonidos y plantillas */
  skipped: { regions: number; tiles: number; drawings: number; sounds: number; templates: number }
  /** La versión de Foundry con la que se guardó (su número grande), si lo dice */
  coreVersion: number | null
}

type Doc = Record<string, unknown>

const isObject = (v: unknown): v is Doc => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const get = (value: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((v, k) => (isObject(v) ? v[k] : undefined), value)
const list = (v: unknown): Doc[] => (Array.isArray(v) ? v.filter(isObject) : [])
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const SQRT3 = Math.sqrt(3)
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

/** Los tipos de rejilla de Foundry: sin rejilla, cuadrada y las cuatro hexagonales */
const GRID = { GRIDLESS: 0, SQUARE: 1, HEXODDR: 2, HEXEVENR: 3, HEXODDQ: 4, HEXEVENQ: 5 } as const

/** La rejilla de la escena, de la v10 (un objeto) o de antes (campos sueltos) */
function gridOf(doc: Doc) {
  const grid = isObject(doc.grid) ? doc.grid : null
  return {
    type: num(grid ? grid.type : doc.gridType, GRID.SQUARE),
    size: Math.max(10, num(grid ? grid.size : doc.grid, 100)),
    distance: num(grid ? grid.distance : doc.gridDistance, 5),
    units: str(grid ? grid.units : doc.gridUnits) ?? 'ft',
    color: str(grid ? grid.color : doc.gridColor) ?? '#000000',
    alpha: num(grid ? grid.alpha : doc.gridAlpha, 0.2)
  }
}

/**
 * Dónde empieza la imagen en el lienzo de Foundry (el margen redondeado a casillas, menos el desplazamiento del fondo).
 * Las cuentas son las de Foundry, tal cual (sus redondeos deciden dónde cae todo)
 */
function sceneOrigin(doc: Doc, grid: ReturnType<typeof gridOf>, width: number, height: number) {
  const padding = num(doc.padding, 0)
  const { type, size } = grid
  let x = 0
  let y = 0
  const hex = type >= GRID.HEXODDR && type <= GRID.HEXEVENQ
  const columns = type === GRID.HEXODDQ || type === GRID.HEXEVENQ
  if (hex && get(doc, 'flags.core.legacyHex')) {
    const legacy = Math.round(size * (2 / SQRT3))
    x = Math.ceil(padding * width * (1 / legacy)) * legacy
    y = Math.ceil(padding * height * (1 / legacy)) * legacy
  } else if (hex) {
    if (padding) {
      const sizeX = columns ? (2 * size) / SQRT3 : size
      const sizeY = columns ? size : (2 * size) / SQRT3
      const strideX = columns ? 0.75 * sizeX : sizeX
      const strideY = columns ? sizeY : 0.75 * sizeY
      x = Math.ceil(padding * width * (1 / strideX)) * strideX
      y = Math.ceil(padding * height * (1 / strideY)) * strideY
      // La primera fila (o columna) de la escena empieza entera o a medias según cuántas caben en el margen
      const crossEven = Math.round(columns ? x / strideX : y / strideY) % 2 === 0
      if (!crossEven) {
        if (columns) y += sizeY / 2
        else x += sizeX / 2
      }
    }
  } else {
    // Cuadrada o sin rejilla: el margen, en casillas enteras
    x = Math.ceil(padding * width * (1 / size)) * size
    y = Math.ceil(padding * height * (1 / size)) * size
  }
  // El desplazamiento del fondo: shiftX (v14 y antes de la v10) o background.offsetX (v10 a v13)
  const background = isObject(doc.background) ? doc.background : null
  const shiftX = num(doc.shiftX, 0) || num(background?.offsetX, 0)
  const shiftY = num(doc.shiftY, 0) || num(background?.offsetY, 0)
  return { x: x - shiftX, y: y - shiftY }
}

/** Lo positivo de un resto (−10 % 100 = 90) */
function mod(value: number, by: number) {
  const rest = ((value % by) + by) % by
  return by - rest < 1e-6 ? 0 : rest
}

/** La rejilla de Crisol: las pares e impares de Foundry son la misma con otro desplazamiento */
function convertGrid(grid: ReturnType<typeof gridOf>, origin: { x: number; y: number }): ConvertedGrid {
  const { type, size } = grid
  const units = /^(ft|feet|foot|pies?)\.?$/i.test(grid.units) ? 'pies' : grid.units.slice(0, 20)
  const base = {
    size,
    distance: grid.distance > 0 ? grid.distance : 5,
    units,
    visible: grid.alpha > 0 && type !== GRID.GRIDLESS,
    color: HEX_COLOR.test(grid.color) ? grid.color : '#000000',
    opacity: clamp(grid.alpha, 0, 1)
  }
  const round = (v: number) => Math.round(v * 1000) / 1000
  if (type === GRID.GRIDLESS) return { type: 'none', offsetX: 0, offsetY: 0, ...base }
  if (type === GRID.HEXODDR || type === GRID.HEXEVENR) {
    // Por filas: la primera fila de las impares empieza media casilla a la izquierda
    const sizeY = (2 * size) / SQRT3
    const left = type === GRID.HEXODDR ? -size / 2 : 0
    return {
      type: 'hex-rows',
      offsetX: round(mod(left - origin.x, size)),
      offsetY: round(mod(-origin.y, 1.5 * sizeY)),
      ...base
    }
  }
  if (type === GRID.HEXODDQ || type === GRID.HEXEVENQ) {
    const sizeX = (2 * size) / SQRT3
    const top = type === GRID.HEXODDQ ? -size / 2 : 0
    return {
      type: 'hex-columns',
      offsetX: round(mod(-origin.x, 1.5 * sizeX)),
      offsetY: round(mod(top - origin.y, size)),
      ...base
    }
  }
  return { type: 'square', offsetX: round(mod(-origin.x, size)), offsetY: round(mod(-origin.y, size)), ...base }
}

/** Lo que para un muro: 0 nada, 10 limitado, 20 del todo; de cerca o de lejos (30, 40), limitado */
function restriction(value: unknown, fallback: number): SceneRestriction {
  const v = num(value, fallback)
  if (v <= 0) return 'none'
  if (v === 20) return 'full'
  return 'limited'
}

/** Antes de la v10, 0 nada, 1 del todo y 2 limitado */
const oldRestriction = (value: unknown): number => ({ 0: 0, 1: 20, 2: 10 })[num(value, 1) as 0 | 1 | 2] ?? 20

function convertWall(wall: Doc, origin: { x: number; y: number }): ConvertedWall | null {
  const c = Array.isArray(wall.c) ? wall.c.map((v) => num(v, Number.NaN)) : []
  if (c.length < 4 || c.some((v) => Number.isNaN(v))) return null
  const [ax, ay, bx, by] = c as [number, number, number, number]
  if (ax === bx && ay === by) return null
  // Antes de la v10, la vista y la luz iban juntas (sense) y los valores eran otros
  const old = wall.sense !== undefined && wall.sight === undefined
  const sight = old ? oldRestriction(wall.sense) : num(wall.sight, 20)
  const light = old ? oldRestriction(wall.sense) : num(wall.light, 20)
  const move = old ? oldRestriction(wall.move) : num(wall.move, 20)
  const sound = old ? oldRestriction(wall.sound) : num(wall.sound, 20)
  const door = num(wall.door, 0)
  const state = num(wall.ds, 0)
  // Foundry: 1, para solo si el rayo le da por su izquierda (que es nuestra derecha): deja pasar por la derecha
  const dir = num(wall.dir, 0)
  return {
    a: { x: ax - origin.x, y: ay - origin.y },
    b: { x: bx - origin.x, y: by - origin.y },
    sight: restriction(sight, 20),
    light: restriction(light, 20),
    move: restriction(move, 20),
    sound: restriction(sound, 20),
    direction: dir === 1 ? 'right' : dir === 2 ? 'left' : 'both',
    door: door === 1 ? 'door' : door === 2 ? 'secret' : null,
    locked: door !== 0 && state === 2,
    open: door !== 0 && state === 1
  }
}

function convertLight(light: Doc, origin: { x: number; y: number }): ConvertedLight {
  // De la v10 en adelante, lo de la luz va en config; antes, suelto (y el color en tintColor)
  const config = isObject(light.config) ? light.config : light
  const color = str(config.color) ?? str(light.tintColor)
  const alpha = num(config.alpha, num(light.tintAlpha, 0.5))
  const range = isObject(config.darkness) ? config.darkness : isObject(light.darkness) ? light.darkness : null
  const min = num(range?.min, 0)
  const negative = config.negative === true || num(config.luminosity, 0.5) < 0
  return {
    x: num(light.x, 0) - origin.x,
    y: num(light.y, 0) - origin.y,
    bright: Math.max(0, num(config.bright, 0)),
    dim: Math.max(0, num(config.dim, 0)),
    color: color && HEX_COLOR.test(color) ? color : '#ffe2a8',
    intensity: clamp(color ? alpha * 2 : 1, 0, 1),
    angle: clamp(num(config.angle, 360), 0, 360),
    rotation: mod(num(light.rotation, 0) + 180, 360),
    walls: light.walls !== false,
    darkness: negative,
    enabled: light.hidden !== true,
    // Foundry: se enciende con la oscuridad entre min y max; aquí, cuando la luz baja de 1 − min
    activeBelowAmbient: min > 0 ? clamp(1 - min, 0, 1) : null
  }
}

function convertToken(
  token: Doc,
  origin: { x: number; y: number },
  grid: ReturnType<typeof gridOf>
): ConvertedToken | null {
  const id = str(token._id)
  if (!id) return null
  const width = Math.max(0.25, num(token.width, 1))
  const height = Math.max(0.25, num(token.height, 1))
  const hex = grid.type >= GRID.HEXODDR && grid.type <= GRID.HEXEVENQ
  const columns = grid.type === GRID.HEXODDQ || grid.type === GRID.HEXEVENQ
  const sizeX = hex && columns ? (2 * grid.size) / SQRT3 : grid.size
  const sizeY = hex && !columns ? (2 * grid.size) / SQRT3 : grid.size
  const disposition = num(token.disposition, -1)
  return {
    id,
    actorId: str(token.actorId),
    name: str(token.name) ?? '',
    x: num(token.x, 0) + (width * sizeX) / 2 - origin.x,
    y: num(token.y, 0) + (height * sizeY) / 2 - origin.y,
    size: clamp(Math.max(width, height), 0.25, 10),
    hidden: token.hidden === true,
    faction: disposition >= 0 ? 'neutral' : 'hostile',
    unique: token.actorLink === true
  }
}

function convertNote(note: Doc, origin: { x: number; y: number }): ConvertedNote {
  return {
    x: num(note.x, 0) - origin.x,
    y: num(note.y, 0) - origin.y,
    label: (str(note.text) ?? '').slice(0, 120),
    entryId: str(note.entryId),
    pageId: str(note.pageId)
  }
}

/** Las plantas de una escena de la v14, en su orden (vienen como documentos; sin juntar, como ids) */
function levelsOf(doc: Doc): Doc[] {
  return list(doc.levels).sort((a, b) => num(a.sort, 0) - num(b.sort, 0))
}

/** Si una cosa de la escena está en esa planta: sin plantas, en todas */
const onLevel = (item: Doc, level: string | null) => {
  if (!level) return true
  if (typeof item.level === 'string') return item.level === level
  const levels = Array.isArray(item.levels) ? item.levels : []
  return levels.length === 0 || levels.includes(level)
}

/** Pasa una escena de Foundry (con lo suyo dentro) a lo que guarda Crisol: una por planta */
export function convertFoundryScene(doc: FoundryDocument): ConvertedScene[] {
  const sourceId = doc._id
  const width = Math.max(1, Math.round(num(doc.width, 0) || 1))
  const height = Math.max(1, Math.round(num(doc.height, 0) || 1))
  const grid = gridOf(doc)
  const origin = sceneOrigin(doc, grid, width, height)
  const converted = convertGrid(grid, origin)
  const levels = levelsOf(doc)
  const environment = isObject(doc.environment) ? doc.environment : null
  // La oscuridad: environment.darknessLevel (v12) o darkness (antes); con la luz global, de día
  const darknessLevel = clamp(num(environment?.darknessLevel, num(doc.darkness, 0)), 0, 1)
  const global = isObject(environment?.globalLight) ? (environment?.globalLight as Doc) : null
  const globalOn = global ? global.enabled === true : doc.globalLight === true
  const threshold = global ? num(get(global, 'darkness.max'), 1) : num(doc.globalLightThreshold, 1)
  const darkness = globalOn && darknessLevel <= threshold ? 0 : darknessLevel
  const initial = isObject(doc.initial) ? doc.initial : null
  const initialView =
    initial && typeof initial.x === 'number' && typeof initial.y === 'number'
      ? {
          x: initial.x - origin.x,
          y: initial.y - origin.y,
          scale: clamp(num(initial.scale, 1) || 1, 0.05, 64)
        }
      : null
  const background = isObject(doc.background) ? doc.background : null
  const regions = list(doc.regions)
  const templates = regions.filter((r) => get(r, 'flags.core.MeasuredTemplate')).length + list(doc.templates).length
  const skipped = {
    regions: regions.length - regions.filter((r) => get(r, 'flags.core.MeasuredTemplate')).length,
    tiles: list(doc.tiles).length,
    drawings: list(doc.drawings).length,
    sounds: list(doc.sounds).length,
    templates
  }
  const coreVersion = Number.parseInt(String(get(doc, '_stats.coreVersion') ?? ''), 10)
  const name = (str(doc.name) ?? sourceId).slice(0, 200)
  const many = levels.length > 1
  const floors: Array<Doc | null> = levels.length > 0 ? levels : [null]
  return floors.map((level) => {
    const levelId = level ? (str(level._id) ?? null) : null
    const on = (item: Doc) => onLevel(item, many ? levelId : null)
    const walls = list(doc.walls)
      .filter(on)
      .flatMap((w) => convertWall(w, origin) ?? [])
    return {
      id: many && levelId ? `${sourceId}.${levelId}` : sourceId,
      sourceId,
      name: many && level ? `${name} · ${str(level.name) ?? levelId}`.slice(0, 200) : name,
      level: many && level && levelId ? { id: levelId, name: str(level.name) ?? levelId } : null,
      background: str(get(level, 'background.src')) ?? str(background?.src) ?? str(doc.img),
      thumb: str(doc.thumb),
      width,
      height,
      grid: converted,
      initialView,
      darkness,
      automaticVision: doc.tokenVision !== false && walls.length > 0,
      walls,
      lights: list(doc.lights)
        .filter(on)
        .map((l) => convertLight(l, origin)),
      tokens: list(doc.tokens)
        .filter(on)
        .flatMap((t) => convertToken(t, origin, grid) ?? []),
      notes: list(doc.notes)
        .filter(on)
        .map((n) => convertNote(n, origin)),
      skipped,
      coreVersion: Number.isFinite(coreVersion) ? coreVersion : null
    }
  })
}

/** Una aventura de Foundry (todo dentro): sus escenas, sus actores, sus diarios y sus carpetas */
export interface FoundryAdventure {
  id: string
  name: string
  img: string | null
  /** Su descripción y su subtítulo, en HTML */
  description: string
  caption: string
  scenes: FoundryDocument[]
  actors: FoundryDocument[]
  journal: FoundryDocument[]
  folders: Array<{ _id: string; name: string; type: string | null; folder: string | null }>
}

/** Lee una aventura: lo que lleva dentro, como documentos sueltos */
export function readAdventure(doc: FoundryDocument): FoundryAdventure {
  const docs = (v: unknown) =>
    list(v).flatMap((d) => (typeof d._id === 'string' ? [{ ...d, _id: d._id } as FoundryDocument] : []))
  return {
    id: doc._id,
    name: (str(doc.name) ?? doc._id).slice(0, 200),
    img: str(doc.img),
    description: typeof doc.description === 'string' ? doc.description : '',
    caption: typeof doc.caption === 'string' ? doc.caption : '',
    scenes: docs(doc.scenes),
    actors: docs(doc.actors),
    journal: docs(doc.journal),
    folders: list(doc.folders).flatMap((f) =>
      typeof f._id === 'string' && typeof f.name === 'string'
        ? [{ _id: f._id, name: f.name, type: str(f.type), folder: str(f.folder) }]
        : []
    )
  }
}

/**
 * Dónde buscar la criatura de un actor en lo importado de Foundry (el módulo 4 hace la clave con el paquete y el id):
 * los orígenes posibles, «paquete/id», por su procedencia (`_stats.compendiumSource` o `flags.core.sourceId`) o, si
 * no la dice, en cada paquete de actores del zip
 */
export function actorOrigins(actor: FoundryDocument | null, actorId: string, actorPacks: readonly string[]): string[] {
  const out: string[] = []
  const source = str(get(actor, '_stats.compendiumSource')) ?? str(get(actor, 'flags.core.sourceId'))
  // Compendium.<paquete del módulo>.<paquete>.Actor.<id> (v11+) o Compendium.<módulo>.<paquete>.<id>
  const match = source ? /^Compendium\.[^.]+\.([^.]+)\.(?:Actor\.)?([A-Za-z0-9]+)$/.exec(source) : null
  if (match) out.push(`${match[1]}/${match[2]}`)
  for (const pack of actorPacks) out.push(`${pack}/${actorId}`)
  return [...new Set(out)]
}
