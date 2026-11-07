import { describe, expect, it } from 'vitest'
import type { Point } from './geometry.ts'
import { crossesWall, freeDestination, movementEdges } from './movement.ts'
import { WallIndex } from './wall-index.ts'
import type { Wall } from './walls.ts'

// Un muro vertical en x = 100, de y = 0 a y = 200
const wall = (extra: Partial<Wall> = {}): Wall => ({
  id: 'm',
  a: { x: 100, y: 0 },
  b: { x: 100, y: 200 },
  sight: 'full',
  light: 'full',
  move: 'full',
  direction: 'both',
  door: null,
  locked: false,
  ...extra
})
const cell = (p: Point) => ({ x: Math.floor(p.x / 50) * 50 + 25, y: Math.floor(p.y / 50) * 50 + 25 })

describe('los muros frenan el paso', () => {
  it('sin muros en medio llega a su destino (ajustado)', () => {
    expect(freeDestination({ x: 25, y: 25 }, { x: 70, y: 160 }, movementEdges([wall()], {}), cell)).toEqual({
      x: 75,
      y: 175
    })
  })

  it('un muro le para en la última casilla libre antes de él (con la lista o con el índice)', () => {
    const edges = movementEdges([wall()], {})
    expect(freeDestination({ x: 25, y: 75 }, { x: 180, y: 75 }, edges, cell)).toEqual({ x: 75, y: 75 })
    expect(freeDestination({ x: 25, y: 75 }, { x: 180, y: 75 }, new WallIndex(edges), cell)).toEqual({ x: 75, y: 75 })
  })

  it('una puerta abierta deja pasar; cerrada, no', () => {
    const door = [wall({ door: 'door' })]
    expect(
      freeDestination({ x: 25, y: 75 }, { x: 180, y: 75 }, movementEdges(door, { m: { open: true } }), cell)
    ).toEqual({
      x: 175,
      y: 75
    })
    expect(freeDestination({ x: 25, y: 75 }, { x: 180, y: 75 }, movementEdges(door, {}), cell)).toEqual({
      x: 75,
      y: 75
    })
  })

  it('un muro de un sentido solo para desde uno de sus lados', () => {
    for (const direction of ['left', 'right'] as const) {
      const edges = movementEdges([wall({ direction })], {})
      const there = crossesWall({ x: 25, y: 75 }, { x: 175, y: 75 }, edges)
      const back = crossesWall({ x: 175, y: 75 }, { x: 25, y: 75 }, edges)
      expect(there).not.toBe(back)
    }
  })

  it('un muro que no para el paso (una ventana que se cruza, una cortina), no frena', () => {
    expect(movementEdges([wall({ move: 'none' })], {})).toEqual([])
  })

  it('una casilla centrada en el muro no vale: se queda antes', () => {
    const onLine = [wall({ a: { x: 125, y: 0 }, b: { x: 125, y: 200 } })]
    const snap = (p: Point) => ({ x: Math.round(p.x / 50) * 50 + 25, y: 75 })
    expect(freeDestination({ x: 25, y: 75 }, { x: 125, y: 75 }, movementEdges(onLine, {}), snap)).toEqual({
      x: 75,
      y: 75
    })
  })

  it('rodear el extremo del muro no es atravesarlo; si no hay sitio libre, se queda donde estaba', () => {
    const edges = movementEdges([wall()], {})
    expect(freeDestination({ x: 25, y: 225 }, { x: 180, y: 225 }, edges, cell)).toEqual({ x: 175, y: 225 })
    expect(freeDestination({ x: 95, y: 75 }, { x: 105, y: 75 }, edges)).toEqual({ x: 95, y: 75 })
  })
})
