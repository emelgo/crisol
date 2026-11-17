import type { MapElementView } from '@crisol/contracts'
import { describe, expect, it } from 'vitest'
import { arcPath, fontPixels, paintOrder, pathOf, regionLabelAt, toPixels } from './geometry.ts'

const IMAGE = { width: 1000, height: 500 }

describe('las cuentas de lo dibujado en un mapa (módulo 9)', () => {
  it('de 0–1 a píxeles, y el trazado de una ruta (abierta) o de una pieza (cerrada)', () => {
    expect(toPixels([0.5, 0.5], IMAGE)).toEqual([500, 250])
    const line = [
      [0, 0],
      [0.5, 0.2]
    ]
    expect(pathOf(line, IMAGE, false)).toBe('M0 0L500 100')
    expect(pathOf(line, IMAGE, true)).toBe('M0 0L500 100Z')
    expect(pathOf([], IMAGE, true)).toBe('')
  })

  it('el nombre de una región va en el centro de su pieza más grande', () => {
    const small = [
      [0, 0],
      [0.1, 0],
      [0.1, 0.1],
      [0, 0.1]
    ]
    const big = [
      [0.4, 0.4],
      [0.8, 0.4],
      [0.8, 0.8],
      [0.4, 0.8]
    ]
    expect(regionLabelAt([small, big], IMAGE)).toEqual([600, 300])
    // Una pieza sin área (en línea): la media de sus puntos
    expect(
      regionLabelAt(
        [
          [
            [0, 0],
            [0.2, 0],
            [0.4, 0]
          ]
        ],
        IMAGE
      )
    ).toEqual([200, 0])
  })

  it('el arco de un texto: recto sin doblar; hacia arriba con arco positivo', () => {
    expect(arcPath([500, 100], 'Mar', 20, 0)).toBe('M480 100Q500 100 520 100')
    const up = arcPath([500, 100], 'Mar de Ceniza', 20, 0.5)
    expect(up).toMatch(/^M422 100Q500 22 578 100$/)
  })

  it('el tamaño de letra crece con la imagen (el del estilo, en una de 1000 de ancho)', () => {
    expect(fontPixels(20, { width: 2000, height: 1000 }, 14)).toBe(40)
    expect(fontPixels(undefined, IMAGE, 14)).toBe(14)
  })

  it('se pinta por capas, de abajo arriba; lo que no tiene capa, con la primera', () => {
    const element = (id: string, layerId: string | null) => ({ id, layerId }) as MapElementView
    const layers = [
      { id: 'fondo', name: 'Fondo', hidden: false },
      { id: 'arriba', name: 'Arriba', hidden: false }
    ]
    const order = paintOrder([element('a', 'arriba'), element('b', null), element('c', 'fondo')], layers)
    expect(order.map((e) => e.id)).toEqual(['b', 'c', 'a'])
  })
})
