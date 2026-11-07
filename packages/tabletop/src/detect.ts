// Portado de packages/mesa/src/nucleo/deteccion.ts (Crisol actual, commit 3f68f11)
/**
 * Detectar la rejilla impresa en un mapa. Diseño propio:
 *
 * 1. Evidencia de línea: cuánto más oscuro (o claro) es un píxel que sus dos flancos a lo largo de una dirección. Un
 *    cambio de brillo (el borde de una zona pintada) solo tiene un flanco distinto y no cuenta.
 * 2. Perfiles: la evidencia de las líneas perpendiculares a una dirección, sumada a lo largo de ellas. Una familia de
 *    líneas paralelas da picos periódicos; su autocorrelación da el periodo (el menor de los fuertes, para no tomar
 *    un múltiplo). Cuadrada: dos familias a 90°, periodo = lado. Hexagonal: tres a 60°, periodo = medio tamaño.
 * 3. Cada tipo con apoyo se coloca (fase de los perfiles y, en la hexagonal, una búsqueda de la fila) y se puntúa con
 *    la evidencia sobre sus propias líneas frente a la de dentro de las celdas: gana la que de verdad está en el mapa.
 *
 * Trabaja sobre un buffer de píxeles RGBA (como `ImageData`), en píxeles de la imagen que recibe: quien llama la
 * reduce antes (a `MAX_ANALYSIS_SIDE`) y lleva el resultado a la imagen entera. Puro: sin DOM ni canvas, para poder
 * llamarlo desde un Web Worker o desde el servidor.
 */
import { normalizeGrid } from './align.ts'
import type { Point, Rect } from './geometry.ts'
import { cellAt, cellCenter, type Grid, type GridType, gridLines, isHex } from './grid.ts'

/** Píxeles RGBA por filas, como los de `ImageData` */
export interface PixelBuffer {
  width: number
  height: number
  data: Uint8ClampedArray | Uint8Array
}

export interface GridDetection {
  /** En píxeles de la imagen analizada */
  grid: Grid
  /** Cuánto se estira el mapa para que sus celdas sean regulares (null si ya lo son) */
  stretch: { x: number; y: number } | null
  /** Qué parte de la rejilla está en el mapa (0–1) */
  support: number
}

/** Una rejilla que el máster midió o colocó: se mantiene su tipo y se buscan tamaños cercanos */
export interface GridHint {
  type: GridType
  size: number
}

/** Lado mayor recomendado de la imagen que se analiza (más grande no mejora y tarda mucho más) */
export const MAX_ANALYSIS_SIDE = 1280

/** La imagen en luminancia 0–255, por filas */
interface GrayImage {
  width: number
  height: number
  data: Float32Array
}

/** Distancia de los flancos a la línea */
const FLANK = 2
/** Celdas más pequeñas que esto (px de la imagen analizada) no se buscan */
const MIN_CELL = 12
/** Entre los picos de la autocorrelación, gana el menor que llegue a esta parte del mejor */
const STRONG_PEAK = 0.7
/** Por debajo de esto, una dirección no tiene líneas periódicas */
const MIN_PERIODICITY = 0.12
/** Lo que deben coincidir los periodos de las familias de una hexagonal */
const HEX_TOLERANCE = 0.04
/** Hasta dónde se acepta una cuadrada con celdas rectangulares (se estira el mapa) */
const MAX_ASPECT = 1.5
/** Para aceptar una rejilla: la evidencia en sus líneas frente a la de dentro de las celdas, y qué parte se ve */
const MIN_CONTRAST = 1.8
const MIN_SUPPORT = 0.3
/** Con pista, el tamaño puede estar hasta esta fracción del suyo */
const HINT_MARGIN = 0.05

const SQRT3 = Math.sqrt(3)
const direction = (degrees: number): Point => ({
  x: Math.cos((degrees * Math.PI) / 180),
  y: Math.sin((degrees * Math.PI) / 180)
})
const fraction = (v: number): number => v - Math.floor(v)

