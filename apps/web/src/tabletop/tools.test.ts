import type { MarkView, SceneGrid } from '@crisol/contracts'
import { describe, expect, it } from 'vitest'
import {
  erase,
  hatchLines,
  liveMeasureOf,
  markShapes,
  measureLabels,
  movedMark,
  placedAt,
  rotateToward,
  snapMeasure,
  targetsOf,
  templateAt,
  templateOf,
  templateOutline,
  templateShapes,
  templateSize,
  thinStroke
} from './tools.ts'

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
  opacity: 0.2
}

const sceneId = crypto.randomUUID()

describe('medir', () => {
  it('cae en el centro o en la esquina más cerca; sin rejilla o con Alt, donde está', () => {
    expect(snapMeasure({ x: 140, y: 260 }, GRID)).toEqual({ x: 150, y: 250 })
    expect(snapMeasure({ x: 120, y: 190 }, GRID)).toEqual({ x: 100, y: 200 })
    expect(snapMeasure({ x: 123.44, y: 190 }, GRID, true)).toEqual({ x: 123.4, y: 190 })
    expect(snapMeasure({ x: 123, y: 190 }, { ...GRID, type: 'none' })).toEqual({ x: 123, y: 190 })
  })

  it('un camino: cada tramo en su mitad y el total al final, con la regla de la escena', () => {
    const measure = {
      shape: 'line' as const,
      points: [
        { x: 50, y: 50 },
        { x: 350, y: 50 },
        { x: 550, y: 250 }
      ]
    }
    expect(measureLabels(measure, GRID)).toEqual([
      { at: { x: 200, y: 50 }, text: '15 pies' },
      { at: { x: 450, y: 150 }, text: '10 pies' },
      { at: { x: 550, y: 250 }, text: '25 pies', strong: true, offset: { x: 44, y: 30 } }
    ])
    // Alternas: la segunda diagonal cuenta doble
    expect(measureLabels(measure, { ...GRID, diagonals: 'alternate' }).at(-1)?.text).toBe('30 pies')
    // Un solo tramo: solo el total
    expect(measureLabels({ shape: 'line', points: measure.points.slice(0, 2) }, GRID)).toHaveLength(1)
  })

  it('una forma: su largo junto a su punto final, a media casilla', () => {
    const cone = {
      shape: 'cone' as const,
      points: [
        { x: 0, y: 0 },
        { x: 610, y: 0 }
      ]
    }
    expect(measureLabels(cone, GRID)).toEqual([
      { at: { x: 610, y: 0 }, text: '30 pies', strong: true, offset: { x: 44, y: 30 } }
    ])
    expect(
      measureLabels(
        {
          shape: 'square',
          points: [
            { x: 0, y: 0 },
            { x: 200, y: 300 }
          ]
        },
        GRID
      )[0]?.text
    ).toBe('15 pies')
  })

  it('lo que va por el canal: el camino y, del cono, su apertura', () => {
    expect(liveMeasureOf({ shape: 'line', points: [{ x: 0, y: 0 }] }, GRID)).toBeNull()
    expect(
      liveMeasureOf(
        {
          shape: 'cone',
          points: [
            { x: 0, y: 0 },
            { x: 300, y: 0 }
          ]
        },
        GRID
      )
    ).toMatchObject({
      shape: 'cone',
      angle: 53.13
    })
  })
})

