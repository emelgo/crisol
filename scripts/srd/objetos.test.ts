import { describe, expect, it } from 'vitest'
import { concepts, pair, sameName } from './equipo.ts'
import { MECHANICS } from './mecanica.ts'
import {
  categoryOf,
  displayName,
  entries,
  type GearRow,
  gearDoc,
  gearRows,
  gearSignature,
  runInTexts,
  subTables,
  toolRows
} from './objetos.ts'
import { GEAR_RENAMES } from './pares.ts'
import type { Row } from './texto.ts'

const row = (text: string, x = 58, y = 0, page = 69): Row => ({ text, x, y, h: 10, page })

describe('el equipo de aventurero', () => {
  it('los objetos de una columna: los de un grupo, sangrados; el título de la tabla; un nombre que sigue abajo', () => {
    const state = { table: 'gear' }
    const rows = gearRows(
      [
        row('Abacus 2 gp 2 lb.'),
        row('Ammunition'),
        row('Arrows (20) 1 gp 1 lb.', 67),
        row('Crossbow bolts (20) 1 gp 1½ lb.', 67),
        row('Antitoxin (vial) 50 gp —'),
        row('Tools'),
        row('Artisan’s tools'),
        row('Disguise kit 25 gp 3 lb.', 67)
      ],
      '2014',
      'en',
      state
    )
    expect(rows.map((r) => [r.name, r.table, r.group, r.cost, r.weight])).toEqual([
      ['Abacus', 'gear', null, 2, 2],
      ['Arrows (20)', 'gear', 'Ammunition', 1, 1],
      ['Crossbow bolts (20)', 'gear', 'Ammunition', 1, 1.5],
      ['Antitoxin (vial)', 'gear', null, 50, null],
      // El PDF lo sangra como de un grupo, y no lo es
      ['Disguise kit', 'tools', null, 25, 3]
    ])
    expect(state.table).toBe('tools')
    const es = gearRows(
      [
        row('Paquete de explorador de 27,5 kg 12 po', 58, 100),
        row('mazmorras', 58, 110),
        row('Pergamino — 1 pp', 58, 120)
      ],
      '2024',
      'es'
    )
    expect(es.map((r) => [r.name, r.weight, r.cost])).toEqual([
      ['Paquete de explorador de mazmorras', 55, 12],
      ['Pergamino', null, 0.1]
    ])
  })

  it('su categoría, su nombre a la vista y su firma', () => {
    const r = (name: string, extra: Partial<GearRow> = {}): GearRow => ({
      name,
      table: 'gear',
      group: null,
      cost: 1,
      weight: 1,
      page: 1,
      ...extra
    })
    expect(categoryOf(r('Crystal', { group: 'Arcane focus' }))).toBe('canalizador_arcano')
    expect(categoryOf(r('Burglar’s Pack'))).toBe('paquete')
    expect(categoryOf(r('Lute', { table: 'tools', group: 'Musical instrument' }))).toBe('instrumento')
    expect(categoryOf(r('Thieves’ tools', { table: 'tools' }))).toBe('herramienta')
    expect(displayName(r('Cristal', { group: 'Canalizadores arcanos' }), 'es')).toBe('Cristal (canalizador arcano)')
    expect(displayName(r('Rope'), 'en')).toBe('Rope')
    expect(gearSignature(r('Rope', { cost: 1, weight: 5 }))).toBe('aventura|1|5')
  })

  it('lo de 2014 con lo de 2024: sin lo de entre paréntesis y con sus cambios de nombre', () => {
    expect(sameName('Acid (vial)')).toBe('acid')
    expect(sameName('Rope, hempen (50 feet)', GEAR_RENAMES)).toBe('rope')
    expect(sameName('Spikes, iron (10)')).toBe(sameName('Spikes, Iron'))
    const r = (name: string): GearRow => ({ name, table: 'gear', group: null, cost: 1, weight: 1, page: 1 })
    const c = concepts(
      [[r('Rope'), r('Cuerda')]],
      [[r('Rope, hempen (50 feet)'), r('Cuerda de cáñamo (15 m)')]],
      GEAR_RENAMES
    )
    expect(c.older).toEqual(['cuerda'])
    expect(() => pair([r('A')], [r('B'), r('C')], gearSignature)).toThrow('casa con 2')
  })

  it('un objeto como documento del 5e, con la mecánica escrita a mano si la tiene', () => {
    const potion: GearRow = { name: 'Potion of Healing', table: 'gear', group: null, cost: 50, weight: 0.5, page: 95 }
    const doc = gearDoc(
      '2024',
      potion,
      { ...potion, name: 'Poción de curación', page: 103 },
      'pocion_de_curacion',
      MECHANICS.pocion_de_curacion_2024
    )
    expect(doc).toMatchObject({
      type: 'equipo',
      key: 'pocion_de_curacion_2024',
      data: {
        name: { es: 'Poción de curación', en: 'Potion of Healing' },
        categoria: 'aventura',
        peso: 0.5,
        coste: 50
      },
      mechanics: { actions: [{ activation: 'bonus', heal: '2d4 + 2' }], automation: 'full' },
      ref: { pages: { en: 95, es: 103 } }
    })
    expect(gearDoc('2014', potion, potion, 'x').mechanics).toEqual({ automation: 'text' })
  })
})

