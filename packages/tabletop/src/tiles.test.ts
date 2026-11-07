import { describe, expect, it } from 'vitest'
import {
  hasTile,
  levelForScale,
  TILE_SIZE,
  TOP_LEVEL_MAX_SIDE,
  tileCount,
  tilePyramid,
  tileRect,
  tilesInRect,
  tileWorldRect
} from './tiles.ts'

describe('los niveles de las teselas', () => {
  it('teselas de 512 y niveles a la mitad hasta que el lado mayor cabe en 1.024', () => {
    expect(TILE_SIZE).toBe(512)
    expect(TOP_LEVEL_MAX_SIDE).toBe(1024)
    const p = tilePyramid(5000, 3000)
    expect(p.tileSize).toBe(512)
    expect(p.levels.map((l) => [l.width, l.height])).toEqual([
      [5000, 3000],
      [2500, 1500],
      [1250, 750],
      [625, 375]
    ])
    expect(p.levels.map((l) => l.scale)).toEqual([1, 0.5, 0.25, 0.125])
    expect(p.levels.map((l) => l.level)).toEqual([0, 1, 2, 3])
  })

  it('una imagen que ya cabe tiene solo el nivel 0; una que se pasa por un píxel, dos', () => {
    expect(tilePyramid(1024, 700).levels).toHaveLength(1)
    expect(tilePyramid(300, 200).levels).toHaveLength(1)
    const p = tilePyramid(1025, 10)
    expect(p.levels.map((l) => [l.width, l.height])).toEqual([
      [1025, 10],
      [513, 5]
    ])
    // Lo que manda es el lado mayor, sea el ancho o el alto
    expect(tilePyramid(10, 4096).levels.map((l) => l.height)).toEqual([4096, 2048, 1024])
  })

  it('al dividir redondea hacia arriba: no se pierde ni una fila de píxeles', () => {
    const p = tilePyramid(4097, 3)
    expect(p.levels.map((l) => [l.width, l.height])).toEqual([
      [4097, 3],
      [2049, 2],
      [1025, 1],
      [513, 1]
    ])
  })

  it('cuántas teselas tiene cada nivel y en total', () => {
    const p = tilePyramid(5000, 3000)
    expect(p.levels.map((l) => [l.columns, l.rows])).toEqual([
      [10, 6],
      [5, 3],
      [3, 2],
      [2, 1]
    ])
    expect(tileCount(p)).toBe(60 + 15 + 6 + 2)
    expect(tileCount(tilePyramid(512, 512))).toBe(1)
    expect(tileCount(tilePyramid(513, 512))).toBe(2)
  })

  it('con otro tamaño de tesela y otro tope', () => {
    const p = tilePyramid(1000, 600, 256, 300)
    expect(p.tileSize).toBe(256)
    expect(p.levels.map((l) => [l.width, l.height, l.columns, l.rows])).toEqual([
      [1000, 600, 4, 3],
      [500, 300, 2, 2],
      [250, 150, 1, 1]
    ])
  })

  it('rechaza medidas que no son enteros positivos', () => {
    for (const [w, h] of [
      [0, 100],
      [100, -1],
      [10.5, 10],
      [Number.NaN, 10],
      [Number.POSITIVE_INFINITY, 10]
    ] as const)
      expect(() => tilePyramid(w, h)).toThrow(RangeError)
    expect(() => tilePyramid(100, 100, 0)).toThrow(RangeError)
    expect(() => tilePyramid(100, 100, 512, 0.5)).toThrow(RangeError)
  })
})