/** La luminancia de cada píxel; lo transparente cuenta como fondo oscuro */
function toGray(pixels: PixelBuffer): GrayImage {
  const { width, height, data } = pixels
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 0 || height < 0)
    throw new RangeError(`Tamaño de imagen no válido: ${width} × ${height}`)
  if (data.length < width * height * 4)
    throw new RangeError(`Faltan píxeles: ${data.length} bytes para ${width} × ${height}`)
  const gray = new Float32Array(width * height)
  for (let i = 0; i < gray.length; i++) {
    const j = i * 4
    const alpha = (data[j + 3] ?? 0) / 255
    gray[i] = (0.2126 * (data[j] ?? 0) + 0.7152 * (data[j + 1] ?? 0) + 0.0722 * (data[j + 2] ?? 0)) * alpha
  }
  return { width, height, data: gray }
}

/** La luminancia del píxel más cercano (null fuera de la imagen) */
function sample(img: GrayImage, x: number, y: number): number | null {
  const i = Math.round(x)
  const j = Math.round(y)
  if (i < 0 || j < 0 || i >= img.width || j >= img.height) return null
  return img.data[j * img.width + i] ?? null
}

/** La evidencia de línea a partir del centro y sus dos flancos */
function flankEvidence(center: number, a: number, b: number): number {
  const da = a - center
  const db = b - center
  if (da > 0 && db > 0) return Math.min(da, db)
  if (da < 0 && db < 0) return Math.min(-da, -db)
  return 0
}

/** Evidencia de línea en un punto, a lo largo de la normal `n`: la diferencia con el más parecido de sus dos flancos */
function lineEvidence(img: GrayImage, x: number, y: number, n: Point): number {
  const c = sample(img, x, y)
  const a = sample(img, x - n.x * FLANK, y - n.y * FLANK)
  const b = sample(img, x + n.x * FLANK, y + n.y * FLANK)
  if (c === null || a === null || b === null) return 0
  return flankEvidence(c, a, b)
}

interface Profile {
  values: Float64Array
  origin: number
}

/** Perfil de la evidencia de las líneas perpendiculares a `n`, sumada a lo largo de ellas (cubos de 1 px) */
function profile(img: GrayImage, n: Point): Profile {
  const corners = [0, img.width * n.x, img.height * n.y, img.width * n.x + img.height * n.y]
  const origin = Math.floor(Math.min(...corners))
  const values = new Float64Array(Math.ceil(Math.max(...corners)) - origin + 2)
  // En un píxel entero, los flancos quedan a un desplazamiento fijo del buffer (redondear un entero más algo es el
  // entero más el redondeo de ese algo), sin salirse: el flanco mide FLANK como mucho por cada eje
  const before = Math.round(-n.x * FLANK) + Math.round(-n.y * FLANK) * img.width
  const after = Math.round(n.x * FLANK) + Math.round(n.y * FLANK) * img.width
  for (let y = FLANK; y < img.height - FLANK; y++) {
    for (let x = FLANK; x < img.width - FLANK; x++) {
      const i = y * img.width + x
      const e = flankEvidence(img.data[i] ?? 0, img.data[i + before] ?? 0, img.data[i + after] ?? 0)
      if (e === 0) continue
      const t = x * n.x + y * n.y - origin
      const k = Math.floor(t)
      const f = t - k
      values[k] = (values[k] ?? 0) + e * (1 - f)
      values[k + 1] = (values[k + 1] ?? 0) + e * f
    }
  }
  // Sin la tendencia lenta (zonas más o menos cargadas de líneas)
  const window = 50
  const sum = new Float64Array(values.length + 1)
  values.forEach((v, i) => {
    sum[i + 1] = (sum[i] ?? 0) + v
  })
  const clean = new Float64Array(values.length)
  values.forEach((v, i) => {
    const a = Math.max(0, i - window)
    const b = Math.min(values.length, i + window + 1)
    clean[i] = v - ((sum[b] ?? 0) - (sum[a] ?? 0)) / (b - a)
  })
  return { values: clean, origin }
}

