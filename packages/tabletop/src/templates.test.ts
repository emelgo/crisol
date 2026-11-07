// Portado de packages/mesa/src/nucleo/plantillas.test.ts (Crisol actual, commit 3f68f11)
import { describe, expect, it } from 'vitest'
import { cellCenter, type Grid } from './grid.ts'
import { type AreaTemplate, insideTemplate, templateBounds, templateCells, tokensInTemplate } from './templates.ts'

const grid: Grid = { type: 'square', size: 70, offsetX: 0, offsetY: 0 }
const center = (q: number, r: number) => ({ x: q * 70 + 35, y: r * 70 + 35 })
const t = (shape: AreaTemplate['shape'], a: { x: number; y: number }, b: { x: number; y: number }, extra = {}) =>
  ({ shape, a, b, ...extra }) as AreaTemplate
const byPosition = (points: Array<{ x: number; y: number }>) => [...points].sort((p, q) => p.x - q.x || p.y - q.y)

describe('plantillas de área', () => {
  it('un círculo de 2 casillas de radio toca las casillas cuyo centro está dentro', () => {
    const cells = templateCells(t('circle', center(5, 5), center(7, 5)), grid)
    expect(cells).toContainEqual(center(5, 5))
    expect(cells).toContainEqual(center(7, 5))
    expect(cells).not.toContainEqual(center(7, 7))
    expect(cells).toHaveLength(13)
  })

  it('un cono abre 53° hacia donde apunta (o lo que se diga)', () => {
    const cone = t('cone', center(0, 5), center(4, 5))
    expect(insideTemplate(cone, center(3, 5))).toBe(true)
    expect(insideTemplate(cone, center(3, 6))).toBe(true)
    expect(insideTemplate(cone, center(1, 7))).toBe(false)
    expect(insideTemplate(cone, center(-2, 5))).toBe(false)
    expect(insideTemplate({ ...cone, angle: 180 }, center(1, 7))).toBe(true)
  })

  it('una línea toca una casilla de ancho; con su anchura, más', () => {
    const ray = t('line', center(0, 0), center(6, 0))
    const cells = templateCells(ray, grid)
    expect(cells).toHaveLength(7)
    expect(cells.every((c) => c.y === 35)).toBe(true)
    expect(templateCells({ ...ray, a: center(0, 1), b: center(6, 1), width: 210 }, grid)).toHaveLength(21)
  })

  it('un cuadrado sale de su esquina hacia donde apunta', () => {
    const cells = templateCells(t('square', { x: 140, y: 140 }, { x: 0, y: 0 }), grid)
    expect(byPosition(cells)).toEqual([center(0, 0), center(0, 1), center(1, 0), center(1, 1)])
    expect(templateBounds(t('square', { x: 140, y: 140 }, { x: 0, y: 0 }))).toEqual({
      x: 0,
      y: 0,
      width: 140,
      height: 140
    })
  })

  it('en hexagonal también', () => {
    const hex: Grid = { type: 'hex-rows', size: 100, offsetX: 0, offsetY: 0 }
    const origin = cellCenter(hex, { q: 3, r: 3 })
    const edge = cellCenter(hex, { q: 4, r: 3 })
    // Radio de un hexágono: el suyo y los seis de alrededor
    expect(templateCells(t('circle', origin, edge), hex)).toHaveLength(7)
  })

  it('las fichas de dentro: basta una casilla de su huella', () => {
    const tokens = [
      { id: 'dentro', ...center(5, 5), size: 1 },
      { id: 'fuera', ...center(9, 5), size: 1 },
      // Grande (2×2) con su esquina en (7, 6): su casilla (7, 6) toca el borde del círculo
      { id: 'ogro', x: 8 * 70, y: 7 * 70, size: 2 }
    ]
    const ball = t('circle', center(5, 5), center(7, 5))
    expect(tokensInTemplate(ball, tokens, grid).map((k) => k.id)).toEqual(['dentro'])
    const bigger = t('circle', center(5, 5), { x: center(7, 5).x + 40, y: center(7, 5).y })
    expect(tokensInTemplate(bigger, tokens, grid).map((k) => k.id)).toEqual(['dentro', 'ogro'])
    // Sin rejilla, con casillas de 70 px
    expect(tokensInTemplate(ball, tokens, null, 70).map((k) => k.id)).toEqual(['dentro'])
  })
})
