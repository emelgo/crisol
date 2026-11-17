import { describe, expect, it } from 'vitest'
import { zoomedAt } from './map-tab.tsx'
import { contrastInk, shapeTransform, tipAnchored } from './pin-shape.tsx'

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
  it('todas las formas se clavan por la punta, abajo en el centro; los de solo icono, por el centro', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((shape) => tipAnchored({ shape, variant: 0 }))).toEqual(Array(8).fill(true))
    expect(tipAnchored({ shape: 0, variant: 2 })).toBe(false)
  })

  it('todas las formas, del mismo tamaño y con la base en el mismo sitio de su caja', () => {
    // El círculo (18,4 de lado) crece hasta 21 y su base baja a 23,5; el rombo (20), igual
    expect(shapeTransform(1)).toBe('translate(12 23.5) scale(1.141) translate(-12 -21.2)')
    expect(shapeTransform(2)).toBe('translate(12 23.5) scale(1.05) translate(-12 -22)')
    // El banderín, estrecho: manda su alto
    expect(shapeTransform(7)).toBe('translate(12 23.5) scale(1.105) translate(-12 -21)')
  })

  it('el icono va en negro sobre los colores claros y en blanco sobre los oscuros', () => {
    expect(contrastInk('#f4e8cf')).toBe('#1b1d22')
    expect(contrastInk('#9a4048')).toBe('#ffffff')
  })
})
