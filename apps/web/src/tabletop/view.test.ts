import type { SceneGrid } from '@crisol/contracts'
import { tilePyramid } from '@crisol/tabletop'
import { describe, expect, it } from 'vitest'
import { fitCanvas, pyramidOf, screenGridLines, tilesToDraw, visibleRect } from './view.ts'

const GRID: SceneGrid = {
  type: 'square',
  size: 100,
  offsetX: 0,
  offsetY: 0,
  distance: 5,
  units: 'pies',
  diagonals: 'equal',
  visible: true,
  color: '#000000',
  opacity: 0.3
}

describe('lo que pinta un lienzo de la mesa', () => {
  // 4000 × 3000: niveles de 4000, 2000 y 1000 px (el último cabe en 1024)
  const pyramid = tilePyramid(4000, 3000)

  it('la pirámide de una escena sale de sus medidas y su tamaño de tesela; sin teselas, ninguna', () => {
    expect(
      pyramidOf({ width: 4000, height: 3000, tiles: { version: 'v', size: 512, levels: 3 } })?.levels
    ).toHaveLength(3)
    expect(pyramidOf({ width: 4000, height: 3000, tiles: null })).toBeNull()
    expect(pyramidOf(null)).toBeNull()
  })

  it('lo que se ve, en píxeles del mapa', () => {
    expect(visibleRect({ x: -200, y: -100, scale: 0.5 }, { width: 800, height: 600 })).toEqual({
      x: 400,
      y: 200,
      width: 1600,
      height: 1200
    })
  })

  it('las teselas del nivel que toca por la escala y la densidad de la pantalla, solo las que se ven', () => {
    const canvas = { width: 800, height: 600 }
    // A escala 1 se ven 800 × 600 px desde el origen: nivel 0, las de 2 × 2 teselas de arriba a la izquierda
    const near = tilesToDraw(pyramid, { x: 0, y: 0, scale: 1 }, canvas, 1)
    expect(near.level).toBe(0)
    expect(near.tiles).toEqual([
      { level: 0, x: 0, y: 0 },
      { level: 0, x: 1, y: 0 },
      { level: 0, x: 0, y: 1 },
      { level: 0, x: 1, y: 1 }
    ])
    // Debajo, mientras llegan, las del nivel siguiente que cubren lo mismo; y siempre el más pequeño entero
    expect(near.under).toEqual([{ level: 1, x: 0, y: 0 }])
    expect(near.base).toHaveLength(4)
    expect(near.base.every((tile) => tile.level === 2)).toBe(true)
    // Alejado, el nivel más pequeño: sin capa intermedia
    const far = tilesToDraw(pyramid, { x: 0, y: 0, scale: 0.2 }, canvas, 1)
    expect(far.level).toBe(2)
    expect(far.under).toEqual([])
    // Con una pantalla de doble densidad, a escala ½ hace falta el nivel 0
    expect(tilesToDraw(pyramid, { x: 0, y: 0, scale: 0.5 }, canvas, 2).level).toBe(0)
    expect(tilesToDraw(pyramid, { x: 0, y: 0, scale: 0.5 }, canvas, 1).level).toBe(1)
  })

  it('el mapa entero, con su margen, cabe en el lienzo', () => {
    const view = fitCanvas({ width: 4000, height: 3000 }, { width: 800, height: 600 })
    expect(view.scale).toBeCloseTo((600 - 48) / 3000)
  })

  it('las líneas de la rejilla en la pantalla: solo lo visible y del mapa, y ninguna si las casillas se ven diminutas', () => {
    const canvas = { width: 300, height: 200 }
    const lines = screenGridLines(GRID, { x: 0, y: 0, scale: 1 }, canvas, { width: 1000, height: 1000 })
    // Verticales en 0, 100, 200, 300 y horizontales en 0, 100, 200
    expect(lines).toHaveLength(7)
    expect(lines[1]).toEqual([100, 0, 100, 200])
    // El mapa acaba antes que el lienzo: las líneas, también
    const small = screenGridLines(GRID, { x: 0, y: 0, scale: 1 }, canvas, { width: 150, height: 150 })
    expect(small.every(([x1, y1, x2, y2]) => Math.max(x1, x2) <= 150 && Math.max(y1, y2) <= 150)).toBe(true)
    expect(screenGridLines(GRID, { x: 0, y: 0, scale: 0.03 }, canvas, { width: 1000, height: 1000 })).toEqual([])
    expect(
      screenGridLines({ ...GRID, type: 'none' }, { x: 0, y: 0, scale: 1 }, canvas, { width: 1000, height: 1000 })
    ).toEqual([])
    // Hexagonal, por filas: lados de hexágono
    const hex = screenGridLines({ ...GRID, type: 'hex-rows' }, { x: 0, y: 0, scale: 1 }, canvas, {
      width: 1000,
      height: 1000
    })
    expect(hex.length).toBeGreaterThan(6)
  })
})
