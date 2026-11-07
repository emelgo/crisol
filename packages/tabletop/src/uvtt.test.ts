import { describe, expect, it } from 'vitest'
import { clipSegment, isUvttFile, parseUvtt, simplifyPolyline, uvttColor, uvttScene } from './uvtt.ts'

/** La cabecera de un PNG de ese tamaño, en base64: al lector le basta */
function pngBase64(width: number, height: number) {
  const bytes = new Uint8Array(33)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  new DataView(bytes.buffer).setUint32(16, width)
  new DataView(bytes.buffer).setUint32(20, height)
  return btoa(String.fromCharCode(...bytes))
}

/** Un mapa de 10×8 casillas de 128 px, con lo que se pida encima */
const file = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    format: 0.3,
    resolution: { map_origin: { x: 0, y: 0 }, map_size: { x: 10, y: 8 }, pixels_per_grid: 128 },
    line_of_sight: [],
    portals: [],
    lights: [],
    environment: { baked_lighting: false, ambient_light: 'ff202030' },
    image: pngBase64(1280, 1024),
    ...extra
  })

const scene = (text: string) => {
  const parsed = parseUvtt(text)
  if (!parsed.ok) throw new Error(parsed.error)
  const placed = uvttScene(parsed.value)
  if (!placed.ok) throw new Error(placed.error)
  return placed.value
}

describe('UVTT', () => {
  it('reconoce las tres extensiones', () => {
    expect(['a.dd2vtt', 'B.UVTT', 'c.df2vtt'].map(isUvttFile)).toEqual([true, true, true])
    expect(isUvttFile('mapa.png')).toBe(false)
  })

  it('saca la rejilla del ancho de la imagen y pasa todo a píxeles', () => {
    const s = scene(
      file({
        line_of_sight: [
          [
            { x: 1, y: 1 },
            { x: 4, y: 1 }
          ]
        ],
        lights: [{ position: { x: 2, y: 2 }, range: 4, intensity: 1, color: 'ffff8800', shadows: true }]
      })
    )
    expect(s).toMatchObject({ width: 1280, height: 1024, grid: { type: 'square', size: 128, offsetX: 0, offsetY: 0 } })
    expect(s.imported.walls).toEqual([
      [
        { x: 128, y: 128 },
        { x: 512, y: 128 }
      ]
    ])
    expect(s.imported.lights).toEqual([{ x: 256, y: 256, range: 512, intensity: 1, color: '#ff8800', shadows: true }])
    expect(s.imported).toMatchObject({ ambientLight: '#202030', bakedLighting: false })
  })

  it('una imagen recomprimida a otro tamaño manda sobre pixels_per_grid', () => {
    const s = scene(file({ image: pngBase64(640, 512) }))
    expect(s.grid.size).toBe(64)
  })

  it('un portal sin cerrar es una ventana, no una puerta abierta', () => {
    const s = scene(
      file({
        portals: [
          {
            bounds: [
              { x: 1, y: 2 },
              { x: 2, y: 2 }
            ],
            closed: true
          },
          {
            bounds: [
              { x: 3, y: 2 },
              { x: 4, y: 2 }
            ],
            closed: false
          }
        ]
      })
    )
    expect(s.imported.portals.map((p) => p.window)).toEqual([false, true])
  })

  it('la intensidad de 1 a 3 se lleva a 0–1 respecto a la mayor', () => {
    const light = (intensity: number) => ({ position: { x: 1, y: 1 }, range: 2, intensity, color: 'ffffffff' })
    const s = scene(file({ lights: [light(1), light(2), light(3)] }))
    expect(s.imported.lights.map((l) => Number(l.intensity.toFixed(3)))).toEqual([0.333, 0.667, 1])
  })

  it('un muro que cruza el borde se recorta a una casilla de él, sin abrir un hueco', () => {
    const s = scene(
      file({
        line_of_sight: [
          [
            { x: -20, y: 3 },
            { x: 5, y: 3 }
          ]
        ]
      })
    )
    expect(s.imported.walls).toEqual([
      [
        { x: -128, y: 384 },
        { x: 640, y: 384 }
      ]
    ])
  })

  it('las cuevas pierden los puntos en línea recta y los repetidos', () => {
    const line = [0, 1, 2, 3, 4]
      .map((x) => ({ x, y: 1 }))
      .concat([
        { x: 4, y: 1 },
        { x: 4, y: 5 }
      ])
    const s = scene(file({ line_of_sight: [line] }))
    expect(s.imported.walls).toEqual([
      [
        { x: 0, y: 128 },
        { x: 512, y: 128 },
        { x: 512, y: 640 }
      ]
    ])
  })

  it('un origen con fracción de casilla desplaza la rejilla', () => {
    const s = scene(file({ resolution: { map_origin: { x: 0.25, y: -0.5 }, map_size: { x: 10, y: 8 } } }))
    expect(s.grid).toMatchObject({ offsetX: 96, offsetY: 64 })
  })

  it('los objetos que tapan van aparte, para poder cambiarlos', () => {
    const square = [
      { x: 4, y: 4 },
      { x: 5, y: 4 },
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 4, y: 4 }
    ]
    const s = scene(file({ objects_line_of_sight: [square] }))
    expect(s.imported.walls).toEqual([])
    expect(s.imported.objects[0]).toHaveLength(5)
  })

  it('dice por qué no sirve un archivo', () => {
    const error = (text: string) => {
      const parsed = parseUvtt(text)
      return parsed.ok ? null : parsed.error
    }
    expect(error('no es json')).toMatch(/JSON/)
    expect(error(JSON.stringify({ image: pngBase64(10, 10) }))).toMatch(/map_size/)
    expect(error(file({ image: '' }))).toMatch(/imagen/)
    expect(error(file({ image: btoa('GIF89a') }))).toMatch(/PNG, JPEG ni WebP/)
    expect(error(file({ lights: new Array(2001).fill({ position: { x: 0, y: 0 }, range: 1 }) }))).toMatch(/luces/)
    expect(error(file({ portals: [{ bounds: [{ x: 1, y: 1 }] }] }))).toMatch(/extremos/)
    expect(error(file({ resolution: { map_size: { x: 5000, y: 10 } } }))).toMatch(/casillas por lado/)
    const tooSmall = parseUvtt(file({ image: pngBase64(50, 40) }))
    expect(tooSmall.ok && uvttScene(tooSmall.value)).toMatchObject({ ok: false })
  })

  it('los colores, con o sin alfa', () => {
    expect([uvttColor('ff00ff00'), uvttColor('#ABCDEF'), uvttColor('nada'), uvttColor(3)]).toEqual([
      '#00ff00',
      '#abcdef',
      null,
      null
    ])
  })

  it('recortar un tramo y simplificar, sueltos', () => {
    const box = { minX: 0, minY: 0, maxX: 10, maxY: 10 }
    expect(clipSegment({ x: 20, y: 0 }, { x: 30, y: 0 }, box)).toBeNull()
    expect(clipSegment({ x: 5, y: -5 }, { x: 5, y: 5 }, box)).toEqual([
      { x: 5, y: 0 },
      { x: 5, y: 5 }
    ])
    expect(clipSegment({ x: 5, y: 20 }, { x: 5, y: 30 }, box)).toBeNull()
    expect(
      simplifyPolyline([
        { x: 0, y: 0 },
        { x: 0, y: 0 }
      ])
    ).toEqual([{ x: 0, y: 0 }])
  })
})