/** Los perfiles de una imagen por ángulo, calculados la primera vez que se piden */
function profileCache(img: GrayImage): (degrees: number) => Profile {
  const cache = new Map<number, Profile>()
  return (degrees) => {
    const known = cache.get(degrees)
    if (known) return known
    const p = profile(img, direction(degrees))
    cache.set(degrees, p)
    return p
  }
}

/** El valor interpolado de un perfil */
function valueAt(values: Float64Array, t: number): number {
  const k = Math.floor(t)
  if (k < 0 || k + 1 >= values.length) return 0
  const f = t - k
  return (values[k] ?? 0) * (1 - f) + (values[k + 1] ?? 0) * f
}

interface Period {
  period: number
  /** Autocorrelación normalizada en ese periodo (0–1) */
  strength: number
}

/** Los picos de la autocorrelación de un perfil entre `from` y `to` (periodos candidatos), del más fuerte al más débil */
function peaksOf(values: Float64Array, from: number, to: number): Period[] {
  let zero = 0
  for (const v of values) zero += v * v
  if (zero <= 0) return []
  const limit = Math.min(Math.floor(to) + 1, values.length - 1)
  const r = new Float64Array(limit + 2)
  for (let tau = Math.max(1, Math.floor(from) - 1); tau <= limit + 1 && tau < values.length; tau++) {
    let s = 0
    for (let i = 0; i + tau < values.length; i++) s += (values[i] ?? 0) * (values[i + tau] ?? 0)
    // Normalizada por el solape, para no favorecer los periodos cortos
    r[tau] = (s / zero) * (values.length / (values.length - tau))
  }
  const peaks: Period[] = []
  for (let tau = Math.max(2, Math.ceil(from)); tau <= limit; tau++) {
    const v = r[tau] ?? 0
    const a = r[tau - 1] ?? 0
    const c = r[tau + 1] ?? 0
    if (v > a && v >= c && v >= MIN_PERIODICITY) {
      // Parábola por los tres puntos
      const den = a - 2 * v + c
      const d = den < 0 ? (0.5 * (a - c)) / den : 0
      peaks.push({ period: tau + Math.max(-0.5, Math.min(0.5, d)), strength: v })
    }
  }
  return peaks.sort((p, q) => q.strength - p.strength)
}

/** El periodo de las líneas de un perfil: el menor pico fuerte (no un múltiplo del de verdad) */
function periodOf(values: Float64Array, from: number, to: number): Period | null {
  const peaks = peaksOf(values, from, to)
  const best = peaks[0]
  if (!best) return null
  return peaks.filter((p) => p.strength >= best.strength * STRONG_PEAK).sort((p, q) => p.period - q.period)[0] ?? null
}

/** Los picos de dos o tres familias que coinciden (dentro de `tolerance`): periodos que todas ven */
function shared(families: readonly Period[][], tolerance: number, max = 4): { periods: number[]; strength: number }[] {
  const out: { periods: number[]; strength: number }[] = []
  const [first, ...rest] = families
  for (const p of first ?? []) {
    const matches: Period[] = []
    for (const family of rest) {
      const q = family.find((c) => Math.abs(c.period - p.period) / p.period <= tolerance)
      if (!q) break
      matches.push(q)
    }
    if (matches.length < rest.length) continue
    out.push({
      periods: [p.period, ...matches.map((q) => q.period)],
      strength: Math.min(p.strength, ...matches.map((q) => q.strength))
    })
  }
  return out.sort((a, b) => b.strength - a.strength).slice(0, max)
}

