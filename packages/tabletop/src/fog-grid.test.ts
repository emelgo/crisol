import { describe, expect, it } from 'vitest'
import { FOG_CELL_SIZE, FOG_MAX_BITS, FogGrid } from './fog-grid.ts'
import { pointInPolygon } from './geometry.ts'
import { tilePyramid } from './tiles.ts'

/** Las celdas encendidas como texto, una fila por línea */
const picture = (grid: FogGrid): string => {
  const lines: string[] = []
  for (let r = 0; r < grid.rows; r++) {
    let line = ''
    for (let c = 0; c < grid.columns; c++) line += grid.get(c, r) ? '#' : '.'
    lines.push(line)
  }
  return lines.join('\n')
}

describe('la rejilla de bits de la niebla', () => {
  it('celdas de 10 px por defecto, redondeando hacia arriba el borde del mapa', () => {
    const grid = new FogGrid(95, 40)
    expect(FOG_CELL_SIZE).toBe(10)
    expect([grid.columns, grid.rows]).toEqual([10, 4])
    expect(grid.isEmpty()).toBe(true)
    expect(() => new FogGrid(0, 10)).toThrow(RangeError)
    expect(() => new FogGrid(10, 10, 2.5)).toThrow(RangeError)
    expect(() => new FogGrid(FOG_MAX_BITS, 20, 1)).toThrow(RangeError)
  })

  it('encender, apagar y leer celdas y puntos; fuera del mapa, nada', () => {
    const grid = new FogGrid(100, 100)
    grid.set(3, 4, true)
    expect(grid.get(3, 4)).toBe(true)
    expect(grid.hasPoint({ x: 35, y: 49 })).toBe(true)
    expect(grid.hasPoint({ x: 45, y: 49 })).toBe(false)
    grid.set(3, 4, false)
    expect(grid.count()).toBe(0)
    grid.set(-1, 0, true)
    grid.set(0, 100, true)
    expect(grid.get(-1, 0)).toBe(false)
    expect(grid.count()).toBe(0)
  })

  it('tramos de una fila a través de varias palabras de 32 bits', () => {
    const grid = new FogGrid(1000, 10)
    grid.setSpan(0, 30, 70, true)
    expect(grid.count()).toBe(41)
    grid.setSpan(0, 32, 63, false)
    expect(grid.count()).toBe(9)
    grid.setSpan(0, 90, 200, true)
    expect(grid.count()).toBe(19)
    grid.setSpan(5, 0, 10, true)
    grid.setSpan(0, 50, 40, true)
    expect(grid.count()).toBe(19)
    expect(grid.fill(true).count()).toBe(100)
    expect(grid.fill(false).isEmpty()).toBe(true)
  })

  it('un rectángulo: las celdas cuyo centro cae dentro', () => {
    const grid = new FogGrid(60, 40).fillRect({ x: 10, y: 10, width: 30, height: 20 })
    expect(picture(grid)).toBe(['......', '.###..', '.###..', '......'].join('\n'))
    // Uno que no llega a ningún centro, o sin área, no enciende nada
    expect(new FogGrid(60, 40).fillRect({ x: 1, y: 1, width: 3, height: 3 }).count()).toBe(0)
    expect(new FogGrid(60, 40).fillRect({ x: 1, y: 1, width: 0, height: 30 }).count()).toBe(0)
    // Apagar
    expect(grid.fillRect({ x: 0, y: 0, width: 25, height: 40 }, false).count()).toBe(4)
  })

  it('un círculo', () => {
    const grid = new FogGrid(70, 70).fillCircle({ x: 35, y: 35 }, 12)
    expect(picture(grid)).toBe(['.......', '.......', '...#...', '..###..', '...#...', '.......', '.......'].join('\n'))
    expect(new FogGrid(70, 70).fillCircle({ x: 35, y: 35 }, 0).count()).toBe(0)
  })

  it('un polígono (y un lazo, que es lo mismo): justo las celdas cuyo centro cae dentro', () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 400, y: 30 },
      { x: 100, y: 390 }
    ]
    const grid = new FogGrid(400, 400).fillPolygon(triangle)
    let mismatches = 0
    for (let r = 0; r < grid.rows; r++)
      for (let c = 0; c < grid.columns; c++)
        if (grid.get(c, r) !== pointInPolygon({ x: (c + 0.5) * 10, y: (r + 0.5) * 10 }, triangle)) mismatches += 1
    expect(mismatches).toBe(0)
    expect(grid.count()).toBeGreaterThan(500)
    // Con un agujero (par-impar) y uno que se sale del mapa
    const ring = [
      { x: -50, y: -50 },
      { x: 450, y: -50 },
      { x: 450, y: 450 },
      { x: -50, y: 450 }
    ]
    expect(new FogGrid(400, 400).fillPolygon(ring).count()).toBe(1600)
    expect(new FogGrid(400, 400).fillPolygon(ring.slice(0, 2)).count()).toBe(0)
    expect(new FogGrid(400, 400).fillPolygon(ring.map((p) => ({ x: p.x, y: p.y + 1000 }))).count()).toBe(0)
  })

  it('un trazo de pincel: un punto es un círculo; varios, una línea gruesa', () => {
    const dot = new FogGrid(70, 70).fillBrush([{ x: 35, y: 35 }], 15)
    expect(dot.count()).toBe(new FogGrid(70, 70).fillCircle({ x: 35, y: 35 }, 15).count())
    const line = new FogGrid(100, 30).fillBrush(
      [
        { x: 15, y: 15 },
        { x: 85, y: 15 }
      ],
      6
    )
    expect(picture(line)).toBe(['..........', '.########.', '..........'].join('\n'))
    expect(new FogGrid(100, 30).fillBrush([], 5).count()).toBe(0)
    expect(line.fillBrush([{ x: 15, y: 15 }], 6, false).count()).toBe(7)
  })

  it('unir, restar, cruzar y saber si se tocan; solo entre nieblas del mismo tamaño', () => {
    const a = new FogGrid(100, 100).fillRect({ x: 0, y: 0, width: 60, height: 100 })
    const b = new FogGrid(100, 100).fillRect({ x: 40, y: 0, width: 60, height: 100 })
    expect(a.clone().union(b).count()).toBe(100)
    expect(a.clone().subtract(b).count()).toBe(40)
    expect(a.clone().intersect(b).count()).toBe(20)
    expect(a.intersects(b)).toBe(true)
    expect(a.clone().subtract(b).intersects(b)).toBe(false)
    expect(() => a.union(new FogGrid(100, 100, 5))).toThrow(RangeError)
    expect(a.empty().isEmpty()).toBe(true)
  })

  it('el rectángulo que encierra lo encendido', () => {
    const grid = new FogGrid(200, 200)
    expect(grid.bounds()).toBeNull()
    grid.set(3, 2, true)
    grid.set(7, 9, true)
    expect(grid.bounds()).toEqual({ x: 30, y: 20, width: 50, height: 80 })
  })
})

