import { describe, expect, it } from 'vitest'
import { type DocumentItem, evaluate } from './evaluate.ts'
import type { System } from './format.ts'
import type { Mechanics } from './mechanics.ts'

/** Un personaje con unas características, una CA calculada y unas resistencias; objetos que se equipan y sintonizan */
const system = {
  format: 1,
  id: 'prueba',
  name: 'Prueba',
  version: '1',
  languages: ['es'],
  types: {
    personaje: {
      document: 'actor',
      label: 'Personaje',
      fields: {
        fue: { kind: 'number', label: 'Fuerza', default: 10 },
        des: { kind: 'number', label: 'Destreza', default: 14 },
        sab: { kind: 'number', label: 'Sabiduría', default: 16 },
        des_mod: { kind: 'derived', label: 'Mod. Des', formula: 'floor((@des - 10) / 2)' },
        sab_mod: { kind: 'derived', label: 'Mod. Sab', formula: 'floor((@sab - 10) / 2)' },
        ca: { kind: 'derived', label: 'CA', formula: '10 + @des_mod' },
        resistencias: { kind: 'list', label: 'Resistencias' },
        competencia: { kind: 'number', label: 'Competencia', default: 2 },
        habilidades: {
          kind: 'set',
          label: 'Habilidades',
          elements: [{ key: 'sigilo', label: 'Sigilo' }],
          fields: {
            grado: { kind: 'number', label: 'Grado', default: 0 },
            total: { kind: 'derived', label: 'Total', formula: '@des_mod + floor(@este.grado * @competencia)' }
          }
        },
        lleva: { kind: 'items', label: 'Lleva', of: ['objeto'] }
      }
    },
    objeto: {
      document: 'item',
      label: 'Objeto',
      fields: {
        equipado: { kind: 'boolean', label: 'Equipado' },
        sintonizado: { kind: 'boolean', label: 'Sintonizado' },
        activo: { kind: 'boolean', label: 'Activo' }
      }
    }
  },
  rolls: { salvacion: { label: 'Salvación', formula: '1d20 + @des_mod' } },
  settings: { variante: { kind: 'boolean', label: 'Variante', default: false } }
} as unknown as System

const thing = (name: string, mechanics: Mechanics, data: Record<string, unknown> = { equipado: true }): DocumentItem =>
  ({
    id: name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_'),
    type: 'objeto',
    name,
    data,
    mechanics
  }) as DocumentItem

const ca = (items: DocumentItem[], data: Record<string, unknown> = {}) =>
  evaluate(system, 'personaje', { data, items }).computed.ca

