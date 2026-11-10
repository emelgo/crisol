/** Las escenas de Foundry a Crisol: escenas escritas a mano con la forma de cada versión, sin contenido de nadie */
import { describe, expect, it } from 'vitest'
import type { FoundryDocument } from './manifest.ts'
import { actorOrigins, convertFoundryScene, readAdventure } from './scene.ts'

/** Una escena de la v14 como la junta la lectura del zip: sus plantas, muros, luces, fichas y notas dentro */
function v14(changes: Record<string, unknown> = {}): FoundryDocument {
  return {
    _id: 'escena0000000001',
    name: 'Cripta',
    width: 1000,
    height: 800,
    padding: 0.25,
    shiftX: 50,
    shiftY: 0,
    grid: { type: 1, size: 100, distance: 5, units: 'ft', color: '#112233', alpha: 0.4 },
    initial: { x: 750, y: 600, scale: 0.8 },
    thumb: 'modules/cripta/thumbs/cripta.webp',
    tokenVision: true,
    environment: { darknessLevel: 0.5, globalLight: { enabled: false } },
    levels: [
      {
        _id: 'planta0000000001',
        name: 'Planta baja',
        sort: 0,
        background: { src: 'modules/cripta/maps/cripta.webp' }
      }
    ],
    walls: [
      { _id: 'm1', c: [400, 300, 900, 300], light: 20, move: 20, sight: 20, sound: 20, dir: 0, door: 0, ds: 0 },
      { _id: 'm2', c: [900, 300, 900, 700], door: 2, ds: 0, sight: 20, light: 20, move: 20, sound: 20 },
      { _id: 'm3', c: [400, 700, 900, 700], door: 1, ds: 2, sight: 10, light: 0, move: 20, sound: 30, dir: 1 },
      { _id: 'm4', c: [400, 300, 400, 700], door: 1, ds: 1, dir: 2 },
      { _id: 'm5', c: [1, 1, 1, 1] }
    ],
    lights: [
      {
        _id: 'l1',
        x: 550,
        y: 400,
        rotation: 0,
        walls: true,
        hidden: false,
        config: { bright: 10, dim: 20, angle: 90, color: '#ff8800', alpha: 0.3, darkness: { min: 0.4, max: 1 } }
      },
      { _id: 'l2', x: 600, y: 500, hidden: true, config: { bright: 0, dim: 15, negative: true } }
    ],
    tokens: [
      {
        _id: 'ficha00000000001',
        name: 'Jefe',
        actorId: 'actor00000000001',
        actorLink: true,
        x: 500,
        y: 400,
        width: 2,
        height: 2,
        disposition: -1,
        hidden: false,
        level: 'planta0000000001'
      },
      {
        _id: 'ficha00000000002',
        name: 'Goblin (1)',
        actorId: 'actor00000000002',
        actorLink: false,
        x: 700,
        y: 400,
        disposition: 0,
        hidden: true,
        delta: { system: { attributes: { hp: { value: 3 } } } }
      }
    ],
    notes: [{ _id: 'n1', x: 650, y: 650, text: 'Pista', entryId: 'diario0000000001', pageId: null }],
    regions: [
      { _id: 'r1', name: 'Cono', flags: { core: { MeasuredTemplate: true } } },
      { _id: 'r2', name: 'Terreno', behaviors: [{ type: 'modifyMovementCost' }] }
    ],
    tiles: [{ _id: 't1' }],
    drawings: [{ _id: 'd1' }],
    sounds: [{ _id: 's1' }],
    _stats: { coreVersion: '14.369' },
    ...changes
  }
}

