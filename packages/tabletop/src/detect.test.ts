// Portado de packages/mesa/src/nucleo/deteccion.test.ts (Crisol actual, commit 3f68f11)
import { describe, expect, it } from 'vitest'
import { detectGrid, type PixelBuffer } from './detect.ts'
import { cellAt, cellCenter, type Grid, gridLines } from './grid.ts'

/** Azar repetible */
function random(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0
    return s / 4294967296
  }
}

/** Una imagen en grises (0–255) como píxeles RGBA opacos, como los de `ImageData` */
function toPixels(width: number, height: number, gray: Float32Array): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4)
  gray.forEach((v, i) => {
    data[i * 4] = v
    data[i * 4 + 1] = v
    data[i * 4 + 2] = v
    data[i * 4 + 3] = 255
  })
  return { width, height, data }
}

/**
 * Un mapa de prueba: suelo con ruido y manchas (salas oscuras, zonas claras) y, encima, las líneas de `grid`
 * (opcionalmente estirada: las celdas impresas son rectangulares).
 */
function map(
  width: number,
  height: number,
  grid: Grid | null,
  options: { stretch?: { x: number; y: number }; seed?: number; ink?: number } = {}
): PixelBuffer {
  const r = random(options.seed ?? 7)
  const gray = new Float32Array(width * height)
  for (let i = 0; i < gray.length; i++) gray[i] = 170 + (r() - 0.5) * 30
  // Manchas: salas y zonas pintadas
  for (let k = 0; k < 14; k++) {
    const x0 = Math.floor(r() * width)
    const y0 = Math.floor(r() * height)
    const w = 60 + Math.floor(r() * 220)
    const h = 60 + Math.floor(r() * 220)
    const v = r() < 0.5 ? 60 : 215
    for (let y = y0; y < Math.min(height, y0 + h); y++)
      for (let x = x0; x < Math.min(width, x0 + w); x++) gray[y * width + x] = v + (r() - 0.5) * 20
  }
  if (grid) {
    const e = options.stretch ?? { x: 1, y: 1 }
    const ink = options.ink ?? 35
    // Las líneas se trazan en el mapa estirado y se llevan a la imagen
    for (const [x1, y1, x2, y2] of gridLines(grid, { x: 0, y: 0, width: width * e.x, height: height * e.y })) {
      const length = Math.hypot(x2 - x1, y2 - y1)
      for (let d = 0; d <= length; d += 0.5) {
        const x = (x1 + ((x2 - x1) * d) / length) / e.x
        const y = (y1 + ((y2 - y1) * d) / length) / e.y
        for (const [dx, dy] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1]
        ] as const) {
          const i = Math.floor(x) + dx
          const j = Math.floor(y) + dy
          if (i >= 0 && j >= 0 && i < width && j < height)
            gray[j * width + i] = Math.max(0, (gray[j * width + i] ?? 0) - ink * 0.6)
        }
      }
    }
  }
  return toPixels(width, height, gray)
}

/** Si la detectada es la misma red que la real: tipo, tamaño y centros que caen en centros */
const same = (found: Grid, real: Grid, tolerance = 1): void => {
  expect(found.type).toBe(real.type)
  expect(Math.abs(found.size - real.size)).toBeLessThan(tolerance * 0.5)
  for (const cell of [
    { q: 2, r: 2 },
    { q: 8, r: 5 }
  ]) {
    const c = cellCenter(real, cell)
    const d = cellCenter(found, cellAt(found, c))
    expect(Math.hypot(d.x - c.x, d.y - c.y)).toBeLessThan(tolerance)
  }
}

// Con la cobertura, cada detección tarda unas cinco veces más (hasta 6 s la hexagonal)
describe('detectar la rejilla', { timeout: 60_000 }, () => {
  it('cuadrada sobre un mapa con salas', () => {
    const real: Grid = { type: 'square', size: 47, offsetX: 13, offsetY: 30 }
    const d = detectGrid(map(900, 640, real))
    expect(d).not.toBeNull()
    if (d) same(d.grid, real)
    expect(d?.stretch).toBeNull()
    expect(d?.support).toBeGreaterThan(0.6)
  })

  for (const type of ['hex-rows', 'hex-columns'] as const) {
    it(`${type}`, () => {
      const real: Grid = { type, size: 52, offsetX: 21, offsetY: 9 }
      const d = detectGrid(map(880, 660, real, { seed: 11 }))
      expect(d).not.toBeNull()
      if (d) same(d.grid, real, 1.5)
    })
  }

  it('celdas rectangulares: propone estirar el mapa', () => {
    const real: Grid = { type: 'square', size: 60, offsetX: 0, offsetY: 0 }
    const d = detectGrid(map(900, 700, real, { stretch: { x: 1, y: 1.12 }, seed: 3 }))
    expect(d).not.toBeNull()
    expect(d?.stretch?.x).toBeCloseTo(1, 2)
    expect(d?.stretch?.y).toBeGreaterThan(1.1)
    expect(d?.stretch?.y).toBeLessThan(1.14)
    expect(d?.grid.size).toBeGreaterThan(59)
    expect(d?.grid.size).toBeLessThan(61)
  })

  it('sin rejilla: null', () => {
    expect(detectGrid(map(800, 600, null, { seed: 5 }))).toBeNull()
  })

  it('con pista: el tipo de la pista y un tamaño cercano', () => {
    const real: Grid = { type: 'square', size: 47, offsetX: 13, offsetY: 30 }
    const d = detectGrid(map(900, 640, real), { type: 'square', size: 46 })
    expect(d).not.toBeNull()
    if (d) same(d.grid, real)
  })

  it('una imagen demasiado pequeña o transparente no tiene rejilla', () => {
    expect(detectGrid({ width: 20, height: 400, data: new Uint8ClampedArray(20 * 400 * 4) })).toBeNull()
    // Lo transparente cuenta como fondo oscuro: la misma rejilla, sin opacidad, no se ve
    const hidden = map(300, 300, { type: 'square', size: 40, offsetX: 0, offsetY: 0 })
    for (let i = 3; i < hidden.data.length; i += 4) hidden.data[i] = 0
    expect(detectGrid(hidden)).toBeNull()
  })

  it('un buffer que no cuadra con su tamaño es un error', () => {
    expect(() => detectGrid({ width: 100, height: 100, data: new Uint8ClampedArray(100) })).toThrow(RangeError)
    expect(() => detectGrid({ width: 10.5, height: 100, data: new Uint8ClampedArray(5000) })).toThrow(RangeError)
  })
})