/** Periodo exacto y fase de las líneas de un perfil cerca de `period`: lo que más evidencia suma en sus picos */
function comb(values: Float64Array, period: number, margin = 0.03): { period: number; phase: number; value: number } {
  let best = { period, phase: 0, value: -Infinity }
  const total = (p: number, phase: number): number => {
    let s = 0
    let n = 0
    for (let t = phase; t < values.length - 1; t += p) {
      s += valueAt(values, t)
      n++
    }
    return n ? s / n : 0
  }
  const steps = Math.max(1, Math.round((period * margin * 2) / 0.02))
  for (let i = 0; i <= steps; i++) {
    const p = period * (1 - margin) + (period * margin * 2 * i) / steps
    for (let phase = 0; phase < p; phase += 0.5) {
      const v = total(p, phase)
      if (v > best.value) best = { period: p, phase, value: v }
    }
  }
  // Afinar la fase
  for (let phase = best.phase - 0.5; phase <= best.phase + 0.5; phase += 0.05) {
    const wrapped = ((phase % best.period) + best.period) % best.period
    const v = total(best.period, wrapped)
    if (v > best.value) best = { ...best, phase: wrapped, value: v }
  }
  return best
}

interface LineSample {
  p: Point
  n: Point
}

/** Puntos de muestra sobre las líneas de la rejilla dentro de la imagen, con su normal (sin los extremos) */
function samples(img: GrayImage, grid: Grid, max = 4000, area?: Rect): LineSample[] {
  const margin = FLANK + 2
  const zone = area ?? { x: margin, y: margin, width: img.width - 2 * margin, height: img.height - 2 * margin }
  const all: LineSample[] = []
  const step = Math.max(2, grid.size / 12)
  for (const [x1, y1, x2, y2] of gridLines(grid, zone)) {
    const length = Math.hypot(x2 - x1, y2 - y1)
    if (length < step) continue
    const n = { x: -(y2 - y1) / length, y: (x2 - x1) / length }
    // Sin los extremos: allí se cruzan líneas
    for (let d = length * 0.15; d <= length * 0.85; d += step) {
      const p = { x: x1 + ((x2 - x1) * d) / length, y: y1 + ((y2 - y1) * d) / length }
      if (p.x >= margin && p.y >= margin && p.x < img.width - margin && p.y < img.height - margin) all.push({ p, n })
    }
  }
  return thin(all, max)
}

/** Como mucho `max` elementos de la lista, repartidos por toda ella */
function thin<T>(list: readonly T[], max: number): T[] {
  if (list.length <= max) return [...list]
  const jump = list.length / max
  const out: T[] = []
  for (let i = 0; i < max; i++) {
    const item = list[Math.floor(i * jump)]
    if (item !== undefined) out.push(item)
  }
  return out
}

interface Support {
  contrast: number
  support: number
}

/** Cuánto está la rejilla en el mapa: evidencia en sus líneas frente a la de dentro de las celdas, y qué parte se ve */
function supportOf(img: GrayImage, grid: Grid): Support {
  return supportOfSamples(img, samples(img, grid), grid.size * 0.25)
}

function supportOfSamples(img: GrayImage, list: readonly LineSample[], inside: number): Support {
  if (list.length < 20) return { contrast: 0, support: 0 }
  let on = 0
  let off = 0
  const values: number[] = []
  for (const { p, n } of list) {
    const e = lineEvidence(img, p.x, p.y, n)
    values.push(e)
    on += e
    off +=
      (lineEvidence(img, p.x + n.x * inside, p.y + n.y * inside, n) +
        lineEvidence(img, p.x - n.x * inside, p.y - n.y * inside, n)) /
      2
  }
  on /= list.length
  off /= list.length
  const threshold = Math.max(4, off * 2)
  return { contrast: on / (off + 1), support: values.filter((v) => v > threshold).length / values.length }
}