describe('convertFoundryScene', () => {
  it('una de la v14: sin el margen ni el desplazamiento, con sus muros, puertas, luces, fichas y notas', () => {
    const [scene, ...rest] = convertFoundryScene(v14())
    expect(rest).toEqual([])
    if (!scene) throw new Error('sin escena')
    // El margen: 0,25 × 1000 = 250 → 3 casillas (300); menos el desplazamiento de 50 → la imagen empieza en 250, 200
    expect(scene).toMatchObject({
      id: 'escena0000000001',
      sourceId: 'escena0000000001',
      name: 'Cripta',
      level: null,
      background: 'modules/cripta/maps/cripta.webp',
      thumb: 'modules/cripta/thumbs/cripta.webp',
      width: 1000,
      height: 800,
      darkness: 0.5,
      automaticVision: true,
      initialView: { x: 500, y: 400, scale: 0.8 },
      coreVersion: 14,
      skipped: { regions: 1, tiles: 1, drawings: 1, sounds: 0, templates: 1 }
    })
    expect(scene.grid).toEqual({
      type: 'square',
      size: 100,
      offsetX: 50,
      offsetY: 0,
      distance: 5,
      units: 'pies',
      visible: true,
      color: '#112233',
      opacity: 0.4
    })
    expect(scene.walls).toEqual([
      {
        a: { x: 150, y: 100 },
        b: { x: 650, y: 100 },
        sight: 'full',
        light: 'full',
        move: 'full',
        sound: 'full',
        direction: 'both',
        door: null,
        locked: false,
        open: false
      },
      expect.objectContaining({ door: 'secret', locked: false, open: false }),
      // Limitado, nada y «de cerca» (limitado); de un sentido: Foundry 1 deja pasar por nuestra derecha
      expect.objectContaining({
        a: { x: 150, y: 500 },
        sight: 'limited',
        light: 'none',
        sound: 'limited',
        door: 'door',
        locked: true,
        open: false,
        direction: 'right'
      }),
      expect.objectContaining({ door: 'door', open: true, locked: false, direction: 'left' })
    ])
    expect(scene.lights).toEqual([
      {
        x: 300,
        y: 200,
        bright: 10,
        dim: 20,
        color: '#ff8800',
        intensity: 0.6,
        angle: 90,
        rotation: 180,
        walls: true,
        darkness: false,
        enabled: true,
        activeBelowAmbient: 0.6
      },
      expect.objectContaining({ x: 350, y: 300, darkness: true, enabled: false, color: '#ffe2a8', intensity: 1 })
    ])
    expect(scene.tokens).toEqual([
      {
        id: 'ficha00000000001',
        actorId: 'actor00000000001',
        name: 'Jefe',
        x: 350,
        y: 300,
        size: 2,
        hidden: false,
        faction: 'hostile',
        unique: true
      },
      expect.objectContaining({ x: 500, y: 250, size: 1, hidden: true, faction: 'neutral', unique: false })
    ])
    expect(scene.notes).toEqual([{ x: 400, y: 450, label: 'Pista', entryId: 'diario0000000001', pageId: null }])
  })

  it('una con dos plantas da dos escenas, cada una con lo suyo y su fondo', () => {
    const scenes = convertFoundryScene(
      v14({
        levels: [
          { _id: 'alta', name: 'Planta alta', sort: 1, background: { src: 'modules/cripta/maps/alta.webp' } },
          { _id: 'baja', name: 'Planta baja', sort: 0, background: { src: 'modules/cripta/maps/baja.webp' } }
        ],
        walls: [
          { _id: 'w1', c: [400, 300, 900, 300], levels: [] },
          { _id: 'w2', c: [400, 400, 900, 400], levels: ['alta'] }
        ],
        tokens: [{ _id: 'f1', actorId: 'a', x: 500, y: 400, level: 'baja' }],
        lights: [],
        notes: []
      })
    )
    expect(scenes.map((s) => [s.id, s.name, s.background, s.walls.length, s.tokens.length])).toEqual([
      ['escena0000000001.baja', 'Cripta · Planta baja', 'modules/cripta/maps/baja.webp', 1, 1],
      ['escena0000000001.alta', 'Cripta · Planta alta', 'modules/cripta/maps/alta.webp', 2, 0]
    ])
    expect(scenes[1]?.level).toEqual({ id: 'alta', name: 'Planta alta' })
  })

  it('una de la v13: el fondo y su desplazamiento sueltos, la oscuridad con la luz global, sin plantas', () => {
    const [scene] = convertFoundryScene(
      v14({
        levels: undefined,
        shiftX: undefined,
        background: { src: 'modules/cripta/maps/v13.webp', offsetX: 50, offsetY: 0 },
        foreground: 'modules/cripta/maps/techo.webp',
        environment: { darknessLevel: 0.8, globalLight: { enabled: true, darkness: { max: 0.9 } } },
        _stats: { coreVersion: '13.351' }
      })
    )
    expect(scene).toMatchObject({ background: 'modules/cripta/maps/v13.webp', darkness: 0, coreVersion: 13 })
    expect(scene?.walls[0]?.a).toEqual({ x: 150, y: 100 })
    expect(scene?.grid.offsetX).toBe(50)
  })

  it('una de la v10: la oscuridad suelta, la luz negativa por su luminosidad y sin visión de las fichas', () => {
    const [scene] = convertFoundryScene(
      v14({
        levels: undefined,
        shiftX: 0,
        padding: 0,
        environment: undefined,
        darkness: 0.7,
        globalLight: false,
        tokenVision: false,
        background: { src: 'modules/cripta/maps/v10.webp' },
        lights: [{ _id: 'l', x: 10, y: 20, config: { dim: 30, luminosity: -0.4 } }]
      })
    )
    expect(scene).toMatchObject({ darkness: 0.7, automaticVision: false, background: 'modules/cripta/maps/v10.webp' })
    expect(scene?.lights[0]).toMatchObject({ x: 10, y: 20, dim: 30, darkness: true })
    expect(scene?.walls[0]?.a).toEqual({ x: 400, y: 300 })
  })

  it('una de antes de la v10: la imagen, la rejilla en campos sueltos y la vista y la luz juntas', () => {
    const [scene] = convertFoundryScene({
      _id: 'vieja',
      name: 'Vieja',
      img: 'modules/cripta/maps/vieja.jpg',
      width: 1000,
      height: 1000,
      padding: 0,
      grid: 50,
      gridType: 1,
      gridDistance: 10,
      gridUnits: 'm',
      walls: [{ c: [0, 0, 100, 0], sense: 2, move: 1, sound: 0 }]
    })
    expect(scene).toMatchObject({ background: 'modules/cripta/maps/vieja.jpg', width: 1000 })
    expect(scene?.grid).toMatchObject({ type: 'square', size: 50, distance: 10, units: 'm' })
    expect(scene?.walls[0]).toMatchObject({ sight: 'limited', light: 'limited', move: 'full', sound: 'none' })
  })

  it('las cuatro hexagonales pasan a las dos nuestras con su desplazamiento', () => {
    const hex = (type: number) => convertFoundryScene(v14({ padding: 0, shiftX: 0, grid: { type, size: 140 } }))[0]
    expect([2, 3, 4, 5].map((type) => hex(type)?.grid).map((g) => [g?.type, g?.offsetX, g?.offsetY])).toEqual([
      ['hex-rows', 70, 0],
      ['hex-rows', 0, 0],
      ['hex-columns', 0, 70],
      ['hex-columns', 0, 0]
    ])
    // Con margen: 0,1 × 1400 cabe en una fila (impar) y la imagen empieza media casilla más a la derecha
    const padded = convertFoundryScene(
      v14({ width: 2000, height: 1000, padding: 0.1, shiftX: 0, grid: { type: 2, size: 140 } })
    )[0]
    expect(padded?.grid).toMatchObject({ type: 'hex-rows', offsetX: 0 })
    // La ficha de 2 casillas: su centro, un hexágono de ancho y de alto (2/√3 del lado) más allá de su esquina
    const sizeY = 280 / Math.sqrt(3)
    const token = convertFoundryScene(v14({ padding: 0, shiftX: 0, grid: { type: 2, size: 140 } }))[0]?.tokens[0]
    expect(token?.x).toBeCloseTo(500 + 140)
    expect(token?.y).toBeCloseTo(400 + sizeY)
  })

  it('los hexágonos de antes de la v10 cuentan su margen con el tamaño antiguo', () => {
    const [scene] = convertFoundryScene(
      v14({ padding: 0.1, shiftX: 0, grid: { type: 2, size: 100 }, flags: { core: { legacyHex: true } } })
    )
    // El tamaño antiguo: 100 × 2/√3 ≈ 115; 0,1 × 1000 = 100 → una casilla antigua
    expect(scene?.walls[0]?.a.x).toBe(400 - 115)
  })
})

