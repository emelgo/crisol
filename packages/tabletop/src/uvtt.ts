// Portado de packages/mesa/src/modelo/compat/uvtt.ts (Crisol actual, commit 3f68f11), con las correcciones de
// research/uvtt/formato.md: ventanas, intensidad de Dungeondraft, muros recortados en el borde y cuevas simplificadas
/**
 * Mapas Universal VTT (`.dd2vtt`, `.uvtt`, `.df2vtt`): leer el archivo, que no es de fiar, y sacar su imagen, su
 * rejilla y lo que pondrá en juego `vision` (muros, objetos, puertas, ventanas y luces), en píxeles de la imagen
 */
import type { Point } from './geometry.ts'
import { imageSize, imageType } from './image.ts'

export const UVTT_EXTENSIONS = ['dd2vtt', 'uvtt', 'df2vtt'] as const
export const UVTT_LIMITS = {
  bytes: 150 * 1024 * 1024,
  segments: 20_000,
  lights: 2_000,
  cells: 4_096,
  minCell: 10
} as const

export const isUvttFile = (name: string) => UVTT_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(`.${ext}`))

/** El archivo leído, aún en casillas como el formato */
export interface UvttMap {
  origin: Point
  /** Casillas de ancho y alto */
  size: Point
  walls: Point[][]
  objects: Point[][]
  portals: Array<{ a: Point; b: Point; closed: boolean }>
  lights: Array<{ position: Point; range: number; intensity: number; color: string; shadows: boolean }>
  /** Luz ambiental en #rrggbb, o null si no trae */
  ambientLight: string | null
  /** La luz ya va pintada en la imagen */
  bakedLighting: boolean
  image: Uint8Array
  imageType: 'png' | 'jpeg' | 'webp'
}

/** Lo que se guarda en la escena (como `sceneImported` de los contratos) y su rejilla */
export interface UvttScene {
  width: number
  height: number
  grid: { type: 'square'; size: number; offsetX: number; offsetY: number }
  imported: {
    source: 'uvtt'
    walls: Point[][]
    objects: Point[][]
    portals: Array<{ a: Point; b: Point; closed: boolean; window: boolean }>
    lights: Array<{ x: number; y: number; range: number; intensity: number; color: string; shadows: boolean }>
    ambientLight: string | null
    bakedLighting: boolean
  }
}

export type UvttResult<T> = { ok: true; value: T } | { ok: false; error: string }
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

const own = (o: unknown, key: string): unknown =>
  typeof o === 'object' && o !== null && Object.hasOwn(o, key) ? (o as Record<string, unknown>)[key] : undefined
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const point = (v: unknown): Point | null => {
  const x = num(own(v, 'x'))
  const y = num(own(v, 'y'))
  return x === null || y === null ? null : { x, y }
}
const flag = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)

