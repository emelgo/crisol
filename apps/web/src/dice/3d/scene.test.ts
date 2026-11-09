import { BufferGeometry, Material, Texture } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FallingDie } from '../falling.ts'
import { createScene } from './scene.ts'

// Sin WebGL: el renderizador apunta cuántos dados hay en la escena cada vez que dibuja
const state = vi.hoisted(() => ({ drawn: [] as number[], stopped: 0 }))
vi.mock('three', async (original) => {
  const three = await original<typeof import('three')>()
  class FakeRenderer {
    setPixelRatio() {}
    shadowMap = { enabled: false, type: 0 }
    toneMapping = 0
    toneMappingExposure = 1
    setSize() {}
    render(scene: InstanceType<typeof three.Scene>) {
      // Los dados (no el tapete, que solo recoge las sombras)
      state.drawn.push(
        scene.children.filter((child) => child instanceof three.Mesh && !(child.material instanceof three.ShadowMaterial))
          .length
      )
    }
    dispose() {}
  }
  return { ...three, WebGLRenderer: FakeRenderer }
})

// La física, al momento: medio segundo de caída en línea recta
const FRAMES = 30
vi.mock('./simulate.ts', () => ({
  simulator: () => ({
    run: async (dice: { kind: number | string }[]) =>
      dice.map((d) => ({
        kind: d.kind,
        labels: Array.from({ length: 20 }, (_, i) => String(i + 1)),
        frames: Array.from({ length: FRAMES }, (_, i) => ({ position: [0, 5 - i / 10, 0], quaternion: [0, 0, 0, 1] })),
        settled: true
      })),
    stop: () => {
      state.stopped++
    }
  })
}))

const d6 = (n: number): FallingDie[] =>
  Array.from({ length: n }, () => ({ kind: 6, label: '3', kept: true, critical: false }))
const THROW_MS = (FRAMES * 1000) / 60
/** Lo que se quedan quietos y lo que tardan en irse (STAY_MS + FADE_MS), y un poco más */
const GONE_MS = THROW_MS + 2200 + 600 + 100

describe('la escena de los dados', () => {
  let canvases: number
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    state.drawn.length = 0
    state.stopped = 0
    canvases = 0
    const create = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: ElementCreationOptions) => {
      if (tag === 'canvas') canvases++
      return create(tag, options)
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('diez d6 del mismo color comparten sus seis texturas; caen, se quedan y se van soltando lo suyo', async () => {
    const textures = vi.spyOn(Texture.prototype, 'dispose')
    const materials = vi.spyOn(Material.prototype, 'dispose')
    const scene = createScene(document.createElement('canvas'))
    const landed = vi.fn()
    canvases = 0
    scene.play(d6(10), '#3a7bd5', landed)
    await vi.advanceTimersByTimeAsync(20)
    expect(canvases).toBe(6)
    expect(state.drawn.at(-1)).toBe(10)
    expect(landed).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(THROW_MS)
    expect(landed).toHaveBeenCalledOnce()
    // Quietos a la vista un rato
    await vi.advanceTimersByTimeAsync(1000)
    expect(state.drawn.at(-1)).toBe(10)
    await vi.advanceTimersByTimeAsync(GONE_MS)
    expect(state.drawn.at(-1)).toBe(0)
    expect(textures).toHaveBeenCalledTimes(6)
    expect(materials).toHaveBeenCalledTimes(10 * 6)
    // Sin nada que mover, deja de dibujar
    const renders = state.drawn.length
    await vi.advanceTimersByTimeAsync(1000)
    expect(state.drawn.length).toBe(renders)
    scene.dispose()
  })

  it('como mucho 60 dados a la vista: si se tira más deprisa, los más viejos se van antes', async () => {
    const textures = vi.spyOn(Texture.prototype, 'dispose')
    const scene = createScene(document.createElement('canvas'))
    for (let i = 0; i < 4; i++) scene.play(d6(20), '#3a7bd5', () => {})
    await vi.advanceTimersByTimeAsync(20)
    expect(Math.max(...state.drawn)).toBeLessThanOrEqual(60)
    expect(state.drawn.at(-1)).toBe(60)
    // La primera tirada ya se fue, con sus seis texturas (una por cara)
    expect(textures).toHaveBeenCalledTimes(6)
    scene.dispose()
  })

  it('al soltarla lo suelta todo, y lo que llegue después ya no se dibuja', async () => {
    const textures = vi.spyOn(Texture.prototype, 'dispose')
    const geometries = vi.spyOn(BufferGeometry.prototype, 'dispose')
    const scene = createScene(document.createElement('canvas'))
    const landed = vi.fn()
    scene.play(d6(3), '#3a7bd5', () => {})
    await vi.advanceTimersByTimeAsync(20)
    scene.dispose()
    expect(state.stopped).toBe(1)
    // Las seis caras, compartidas por los tres
    expect(textures).toHaveBeenCalledTimes(6)
    // La forma del d6, la misma para los tres, y el tapete de las sombras
    expect(geometries).toHaveBeenCalledTimes(2)
    const renders = state.drawn.length
    scene.play(d6(2), '#3a7bd5', landed)
    await vi.advanceTimersByTimeAsync(GONE_MS)
    expect(state.drawn.length).toBe(renders)
    expect(landed).not.toHaveBeenCalled()
  })
})
