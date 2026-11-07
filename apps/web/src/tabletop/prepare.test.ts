import { type TileRef, tileCount, tilePyramid } from '@crisol/tabletop'
import { describe, expect, it, vi } from 'vitest'
import { analysisLevel, prepareTiles, sourceRect, tileOrder } from './prepare.ts'

const key = (ref: TileRef) => `${ref.level}/${ref.x}_${ref.y}`

describe('trocear el mapa de una escena', () => {
  // 3000 × 2000: niveles de 3000, 1500 y 750 px
  const pyramid = tilePyramid(3000, 2000)

  it('las teselas van del nivel más pequeño al mayor: lo primero que llega ya enseña el mapa entero', () => {
    const order = tileOrder(pyramid)
    expect(order).toHaveLength(tileCount(pyramid))
    expect(order.slice(0, 4).map(key)).toEqual(['2/0_0', '2/1_0', '1/0_0', '1/1_0'])
    expect(order.at(-1)).toEqual({ level: 0, x: 5, y: 3 })
  })

  it('cada tesela sale de su trozo de la imagen, sin salirse de ella', () => {
    expect(sourceRect(pyramid, { level: 0, x: 0, y: 0 })).toEqual({ x: 0, y: 0, width: 512, height: 512 })
    expect(sourceRect(pyramid, { level: 1, x: 2, y: 1 })).toEqual({ x: 2048, y: 1024, width: 952, height: 976 })
    // 1001 px de ancho: el nivel 1 mide 501, que a escala real serían 1002; se recorta a la imagen
    expect(sourceRect(tilePyramid(1001, 900, 512, 512), { level: 1, x: 0, y: 0 })).toEqual({
      x: 0,
      y: 0,
      width: 1001,
      height: 900
    })
  })

  it('para buscar la rejilla se usa el nivel más detallado que cabe en el análisis', () => {
    expect(analysisLevel(pyramid)).toBe(2)
    expect(analysisLevel(tilePyramid(2400, 1200))).toBe(1)
    expect(analysisLevel(tilePyramid(900, 600))).toBe(0)
    expect(analysisLevel(tilePyramid(20_000, 400))).toBe(4)
  })

  it('codifica y sube todas, unas pocas a la vez, diciendo cuántas lleva', async () => {
    let active = 0
    let most = 0
    const uploaded: string[] = []
    const progress: number[] = []
    await prepareTiles(pyramid, {
      encode: async (ref) => new Blob([key(ref)], { type: 'image/webp' }),
      upload: async (ref) => {
        active++
        most = Math.max(most, active)
        await new Promise((resolve) => setTimeout(resolve, 1))
        uploaded.push(key(ref))
        active--
      },
      concurrency: 3,
      onProgress: (done) => progress.push(done)
    })
    expect(uploaded).toHaveLength(tileCount(pyramid))
    expect(new Set(uploaded).size).toBe(tileCount(pyramid))
    expect(most).toBe(3)
    expect(progress.at(-1)).toBe(tileCount(pyramid))
  })

  it('una subida que falla se reintenta; si sigue fallando, para todo', async () => {
    let failures = 0
    const flaky = vi.fn(async (ref: TileRef) => {
      if (key(ref) === '2/0_0' && failures++ < 1) throw new Error('red')
    })
    await prepareTiles(pyramid, { encode: async () => new Blob(['x'], { type: 'image/webp' }), upload: flaky })
    expect(flaky).toHaveBeenCalledTimes(tileCount(pyramid) + 1)
    await expect(
      prepareTiles(pyramid, {
        encode: async () => new Blob(['x'], { type: 'image/webp' }),
        upload: async () => {
          throw new Error('caído')
        }
      })
    ).rejects.toThrow('caído')
  })

  it('un navegador que no sabe sacar WebP no sube nada', async () => {
    const upload = vi.fn()
    await expect(
      prepareTiles(pyramid, { encode: async () => new Blob(['x'], { type: 'image/png' }), upload })
    ).rejects.toMatchObject({ code: 'NO_WEBP' })
    expect(upload).not.toHaveBeenCalled()
  })

  it('cancelar para antes de acabar', async () => {
    const controller = new AbortController()
    const upload = vi.fn(async () => {
      if (upload.mock.calls.length === 2) controller.abort()
    })
    await expect(
      prepareTiles(pyramid, {
        encode: async () => new Blob(['x'], { type: 'image/webp' }),
        upload,
        concurrency: 1,
        signal: controller.signal
      })
    ).rejects.toMatchObject({ code: 'CANCELLED' })
    expect(upload.mock.calls.length).toBeLessThan(tileCount(pyramid))
  })
})
