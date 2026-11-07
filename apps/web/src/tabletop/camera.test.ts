import { describe, expect, it } from 'vitest'
import {
  canvasViewOf,
  closeTo,
  framingOf,
  REFERENCE_WIDTH,
  sceneViewportOf,
  sceneViewportOfCanvas,
  smoothToward
} from './camera.ts'

describe('los encuadres de la mesa', () => {
  it('un encuadre guardado dice su escala para una pantalla de referencia: su ancho en el mapa sale de ella', () => {
    expect(framingOf({ x: 500, y: 300, scale: 2 })).toEqual({ center: { x: 500, y: 300 }, width: REFERENCE_WIDTH / 2 })
    expect(sceneViewportOf({ center: { x: 10, y: 20 }, width: 960 })).toEqual({ x: 10, y: 20, scale: 2 })
  })

  it('cada lienzo enseña el encuadre entero a su tamaño, centrado', () => {
    // 960 px de mapa de ancho (y 540 de alto) en un lienzo de 1280 × 720: a escala 4/3
    const view = canvasViewOf({ x: 500, y: 300, scale: 2 }, { width: 1280, height: 720 })
    expect(view.scale).toBeCloseTo(1280 / 960)
    expect(view.x + 500 * view.scale).toBeCloseTo(640)
    expect(view.y + 300 * view.scale).toBeCloseTo(360)
    // En uno más alto que ancho manda el ancho; en uno muy ancho, el alto: siempre cabe entero
    expect(canvasViewOf({ x: 0, y: 0, scale: 2 }, { width: 480, height: 800 }).scale).toBeCloseTo(0.5)
    expect(canvasViewOf({ x: 0, y: 0, scale: 2 }, { width: 3000, height: 540 }).scale).toBeCloseTo(1)
  })

  it('lo que ve un lienzo pasa a encuadre de la tele, entero, y vuelve al mismo sitio', () => {
    const canvas = { width: 1200, height: 800 }
    const view = { x: -300, y: -100, scale: 1.5 }
    const framing = sceneViewportOfCanvas(view, canvas)
    // El centro del lienzo, en el mapa
    expect(framing.x).toBeCloseTo((600 + 300) / 1.5)
    expect(framing.y).toBeCloseTo((400 + 100) / 1.5)
    // Lo que se ve de alto (800 / 1,5) no cabe en 16:9 con el ancho: manda el alto
    const width = REFERENCE_WIDTH / framing.scale
    expect(width).toBeCloseTo(800 / 1.5 / (9 / 16))
    const back = canvasViewOf(framing, canvas)
    expect(back.x + framing.x * back.scale).toBeCloseTo(600)
  })

  it('la tele se acerca al encuadre que sigue poco a poco y llega', () => {
    const target = { x: 100, y: 100, scale: 2 }
    let current = { x: 0, y: 0, scale: 1 }
    current = smoothToward(current, target, 16)
    expect(current.x).toBeGreaterThan(0)
    expect(current.x).toBeLessThan(100)
    expect(current.scale).toBeGreaterThan(1)
    for (let i = 0; i < 120; i++) current = smoothToward(current, target, 16)
    expect(closeTo(current, target)).toBe(true)
    // Un salto enorme (otra escena, otra punta del mapa) no se anima: va directo
    expect(smoothToward({ x: 0, y: 0, scale: 1 }, { x: 90_000, y: 0, scale: 1 }, 16)).toEqual({
      x: 90_000,
      y: 0,
      scale: 1
    })
  })
})