describe('guardarla comprimida', () => {
  it('lo que se guarda se lee igual: vacía, llena, con tramos que pasan de fila y al azar', () => {
    const cases = [new FogGrid(95, 47), new FogGrid(95, 47).fill(true), new FogGrid(640, 480, 8)]
    const crossing = new FogGrid(100, 100)
    crossing.setSpan(0, 8, 9, true)
    crossing.setSpan(1, 0, 3, true)
    cases.push(crossing)
    const noise = new FogGrid(333, 222, 3)
    let seed = 1
    for (let i = 0; i < 4000; i++) {
      seed = (seed * 16807) % 2147483647
      noise.set(seed % noise.columns, (seed >> 8) % noise.rows, true)
    }
    cases.push(noise)
    for (const grid of cases) {
      const back = FogGrid.decode(grid.encode())
      expect([back.width, back.height, back.cellSize]).toEqual([grid.width, grid.height, grid.cellSize])
      expect(back.words).toEqual(grid.words)
    }
  })

  it('un mapa de 6.000 × 6.000 px con unas salas exploradas cabe en pocos KB', () => {
    const grid = new FogGrid(6000, 6000)
    for (let i = 0; i < 40; i++) grid.fillCircle({ x: 300 + (i % 8) * 700, y: 300 + Math.floor(i / 8) * 1100 }, 280)
    grid.fillPolygon([
      { x: 100, y: 5000 },
      { x: 5900, y: 5200 },
      { x: 3000, y: 5900 }
    ])
    const bytes = grid.encode()
    expect(bytes.length).toBeLessThan(8 * 1024)
    expect(FogGrid.decode(bytes).count()).toBe(grid.count())
  })

  it('lo que no es una niebla, o viene roto, no se lee', () => {
    const good = new FogGrid(100, 100).fillRect({ x: 0, y: 0, width: 50, height: 50 }).encode()
    expect(() => FogGrid.decode(new Uint8Array([1, 2, 3]))).toThrow(RangeError)
    expect(() => FogGrid.decode(Uint8Array.from([0x43, 0x46, 9]))).toThrow(/Versión/)
    expect(() => FogGrid.decode(good.slice(0, good.length - 1))).toThrow(RangeError)
    expect(() => FogGrid.decode(Uint8Array.from([...good, 5]))).toThrow(RangeError)
    expect(() => FogGrid.decode(Uint8Array.from([0x43, 0x46, 1, 10]))).toThrow(/cortada/)
    expect(() => FogGrid.decode(Uint8Array.from([0x43, 0x46, 1, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01]))).toThrow(
      /largo/
    )
    // Un tamaño enorme no llega a crearse
    expect(() => FogGrid.decode(Uint8Array.from([0x43, 0x46, 1, 1, 0xff, 0xff, 0x7f, 0xff, 0xff, 0x7f]))).toThrow(
      RangeError
    )
  })
})

describe('las teselas que tocan lo encendido', () => {
  const pyramid = tilePyramid(2048, 1024)

  it('solo las de las celdas encendidas, por filas y sin repetir', () => {
    const grid = new FogGrid(2048, 1024)
    expect(grid.tilesTouched(pyramid)).toEqual([])
    grid.fillRect({ x: 100, y: 100, width: 300, height: 200 })
    expect(grid.tilesTouched(pyramid)).toEqual([{ level: 0, x: 0, y: 0 }])
    grid.fillRect({ x: 500, y: 600, width: 100, height: 100 })
    expect(grid.tilesTouched(pyramid)).toEqual([
      { level: 0, x: 0, y: 0 },
      { level: 0, x: 0, y: 1 },
      { level: 0, x: 1, y: 1 }
    ])
    // En el nivel 1 (teselas de 1.024 px del mapa), una
    expect(grid.tilesTouched(pyramid, 1)).toEqual([{ level: 1, x: 0, y: 0 }])
  })

  it('una celda que pisa dos teselas da las dos; con un mapa estirado, se pasa a la imagen', () => {
    const grid = new FogGrid(2048, 1024)
    // La celda 51 va de 510 a 520 px: pisa la tesela 0 y la 1
    grid.set(51, 0, true)
    expect(grid.tilesTouched(pyramid).map((t) => t.x)).toEqual([0, 1])
    const half = (r: { x: number; y: number; width: number; height: number }) => ({
      x: r.x / 2,
      y: r.y / 2,
      width: r.width / 2,
      height: r.height / 2
    })
    expect(grid.tilesTouched(pyramid, 0, half).map((t) => t.x)).toEqual([0])
  })
})