describe('los efectos de lo que lleva', () => {
  it('sumar, si se cumple su condición; con su origen en el desglose', () => {
    const anillo = (sintonizado: boolean) =>
      thing(
        'Anillo de protección',
        { effects: [{ target: 'ca', op: 'add', value: '1', when: '@este.sintonizado' }] },
        { sintonizado }
      )
    expect(ca([anillo(true)])).toMatchObject({ value: 13 })
    expect(ca([anillo(true)])?.terms.at(-1)).toEqual({
      label: 'Anillo de protección',
      value: 1,
      kind: 'bonus',
      origin: 'anillo_de_proteccion'
    })
    expect(ca([anillo(false)])?.value).toBe(12)
  })

  it('la base: gana la mayor (la armadura, Defensa sin armadura o lo de siempre)', () => {
    const cota = thing('Cota de malla', {
      effects: [{ target: 'ca', op: 'base', value: '16', when: '@este.equipado' }]
    })
    const sinArmadura = thing('Defensa sin armadura', {
      effects: [{ target: 'ca', op: 'base', value: '10 + @des_mod + @sab_mod' }]
    })
    expect(ca([cota])?.value).toBe(16)
    expect(ca([cota])?.terms).toEqual([{ label: 'Cota de malla', value: 16, kind: 'base', origin: 'cota_de_malla' }])
    expect(ca([sinArmadura])?.value).toBe(15)
    expect(ca([sinArmadura])?.terms.map((t) => t.label)).toEqual(['Defensa sin armadura', 'Mod. Des', 'Mod. Sab'])
    expect(ca([cota, sinArmadura])?.value).toBe(16)
    // Con armadura, la suya, aunque la de siempre dé más (una cota de anillas con Des 20)
    const anillas = thing('Cota de anillas', { effects: [{ target: 'ca', op: 'base', value: '14' }] })
    expect(evaluate(system, 'personaje', { data: { des: 20 }, items: [anillas] }).computed.ca?.value).toBe(14)
    expect(
      ca([
        thing(
          'Cota de malla',
          { effects: [{ target: 'ca', op: 'base', value: '16', when: '@este.equipado' }] },
          { equipado: false }
        )
      ])?.value
    ).toBe(12)
  })

  it('en su orden: base, fijar, sumar, mínimo y máximo', () => {
    const fija = thing('Fija', { effects: [{ target: 'ca', op: 'set', value: '18' }] })
    const suma = thing('Suma', { effects: [{ target: 'ca', op: 'add', value: '1' }] })
    expect(ca([suma, fija])?.value).toBe(19)
    const tope = thing('Tope', { effects: [{ target: 'ca', op: 'max', value: '15' }] })
    expect(ca([fija, suma, tope])?.value).toBe(15)
    const cinturon = thing('Cinturón', { effects: [{ target: 'fue', op: 'min', value: '21' }] })
    const r = evaluate(system, 'personaje', { data: { fue: 12 }, items: [cinturon] })
    expect(r.values.fue).toBe(21)
    expect(evaluate(system, 'personaje', { data: { fue: 24 }, items: [cinturon] }).values.fue).toBe(24)
  })

  it('el grado de competencia es un mínimo en su grado: competente, pericia o media', () => {
    const grado = (value: string) =>
      evaluate(system, 'personaje', {
        data: {},
        items: [thing('Rasgo', { effects: [{ target: 'habilidades.sigilo.grado', op: 'min', value }] })]
      }).values.habilidades as Record<string, { grado: number; total: number }>
    expect(grado('1').sigilo).toMatchObject({ grado: 1, total: 4 })
    expect(grado('2').sigilo).toMatchObject({ grado: 2, total: 6 })
    expect(grado('0.5').sigilo).toMatchObject({ grado: 0.5, total: 3 })
  })

  it('añadir a una lista y anotar la ventaja para su tirada', () => {
    const anillo = thing('Anillo de resistencia', {
      effects: [
        { target: 'resistencias', op: 'append', value: '"fuego"' },
        { target: 'salvacion', op: 'advantage', when: '@este.equipado' }
      ]
    })
    const r = evaluate(system, 'personaje', { data: { resistencias: ['frío'] }, items: [anillo] })
    expect(r.values.resistencias).toEqual(['frío', 'fuego'])
    const roto = thing('Roto', { effects: [{ target: 'resistencias', op: 'append', value: '@nada' }] })
    const r2 = evaluate(system, 'personaje', { data: { resistencias: ['frío'] }, items: [roto, anillo] })
    expect(r2.values.resistencias).toEqual(['frío', 'fuego'])
    expect(r2.problems[0]?.message).toMatch(/Lo que añade «Roto» no se pudo calcular/)
    expect(r.advantages).toEqual({
      salvacion: [{ mode: 'advantage', label: 'Anillo de resistencia', origin: 'anillo_de_resistencia' }]
    })
  })

  it('un estado que se activa; los ajustes de la campaña en la condición', () => {
    const furia = thing(
      'Furia',
      { effects: [{ target: 'ca', op: 'add', value: '2', when: '@este.activo && @ajustes.variante' }], toggle: {} },
      { activo: true }
    )
    expect(ca([furia])?.value).toBe(12)
    expect(
      evaluate(system, 'personaje', { data: {}, items: [furia] }, { settings: { variante: true } }).computed.ca?.value
    ).toBe(14)
  })

  it('un efecto que depende de su propio destino dice el error y lo demás sigue', () => {
    const raro = thing('Raro', { effects: [{ target: 'ca', op: 'add', value: '@ca' }] })
    const r = evaluate(system, 'personaje', { data: {}, items: [raro] })
    expect(r.computed.ca?.error).toMatch(/depende de su propio valor/)
    expect(r.values.des).toBe(14)
    // En un número guardado, igual; una ventaja cuya condición falla no se anota
    const otro = thing('Otro', {
      effects: [
        { target: 'fue', op: 'add', value: '@fue' },
        { target: 'salvacion', op: 'advantage', when: '@nada' }
      ]
    })
    const r2 = evaluate(system, 'personaje', { data: {}, items: [otro] })
    expect(r2.computed.fue).toMatchObject({ value: 10, error: expect.stringMatching(/depende de su propio valor/) })
    expect(r2.advantages).toEqual({})
  })
})
