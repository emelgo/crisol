// Portado de packages/mesa/src/nucleo/imagenes.test.ts (Crisol actual, commit 3f68f11)
import { describe, expect, it } from 'vitest'
import {
  handleAt,
  imageAt,
  imageCorners,
  imagesInPaintOrder,
  initialImageSize,
  insideImage,
  type MapImage,
  resizeImage,
  rotationHandle,
  rotationToward
} from './map-images.ts'

const image = (changes: Partial<MapImage> = {}): MapImage => ({
  id: 'a',
  x: 100,
  y: 100,
  width: 80,
  height: 40,
  rotation: 0,
  ...changes
})

describe('imágenes sueltas en el mapa', () => {
  it('se pintan las de debajo primero', () => {
    const list = [image({ id: 'arriba', above: true }), image({ id: 'abajo' })]
    expect(imagesInPaintOrder(list).map((i) => i.id)).toEqual(['abajo', 'arriba'])
  })

  it('bajo el puntero, la de más arriba; girada, cuenta su forma girada', () => {
    const below = image({ id: 'abajo' })
    const above = image({ id: 'arriba', above: true, x: 130 })
    expect(imageAt([below, above], { x: 135, y: 100 })?.id).toBe('arriba')
    expect(imageAt([below, above], { x: 70, y: 100 })?.id).toBe('abajo')
    expect(imageAt([below, above], { x: 100, y: 130 })).toBeNull()
    // Girada 90°: ahora mide 40 de ancho y 80 de alto
    const turned = image({ rotation: 90 })
    expect(insideImage(turned, { x: 100, y: 135 })).toBe(true)
    expect(insideImage(turned, { x: 135, y: 100 })).toBe(false)
  })

  it('esquinas y asas', () => {
    const i = image()
    expect(imageCorners(i)).toEqual([
      { x: 60, y: 80 },
      { x: 140, y: 80 },
      { x: 140, y: 120 },
      { x: 60, y: 120 }
    ])
    expect(rotationHandle(i, 20)).toEqual({ x: 100, y: 60 })
    expect(handleAt(i, { x: 141, y: 121 }, 6, 20)).toEqual({ handle: 'size', corner: 2 })
    expect(handleAt(i, { x: 100, y: 61 }, 6, 20)).toEqual({ handle: 'rotation' })
    expect(handleAt(i, { x: 100, y: 100 }, 6, 20)).toBeNull()
  })

  it('cambiar el tamaño: la esquina opuesta se queda y no se deforma (salvo libre)', () => {
    const i = image()
    expect(resizeImage(i, 2, { x: 220, y: 130 })).toEqual({ x: 140, y: 120, width: 160, height: 80 })
    expect(resizeImage(i, 2, { x: 220, y: 130 }, true)).toEqual({ x: 140, y: 105, width: 160, height: 50 })
    // No baja de 8 px por el lado menor
    expect(resizeImage(i, 2, { x: 0, y: 0 }).height).toBeCloseTo(8)
  })

  it('girar: hacia el puntero, de 15 en 15 grados (o de 45 en 45)', () => {
    const i = image()
    expect(rotationToward(i, { x: 100, y: 0 })).toBe(0)
    expect(rotationToward(i, { x: 200, y: 100 })).toBe(90)
    expect(rotationToward(i, { x: 200, y: 92 })).toBe(90)
    expect(rotationToward(i, { x: 200, y: 40 })).toBe(60)
    expect(rotationToward(i, { x: 200, y: 40 }, true)).toBe(45)
  })

  it('al ponerla, su lado mayor mide dos casillas', () => {
    expect(initialImageSize(400, 200, 70)).toEqual({ width: 140, height: 70 })
    expect(initialImageSize(0, 0, 70)).toEqual({ width: 140, height: 140 })
  })
})