/** «AARRGGBB» o «RRGGBB» (con o sin #) → `#rrggbb`, o null */
export function uvttColor(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const clean = v.replace(/^#/, '')
  if (/^[0-9a-f]{8}$/i.test(clean)) return `#${clean.slice(2).toLowerCase()}`
  if (/^[0-9a-f]{6}$/i.test(clean)) return `#${clean.toLowerCase()}`
  return null
}

function fromBase64(text: string): Uint8Array | null {
  try {
    const binary = atob(text.replace(/^data:[^,]*,/, '').replace(/\s+/g, ''))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

/** Lee las polilíneas de un campo; null y la frase si algo no sirve */
function polylines(data: unknown, field: string, budget: { left: number }): Point[][] | string {
  const list = own(data, field)
  if (list === undefined) return []
  if (!Array.isArray(list)) return `«${field}» no es una lista.`
  const lines: Point[][] = []
  for (const line of list) {
    if (!Array.isArray(line)) return `Una línea de «${field}» no es una lista de puntos.`
    budget.left -= Math.max(0, line.length - 1)
    if (budget.left < 0) return `Pasa de ${UVTT_LIMITS.segments} tramos de muro.`
    const points = line.map(point)
    if (points.some((p) => p === null)) return `Un punto de «${field}» no tiene x e y.`
    if (points.length >= 2) lines.push(points as Point[])
  }
  return lines
}

/** Lee un archivo Universal VTT; si no sirve, una frase que dice por qué */
export function parseUvtt(text: string): UvttResult<UvttMap> {
  if (text.length > UVTT_LIMITS.bytes) return fail('El archivo pasa de 150 MB.')
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return fail('No es un archivo Universal VTT (no se puede leer como JSON).')
  }
  const resolution = own(data, 'resolution')
  const origin = point(own(resolution, 'map_origin')) ?? { x: 0, y: 0 }
  const size = point(own(resolution, 'map_size'))
  if (!size || size.x <= 0 || size.y <= 0) return fail('Falta el tamaño del mapa (resolution.map_size).')
  if (size.x > UVTT_LIMITS.cells || size.y > UVTT_LIMITS.cells)
    return fail(`El mapa pasa de ${UVTT_LIMITS.cells} casillas por lado.`)
  const imageText = own(data, 'image')
  if (typeof imageText !== 'string' || imageText.length === 0)
    return fail('El archivo no trae la imagen del mapa (image).')
  const image = fromBase64(imageText)
  const type = image ? imageType(image) : null
  if (!image || !type) return fail('La imagen del mapa no es PNG, JPEG ni WebP.')

  const budget = { left: UVTT_LIMITS.segments }
  const walls = polylines(data, 'line_of_sight', budget)
  if (typeof walls === 'string') return fail(walls)
  const objects = polylines(data, 'objects_line_of_sight', budget)
  if (typeof objects === 'string') return fail(objects)

  const portalData = own(data, 'portals') ?? []
  if (!Array.isArray(portalData)) return fail('«portals» no es una lista.')
  if (portalData.length > budget.left) return fail(`Pasa de ${UVTT_LIMITS.segments} tramos de muro.`)
  const portals: UvttMap['portals'] = []
  for (const portal of portalData) {
    const bounds = own(portal, 'bounds')
    const a = Array.isArray(bounds) ? point(bounds[0]) : null
    const b = Array.isArray(bounds) ? point(bounds[1]) : null
    if (!a || !b) return fail('Una puerta no tiene sus dos extremos (bounds).')
    portals.push({ a, b, closed: flag(own(portal, 'closed'), true) })
  }

  const lightData = own(data, 'lights') ?? []
  if (!Array.isArray(lightData)) return fail('«lights» no es una lista.')
  if (lightData.length > UVTT_LIMITS.lights) return fail(`Pasa de ${UVTT_LIMITS.lights} luces.`)
  const lights: UvttMap['lights'] = []
  for (const light of lightData) {
    const position = point(own(light, 'position'))
    if (!position) return fail('Una luz no tiene posición.')
    const range = num(own(light, 'range'))
    if (range === null || range < 0) return fail('Una luz no tiene un alcance válido.')
    lights.push({
      position,
      range,
      intensity: Math.max(0, num(own(light, 'intensity')) ?? 1),
      color: uvttColor(own(light, 'color')) ?? '#ffffff',
      shadows: flag(own(light, 'shadows'), true)
    })
  }
  const environment = own(data, 'environment')
  return {
    ok: true,
    value: {
      origin,
      size,
      walls,
      objects,
      portals,
      lights,
      ambientLight: uvttColor(own(environment, 'ambient_light')),
      bakedLighting: flag(own(environment, 'baked_lighting'), false),
      image,
      imageType: type
    }
  }
}

/** Recorta un tramo al rectángulo (Liang-Barsky); null si queda fuera */
export function clipSegment(a: Point, b: Point, box: { minX: number; minY: number; maxX: number; maxY: number }) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  let t0 = 0
  let t1 = 1
  const edges: Array<[number, number]> = [
    [-dx, a.x - box.minX],
    [dx, box.maxX - a.x],
    [-dy, a.y - box.minY],
    [dy, box.maxY - a.y]
  ]
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null
      continue
    }
    const t = q / p
    if (p < 0) t0 = Math.max(t0, t)
    else t1 = Math.min(t1, t)
    if (t0 > t1) return null
  }
  return [
    { x: a.x + t0 * dx, y: a.y + t0 * dy },
    { x: a.x + t1 * dx, y: a.y + t1 * dy }
  ] as const
}