describe('las plantillas', () => {
  it('la de una medida: el cono con su apertura, la línea con una casilla de ancho; sin largo, ninguna', () => {
    expect(
      templateOf(
        {
          shape: 'cone',
          points: [
            { x: 0, y: 0 },
            { x: 300, y: 0 }
          ]
        },
        GRID
      )
    ).toMatchObject({
      angle: 53.13
    })
    expect(
      templateOf(
        {
          shape: 'line',
          points: [
            { x: 0, y: 0 },
            { x: 300, y: 0 }
          ]
        },
        GRID
      )
    ).toMatchObject({
      width: 100
    })
    expect(
      templateOf(
        {
          shape: 'circle',
          points: [
            { x: 5, y: 5 },
            { x: 5, y: 5 }
          ]
        },
        GRID
      )
    ).toBeNull()
  })

  it('su contorno: el cuadrado hacia donde apunta, la línea con su anchura, el cono desde su vértice', () => {
    expect(templateOutline({ shape: 'square', a: { x: 100, y: 100 }, b: { x: 0, y: 300 } }, 100)).toEqual([
      { x: -100, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 300 },
      { x: -100, y: 300 }
    ])
    const line = templateOutline({ shape: 'line', a: { x: 0, y: 0 }, b: { x: 300, y: 0 } }, 100)
    expect(line.map((p) => [Math.round(p.x), Math.round(p.y)])).toEqual([
      [0, 50],
      [300, 50],
      [300, -50],
      [0, -50]
    ])
    expect(templateOutline({ shape: 'cone', a: { x: 0, y: 0 }, b: { x: 300, y: 0 } }, 100)[0]).toEqual({ x: 0, y: 0 })
  })

  it('la trama: rayas paralelas recortadas por el borde', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ]
    const lines = hatchLines(square, 25, 0)
    expect(lines).toHaveLength(5)
    for (const [a, b] of lines) {
      expect(a.x).toBeCloseTo(0)
      expect(b.x).toBeCloseTo(100)
      expect(a.y).toBeCloseTo(b.y)
    }
    // En diagonal, la del centro va de esquina a esquina
    const diagonal = hatchLines(square, 25, 45).map(([a, b]) => Math.hypot(b.x - a.x, b.y - a.y))
    expect(Math.max(...diagonal)).toBeCloseTo(Math.SQRT2 * 100)
  })

  it('con un tipo de daño conocido, la trama de su color; del máster, a trazos; elegida, con su asa', () => {
    const base = { shape: 'circle' as const, a: { x: 0, y: 0 }, b: { x: 200, y: 0 }, color: '#ff6b5b' }
    const plain = templateShapes(base, { cell: 100 })
    expect(plain.filter((s) => s.kind === 'line')).toHaveLength(0)
    const fire = templateShapes({ ...base, damageType: 'fire' }, { cell: 100, selected: true, hidden: true })
    expect(fire.filter((s) => s.kind === 'line').length).toBeGreaterThan(5)
    expect(fire.some((s) => s.kind === 'polygon' && s.dash)).toBe(true)
    expect(fire.at(-1)).toMatchObject({ kind: 'dot', at: { x: 200, y: 0 } })
  })

  it('la de debajo de un punto, girarla con su largo y las fichas de dentro', () => {
    const t = { shape: 'cone' as const, a: { x: 0, y: 0 }, b: { x: 300, y: 0 }, color: '#ffffff', angle: 53.13 }
    expect(templateAt([t], { x: 200, y: 10 }, 100)).toBe(t)
    expect(templateAt([t], { x: -50, y: 0 }, 100)).toBeNull()
    expect(rotateToward(t, { x: 0, y: 50 })).toEqual({ x: 0, y: 300 })
    const tokens = [
      { id: 'a', x: 250, y: 50, size: 1 },
      { id: 'b', x: 50, y: 350, size: 1 }
    ]
    expect(targetsOf(t, tokens, GRID).map((each) => each.id)).toEqual(['a'])
  })

  it('en la tele, los dibujos llegan en trozos; los del máster salen a trazos en la mesa', () => {
    const drawing: MarkView = {
      kind: 'drawing',
      id: crypto.randomUUID(),
      sceneId,
      hidden: true,
      version: 1,
      tool: 'pen',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ],
      color: '#ff6b5b',
      width: 6,
      opacity: 1
    }
    expect(markShapes([drawing], GRID)[0]).toMatchObject({ dash: [10, 7], scaled: true })
    const { hidden: _, sceneId: __, version: ___, points: ____, ...rest } = drawing
    const onScreen = markShapes([{ ...rest, strokes: [drawing.points, drawing.points] }], GRID)
    expect(onScreen).toHaveLength(2)
  })
})

