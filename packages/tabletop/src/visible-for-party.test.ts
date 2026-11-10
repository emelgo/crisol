import { describe, expect, it } from 'vitest'
import type { FogOperation } from './fog.ts'
import type { FogGrid } from './fog-grid.ts'
import type { Light } from './light.ts'
import type { PartyToken } from './party-vision.ts'
import { partyView, prepareVision, type VisionScene, visibleForParty } from './visible-for-party.ts'
import type { Wall } from './walls.ts'

const wall = (x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall => ({
  id: `${x1},${y1},${x2},${y2}`,
  a: { x: x1, y: y1 },
  b: { x: x2, y: y2 },
  sight: 'full',
  light: 'full',
  move: 'full',
  direction: 'both',
  door: null,
  locked: false,
  ...extra
})
const light = (id: string, x: number, y: number, extra: Partial<Light> = {}): Light => ({
  id,
  x,
  y,
  bright: 30,
  dim: 60,
  color: '#ffe2a8',
  intensity: 1,
  angle: 360,
  rotation: 0,
  walls: true,
  darkness: false,
  ...extra
})

/**
 * Dos salas de 200 × 200 px: A (x 0–200) y B (x 200–400), con una puerta entre las dos (y 80–120) y una puerta secreta
 * en la pared de abajo de B que da a un pasillo (y 200–300)
 */
const walls = [
  wall(0, 0, 400, 0),
  wall(0, 0, 0, 300),
  wall(400, 0, 400, 300),
  wall(0, 300, 400, 300),
  wall(200, 0, 200, 80),
  wall(200, 120, 200, 200),
  wall(200, 100, 200, 100),
  wall(200, 80, 200, 120, { id: 'puerta', door: 'door' }),
  wall(0, 200, 280, 200),
  wall(320, 200, 400, 200),
  wall(280, 200, 320, 200, { id: 'secreta', door: 'secret' })
]
const scene = (extra: Partial<VisionScene> = {}): VisionScene => ({
  width: 400,
  height: 300,
  walls,
  doors: {},
  lights: [],
  darkness: 0,
  ...extra
})
const ana: PartyToken = { id: 'ana', x: 100, y: 100, radius: 20 }
/** Cuántas celdas se ven en el rectángulo de celdas (columnas c0–c1, filas r0–r1) */
const seenIn = (grid: FogGrid, c0: number, c1: number, r0: number, r1: number): number => {
  let n = 0
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (grid.get(c, r)) n += 1
  return n
}
const roomA = (g: FogGrid) => seenIn(g, 0, 19, 0, 19)
const roomB = (g: FogGrid) => seenIn(g, 20, 39, 0, 19)
const corridor = (g: FogGrid) => seenIn(g, 0, 39, 20, 29)

describe('lo que ve el grupo', () => {
  it('de día, su sala entera y nada de la de al lado con la puerta cerrada', () => {
    const { visible } = visibleForParty({ ...scene(), tokens: [ana], manualFog: [] })
    expect(roomA(visible)).toBe(400)
    expect(roomB(visible)).toBe(0)
    expect(corridor(visible)).toBe(0)
  })

  it('con la puerta abierta, por el hueco se ve parte de la otra sala', () => {
    const { visible } = visibleForParty({
      ...scene({ doors: { puerta: { open: true } } }),
      tokens: [ana],
      manualFog: []
    })
    expect(roomA(visible)).toBe(400)
    expect(roomB(visible)).toBeGreaterThan(20)
    expect(roomB(visible)).toBeLessThan(300)
  })

  it('una puerta secreta cerrada es muro; abierta, un hueco más', () => {
    const bea: PartyToken = { id: 'bea', x: 300, y: 100 }
    const closed = visibleForParty({ ...scene(), tokens: [bea], manualFog: [] })
    expect(corridor(closed.visible)).toBe(0)
    const open = visibleForParty({ ...scene({ doors: { secreta: { open: true } } }), tokens: [bea], manualFog: [] })
    expect(corridor(open.visible)).toBeGreaterThan(10)
  })

  it('de noche y sin luz, solo su huella; con una antorcha, lo que alumbra; con visión en la oscuridad, su alcance', () => {
    const dark = visibleForParty({ ...scene({ darkness: 1 }), tokens: [ana], manualFog: [] })
    // La huella: un círculo de 20 px, unas 12 celdas
    expect(roomA(dark.visible)).toBeGreaterThan(5)
    expect(roomA(dark.visible)).toBeLessThan(20)
    const torch = visibleForParty({
      ...scene({ darkness: 1, lights: [light('antorcha', 50, 50)] }),
      tokens: [ana],
      manualFog: []
    })
    expect(roomA(torch.visible)).toBeGreaterThan(roomA(dark.visible) + 50)
    expect(torch.litPolygons.map((l) => l.id)).toEqual(['antorcha'])
    // Lo que alumbra de lo visible, sin salirse de ello
    const [lit] = torch.litPolygons
    expect(lit?.cells.count()).toBeGreaterThan(50)
    expect(lit?.cells.clone().subtract(torch.visible).isEmpty()).toBe(true)
    const eyes = visibleForParty({
      ...scene({ darkness: 1 }),
      tokens: [{ ...ana, senses: { darkvision: 60 } }],
      manualFog: []
    })
    // Un círculo de 60 px: unas 113 celdas
    expect(roomA(eyes.visible)).toBeGreaterThan(100)
    expect(roomA(eyes.visible)).toBeLessThan(130)
  })

  it('una luz al otro lado del muro no alumbra lo que se ve, ni le llega a la pantalla', () => {
    const view = visibleForParty({
      ...scene({ darkness: 1, lights: [light('fuera', 300, 100, { dim: 150 })] }),
      tokens: [ana],
      manualFog: []
    })
    expect(roomB(view.visible)).toBe(0)
    expect(view.litPolygons).toEqual([])
  })

  it('con poca oscuridad, la luz ambiental basta; las luces apagadas en la campaña no cuentan', () => {
    expect(roomA(visibleForParty({ ...scene({ darkness: 0.7 }), tokens: [ana], manualFog: [] }).visible)).toBe(400)
    const off = visibleForParty({
      ...scene({ darkness: 1, lights: [light('antorcha', 50, 50)], lightsOff: new Set(['antorcha']) }),
      tokens: [ana],
      manualFog: []
    })
    expect(off.litPolygons).toEqual([])
    expect(roomA(off.visible)).toBeLessThan(20)
  })

  it('la oscuridad mágica tapa la vista y la visión en la oscuridad; la vista verdadera ve a través', () => {
    // Una zona de oscuridad en mitad de la sala A, entre Ana (a la izquierda) y el fondo
    const darkness = light('oscuridad', 120, 100, { dim: 30, bright: 0, darkness: true })
    const left = { ...ana, x: 30, y: 100 }
    const behind = (g: FogGrid) => seenIn(g, 16, 19, 9, 10)
    const normal = visibleForParty({ ...scene({ lights: [darkness] }), tokens: [left], manualFog: [] })
    expect(behind(normal.visible)).toBe(0)
    expect(seenIn(normal.visible, 11, 12, 9, 10)).toBe(0)
    const eyes = visibleForParty({
      ...scene({ lights: [darkness], darkness: 1 }),
      tokens: [{ ...left, senses: { darkvision: 300 } }],
      manualFog: []
    })
    expect(seenIn(eyes.visible, 11, 12, 9, 10)).toBe(0)
    const truesight = visibleForParty({
      ...scene({ lights: [darkness] }),
      tokens: [{ ...left, senses: { truesight: 120 } }],
      manualFog: []
    })
    expect(behind(truesight.visible)).toBe(8)
  })

  it('el grupo es la unión de sus fichas', () => {
    const bea: PartyToken = { id: 'bea', x: 300, y: 100 }
    const { visible, sights } = visibleForParty({ ...scene(), tokens: [ana, bea], manualFog: [] })
    expect(roomA(visible)).toBe(400)
    expect(roomB(visible)).toBe(400)
    expect(sights.map((s) => s.id)).toEqual(['ana', 'bea'])
  })
})

describe('la niebla a mano', () => {
  const reveal: FogOperation = { id: 'd', mode: 'reveal', shape: 'rectangle', x: 0, y: 200, width: 400, height: 100 }
  const cover: FogOperation = { id: 't', mode: 'cover', shape: 'rectangle', x: 0, y: 0, width: 100, height: 200 }

  it('lo destapado se ve aunque no lo vea nadie; lo tapado no, aunque lo vean', () => {
    const view = visibleForParty({ ...scene(), tokens: [ana], manualFog: [reveal, { ...cover, timestamp: 1 }] })
    expect(corridor(view.visible)).toBe(400)
    expect(roomA(view.visible)).toBe(200)
    expect(view.covered.count()).toBe(200)
    expect(view.revealed.count()).toBe(400)
  })

  it('lo que ven las fichas va aparte, sin lo destapado ni lo tapado a mano (lo que se suma a lo explorado)', () => {
    const view = visibleForParty({ ...scene(), tokens: [ana], manualFog: [reveal, { ...cover, timestamp: 1 }] })
    expect(corridor(view.sighted)).toBe(0)
    expect(roomA(view.sighted)).toBe(200)
    expect(roomB(view.sighted)).toBe(0)
    const blind = visibleForParty({ ...scene({ automatic: false }), tokens: [ana], manualFog: [reveal] })
    expect(blind.sighted.count()).toBe(0)
  })

  it('sin visión automática (como Foundry sin visión de fichas), se ve todo salvo lo tapado a mano', () => {
    const view = visibleForParty({ ...scene({ automatic: false }), tokens: [ana], manualFog: [reveal] })
    // Entero: sus dos salas y el pasillo
    expect(view.visible.count()).toBe(view.visible.empty().fill(true).count())
    expect(roomB(view.visible)).toBeGreaterThan(0)
    expect(view.sights).toEqual([])
    const covered = visibleForParty({ ...scene({ automatic: false }), tokens: [ana], manualFog: [cover] })
    expect(covered.visible.count()).toBeLessThan(view.visible.count())
  })
})

describe('las fichas que ve el grupo', () => {
  const others = [
    { id: 'orco', x: 150, y: 150 },
    { id: 'trasgo', x: 300, y: 100 },
    { id: 'grande', x: 210, y: 150, radius: 40 },
    { id: 'tapado', x: 50, y: 50 }
  ]
  const cover: FogOperation = { id: 't', mode: 'cover', shape: 'rectangle', x: 0, y: 0, width: 100, height: 100 }

  it('las que caen en lo visible por su centro o su borde; las tapadas a mano, no', () => {
    const view = visibleForParty({ ...scene(), tokens: [ana], manualFog: [cover] })
    expect(view.tokensSeen(others).map((t) => t.id)).toEqual(['orco', 'grande'])
  })

  it('el sentido sísmico nota las de su alcance a través de los muros, salvo las tapadas a mano', () => {
    const view = visibleForParty({
      ...scene(),
      tokens: [{ ...ana, senses: { tremorsense: 250 } }],
      manualFog: [cover]
    })
    expect(view.tokensSeen(others).map((t) => t.id)).toEqual(['orco', 'trasgo', 'grande'])
  })
})

describe('lo preparado de la escena', () => {
  it('se guarda y vale para cualquier grupo: lo mismo que calcularlo todo', () => {
    const lights = [light('antorcha', 50, 50), light('oscuridad', 300, 150, { darkness: true, dim: 30 })]
    const prepared = prepareVision(scene({ darkness: 1, lights }))
    expect(prepared.lit.map((l) => l.light.id)).toEqual(['antorcha'])
    expect(prepared.darknessCells.count()).toBeGreaterThan(20)
    const once = visibleForParty({ ...scene({ darkness: 1, lights }), tokens: [ana], manualFog: [] })
    expect(partyView(prepared, [ana], []).visible.words).toEqual(once.visible.words)
  })
})