/** Quita los puntos que sobran de una polilínea: los repetidos y los que están en línea recta con sus vecinos */
export function simplifyPolyline(points: readonly Point[], tolerance = 0.5): Point[] {
  const out: Point[] = []
  for (const p of points) {
    const last = out.at(-1)
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 1e-6) continue
    const before = out.at(-2)
    if (before && last) {
      // Distancia del punto del medio a la recta que une sus vecinos
      const length = Math.hypot(p.x - before.x, p.y - before.y)
      const off =
        length === 0
          ? 0
          : Math.abs((p.x - before.x) * (before.y - last.y) - (before.x - last.x) * (p.y - before.y)) / length
      if (off <= tolerance) out.pop()
    }
    out.push(p)
  }
  return out
}

/**
 * La escena de un mapa leído: la casilla sale del ancho de la imagen entre las casillas (acierta con imágenes
 * recomprimidas, a diferencia de pixels_per_grid); lo de fuera de la imagen se recorta a una casilla del borde
 */
export function uvttScene(map: UvttMap): UvttResult<UvttScene> {
  const size = imageSize(map.image)
  if (!size) return fail('No se pueden leer las medidas de la imagen del mapa.')
  const cell = size.width / map.size.x
  if (!Number.isFinite(cell) || cell < UVTT_LIMITS.minCell)
    return fail(`Las casillas del mapa miden menos de ${UVTT_LIMITS.minCell} px.`)
  const toPixels = (p: Point): Point => ({ x: (p.x - map.origin.x) * cell, y: (p.y - map.origin.y) * cell })
  const box = { minX: -cell, minY: -cell, maxX: size.width + cell, maxY: size.height + cell }
  const inside = (p: Point) => p.x >= box.minX && p.y >= box.minY && p.x <= box.maxX && p.y <= box.maxY

  /** Una polilínea en píxeles, recortada al borde (puede partirse en varias) y simplificada */
  const place = (line: readonly Point[]): Point[][] => {
    const pieces: Point[][] = []
    let current: Point[] = []
    for (let i = 1; i < line.length; i++) {
      const clipped = clipSegment(toPixels(line[i - 1] as Point), toPixels(line[i] as Point), box)
      if (!clipped) {
        if (current.length >= 2) pieces.push(current)
        current = []
        continue
      }
      const [a, b] = clipped
      const last = current.at(-1)
      if (!last || Math.hypot(last.x - a.x, last.y - a.y) > 1e-6) {
        if (current.length >= 2) pieces.push(current)
        current = [a]
      }
      current.push(b)
    }
    if (current.length >= 2) pieces.push(current)
    return pieces.map((piece) => simplifyPolyline(piece)).filter((piece) => piece.length >= 2)
  }

  // La fracción de casilla del origen pasa a desplazamiento de la rejilla
  const fraction = (v: number) => {
    const f = (((-v * cell) % cell) + cell) % cell
    return Math.abs(f) < 1e-6 || Math.abs(f - cell) < 1e-6 ? 0 : f
  }
  // Dungeondraft escribe la intensidad de 1 a 3: se lleva a 0–1 respecto a la mayor del archivo
  const strongest = Math.max(1, ...map.lights.map((light) => light.intensity))
  const portals = map.portals.flatMap((portal) => {
    const clipped = clipSegment(toPixels(portal.a), toPixels(portal.b), box)
    if (!clipped) return []
    // En Dungeondraft, un portal sin cerrar es una ventana (deja pasar la vista y la luz, no el paso)
    return [{ a: clipped[0], b: clipped[1], closed: true, window: !portal.closed }]
  })
  return {
    ok: true,
    value: {
      width: size.width,
      height: size.height,
      grid: { type: 'square', size: cell, offsetX: fraction(map.origin.x), offsetY: fraction(map.origin.y) },
      imported: {
        source: 'uvtt',
        walls: map.walls.flatMap(place),
        objects: map.objects.flatMap(place),
        portals,
        lights: map.lights
          .map((light) => ({ ...light, position: toPixels(light.position) }))
          .filter((light) => light.range > 0 && inside(light.position))
          .map((light) => ({
            x: light.position.x,
            y: light.position.y,
            range: light.range * cell,
            intensity: light.intensity / strongest,
            color: light.color,
            shadows: light.shadows
          })),
        ambientLight: map.ambientLight,
        bakedLighting: map.bakedLighting
      }
    }
  }
}
