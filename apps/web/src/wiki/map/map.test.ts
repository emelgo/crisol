import { describe, expect, it } from 'vitest'
import { zoomedAt } from './map-tab.tsx'
import { contrastInk, tipAnchored } from './pin-shape.tsx'

describe('el visor del mapa', () => {
  it('acercar deja quieto el punto del cursor', () => {
    const view = { x: 100, y: 50, k: 1 }
    const next = zoomedAt(view, 2, 300, 250)
    // El punto de la imagen bajo el cursor, antes y después
    expect((300 - view.x) / view.k).toBeCloseTo((300 - next.x) / next.k)
    expect((250 - view.y) / view.k).toBeCloseTo((250 - next.y) / next.k)
    expect(next.k).toBe(2)
  })

  it('no acerca ni aleja sin límite', () => {
    expect(zoomedAt({ x: 0, y: 0, k: 6 }, 10, 0, 0).k).toBe(8)
    expect(zoomedAt({ x: 0, y: 0, k: 0.1 }, 0.01, 0, 0).k).toBe(0.05)
  })
})

describe('los pines', () => {
  it('la gota, la bandera y el banderín se clavan por la punta; el resto y los de solo icono, por el centro', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((shape) => tipAnchored({ shape, variant: 0 }))).toEqual([
      true,
      false,
      false,
      false,
      false,
      true,
      false,
      true
    ])
    expect(tipAnchored({ shape: 0, variant: 2 })).toBe(false)
  })

  it('el icono va en negro sobre los colores claros y en blanco sobre los oscuros', () => {
    expect(contrastInk('#f4e8cf')).toBe('#1b1d22')
    expect(contrastInk('#9a4048')).toBe('#ffffff')
  })
})