describe('la goma y los trazos', () => {
  const drawing = {
    kind: 'drawing' as const,
    id: crypto.randomUUID(),
    sceneId,
    hidden: false,
    version: 1,
    tool: 'pen' as const,
    points: Array.from({ length: 11 }, (_, i) => ({ x: i * 20, y: 0 })),
    color: '#ff6b5b',
    width: 4,
    opacity: 1
  }

  it('parte en dos el trazo que toca y deja los otros', () => {
    const other = {
      ...drawing,
      id: crypto.randomUUID(),
      points: [
        { x: 0, y: 500 },
        { x: 100, y: 500 }
      ]
    }
    const result = erase([drawing, other], { x: 100, y: 0 }, 15)
    expect(result.remove).toEqual([drawing.id])
    expect(result.add).toHaveLength(2)
    expect(result.add[0]).toMatchObject({ kind: 'drawing', color: '#ff6b5b', width: 4, hidden: false })
    expect(result.add[0]?.points.at(-1)?.x).toBeLessThan(100)
  })

  it('un trazo largo se queda en los puntos que admite la API', () => {
    const points = Array.from({ length: 9000 }, (_, i) => ({ x: i, y: 0 }))
    const thin = thinStroke(points, 4000)
    expect(thin).toHaveLength(4000)
    expect(thin[0]).toEqual({ x: 0, y: 0 })
    expect(thin.at(-1)).toEqual({ x: 8999, y: 0 })
  })
})

describe('las marcas sueltas', () => {
  const base = { sceneId, hidden: false, version: 1 }
  const text: MarkView = {
    ...base,
    kind: 'text',
    id: crypto.randomUUID(),
    x: 500,
    y: 500,
    text: 'Ojo',
    color: '#ffffff',
    size: 40
  }
  const stamp: MarkView = {
    ...base,
    kind: 'stamp',
    id: crypto.randomUUID(),
    x: 100,
    y: 100,
    icon: 'skull',
    size: 60,
    color: '#ffffff'
  }
  const pin: MarkView = {
    ...base,
    kind: 'pin',
    id: crypto.randomUUID(),
    x: 800,
    y: 800,
    pageId: null,
    label: '1',
    icon: 'pin'
  }
  const image: MarkView = {
    ...base,
    kind: 'image',
    id: crypto.randomUUID(),
    x: 300,
    y: 300,
    width: 200,
    height: 100,
    rotation: 90,
    fileId: crypto.randomUUID()
  }

  it('la de debajo de un punto: el texto en su caja, el sello en su cuadrado, el pin por encima de su punta, la imagen girada', () => {
    const marks = [text, stamp, pin, image]
    expect(placedAt(marks, { x: 520, y: 510 }, 1)?.id).toBe(text.id)
    expect(placedAt(marks, { x: 120, y: 80 }, 1)?.id).toBe(stamp.id)
    expect(placedAt(marks, { x: 800, y: 785 }, 1)?.id).toBe(pin.id)
    expect(placedAt(marks, { x: 800, y: 810 }, 1)).toBeNull()
    // Girada 90°: ahora es alta
    expect(placedAt(marks, { x: 300, y: 390 }, 1)?.id).toBe(image.id)
    expect(placedAt(marks, { x: 390, y: 300 }, 1)).toBeNull()
  })

  it('moverla y el nombre de una plantilla', () => {
    expect(movedMark(stamp, 10, -5)).toMatchObject({ x: 110, y: 95 })
    expect(templateSize({ shape: 'cone', a: { x: 0, y: 0 }, b: { x: 0, y: 600 } }, GRID)).toBe('30 pies')
  })
})
