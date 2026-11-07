/**
 * Trocear el mapa de una escena (docs/specs/escenas.md, ADR-0018 § 7): por cada nivel de la pirámide, sus teselas en
 * WebP, subidas unas pocas a la vez. Lo hace el navegador del máster en un hilo aparte (`prepare.worker.ts`); aquí,
 * el orden, los recortes y la cola, sin canvas ni red (se inyectan), para probarlo
 */
import { MAX_ANALYSIS_SIDE, type Rect, type TilePyramid, type TileRef, tileWorldRect } from '@crisol/tabletop'

/** Un fallo de la preparación con su código (lo traduce la interfaz) */
export class PrepareError extends Error {
  readonly code: string
  constructor(code: string, message = code) {
    super(message)
    this.code = code
    this.name = 'PrepareError'
  }
}

/** Todas las teselas, del nivel más pequeño (el mapa entero en pocas) al mayor, por filas */
export function tileOrder(pyramid: TilePyramid): TileRef[] {
  const out: TileRef[] = []
  for (const level of [...pyramid.levels].reverse())
    for (let y = 0; y < level.rows; y++) for (let x = 0; x < level.columns; x++) out.push({ level: level.level, x, y })
  return out
}

/** El trozo de la imagen (a tamaño real) del que sale una tesela, sin salirse de ella */
export function sourceRect(pyramid: TilePyramid, ref: TileRef): Rect {
  const r = tileWorldRect(pyramid, ref)
  return {
    x: r.x,
    y: r.y,
    width: Math.min(r.width, pyramid.width - r.x),
    height: Math.min(r.height, pyramid.height - r.y)
  }
}

/** El nivel con más detalle que aún cabe en lo que analiza la búsqueda de la rejilla */
export function analysisLevel(pyramid: TilePyramid): number {
  const found = pyramid.levels.find((level) => Math.max(level.width, level.height) <= MAX_ANALYSIS_SIDE)
  return found?.level ?? pyramid.levels.length - 1
}

export interface PrepareTilesOptions {
  /** La tesela en WebP */
  encode(ref: TileRef): Promise<Blob>
  upload(ref: TileRef, tile: Blob, signal?: AbortSignal): Promise<void>
  /** Cuántas suben a la vez */
  concurrency?: number
  signal?: AbortSignal
  onProgress?(done: number, total: number): void
}

/** Cuántas veces se intenta subir una tesela antes de dejarlo */
const ATTEMPTS = 3

/**
 * Codifica las teselas una tras otra y las sube a la vez que codifica las siguientes, con como mucho `concurrency`
 * subidas en marcha. Si una no sube tras sus intentos, o se cancela, para (las que ya subieron se quedan sin usar)
 */
export async function prepareTiles(pyramid: TilePyramid, options: PrepareTilesOptions): Promise<void> {
  const { encode, upload, signal } = options
  const concurrency = Math.max(1, options.concurrency ?? 6)
  const order = tileOrder(pyramid)
  const total = order.length
  let done = 0
  let failure: unknown = null
  const running = new Set<Promise<void>>()
  const check = () => {
    if (failure) throw failure
    if (signal?.aborted) throw new PrepareError('CANCELLED')
  }

  const send = async (ref: TileRef, tile: Blob) => {
    for (let attempt = 1; ; attempt++) {
      try {
        await upload(ref, tile, signal)
        break
      } catch (error) {
        if (signal?.aborted || attempt >= ATTEMPTS) throw error
      }
    }
    done++
    options.onProgress?.(done, total)
  }

  for (const ref of order) {
    check()
    const tile = await encode(ref)
    // Safari, por ejemplo, devuelve PNG cuando no sabe sacar WebP: el servidor no lo aceptaría
    if (tile.type !== 'image/webp') throw new PrepareError('NO_WEBP')
    while (running.size >= concurrency) await Promise.race(running)
    check()
    const job = send(ref, tile).then(
      () => {
        running.delete(job)
      },
      (error: unknown) => {
        running.delete(job)
        failure ??= error
      }
    )
    running.add(job)
  }
  await Promise.all(running)
  check()
}

// ── Lo que se dicen la página y el hilo que trocea ───────────────────────

/**
 * De dónde sale el mapa: una imagen (un archivo del mundo ya bajado o una que se elige), un UVTT o una imagen ya
 * pintada (un SVG: en el hilo que trocea no se puede descodificar, se pinta antes en la página)
 */
export type PrepareSource =
  | { kind: 'image'; blob: Blob }
  | { kind: 'uvtt'; blob: Blob }
  | { kind: 'bitmap'; bitmap: ImageBitmap }

/** La rejilla que se encontró, ya en píxeles de la imagen entera */
export interface DetectedGrid {
  type: 'square' | 'hex-rows' | 'hex-columns'
  size: number
  offsetX: number
  offsetY: number
}

/** Lo que trae un UVTT para la escena (como `uvttScene` del núcleo) */
export interface PreparedUvtt {
  grid: { type: 'square'; size: number; offsetX: number; offsetY: number }
  imported: {
    source: 'uvtt'
    walls: Array<Array<{ x: number; y: number }>>
    objects: Array<Array<{ x: number; y: number }>>
    portals: Array<{ a: { x: number; y: number }; b: { x: number; y: number }; closed: boolean; window: boolean }>
    lights: Array<{ x: number; y: number; range: number; intensity: number; color: string; shadows: boolean }>
    ambientLight: string | null
    bakedLighting: boolean
  }
}

export type WorkerRequest =
  | { type: 'prepare'; sceneId: string; version: string; source: PrepareSource }
  | { type: 'detect'; sceneId: string; version: string; width: number; height: number; size: number; levels: number }

export type WorkerReply =
  /** Ya se sabe lo que mide (y aquí está la imagen, para enseñarla mientras se trocea) */
  | { type: 'image'; width: number; height: number; preview: Blob | null; total: number }
  | { type: 'progress'; done: number; total: number }
  | { type: 'prepared'; width: number; height: number; size: number; levels: number; uvtt: PreparedUvtt | null }
  | { type: 'detected'; grid: DetectedGrid | null }
  | { type: 'failed'; code: string }
