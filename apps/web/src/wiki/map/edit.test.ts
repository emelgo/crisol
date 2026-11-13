import type { MapElementView, MapGeometry } from '@crisol/contracts'
import { describe, expect, it } from 'vitest'
import { insertedVertex, midpoints, moved, snapped, snapTargets, withoutVertex, withVertex } from './edit.ts'

const IMAGE = { width: 1000, height: 1000 }
const square: MapGeometry = {
  pieces: [
    [
      [0.1, 0.1],
      [0.4, 0.1],
      [0.4, 0.4],
      [0.1, 0.4]
    ]
  ]
}
const route: MapGeometry = {
  points: [
    [0.1, 0.1],
    [0.5, 0.5]
  ],
  from: 'pin-a',
  to: 'pin-b'
}

describe('dibujar y retocar en un mapa (módulo 9)', () => {
  it('a dónde se pega: los vértices de lo demás (no de lo que se edita) y los pines', () => {
    const element = (id: string, geometry: MapGeometry) => ({ id, geometry }) as MapElementView
    const targets = snapTargets(
      [element('reino', square), element('camino', route), element('mar', { at: [0.5, 0.9] })],
      [{ x: 0.7, y: 0.7 }],
      'camino'
    )
    expect(targets).toEqual([
      [0.7, 0.7],
      [0.1, 0.1],
      [0.4, 0.1],
      [0.4, 0.4],
      [0.1, 0.4]
    ])
  })

  it('pegar: al más cercano dentro del radio en pantalla; lejos, tal cual; más cerca con más zoom', () => {
    const targets: [number, number][] = [
      [0.4, 0.4],
      [0.405, 0.4]
    ]
    // A 3 px (con k = 1) del primero y a 2 px del segundo: el segundo
    expect(snapped([0.403, 0.4], targets, IMAGE, 1)).toEqual({ point: [0.405, 0.4], snapped: true })
    expect(snapped([0.5, 0.5], targets, IMAGE, 1)).toEqual({ point: [0.5, 0.5], snapped: false })
    // A 8 px de imagen: con k = 2 son 16 de pantalla, fuera del radio
    expect(snapped([0.408, 0.4], [[0.4, 0.4]], IMAGE, 2).snapped).toBe(false)
    expect(snapped([0.408, 0.4], [[0.4, 0.4]], IMAGE, 1).snapped).toBe(true)
  })

  it('mover entero: sin salirse de la imagen; una ruta movida deja sus pines; un texto, su sitio', () => {
    const round = (g: MapGeometry) =>
      JSON.parse(JSON.stringify(g, (_, v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v)))
    expect(round(moved(square, 0.7, 0))).toEqual({
      pieces: [
        [
          [0.8, 0.1],
          [1, 0.1],
          [1, 0.4],
          [0.8, 0.4]
        ]
      ]
    })
    expect(moved(route, 0.1, 0.1)).toMatchObject({ from: null, to: null })
    expect(round(moved({ at: [0.5, 0.5], rotate: 10 }, 0.1, -0.1))).toEqual({ at: [0.6, 0.4], rotate: 10 })
  })

  it('un vértice: moverlo (el de una punta de la ruta suelta su pin), añadir uno tras otro y quitarlo', () => {
    expect(withVertex(route, { piece: 0, index: 1 }, [0.6, 0.6])).toMatchObject({
      points: [
        [0.1, 0.1],
        [0.6, 0.6]
      ],
      from: 'pin-a',
      to: null
    })
    const added = insertedVertex(square, { piece: 0, index: 0 }, [0.25, 0.05])
    expect('pieces' in added && added.pieces[0]?.[1]).toEqual([0.25, 0.05])
    expect(withoutVertex(added, { piece: 0, index: 1 })).toEqual(square)
    // A una pieza de tres no se le quita ninguno; a una ruta de dos, tampoco
    const triangle = withoutVertex(square, { piece: 0, index: 0 })
    expect(triangle && withoutVertex(triangle, { piece: 0, index: 0 })).toBeNull()
    expect(withoutVertex(route, { piece: 0, index: 0 })).toBeNull()
    // Fuera de rango, igual
    expect(withVertex(square, { piece: 3, index: 0 }, [0, 0])).toBe(square)
  })

  it('los «+» de cada lado: en una pieza, también el que la cierra; en una ruta, no', () => {
    expect(midpoints(square)).toHaveLength(4)
    expect(midpoints(square)[3]).toEqual({ ref: { piece: 0, index: 3 }, at: [0.1, 0.25] })
    expect(midpoints(route)).toEqual([{ ref: { piece: 0, index: 0 }, at: [0.3, 0.3] }])
    expect(midpoints({ at: [0, 0] })).toEqual([])
  })
})