/** Si `p` está a menos de `distance` de una línea de la rejilla (el borde de su celda) */
function onLine(grid: Grid, p: Point, distance: number): boolean {
  const c = cellCenter(grid, cellAt(grid, p))
  const dx = p.x - c.x
  const dy = p.y - c.y
  const apothem = grid.size / 2
  if (grid.type === 'square') return apothem - Math.max(Math.abs(dx), Math.abs(dy)) < distance
  // Hexágono: las normales de sus caras cada 60° (0° en el de punta arriba, 30° en el de lado arriba)
  const start = grid.type === 'hex-rows' ? 0 : Math.PI / 6
  let max = 0
  for (let i = 0; i < 3; i++) {
    const a = start + (i * Math.PI) / 3
    max = Math.max(max, Math.abs(dx * Math.cos(a) + dy * Math.sin(a)))
  }
  return apothem - max < distance
}

interface Proposal {
  type: GridType
  size: number
  /** Cuadrada: periodos por eje (pueden diferir: celdas rectangulares) */
  axes?: { x: number; y: number }
}

/** Lo que proponen los perfiles de las seis direcciones */
function proposals(img: GrayImage, profiles: (degrees: number) => Profile, hint?: GridHint): Proposal[] {
  const side = Math.min(img.width, img.height)
  const list: Proposal[] = []
  const types: GridType[] = hint ? [hint.type] : ['square', 'hex-rows', 'hex-columns']
  for (const type of types) {
    // El periodo de las familias: el lado (cuadrada) o medio tamaño (hexagonal)
    const factor = isHex(type) ? 0.5 : 1
    const from = hint ? hint.size * factor * (1 - HINT_MARGIN) : MIN_CELL * factor
    const to = hint ? hint.size * factor * (1 + HINT_MARGIN) : (side / 3) * factor
    if (type === 'square') {
      const x = peaksOf(profiles(0).values, from, to)
      const y = peaksOf(profiles(90).values, from, to)
      // Regulares: periodos que ven las dos familias
      for (const { periods } of shared([x, y], 0.03)) {
        const [px = 0, py = 0] = periods
        list.push({ type, size: Math.max(px, py), axes: { x: px, y: py } })
      }
      // Regulares que sugiere una familia sola (la otra puede tener pocas líneas)
      for (const t of [...x.slice(0, 2), ...y.slice(0, 2)])
        list.push({ type, size: t.period, axes: { x: t.period, y: t.period } })
      // Celdas rectangulares: el periodo de cada familia por su lado
      const px = periodOf(profiles(0).values, from, to)
      const py = periodOf(profiles(90).values, from, to)
      if (px && py && Math.max(px.period, py.period) / Math.min(px.period, py.period) <= MAX_ASPECT)
        list.push({ type, size: Math.max(px.period, py.period), axes: { x: px.period, y: py.period } })
    } else {
      const angles = type === 'hex-rows' ? [0, 60, 120] : [90, 30, 150]
      const families = angles.map((a) => peaksOf(profiles(a).values, from, to))
      for (const { periods } of shared(families, HEX_TOLERANCE)) {
        list.push({ type, size: periods.reduce((s, v) => s + v, 0) / periods.length / factor })
      }
    }
  }
  // Las divisoras de cada una (un pico puede ser un múltiplo de la de verdad), regulares
  const min = hint ? hint.size * (1 - HINT_MARGIN) : MIN_CELL
  for (const p of [...list]) {
    // Las cuadradas impresas a veces marcan cada tercera o quinta línea; las hexagonales, solo la mitad
    for (let k = 2; k <= (p.type === 'square' ? 5 : 2); k++) {
      const size = p.size / k
      if (size < min) break
      list.push({ type: p.type, size, ...(p.axes ? { axes: { x: size, y: size } } : {}) })
    }
  }
  // Sin repetidas
  const same = (p: Proposal, q: Proposal): boolean =>
    q.type === p.type &&
    Math.abs(q.size - p.size) < p.size * 0.01 &&
    Math.abs((q.axes?.x ?? 0) - (p.axes?.x ?? 0)) < p.size * 0.01 &&
    Math.abs((q.axes?.y ?? 0) - (p.axes?.y ?? 0)) < p.size * 0.01
  return list.filter((p, i) => list.findIndex((q) => same(p, q)) === i)
}

