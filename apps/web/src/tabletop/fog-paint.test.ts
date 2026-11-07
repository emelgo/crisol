import { FogGrid, tilePyramid } from '@crisol/tabletop'
import { describe, expect, it } from 'vitest'
import { decodeMask, FOG_LOOKS, fogImage, maskTileUrl, soften, tileCoverage, tileSignature } from './fog-paint.ts'

/** Un mapa de 100 × 50 en celdas de 10: 10 × 5 celdas */
const grids = () => {
  const explored = new FogGrid(100, 50, 10)
  const visible = new FogGrid(100, 50, 10)
  // Lo explorado: las cuatro primeras columnas; lo visible, las dos primeras
  explored.fillRect({ x: 0, y: 0, width: 40, height: 50 })
  visible.fillRect({ x: 0, y: 0, width: 20, height: 50 })
  return { explored, visible }
}
const alphaAt = (image: { pixels: Uint8ClampedArray; columns: number }, column: number, row: number) =>
  image.pixels[(row * image.columns + column) * 4 + 3]

describe('la máscara de la niebla, en una imagen de una celda por píxel', () => {
  it('la tele: lo no explorado negro, lo explorado en gris oscuro y lo visible sin nada', () => {
    const { explored, visible } = grids()
    const image = fogImage(explored, visible, 'screen', { soften: 0 })
    expect(image.columns).toBe(10)
    expect(image.rows).toBe(5)
    expect(alphaAt(image, 0, 2)).toBe(0)
    expect(alphaAt(image, 3, 2)).toBe(FOG_LOOKS.screen.explored[3])
    expect(alphaAt(image, 8, 2)).toBe(255)
  })

  it('el máster: lo no explorado atenuado (no negro) y lo explorado algo menos', () => {
    const { explored, visible } = grids()
    const image = fogImage(explored, visible, 'master', { soften: 0 })
    const unexplored = alphaAt(image, 8, 2) as number
    const seen = alphaAt(image, 3, 2) as number
    expect(unexplored).toBeLessThan(255)
    expect(seen).toBeLessThan(unexplored)
    expect(seen).toBeGreaterThan(0)
    expect(alphaAt(image, 0, 2)).toBe(0)
  })

  it('suavizada, el borde se funde hacia dentro y lo no explorado de la tele sigue negro del todo', () => {
    const { explored, visible } = grids()
    const image = fogImage(explored, visible, 'screen', { soften: 1 })
    // La última columna visible ya no está limpia: le llega la sombra de la de al lado
    expect(alphaAt(image, 1, 2)).toBeGreaterThan(0)
    // Lo no explorado no se aclara (no asoma el mapa)
    expect(alphaAt(image, 4, 2)).toBe(255)
    expect(alphaAt(image, 9, 0)).toBe(255)
  })

  it('la máscara llega en base64 y se lee igual', () => {
    const { explored } = grids()
    const base64 = btoa(String.fromCharCode(...explored.encode()))
    const read = decodeMask(base64)
    expect(read.count()).toBe(explored.count())
    expect(read.get(3, 2)).toBe(true)
    expect(read.get(4, 2)).toBe(false)
  })

  it('suavizar es un desenfoque de caja que conserva lo que es igual', () => {
    const flat = new Uint8ClampedArray(3 * 3 * 4).fill(100)
    expect([...soften(flat, 3, 3, 1)]).toEqual([...flat])
    const dot = new Uint8ClampedArray(3 * 3 * 4)
    dot[(1 * 3 + 1) * 4 + 3] = 90
    const out = soften(dot, 3, 3, 1)
    expect(out[(1 * 3 + 1) * 4 + 3]).toBe(10)
    expect(out[3]).toBe(10)
  })

  it('con luz, lo visible a oscuras se sombrea y lo que alumbra brilla con su color', () => {
    const { explored, visible } = grids()
    const cells = new FogGrid(100, 50, 10).fillRect({ x: 0, y: 0, width: 10, height: 50 })
    const image = fogImage(explored, visible, 'screen', {
      soften: 0,
      darkness: 1,
      lights: [{ color: '#ff8000', intensity: 1, bright: 10, dim: 20, origin: { x: 5, y: 25 }, cells }]
    })
    // La columna 1 se ve pero no le llega la luz: sombreada
    expect(alphaAt(image, 1, 2)).toBeGreaterThan(0)
    // La columna 0, alumbrada: sin sombra
    expect(alphaAt(image, 0, 2)).toBe(0)
    const glow = image.glow
    expect(glow).not.toBeNull()
    if (!glow) return
    const at = (2 * image.columns + 0) * 4
    expect(glow[at]).toBe(255)
    expect(glow[at + 1]).toBe(128)
    expect(glow[at + 3]).toBeGreaterThan(0)
    // Al lado brilla menos (el borde, suave) y en lo que no se ve, nada
    expect(glow[(2 * image.columns + 1) * 4 + 3]).toBeLessThan(glow[at + 3] as number)
    expect(glow[(2 * image.columns + 3) * 4 + 3]).toBe(0)
  })
})

describe('las teselas de la tele: solo las que tocan lo que ve o vio', () => {
  // Un mapa de 1200 × 600 con teselas de 512: tres columnas y dos filas
  const mask = new FogGrid(1200, 600, 10)
  mask.fillRect({ x: 0, y: 0, width: 300, height: 300 })
  const pyramid = tilePyramid(1200, 600, 512)

  it('cuánto de una tesela cae en lo que ve: nada, una parte o entera', () => {
    expect(tileCoverage(mask, { x: 600, y: 0, width: 512, height: 512 })).toBe('none')
    expect(tileCoverage(mask, { x: 0, y: 0, width: 512, height: 512 })).toBe('partial')
    expect(tileCoverage(mask, { x: 0, y: 0, width: 200, height: 200 })).toBe('full')
  })

  it('la huella cambia cuando cambia lo que se ve dentro de la tesela, no fuera', () => {
    const rect = { x: 0, y: 0, width: 512, height: 512 }
    const before = tileSignature(mask, rect)
    const outside = mask.clone().fillRect({ x: 1000, y: 0, width: 100, height: 100 })
    expect(tileSignature(outside, rect)).toBe(before)
    const inside = mask.clone().fillRect({ x: 400, y: 0, width: 50, height: 50 })
    expect(tileSignature(inside, rect)).not.toBe(before)
  })

  it('la dirección: ninguna fuera, la de siempre si está entera y con su huella si está a medias', () => {
    const url = maskTileUrl((level, x, y) => `/t/${level}/${x}/${y}`, mask, pyramid)
    expect(url(0, 2, 0)).toBeNull()
    expect(url(0, 0, 0)).toMatch(/^\/t\/0\/0\/0\?m=/)
    const full = new FogGrid(1200, 600, 10).fill(true)
    expect(maskTileUrl((level, x, y) => `/t/${level}/${x}/${y}`, full, pyramid)(0, 0, 0)).toBe('/t/0/0/0')
  })
})