describe('las teselas que tocan un rectángulo', () => {
  const p = tilePyramid(5000, 3000)

  it('en el nivel 0, las que pisa el rectángulo, por filas', () => {
    expect(tilesInRect(p, 0, { x: 600, y: 100, width: 500, height: 500 })).toEqual([
      { level: 0, x: 1, y: 0 },
      { level: 0, x: 2, y: 0 },
      { level: 0, x: 1, y: 1 },
      { level: 0, x: 2, y: 1 }
    ])
  })

  it('el borde exacto de una tesela no toca la siguiente', () => {
    expect(tilesInRect(p, 0, { x: 0, y: 0, width: 512, height: 512 })).toEqual([{ level: 0, x: 0, y: 0 }])
    expect(tilesInRect(p, 0, { x: 512, y: 0, width: 0.5, height: 1 })).toEqual([{ level: 0, x: 1, y: 0 }])
  })

  it('en otro nivel, el rectángulo sigue en píxeles del nivel 0', () => {
    // En el nivel 2 (escala ¼) una tesela abarca 2.048 px del nivel 0
    expect(tilesInRect(p, 2, { x: 2000, y: 0, width: 100, height: 100 })).toEqual([
      { level: 2, x: 0, y: 0 },
      { level: 2, x: 1, y: 0 }
    ])
    expect(tilesInRect(p, 3, { x: 0, y: 0, width: 5000, height: 3000 })).toEqual([
      { level: 3, x: 0, y: 0 },
      { level: 3, x: 1, y: 0 }
    ])
  })

  it('lo que se sale del mapa se recorta; fuera del todo o vacío, ninguna', () => {
    expect(tilesInRect(p, 3, { x: -1000, y: -1000, width: 99999, height: 99999 })).toHaveLength(2)
    expect(tilesInRect(p, 0, { x: 4900, y: 2900, width: 500, height: 500 })).toEqual([{ level: 0, x: 9, y: 5 }])
    expect(tilesInRect(p, 0, { x: 6000, y: 0, width: 100, height: 100 })).toEqual([])
    expect(tilesInRect(p, 0, { x: -200, y: 0, width: 100, height: 100 })).toEqual([])
    expect(tilesInRect(p, 0, { x: 100, y: 100, width: 0, height: 100 })).toEqual([])
    expect(tilesInRect(p, 0, { x: 100, y: 100, width: Number.NaN, height: 100 })).toEqual([])
  })

  it('un nivel que no existe no tiene teselas', () => {
    expect(tilesInRect(p, 4, { x: 0, y: 0, width: 100, height: 100 })).toEqual([])
    expect(tilesInRect(p, -1, { x: 0, y: 0, width: 100, height: 100 })).toEqual([])
  })
})

describe('el nivel para una escala de pantalla', () => {
  const p = tilePyramid(5000, 3000)

  it('el más pequeño que aún tiene un píxel por cada píxel de pantalla', () => {
    expect(levelForScale(p, 2)).toBe(0)
    expect(levelForScale(p, 1)).toBe(0)
    expect(levelForScale(p, 0.75)).toBe(0)
    expect(levelForScale(p, 0.5)).toBe(1)
    expect(levelForScale(p, 0.4)).toBe(1)
    expect(levelForScale(p, 0.25)).toBe(2)
    expect(levelForScale(p, 0.125)).toBe(3)
  })

  it('más lejos que el último nivel, el último', () => {
    expect(levelForScale(p, 0.01)).toBe(3)
    expect(levelForScale(p, 0)).toBe(3)
    expect(levelForScale(tilePyramid(800, 600), 0.01)).toBe(0)
  })
})

describe('dónde va cada tesela', () => {
  const p = tilePyramid(5000, 3000)

  it('en píxeles de su nivel: las del borde, más pequeñas', () => {
    expect(tileRect(p, { level: 0, x: 0, y: 0 })).toEqual({ x: 0, y: 0, width: 512, height: 512 })
    expect(tileRect(p, { level: 0, x: 9, y: 5 })).toEqual({ x: 4608, y: 2560, width: 392, height: 440 })
    expect(tileRect(p, { level: 3, x: 1, y: 0 })).toEqual({ x: 512, y: 0, width: 113, height: 375 })
  })

  it('en píxeles del nivel 0, para dibujarla', () => {
    expect(tileWorldRect(p, { level: 0, x: 1, y: 1 })).toEqual({ x: 512, y: 512, width: 512, height: 512 })
    // En el nivel 2 (escala ¼), la última de cada fila y de cada columna llega justo al borde del mapa
    expect(tileWorldRect(p, { level: 2, x: 1, y: 0 })).toEqual({ x: 2048, y: 0, width: 2048, height: 2048 })
    expect(tileWorldRect(p, { level: 2, x: 2, y: 1 })).toEqual({ x: 4096, y: 2048, width: 904, height: 952 })
  })

  it('si existe una tesela', () => {
    expect(hasTile(p, { level: 0, x: 9, y: 5 })).toBe(true)
    expect(hasTile(p, { level: 0, x: 10, y: 0 })).toBe(false)
    expect(hasTile(p, { level: 0, x: 0, y: 6 })).toBe(false)
    expect(hasTile(p, { level: 4, x: 0, y: 0 })).toBe(false)
    expect(hasTile(p, { level: 0, x: -1, y: 0 })).toBe(false)
    expect(hasTile(p, { level: 0, x: 0.5, y: 0 })).toBe(false)
    expect(() => tileRect(p, { level: 0, x: 10, y: 0 })).toThrow(RangeError)
  })
})
