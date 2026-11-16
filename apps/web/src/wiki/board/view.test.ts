import { describe, expect, it } from 'vitest'
import { zoomedAround } from './view.ts'

describe('el zoom de la pizarra', () => {
  it('acerca alrededor del centro de lo que se ve: lo del centro se queda en el centro', () => {
    const state = { width: 800, height: 600, scrollX: 10, scrollY: -20, zoom: { value: 1 } }
    const next = zoomedAround(state, 2)
    // El punto de la escena en el centro (x = 400 / zoom - scrollX), el mismo antes y después
    expect(400 / 1 - state.scrollX).toBeCloseTo(400 / next.zoom - next.scrollX)
    expect(300 / 1 - state.scrollY).toBeCloseTo(300 / next.zoom - next.scrollY)
    expect(next.zoom).toBe(2)
  })

  it('no pasa de sus topes', () => {
    const state = { width: 800, height: 600, scrollX: 0, scrollY: 0, zoom: { value: 1 } }
    expect(zoomedAround(state, 100).zoom).toBe(30)
    expect(zoomedAround(state, 0.01).zoom).toBe(0.1)
  })
})