describe('readAdventure y actorOrigins', () => {
  it('reparte lo que lleva una aventura', () => {
    const adventure = readAdventure({
      _id: 'aventura00000001',
      name: 'La cripta',
      img: 'modules/cripta/portada.webp',
      description: '<p>Una cripta</p>',
      caption: '<p>Corta</p>',
      scenes: [v14()],
      actors: [{ _id: 'actor00000000001', name: 'Jefe', type: 'npc' }],
      journal: [{ _id: 'diario0000000001', name: 'Diario', pages: [] }],
      folders: [{ _id: 'c1', name: 'Carpeta', type: 'JournalEntry', folder: null }, { name: 'sin id' }]
    })
    expect(adventure).toMatchObject({ id: 'aventura00000001', name: 'La cripta', description: '<p>Una cripta</p>' })
    expect(adventure.scenes.map((s) => s._id)).toEqual(['escena0000000001'])
    expect(adventure.actors.map((a) => a.name)).toEqual(['Jefe'])
    expect(adventure.folders).toEqual([{ _id: 'c1', name: 'Carpeta', type: 'JournalEntry', folder: null }])
  })

  it('el origen de un actor: su procedencia y, si no, cada paquete de actores', () => {
    const actor = { _id: 'x', _stats: { compendiumSource: 'Compendium.dnd5e.monsters.Actor.abc123' } }
    expect(actorOrigins(actor, 'x', ['bestias'])).toEqual(['monsters/abc123', 'bestias/x'])
    expect(actorOrigins(null, 'y', ['bestias', 'otros'])).toEqual(['bestias/y', 'otros/y'])
    const old = { _id: 'z', flags: { core: { sourceId: 'Compendium.mod.criaturas.zzz' } } }
    expect(actorOrigins(old, 'z', [])).toEqual(['criaturas/zzz'])
  })
})
