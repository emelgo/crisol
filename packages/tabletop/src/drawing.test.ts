// Portado de packages/mesa/src/nucleo/dibujo.test.ts (Crisol actual, commit 3f68f11)
import { describe, expect, it } from 'vitest'
import { circlePoints, followStroke, rectanglePoints, splitByEraser, strokeInside, touchesDrawing } from './drawing.ts'
import { liveTrail } from './laser.ts'

describe('dibujo', () => {
  it('trazos, formas y qué toca un punto', () => {
    expect(followStroke([{ x: 0, y: 0 }], { x: 1, y: 1 })).toHaveLength(1)
    expect(followStroke([{ x: 0, y: 0 }], { x: 3, y: 0 })).toHaveLength(2)
    expect(rectanglePoints({ x: 0, y: 0 }, { x: 10, y: 5 })).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 5 },
      { x: 0, y: 0 }
    ])
    const circle = circlePoints({ x: 0, y: 0 }, { x: 10, y: 0 }, 4)
    expect(circle).toHaveLength(5)
    expect(circle[1]?.y).toBeCloseTo(10)
    const line = {
      type: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ],
      width: 4
    }
    expect(touchesDrawing(line, { x: 50, y: 3 }, 2)).toBe(true)
    expect(touchesDrawing(line, { x: 50, y: 8 }, 2)).toBe(false)
    expect(touchesDrawing({ type: 'stamp', points: [{ x: 0, y: 0 }], width: 70 }, { x: 30, y: -30 }, 0)).toBe(true)
    expect(touchesDrawing({ type: 'pen', points: [{ x: 0, y: 0 }], width: 4 }, { x: 1, y: 1 }, 0)).toBe(true)
  })

  it('la goma parte el trazo y deja sus extremos', () => {
    const points = Array.from({ length: 11 }, (_, i) => ({ x: i * 10, y: 0 }))
    expect(splitByEraser(points, { x: 50, y: 50 }, 5)).toBeNull()
    const runs = splitByEraser(points, { x: 50, y: 0 }, 12) ?? []
    // Corta justo por donde pasa (con puntos nuevos en el borde de la goma)
    expect(runs.map((run) => run.map((p) => p.x))).toEqual([
      [0, 10, 20, 30, 35],
      [65, 70, 80, 90, 100]
    ])
    expect(splitByEraser(points, { x: 50, y: 0 }, 100)).toEqual([])
    expect(splitByEraser([], { x: 0, y: 0 }, 10)).toBeNull()
  })

  it('una goma fina parte una línea de dos puntos por en medio, contando el grosor del trazo', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 100, y: 0 }
    ]
    const runs = splitByEraser(line, { x: 50, y: 3 }, 2, 4) ?? []
    expect(runs).toHaveLength(2)
    expect(runs[0]?.at(-1)?.x).toBeLessThan(50)
    expect(runs[1]?.[0]?.x).toBeGreaterThan(50)
    expect(splitByEraser(line, { x: 50, y: 8 }, 2, 4)).toBeNull()
  })

  it('lo que queda de un trazo dentro de una zona: lo de fuera se quita', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 100, y: 0 }
    ]
    const left = (p: { x: number }) => p.x <= 40
    const runs = strokeInside(line, left, 10)
    expect(runs).toHaveLength(1)
    expect(runs[0]?.map((p) => p.x)).toEqual([0, 10, 20, 30, 40])
    expect(strokeInside(line, () => false, 10)).toEqual([])
    expect(strokeInside(line, () => true, 50)).toEqual([
      [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 }
      ]
    ])
  })
})

describe('láser', () => {
  it('la estela se apaga con el tiempo', () => {
    const alive = liveTrail(
      [
        { x: 0, y: 0, t: 0 },
        { x: 1, y: 0, t: 500 }
      ],
      600,
      700
    )
    expect(alive.map((p) => p.x)).toEqual([0, 1])
    expect(alive[0]?.life).toBeCloseTo(1 - 600 / 700)
    expect(liveTrail([{ x: 0, y: 0, t: 0 }], 800)).toEqual([])
  })
})