/** Coloca una propuesta: fase de los perfiles y, en la hexagonal, la fila que más evidencia tiene */
function place(
  img: GrayImage,
  proposal: Proposal,
  profiles: (degrees: number) => Profile
): { grid: Grid; stretch: GridDetection['stretch'] } {
  if (proposal.type === 'square') {
    const px = profiles(0)
    const py = profiles(90)
    const x = comb(px.values, proposal.axes?.x ?? proposal.size)
    const y = comb(py.values, proposal.axes?.y ?? proposal.size)
    const ox = x.phase + px.origin
    const oy = y.phase + py.origin
    const size = Math.max(x.period, y.period)
    const sx = size / x.period
    const sy = size / y.period
    const regular = Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01
    // Con estiramiento, el tamaño y el desplazamiento son del mapa estirado (el que lo usa los lleva al mundo)
    return {
      grid: normalizeGrid({
        type: 'square',
        size: regular ? (x.period + y.period) / 2 : size,
        offsetX: regular ? ox : ox * sx,
        offsetY: regular ? oy : oy * sy
      }),
      stretch: regular ? null : { x: Math.round(sx * 1000) / 1000, y: Math.round(sy * 1000) / 1000 }
    }
  }
  const rows = proposal.type === 'hex-rows'
  // La familia de las aristas rectas da el periodo exacto y una coordenada (con dos opciones por medio tamaño)
  const straight = profiles(rows ? 0 : 90)
  const p = comb(straight.values, proposal.size / 2)
  const size = p.period * 2
  const phase = p.phase + straight.origin
  const box = rows ? { width: size, height: (2 * size) / SQRT3 } : { width: (2 * size) / SQRT3, height: size }
  // La otra coordenada: la que más evidencia pone sobre las aristas, recorriendo un periodo de filas (o columnas)
  const span = rows ? box.height * 1.5 : box.width * 1.5
  const gridWith = (a: number, b: number): Grid =>
    rows ? { type: 'hex-rows', size, offsetX: a, offsetY: b } : { type: 'hex-columns', size, offsetX: b, offsetY: a }
  // Se busca en una ventana de unas ocho celdas en el centro del mapa
  const side = Math.min(size * 8, img.width - 2 * (FLANK + 2), img.height - 2 * (FLANK + 2))
  const area = { x: (img.width - side) / 2, y: (img.height - side) / 2, width: side, height: side }
  const score = (g: Grid): number => {
    const list = samples(img, g, 600, area)
    let s = 0
    for (const { p: q, n } of list) s += lineEvidence(img, q.x, q.y, n)
    return list.length ? s / list.length : 0
  }
  let best = { a: phase, b: 0, value: -Infinity }
  for (const a of [phase, phase + size / 2]) {
    for (let b = 0; b < span; b += Math.max(1, size / 30)) {
      const v = score(gridWith(a, b))
      if (v > best.value) best = { a, b, value: v }
    }
  }
  const coarse = Math.max(1, size / 30)
  for (let b = best.b - coarse; b <= best.b + coarse; b += 0.1) {
    const v = score(gridWith(best.a, b))
    if (v > best.value) best = { ...best, b, value: v }
  }
  return { grid: normalizeGrid(gridWith(best.a, best.b)), stretch: null }
}

/**
 * El apoyo de una cuadrada de celdas rectangulares (en la imagen sin estirar): verticales cada `axes.x`, horizontales
 * cada `axes.y`.
 */
