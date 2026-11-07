import type { SceneGrid, WallView } from '@crisol/contracts'
import { describe, expect, it } from 'vitest'
import {
  chainClick,
  chainSegments,
  drawKindOf,
  endpointAt,
  endpointsOf,
  feetToPixels,
  lightAt,
  moveEndpoint,
  snapPoint,
  WALL_COLORS,
  wallAt,
  wallInputFor,
  wallShapes,
  wallStats
} from './walls.ts'

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

const wall = (id: string, a: [number, number], b: [number, number], extra: Partial<WallView> = {}): WallView => ({
  id,
  a: { x: a[0], y: a[1] },
  b: { x: b[0], y: b[1] },
  kind: 'wall',
  sight: 'full',
  light: 'full',
  move: 'full',
  sound: 'full',
  direction: 'both',
  door: null,
  locked: false,
  open: false,
  ...extra
})

describe('pegar el punto al dibujar', () => {
  it('suelto, se queda donde cae (redondeado)', () => {
    expect(snapPoint({ x: 123.44, y: 87.06 }, { grid: GRID, shift: false, endpoints: [], tolerance: 8 })).toEqual({
      x: 123.4,
      y: 87.1
    })
  })

  it('con Mayús, a la esquina de la rejilla más cercana (con su desplazamiento)', () => {
    expect(snapPoint({ x: 140, y: 260 }, { grid: GRID, shift: true, endpoints: [], tolerance: 8 })).toEqual({
      x: 100,
      y: 300
    })
    const moved = { ...GRID, offsetX: 30, offsetY: -20 }
    expect(snapPoint({ x: 140, y: 260 }, { grid: moved, shift: true, endpoints: [], tolerance: 8 })).toEqual({
      x: 130,
      y: 280
    })
  })

  it('cerca del extremo de un muro, pega a él (para encadenar con lo que hay)', () => {
    const endpoints = [{ x: 500, y: 500 }]
    expect(snapPoint({ x: 505, y: 497 }, { grid: GRID, shift: false, endpoints, tolerance: 8 })).toEqual({
      x: 500,
      y: 500
    })
    // El extremo manda también con Mayús
    expect(snapPoint({ x: 505, y: 497 }, { grid: GRID, shift: true, endpoints, tolerance: 8 })).toEqual({
      x: 500,
      y: 500
    })
  })

  it('sin rejilla, Mayús no pega a nada', () => {
    const none = { ...GRID, type: 'none' as const }
    expect(snapPoint({ x: 140, y: 260 }, { grid: none, shift: true, endpoints: [], tolerance: 8 })).toEqual({
      x: 140,
      y: 260
    })
  })
})

describe('los muros encadenados, clic a clic', () => {
  it('el primer clic empieza; cada uno añade un tramo', () => {
    let step = chainClick(null, { x: 0, y: 0 }, 4)
    expect(step).toEqual({ chain: { points: [{ x: 0, y: 0 }] }, done: false })
    step = chainClick(step.chain, { x: 100, y: 0 }, 4)
    step = chainClick(step.chain, { x: 100, y: 100 }, 4)
    expect(step.done).toBe(false)
    expect(chainSegments(step.chain, 'wall')).toEqual([
      { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, kind: 'wall' },
      { a: { x: 100, y: 0 }, b: { x: 100, y: 100 }, kind: 'wall' }
    ])
  })

  it('un clic sobre el último punto (el doble clic) acaba sin añadir nada', () => {
    let step = chainClick(null, { x: 0, y: 0 }, 4)
    step = chainClick(step.chain, { x: 100, y: 0 }, 4)
    step = chainClick(step.chain, { x: 102, y: 1 }, 4)
    expect(step.done).toBe(true)
    expect(chainSegments(step.chain, 'wall')).toHaveLength(1)
  })

  it('volver al primer punto cierra la figura y acaba', () => {
    let step = chainClick(null, { x: 0, y: 0 }, 4)
    step = chainClick(step.chain, { x: 100, y: 0 }, 4)
    step = chainClick(step.chain, { x: 100, y: 100 }, 4)
    step = chainClick(step.chain, { x: 1, y: 2 }, 4)
    expect(step.done).toBe(true)
    const segments = chainSegments(step.chain, 'wall')
    expect(segments).toHaveLength(3)
    expect(segments[2]).toEqual({ a: { x: 100, y: 100 }, b: { x: 0, y: 0 }, kind: 'wall' })
  })

  it('un solo punto no hace ningún muro', () => {
    expect(chainSegments(chainClick(null, { x: 0, y: 0 }, 4).chain, 'wall')).toEqual([])
    expect(chainSegments(null, 'wall')).toEqual([])
  })
})