describe('lo de 2024 que va en el texto', () => {
  const r = (text: string, y: number, x = 58, page = 96): Row => ({ text, x, y, h: 10, page })

  it('las tablas pequeñas: su grupo es su título; un nombre que sigue abajo; acaban con el texto', () => {
    const rows = subTables(
      [
        r('Munición', 0),
        r('Tipo Cantidad Recipiente Peso Precio', 10),
        r('Balas de 10 Bolsa 1 kg 3 po', 20),
        r('arma de', 30),
        r('fuego', 40),
        r('Flechas 20 Aljaba 0,5 kg 1 po', 50),
        r('Un texto que ya no es de la tabla.', 70),
        r('Canalizadores arcanos', 90),
        r('Canalizador Peso Precio', 100),
        r('Bastón de madera (también bastón) 2 kg 5 po', 110)
      ],
      'es'
    )
    expect(rows.map((x) => [x.group, x.name, x.cost, x.weight])).toEqual([
      ['Munición', 'Balas de arma de fuego (10)', 3, 2],
      ['Munición', 'Flechas (20)', 1, 1],
      ['Canalizadores arcanos', 'Bastón de madera', 5, 4]
    ])
  })

  it('las entradas: cada una con su texto; un título partido antes de su precio; las secciones', () => {
    const found = entries(
      [
        r('Herramientas de artesano', 0),
        r('Herramientas de soplador de vidrio', 10),
        r('(30 po)', 20),
        r('Característica: Inteligencia Peso: 2,5 kg', 30),
        r('Utilizar: distinguir lo que ha contenido un objeto de vi-', 40),
        r('drio (CD 15)', 50),
        r('Otras herramientas', 60),
        r('Juego (variable)', 70),
        r('Característica: Sabiduría Peso: —', 80),
        r('Variantes: dados (1 pp), naipes (5 pp)', 90)
      ],
      'es',
      /^(Herramientas de artesano|Otras herramientas)$/
    )
    expect(found.map((e) => [e.section, e.name, e.cost])).toEqual([
      ['Herramientas de artesano', 'Herramientas de soplador de vidrio', 30],
      ['Otras herramientas', 'Juego', null]
    ])
    expect(found[0]?.text).toBe(
      'Característica: Inteligencia Peso: 2,5 kg\nUtilizar: distinguir lo que ha contenido un objeto de vidrio (CD 15)'
    )
    const tools = toolRows(found, 'es')
    expect(tools.map((t) => [t.name, t.group, t.cost, t.weight, t.ability])).toEqual([
      ['Herramientas de soplador de vidrio', 'Artisan’s Tools', 30, 5, 'int'],
      ['Dados', 'Gaming Set', 0.1, null, 'sab'],
      ['Naipes', 'Gaming Set', 0.5, null, 'sab']
    ])
  })
})

describe('los textos de 2014 que empiezan con su nombre', () => {
  it('de cada nombre conocido, hasta el siguiente o hasta un título que corta', () => {
    const rows = [
      'Acid. As an action, you can splash',
      'the contents of this vial.',
      'Ball Bearings. As an action, you',
      'can spill these.',
      'Mounts and Vehicles',
      'A good mount helps.'
    ].map((text, i): Row => ({ text, x: 58, y: i * 10, h: 10, page: 66 }))
    const texts = runInTexts(rows, ['Acid', 'Ball bearings'], /^Mounts and Vehicles$/)
    expect([...texts]).toEqual([
      ['acid', 'As an action, you can splash the contents of this vial.'],
      ['ball bearings', 'As an action, you can spill these.']
    ])
  })
})
