/** Los caminos que se exploran en el hilo de la visión: cortados en el primer muro y con un tope de puntos por vista */
import { movementEdges, prepareVision, type Wall, WallIndex } from '@crisol/tabletop'
import { describe, expect, it } from 'vitest'
import { MAX_WALK_STEPS, type Prepared, walkSteps } from './vision-compute.ts'

const wall = (id: string, ax: number, ay: number, bx: number, by: number, extra: Partial<Wall> = {}): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  sight: 'full',
  light: 'full',
  move: 'full',
  direction: 'both',
  door: null,
  locked: false,
  ...extra
})
const prepared = (walls: Wall[]): Prepared => ({
  vision: prepareVision({ width: 4000, height: 1000, walls, doors: {}, lights: [], darkness: 0 }),
  move: new WallIndex(movementEdges(walls, {}))
})
const ana = { id: 'ana', x: 0, y: 0, radius: 50 }

describe('los caminos que se exploran', () => {
  it('una casilla cada vez, desde donde estaba hasta antes de donde está', () => {
    const steps = walkSteps([{ token: ana, from: { x: 50, y: 50 }, to: { x: 450, y: 50 } }], 100, prepared([]))
    expect(steps.map((s) => s.x)).toEqual([50, 150, 250, 350])
  })

  it('se corta en el primer muro que frena el paso o la vista (una ventana frena el paso)', () => {
    const solid = walkSteps(
      [{ token: ana, from: { x: 50, y: 50 }, to: { x: 950, y: 50 } }],
      100,
      prepared([wall('m', 300, 0, 300, 100)])
    )
    expect(solid.map((s) => s.x)).toEqual([50, 150, 250])
    const glass = prepared([wall('v', 300, 0, 300, 100, { sight: 'none', light: 'none' })])
    expect(
      walkSteps([{ token: ana, from: { x: 50, y: 50 }, to: { x: 950, y: 50 } }], 100, glass).map((s) => s.x)
    ).toEqual([50, 150, 250])
  })

  it(`como mucho ${MAX_WALK_STEPS} puntos por vista, repartidos por todos los caminos`, () => {
    const walks = Array.from({ length: 6 }, (_, i) => ({
      token: { ...ana, id: `pj${i}` },
      from: { x: 50, y: 50 + i * 150 },
      to: { x: 3050, y: 50 + i * 150 }
    }))
    const steps = walkSteps(walks, 100, prepared([]))
    expect(steps.length).toBeLessThanOrEqual(MAX_WALK_STEPS)
    expect(new Set(steps.map((s) => s.id)).size).toBe(6)
    const many = Array.from({ length: 200 }, (_, i) => ({
      token: ana,
      from: { x: i * 10, y: 50 },
      to: { x: i * 10 + 10, y: 50 }
    }))
    expect(walkSteps(many, 100, prepared([])).length).toBe(MAX_WALK_STEPS)
  })
})