describe('lo que se manda por cada tipo', () => {
  const a = { x: 0, y: 0 }
  const b = { x: 100, y: 0 }
  it('los tipos ya hechos, por su nombre', () => {
    expect(wallInputFor('low', a, b)).toEqual({ a, b, kind: 'low' })
    expect(wallInputFor('window', a, b)).toEqual({ a, b, kind: 'window' })
  })
  it('las puertas, un muro con su puerta; de un sentido, un muro que deja pasar por un lado', () => {
    expect(wallInputFor('door', a, b)).toEqual({ a, b, kind: 'wall', door: 'door' })
    expect(wallInputFor('secret', a, b)).toEqual({ a, b, kind: 'wall', door: 'secret' })
    expect(wallInputFor('oneWay', a, b)).toEqual({ a, b, kind: 'wall', direction: 'left' })
  })
  it('y al revés: el tipo de un muro que ya está', () => {
    expect(drawKindOf(wall('1', [0, 0], [1, 1]))).toBe('wall')
    expect(drawKindOf(wall('1', [0, 0], [1, 1], { door: 'secret' }))).toBe('secret')
    expect(drawKindOf(wall('1', [0, 0], [1, 1], { door: 'door', kind: 'window' }))).toBe('door')
    expect(drawKindOf(wall('1', [0, 0], [1, 1], { direction: 'right' }))).toBe('oneWay')
    expect(drawKindOf(wall('1', [0, 0], [1, 1], { kind: 'custom' }))).toBe('custom')
  })
})

describe('elegir y mover', () => {
  const walls = [wall('a', [0, 0], [100, 0]), wall('b', [100, 0], [100, 100]), wall('c', [300, 300], [400, 300])]

  it('el muro más cercano a un punto, si está a menos de la tolerancia', () => {
    expect(wallAt(walls, { x: 50, y: 3 }, 6)?.id).toBe('a')
    expect(wallAt(walls, { x: 103, y: 60 }, 6)?.id).toBe('b')
    expect(wallAt(walls, { x: 50, y: 30 }, 6)).toBeNull()
  })

  it('el extremo bajo el cursor, y los extremos sin repetir', () => {
    expect(endpointAt(walls, { x: 98, y: 3 }, 6)).toEqual({ x: 100, y: 0 })
    expect(endpointAt(walls, { x: 50, y: 0 }, 6)).toBeNull()
    expect(endpointsOf(walls)).toHaveLength(5)
  })

  it('mover un extremo se lleva todos los muros que se tocan en él', () => {
    expect(moveEndpoint(walls, { x: 100, y: 0 }, { x: 120, y: 10 })).toEqual([
      { id: 'a', b: { x: 120, y: 10 } },
      { id: 'b', a: { x: 120, y: 10 } }
    ])
  })

  it('cuántos muros y cuántas puertas', () => {
    expect(wallStats([...walls, wall('d', [0, 0], [0, 1], { door: 'door' })])).toEqual({ walls: 3, doors: 1 })
  })
})

describe('las luces', () => {
  it('los pies, a píxeles con la rejilla', () => {
    expect(feetToPixels(20, GRID)).toBe(400)
    expect(feetToPixels(20, { ...GRID, type: 'none' })).toBe(400)
  })

  it('la luz bajo el cursor', () => {
    const lights = [
      { id: 'l1', x: 100, y: 100 },
      { id: 'l2', x: 400, y: 100 }
    ]
    expect(lightAt(lights, { x: 405, y: 96 }, 12)?.id).toBe('l2')
    expect(lightAt(lights, { x: 250, y: 100 }, 12)).toBeNull()
  })
})

describe('cómo se ven los muros', () => {
  const walls = [
    wall('m', [0, 0], [100, 0]),
    wall('p', [100, 0], [200, 0], { door: 'door' }),
    wall('s', [200, 0], [300, 0], { door: 'secret' }),
    wall('k', [300, 0], [400, 0], { door: 'door', locked: true })
  ]
  const lines = (shapes: ReturnType<typeof wallShapes>) => shapes.filter((s) => s.kind === 'line')

  it('cada tipo con su color, y la puerta abierta a trazos', () => {
    const shapes = lines(wallShapes(walls, { doors: { p: true }, selected: null, scale: 1, endpoints: false }))
    expect(shapes.map((s) => s.color)).toEqual([
      WALL_COLORS.wall,
      WALL_COLORS.door,
      WALL_COLORS.secret,
      WALL_COLORS.locked
    ])
    expect(shapes[1]?.kind === 'line' && shapes[1].dash).toBeTruthy()
    expect(shapes[2]?.kind === 'line' && shapes[2].dash).toBeFalsy()
  })

  it('la elegida lleva un aro blanco debajo; al editar, sus extremos', () => {
    const shapes = wallShapes(walls, { doors: {}, selected: 's', scale: 1, endpoints: true })
    const white = shapes.findIndex((s) => s.kind === 'line' && s.color === WALL_COLORS.selected)
    const secret = shapes.findIndex((s) => s.kind === 'line' && s.color === WALL_COLORS.secret)
    expect(white).toBeGreaterThan(-1)
    expect(white).toBeLessThan(secret)
    expect(shapes.filter((s) => s.kind === 'dot')).toHaveLength(5)
  })

  it('el de un sentido, con su marca hacia donde deja pasar', () => {
    const shapes = lines(
      wallShapes([wall('u', [0, 0], [100, 0], { direction: 'left' })], {
        doors: {},
        selected: null,
        scale: 1,
        endpoints: false
      })
    )
    const tick = shapes.find((s) => s.color === WALL_COLORS.oneWay)
    expect(tick?.kind === 'line' && tick.b).toEqual({ x: 50, y: -12 })
  })
})
