import { describe, expect, it } from 'vitest'
import { concepts, pair, sameName } from './equipo.ts'
import { MECHANICS } from './mecanica.ts'
import { categoryOf, displayName, type GearRow, gearDoc, gearRows, gearSignature } from './objetos.ts'
import { GEAR_RENAMES } from './pares.ts'
import type { Row } from './texto.ts'

const row = (text: string, x = 58, y = 0, page = 69): Row => ({ text, x, y, page })

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
