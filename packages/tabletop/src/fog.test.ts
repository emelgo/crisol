import { describe, expect, it } from 'vitest'
import { type FogOperation, fogInOrder, fogOperationAt, isFogOperation, manualFog, rectBetween } from './fog.ts'

const rect = (
  id: string,
  x: number,
  mode: 'reveal' | 'cover' = 'reveal',
  timestamp?: number
): Extract<FogOperation, { shape: 'rectangle' }> => ({
  id,
  mode,
  shape: 'rectangle',
  x,
  y: 0,
  width: 50,
  height: 50,
  ...(timestamp === undefined ? {} : { timestamp })
})

describe('la niebla a mano', () => {
  it('valida las operaciones (una dañada no se pinta)', () => {
    expect(isFogOperation({ id: 'p', mode: 'reveal', shape: 'brush', points: [{ x: 0, y: 0 }], radius: 10 })).toBe(true)
    expect(isFogOperation({ id: 'p', mode: 'reveal', shape: 'brush', points: [], radius: 10 })).toBe(false)
    expect(isFogOperation({ id: 'p', mode: 'reveal', shape: 'brush', points: [{ x: 0, y: 0 }], radius: 0 })).toBe(false)
    expect(
      isFogOperation({
        id: 'l',
        mode: 'cover',
        shape: 'lasso',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 }
        ]
      })
    ).toBe(false)
    expect(isFogOperation({ ...rect('r', 0), height: Number.NaN })).toBe(false)
    expect(isFogOperation({ ...rect('r', 0), mode: 'erase' })).toBe(false)
    expect(isFogOperation({ ...rect('r', 0), offsetX: '3' })).toBe(false)
    expect(isFogOperation({ ...rect('r', 0), shape: 'star' })).toBe(false)
    expect(isFogOperation({ ...rect('r', 0), id: 3 })).toBe(false)
    expect(isFogOperation(null)).toBe(false)
    expect(isFogOperation({ id: 'l', mode: 'cover', shape: 'lasso', points: [{ x: 0 }, { x: 1 }, { x: 2 }] })).toBe(
      false
    )
  })

  it('las ordena por su fecha, y a igualdad como vienen', () => {
    const ops = [rect('b', 0, 'reveal', 2), rect('a', 0, 'reveal', 1), { id: 'mala', shape: 'rectangle' }, rect('c', 0)]
    expect(fogInOrder(ops).map((o) => o.id)).toEqual(['c', 'a', 'b'])
  })

  it('la de más arriba bajo el punto, con su desplazamiento', () => {
    const ops: FogOperation[] = [
      { ...rect('r', 0), width: 100, height: 100, timestamp: 1 },
      {
        id: 'p',
        mode: 'cover',
        shape: 'brush',
        points: [
          { x: 50, y: 50 },
          { x: 80, y: 50 }
        ],
        radius: 10,
        timestamp: 2
      },
      {
        id: 'l',
        mode: 'reveal',
        shape: 'lasso',
        points: [
          { x: 200, y: 0 },
          { x: 300, y: 0 },
          { x: 250, y: 100 }
        ],
        timestamp: 3,
        offsetX: 10
      }
    ]
    expect(fogOperationAt(ops, { x: 60, y: 55 })?.id).toBe('p')
    expect(fogOperationAt(ops, { x: 10, y: 90 })?.id).toBe('r')
    expect(fogOperationAt(ops, { x: 260, y: 20 })?.id).toBe('l')
    expect(fogOperationAt(ops, { x: 500, y: 500 })).toBeNull()
  })

  it('un rectángulo arrastrado, normalizado; con rejilla cuadrada, casillas enteras', () => {
    expect(rectBetween({ x: 5, y: 5 }, { x: 1, y: 9 })).toEqual({ x: 1, y: 5, width: 4, height: 4 })
    const grid = { type: 'square' as const, size: 70, offsetX: 0, offsetY: 0 }
    expect(rectBetween({ x: 75, y: 10 }, { x: 150, y: 130 }, grid)).toEqual({ x: 70, y: 0, width: 140, height: 140 })
    expect(rectBetween({ x: 75, y: 10 }, { x: 80, y: 12 }, grid)).toEqual({ x: 70, y: 0, width: 70, height: 70 })
    // En una hexagonal no se pega
    expect(rectBetween({ x: 75, y: 10 }, { x: 80, y: 12 }, { ...grid, type: 'hex-rows' })).toEqual({
      x: 75,
      y: 10,
      width: 5,
      height: 2
    })
  })
})

describe('lo destapado y lo tapado, en la rejilla', () => {
  it('gana la última: tapar sobre lo destapado lo tapa, y destapar después lo vuelve a destapar', () => {
    const { revealed, covered } = manualFog(
      [rect('a', 0, 'reveal', 1), rect('b', 30, 'cover', 2), rect('c', 40, 'reveal', 3)],
      200,
      100
    )
    // Destapadas: x 0–30 (de a) y 40–90 (de c); tapadas: 30–40
    expect(revealed.count()).toBe((3 + 5) * 5)
    expect(covered.count()).toBe(1 * 5)
    expect(revealed.intersects(covered)).toBe(false)
  })

  it('pincel y lazo, con su desplazamiento', () => {
    const { revealed, covered } = manualFog(
      [
        { id: 'p', mode: 'reveal', shape: 'brush', points: [{ x: 15, y: 15 }], radius: 6, offsetX: 20 },
        {
          id: 'l',
          mode: 'cover',
          shape: 'lasso',
          points: [
            { x: 50, y: 50 },
            { x: 90, y: 50 },
            { x: 90, y: 90 },
            { x: 50, y: 90 }
          ],
          offsetY: -10
        }
      ],
      100,
      100
    )
    expect(revealed.get(3, 1)).toBe(true)
    expect(revealed.count()).toBe(1)
    expect(covered.count()).toBe(16)
    expect(covered.get(5, 4)).toBe(true)
  })
})
