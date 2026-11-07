// Portado de packages/mesa/src/nucleo/nucleo.test.ts y camaraJugadores.test.ts (Crisol actual, commit 3f68f11)
import { describe, expect, it } from 'vitest'
import {
  centerOn,
  decelerate,
  type FramingContext,
  fitView,
  frameGroup,
  framingOfViewport,
  framingRect,
  isTrackpadWheel,
  MIN_FRAMING_CELLS,
  panBy,
  resolveFraming,
  sameViewport,
  toScreen,
  toWorld,
  viewportOfFraming,
  wheelZoomFactor,
  widthToCorner,
  zoomAt,
  zoomLimits
} from './camera.ts'

describe('la vista de un lienzo', () => {
  it('mundo ↔ lienzo, ajustar, límites y zoom en el cursor', () => {
    const view = { x: 10, y: 20, scale: 2 }
    expect(toScreen(view, { x: 5, y: 5 })).toEqual({ x: 20, y: 30 })
    expect(toWorld(view, { x: 20, y: 30 })).toEqual({ x: 5, y: 5 })
    const fit = fitView({ width: 1000, height: 500 }, { width: 548, height: 548 })
    expect(fit.scale).toBeCloseTo(0.5)
    expect(fit.x).toBeCloseTo(24)
    const limits = zoomLimits({ width: 1000, height: 500 }, { width: 548, height: 548 })
    expect(limits).toEqual({ min: 0.25, max: 8 })
    const cursor = { x: 100, y: 100 }
    const before = toWorld(view, cursor)
    const after = zoomAt(view, 1.5, cursor, { min: 0.1, max: 10 })
    expect(toWorld(after, cursor).x).toBeCloseTo(before.x)
    expect(zoomAt(view, 100, cursor, { min: 0.1, max: 3 }).scale).toBe(3)
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1)
    expect(wheelZoomFactor(5, 1)).toBeCloseTo(wheelZoomFactor(80))
    expect(wheelZoomFactor(1, 2)).toBeCloseTo(wheelZoomFactor(300))
    // El pellizco acelera
    expect(wheelZoomFactor(-10, 0, true)).toBeGreaterThan(wheelZoomFactor(-10))
  })

  it('centrar, desplazar, frenar y comparar', () => {
    const v = centerOn({ x: 100, y: 50 }, { width: 800, height: 600 }, 2)
    expect(v).toEqual({ x: 200, y: 200, scale: 2 })
    expect(toScreen(v, { x: 100, y: 50 })).toEqual({ x: 400, y: 300 })
    expect(panBy(v, 5, -5)).toEqual({ x: 205, y: 195, scale: 2 })
    expect(decelerate({ x: 1, y: -2 }, 0)).toEqual({ x: 1, y: -2 })
    expect(decelerate({ x: 1, y: 0 }, 100).x).toBeCloseTo(0.995 ** 100)
    expect(sameViewport(v, { ...v, x: v.x + 1e-9 })).toBe(true)
    expect(sameViewport(v, { ...v, scale: 2.1 })).toBe(false)
  })

  it('rueda de trackpad o de ratón', () => {
    expect(isTrackpadWheel(3, 0, 0)).toBe(true)
    expect(isTrackpadWheel(0, 4.5, 0)).toBe(true)
    expect(isTrackpadWheel(0, 100, 0)).toBe(false)
    expect(isTrackpadWheel(0, 3, 1)).toBe(false)
  })
})

describe('la cámara de la pantalla', () => {
  it('el rectángulo sale del centro, el ancho y la forma de la pantalla', () => {
    expect(framingRect({ center: { x: 500, y: 300 }, width: 1000 }, 0.5)).toEqual({
      x: 0,
      y: 50,
      width: 1000,
      height: 500
    })
  })

  it('el grupo: sus fichas con margen', () => {
    const e = frameGroup(
      [
        { x: 0, y: 0 },
        { x: 2100, y: 700 }
      ],
      70,
      0.5
    )
    expect(e?.center).toEqual({ x: 1050, y: 350 })
    expect(e?.width).toBe(2100 + 2 * 2.5 * 70)
  })

  it('un grupo alto pide más ancho; uno pequeño, el mínimo; sin fichas, nada', () => {
    expect(
      frameGroup(
        [
          { x: 0, y: 0 },
          { x: 0, y: 1000 }
        ],
        70,
        0.5
      )?.width
    ).toBe((1000 + 350) / 0.5)
    expect(frameGroup([{ x: 0, y: 0 }], 70, 1)?.width).toBe(MIN_FRAMING_CELLS * 70)
    expect(frameGroup([], 70, 0.5)).toBeNull()
  })

  it('la esquina arrastrada fija el ancho (con la contraria quieta), nunca menos de 2 casillas', () => {
    const rect = { x: 0, y: 0, width: 1000, height: 500 }
    expect(widthToCorner(rect, { x: 600, y: 100 }, 0.5, 70)).toBe(600)
    expect(widthToCorner(rect, { x: 100, y: 400 }, 0.5, 70)).toBe(800)
    expect(widthToCorner(rect, { x: -50, y: -50 }, 0.5, 70)).toBe(140)
  })

  it('seguir al máster: lo que ve, entero en la pantalla, y de vuelta a una vista', () => {
    // El máster ve 800 × 600 px de lienzo a escala 2: 400 × 300 del mundo, centrados en (400, 250)
    const master = { x: -400, y: -200, scale: 2 }
    const canvas = { width: 800, height: 600 }
    // En una pantalla cuadrada (aspecto 1) cabe todo con 400 de ancho
    expect(framingOfViewport(master, canvas, 1)).toEqual({ center: { x: 400, y: 250 }, width: 400 })
    // Una pantalla muy apaisada (aspecto 0,5) necesita 600 de ancho para que quepan los 300 de alto
    expect(framingOfViewport(master, canvas, 0.5).width).toBe(600)
    const tv = viewportOfFraming({ center: { x: 400, y: 250 }, width: 400 }, { width: 1920, height: 1080 })
    expect(tv.scale).toBeCloseTo(1920 / 400)
    expect(toScreen(tv, { x: 400, y: 250 })).toEqual({ x: 960, y: 540 })
  })

  it('cada cámara da su encuadre; si la ficha o el grupo faltan, se queda en lo último', () => {
    const master = { center: { x: 1, y: 1 }, width: 100 }
    const last = { center: { x: 9, y: 9 }, width: 50 }
    const context: FramingContext = {
      master,
      tokenPosition: (id) => (id === 'lobo' ? { x: 70, y: 140 } : null),
      group: [{ x: 0, y: 0 }],
      cellSize: 70,
      aspect: 1,
      last
    }
    expect(resolveFraming({ mode: 'follow' }, context)).toBe(master)
    expect(resolveFraming({ mode: 'fixed', center: { x: 5, y: 6 }, width: 700 }, context)).toEqual({
      center: { x: 5, y: 6 },
      width: 700
    })
    expect(resolveFraming({ mode: 'token', tokenId: 'lobo', width: 560 }, context)).toEqual({
      center: { x: 70, y: 140 },
      width: 560
    })
    expect(resolveFraming({ mode: 'token', tokenId: 'otro', width: 560 }, context)).toBe(last)
    expect(resolveFraming({ mode: 'group' }, context)).toEqual({ center: { x: 0, y: 0 }, width: 8 * 70 })
    expect(resolveFraming({ mode: 'group' }, { ...context, group: [] })).toBe(last)
    // Sin nada antes, lo del máster
    expect(resolveFraming({ mode: 'group' }, { ...context, group: [], last: null })).toBe(master)
  })
})