function rectangularSupport(img: GrayImage, origin: Point, axes: { x: number; y: number }): Support {
  const list: LineSample[] = []
  const margin = FLANK + 2
  const stepX = Math.max(2, axes.x / 12)
  const stepY = Math.max(2, axes.y / 12)
  const firstLine = (o: number, t: number): number => o - Math.floor((o - margin) / t) * t
  // Sin los extremos: allí se cruzan líneas
  const midCell = (v: number, o: number, t: number): boolean => {
    const f = fraction((v - o) / t)
    return f > 0.15 && f < 0.85
  }
  for (let x = firstLine(origin.x, axes.x); x < img.width - margin; x += axes.x)
    for (let y = margin; y < img.height - margin; y += stepY)
      if (midCell(y, origin.y, axes.y)) list.push({ p: { x, y }, n: { x: 1, y: 0 } })
  for (let y = firstLine(origin.y, axes.y); y < img.height - margin; y += axes.y)
    for (let x = margin; x < img.width - margin; x += stepX)
      if (midCell(x, origin.x, axes.x)) list.push({ p: { x, y }, n: { x: 0, y: 1 } })
  const every = Math.ceil(Math.max(1, list.length / 4000))
  return supportOfSamples(
    img,
    list.filter((_, i) => i % every === 0),
    Math.min(axes.x, axes.y) * 0.25
  )
}

/**
 * La rejilla impresa en la imagen, o null si no hay ninguna clara. Con `hint`, solo se busca de ese tipo y cerca de
 * ese tamaño («Ajustar a las líneas del mapa»).
 */
export function detectGrid(pixels: PixelBuffer, hint?: GridHint): GridDetection | null {
  const img = toGray(pixels)
  if (img.width < MIN_CELL * 3 || img.height < MIN_CELL * 3) return null
  const profiles = profileCache(img)
  const accepted: Candidate[] = []
  for (const proposal of proposals(img, profiles, hint)) {
    const { grid, stretch } = place(img, proposal, profiles)
    // El apoyo se mide sobre la imagen sin estirar
    const { contrast, support } = stretch
      ? rectangularSupport(
          img,
          { x: grid.offsetX / stretch.x, y: grid.offsetY / stretch.y },
          { x: grid.size / stretch.x, y: grid.size / stretch.y }
        )
      : supportOf(img, grid)
    if (contrast < MIN_CONTRAST || support < MIN_SUPPORT) continue
    accepted.push({ grid, stretch, support, score: contrast * support })
  }
  const first = accepted.sort((a, b) => b.score - a.score)[0]
  if (!first) return null
  // Una rejilla doble (o triple…) de la de verdad también tiene todas sus líneas en el mapa: se baja a la mayor de sus
  // divisoras cuyas líneas de más (las que ella no tiene) también están, hasta que ninguna lo cumple
  let best = first
  for (let next = finerDivisor(img, accepted, best); next; next = finerDivisor(img, accepted, best)) best = next
  return { grid: best.grid, stretch: best.stretch, support: best.support }
}

type Candidate = GridDetection & { score: number }

/** La mayor divisora de `now` entre las candidatas cuyas líneas de más también están en el mapa */
function finerDivisor(img: GrayImage, candidates: readonly Candidate[], now: Candidate): Candidate | undefined {
  return candidates
    .filter((c) => c.grid.type === now.grid.type && !c.stretch && !now.stretch && c.grid.size < now.grid.size)
    .filter((c) => {
      const k = now.grid.size / c.grid.size
      return Math.round(k) >= 2 && Math.abs(k - Math.round(k)) < 0.04 * Math.round(k)
    })
    .sort((a, b) => b.grid.size - a.grid.size)
    .find((c) => {
      const extra = samples(img, c.grid).filter(({ p }) => !onLine(now.grid, p, c.grid.size * 0.1))
      const s = supportOfSamples(img, extra, c.grid.size * 0.25)
      return s.contrast >= MIN_CONTRAST && s.support >= MIN_SUPPORT
    })
}
