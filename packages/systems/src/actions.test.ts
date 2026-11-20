import type { DieRoller } from '@crisol/dice'
import { describe, expect, it } from 'vitest'
import { actionsOf, prepareAction, tryAction } from './actions.ts'
import { type DocumentItem, evaluate } from './evaluate.ts'
import type { System } from './format.ts'
import type { Mechanics } from './mechanics.ts'
import { RollError, rollsOf, tryRoll } from './rolls.ts'
import { validateSystem } from './validate.ts'

/** Un dado trucado: da los valores en este orden */
const fixed = (...values: number[]): DieRoller => {
  let i = 0
  return () => values[i++ % values.length] ?? 1
}

/** Un personaje con armas, conjuros y objetos; las armas se tiran con las tiradas del sistema, por cada una */
const system = {
  format: 1,
  id: 'prueba',
  name: 'Prueba',
  version: '1',
  languages: ['es'],
  dice: { default: '1d20', critical: 'd20' },
  types: {
    personaje: {
      document: 'actor',
      label: 'Personaje',
      fields: {
        nivel: { kind: 'number', label: 'Nivel', default: 1 },
        fue: { kind: 'number', label: 'Fuerza', default: 16 },
        int: { kind: 'number', label: 'Inteligencia', default: 16 },
        fue_mod: { kind: 'derived', label: 'Mod. Fue', formula: 'floor((@fue - 10) / 2)' },
        int_mod: { kind: 'derived', label: 'Mod. Int', formula: 'floor((@int - 10) / 2)' },
        competencia: { kind: 'derived', label: 'Competencia', formula: 'ceil(@nivel / 4) + 1' },
        cd: { kind: 'derived', label: 'CD de conjuros', formula: '8 + @competencia + @int_mod' },
        ataque_conjuros: { kind: 'derived', label: 'Ataque de conjuros', formula: '@competencia + @int_mod' },
        lleva: { kind: 'items', label: 'Lleva', of: ['arma', 'conjuro', 'objeto'] }
      }
    },
    criatura: {
      document: 'actor',
      label: 'Criatura',
      fields: {
        fue: { kind: 'number', label: 'Fuerza', default: 10 },
        caracteristicas: {
          kind: 'set',
          label: 'Características',
          elements: [{ key: 'des', label: 'Destreza' }],
          fields: { valor: { kind: 'number', label: 'Valor', default: 10 } }
        }
      }
    },
    arma: {
      document: 'item',
      label: 'Arma',
      fields: {
        bono: { kind: 'number', label: 'Bono', default: 0 },
        dano: { kind: 'dice', label: 'Daño', default: '1d6' }
      }
    },
    conjuro: { document: 'item', label: 'Conjuro', fields: { nivel: { kind: 'number', label: 'Nivel', default: 0 } } },
    objeto: { document: 'item', label: 'Objeto', fields: { equipado: { kind: 'boolean', label: 'Equipado' } } }
  },
  rolls: {
    ataque: {
      label: 'Ataque',
      formula: '1d20 + @fue_mod + @competencia + @este.bono',
      for: { items: ['arma'] },
      modes: [{ key: 'ventaja', label: 'Con ventaja', from: '1d20', to: '2d20kh1' }]
    },
    dano: { label: 'Daño', formula: '@este.dano + @fue_mod + @este.bono', for: { items: ['arma'] } }
  }
} as unknown as System

const doc = (items: DocumentItem[], data: Record<string, unknown> = {}) => ({ data, items })
const arma = (id: string, name: string, data: Record<string, unknown>): DocumentItem => ({
  id,
  type: 'arma',
  name,
  data
})
const conjuro = (id: string, name: string, mechanics: Mechanics, nivel = 1): DocumentItem => ({
  id,
  type: 'conjuro',
  name,
  data: { nivel },
  mechanics
})

const espada = arma('espada', 'Espada larga', { bono: 1, dano: '1d8' })
const daga = arma('daga', 'Daga', { dano: '1d4' })
const bolaDeFuego = conjuro(
  'bola_de_fuego',
  'Bola de fuego',
  {
    actions: [
      {
        key: 'lanzar',
        label: 'Bola de fuego',
        activation: 'action',
        save: { ability: 'des', dc: '@cd', success: 'half' },
        damage: [{ formula: '8d6', type: 'fuego' }]
      }
    ],
    scaling: { mode: 'slot', base: 3, per: '1d6' }
  },
  3
)
const descarga = conjuro(
  'descarga_de_fuego',
  'Descarga de fuego',
  {
    actions: [
      {
        key: 'lanzar',
        label: 'Descarga de fuego',
        attack: '@ataque_conjuros',
        damage: [{ formula: '1d10', type: 'fuego' }]
      }
    ],
    scaling: {
      mode: 'level',
      by: '@nivel',
      at: [
        { level: 5, formula: '2d10' },
        { level: 11, formula: '3d10' },
        { level: 17, formula: '4d10' }
      ]
    }
  },
  0
)
const curar = conjuro('curar_heridas', 'Curar heridas', {
  actions: [{ key: 'lanzar', label: 'Curar heridas', heal: '1d8 + @int_mod' }],
  scaling: { mode: 'slot', base: 1, per: '1d8' }
})

describe('el sistema de prueba', () => {
  it('valida, con sus tiradas por cada arma', () => {
    expect(validateSystem(system).problems.filter((p) => p.severity === 'error')).toEqual([])
  })

  it('una tirada por objetos dice cada error: un tipo que no existe, uno que no es de objetos, un campo de @este', () => {
    const bad = structuredClone(system) as System
    bad.rolls = {
      a: { label: 'A', formula: '1d20', for: { items: ['nada'] } },
      b: { label: 'B', formula: '1d20', for: { items: ['personaje'] } },
      c: { label: 'C', formula: '1d20 + @este.nada', for: { items: ['arma'] } }
    } as never
    expect(validateSystem(bad).problems.map((p) => `${p.path}: ${p.message}`)).toEqual([
      'rolls.a.for.items[0]: No existe el tipo «nada»',
      'rolls.b.for.items[0]: «personaje» no es un tipo de objeto',
      'rolls.c.formula: «nada» no existe en «@este»'
    ])
  })
})

describe('los recursos de lo que lleva', () => {
  it('con su máximo (una fórmula de quien lo lleva), lo gastado, lo que queda y cómo se recupera', () => {
    const varita: DocumentItem = {
      id: 'varita',
      type: 'objeto',
      name: 'Varita',
      data: {},
      uses: { cargas: 2 },
      mechanics: {
        resources: [
          { key: 'cargas', label: 'Cargas', max: '7', recovery: 'dawn', amount: '1d6 + 1' },
          { key: 'usos', label: 'Usos', max: '@competencia', recovery: 'long' }
        ]
      }
    }
    expect(evaluate(system, 'personaje', doc([varita], { nivel: 5 })).resources).toEqual([
      { item: 'varita', key: 'cargas', label: 'Cargas', max: 7, used: 2, left: 5, recovery: 'dawn', amount: '1d6 + 1' },
      { item: 'varita', key: 'usos', label: 'Usos', max: 3, used: 0, left: 3, recovery: 'long' }
    ])
    // Más gastado que su máximo: no queda nada; un máximo que falla dice por qué
    const rota: DocumentItem = {
      ...varita,
      uses: { cargas: 9 },
      mechanics: {
        resources: [
          { key: 'cargas', label: 'Cargas', max: '7' },
          { key: 'x', label: 'X', max: '@nada' }
        ]
      }
    }
    const [cargas, x] = evaluate(system, 'personaje', doc([rota])).resources
    expect(cargas).toMatchObject({ used: 9, left: 0 })
    expect(x).toMatchObject({ max: 0, left: 0, error: expect.stringMatching(/nada/) })
  })
})

describe('las tiradas por cada objeto', () => {
  it('salen por cada arma que lleva, con @este como el arma', () => {
    const d = doc([espada, daga, bolaDeFuego])
    const ataque = rollsOf(system, 'personaje', 'es', d).find((r) => r.key === 'ataque')
    expect(ataque?.elements).toEqual([
      { key: 'espada', label: 'Espada larga' },
      { key: 'daga', label: 'Daga' }
    ])
    const r = tryRoll(system, 'personaje', d, 'ataque', { element: 'espada', roller: fixed(12) })
    expect(r).toMatchObject({ label: 'Ataque · Espada larga', total: 18 })
    expect(r.formula).toBe('1d20+3[Mod. Fue]+2[Competencia]+1[Espada larga]')
    expect(tryRoll(system, 'personaje', d, 'dano', { element: 'daga', roller: fixed(4) })).toMatchObject({
      formula: '1d4+3[Mod. Fue]+0[Daga]',
      total: 7
    })
    expect(
      tryRoll(system, 'personaje', d, 'ataque', { element: 'espada', mode: 'ventaja', roller: fixed(3, 15) }).total
    ).toBe(21)
  })

  it('si no lleva nada con lo que tirar, o se elige algo que no es de esos, lo dice', () => {
    expect(() => tryRoll(system, 'personaje', doc([]), 'ataque')).toThrow(new RollError('No lleva nada para «Ataque»'))
    expect(() =>
      tryRoll(system, 'personaje', doc([espada, daga, bolaDeFuego]), 'ataque', { element: 'bola_de_fuego' })
    ).toThrow('Elige con qué se tira: Espada larga, Daga')
  })
})

describe('las acciones de un documento', () => {
  it('Bola de fuego: su salvación con la CD de quien la lanza, y su daño a nivel 3 y a nivel 5', () => {
    const d = doc([bolaDeFuego], { nivel: 5 })
    const a3 = prepareAction(system, 'personaje', d, 'bola_de_fuego', 'lanzar')
    expect(a3).toMatchObject({
      label: 'Bola de fuego',
      level: 3,
      attack: null,
      save: { ability: 'des', dc: 14, success: 'half' }
    })
    expect(a3.damage.map((p) => [p.formula, p.type])).toEqual([['8d6', 'fuego']])
    expect(prepareAction(system, 'personaje', d, 'bola_de_fuego', 'lanzar', { level: 5 }).damage[0]?.formula).toBe(
      '10d6'
    )
    expect(() => prepareAction(system, 'personaje', d, 'bola_de_fuego', 'lanzar', { level: 2 })).toThrow(
      'Se tira a nivel 3 o más'
    )
    const rolled = tryAction(system, 'personaje', d, 'bola_de_fuego', 'lanzar', { level: 5, roller: fixed(3) })
    expect(rolled.damage[0]?.result.total).toBe(30)
  })

  it('un truco escala con el nivel de quien lo lanza; su ataque es el dado del sistema más su bono', () => {
    const at = (nivel: number) =>
      prepareAction(system, 'personaje', doc([descarga], { nivel }), 'descarga_de_fuego', 'lanzar')
    expect(at(1).damage[0]?.formula).toBe('1d10')
    expect(at(5).damage[0]?.formula).toBe('2d10')
    expect(at(16).damage[0]?.formula).toBe('3d10')
    expect(at(17).damage[0]?.formula).toBe('4d10')
    expect(at(1)).toMatchObject({ attack: '1d20+5', bonus: 5 })
    const rolled = tryAction(system, 'personaje', doc([descarga]), 'descarga_de_fuego', 'lanzar', {
      roller: fixed(10, 7)
    })
    expect(rolled.attack?.total).toBe(15)
    expect(rolled.damage[0]?.result.total).toBe(7)
  })

  it('la curación escala igual, con lo que suma quien la lanza', () => {
    const a = prepareAction(system, 'personaje', doc([curar]), 'curar_heridas', 'lanzar', { level: 3 })
    expect(a.heal?.formula).toBe('3d8+3')
  })

  it('un crítico dobla los dados del daño; las acciones de una criatura son suyas, sin objetos', () => {
    const dragon = {
      data: { fue: 23 },
      items: [],
      mechanics: {
        resources: [{ key: 'legendarias', label: 'Acciones legendarias', max: '3' }],
        actions: [
          {
            key: 'mordisco',
            label: 'Mordisco',
            attack: '11',
            damage: [
              { formula: '2d10 + 6', type: 'perforante' },
              { formula: '2d6', type: 'fuego' }
            ]
          },
          {
            key: 'aliento',
            label: 'Aliento de fuego',
            recharge: '5-6',
            save: { ability: 'des', dc: '21' },
            damage: [{ formula: '16d6', type: 'fuego' }]
          }
        ]
      } satisfies Mechanics
    }
    expect(prepareAction(system, 'criatura', dragon, null, 'aliento').save).toEqual({
      ability: 'des',
      abilityLabel: 'Destreza',
      dc: 21
    })
    const mordisco = prepareAction(system, 'criatura', dragon, null, 'mordisco', { critical: true })
    expect(mordisco.damage.map((p) => p.formula)).toEqual(['4d10+6', '4d6'])
    expect(actionsOf(system, 'criatura', dragon).map((a) => [a.item, a.key, a.bonus, a.save?.dc, a.recharge])).toEqual([
      [null, 'mordisco', 11, undefined, undefined],
      [null, 'aliento', null, 21, '5-6']
    ])
    expect(evaluate(system, 'criatura', dragon).resources).toEqual([
      { item: null, key: 'legendarias', label: 'Acciones legendarias', max: 3, used: 0, left: 3 }
    ])
  })

  it('el escalado suma números o fórmulas enteras; con daño, la curación no escala; el ataque, con un modo', () => {
    const raro = conjuro('raro', 'Raro', {
      actions: [
        { key: 'x', label: 'X', attack: '2', damage: [{ formula: '1d4 + 1' }, { formula: '2d6' }], heal: '1d4' }
      ],
      scaling: { mode: 'slot', base: 1, per: '1d8 + 1', parts: [0, 1] }
    })
    const a = prepareAction(system, 'personaje', doc([raro]), 'raro', 'x', { level: 2, mode: 'ventaja' })
    expect(a.damage.map((p) => p.formula)).toEqual(['1d4+1+1d8+1', '2d6+1d8+1'])
    expect(a.heal?.formula).toBe('1d4')
    expect(a.attack).toBe('2d20kh1+2')
    expect(() => prepareAction(system, 'personaje', doc([raro]), 'raro', 'x', { mode: 'nada' })).toThrow(
      'No existe el modo «nada»'
    )
    const suma = conjuro('suma', 'Suma', {
      actions: [{ key: 'x', label: 'X', damage: [{ formula: '3' }] }],
      scaling: { mode: 'slot', base: 1, per: '2' }
    })
    expect(prepareAction(system, 'personaje', doc([suma]), 'suma', 'x', { level: 3 }).damage[0]?.formula).toBe('3+4')
    const curada = tryAction(system, 'personaje', doc([curar]), 'curar_heridas', 'lanzar', {
      level: 2,
      roller: fixed(5)
    })
    expect(curada.heal?.result.total).toBe(13)
    expect(() => prepareAction(system, 'personaje', doc([curar]), 'nada', 'lanzar')).toThrow('No lleva «nada»')
    expect(() => prepareAction(system, 'personaje', doc([curar]), 'curar_heridas', 'nada')).toThrow(
      'No existe la acción «nada»'
    )
  })

  it('las acciones de todo lo que lleva, con lo que falla dicho y lo demás listo', () => {
    const roto = conjuro('roto', 'Roto', { actions: [{ key: 'x', label: 'X', attack: '@nada' }] })
    const list = actionsOf(system, 'personaje', doc([espada, bolaDeFuego, roto]))
    expect(list.map((a) => [a.item, a.key, a.error ?? null])).toEqual([
      ['bola_de_fuego', 'lanzar', null],
      ['roto', 'x', expect.stringMatching(/nada/)]
    ])
  })

  it('una acción con opciones (ADR-0033): cada una armada con lo suyo, y se tira la elegida', () => {
    const beholder = {
      data: {},
      items: [],
      mechanics: {
        actions: [
          {
            key: 'rayos',
            label: 'Rayos oculares',
            save: { ability: 'des', dc: '16' },
            count: 3,
            distinct: true,
            pick: '1d10',
            options: [
              { key: 'encanto', label: 'Rayo de encanto' },
              { key: 'enervante', label: 'Rayo enervante', damage: [{ formula: '4d8', type: 'necrotico' }] },
              {
                key: 'desintegrador',
                label: 'Rayo desintegrador',
                save: { ability: 'des', dc: '17' },
                damage: [{ formula: '10d6 + 40' }]
              }
            ]
          }
        ]
      } satisfies Mechanics
    }
    const shown = prepareAction(system, 'criatura', beholder, null, 'rayos')
    expect(shown).toMatchObject({ count: 3, distinct: true, pick: '1d10' })
    expect(shown.options?.map((o) => [o.key, o.save?.dc, o.damage.map((d) => d.formula)])).toEqual([
      ['encanto', 16, []],
      ['enervante', 16, ['4d8']],
      ['desintegrador', 17, ['10d6+40']]
    ])
    const rolled = tryAction(system, 'criatura', beholder, null, 'rayos', { option: 'enervante', roller: fixed(5) })
    expect(rolled.option).toEqual({ key: 'enervante', label: 'Rayo enervante' })
    expect(rolled.damage[0]?.result.total).toBe(20)
    expect(() => prepareAction(system, 'criatura', beholder, null, 'rayos', { option: 'no' })).toThrow(RollError)
  })

  it('un conjuro lanzado por una criatura (cast, ADR-0033): con su CD y su ataque, no los de la acción', () => {
    const spell = {
      id: 'conjuro-lanzado',
      type: 'objeto',
      name: 'Rayo',
      data: {},
      mechanics: {
        actions: [
          {
            key: 'lanzar',
            label: 'Rayo',
            attack: '@portador.no_existe',
            save: { ability: 'des', dc: '@portador.no_existe' }
          }
        ]
      } satisfies Mechanics
    }
    const doc = { data: {}, items: [spell] }
    const cast = prepareAction(system, 'criatura', doc, 'conjuro-lanzado', 'lanzar', { cast: { dc: 15, attack: 7 } })
    expect(cast.save?.dc).toBe(15)
    expect(cast.bonus).toBe(7)
    expect(() => prepareAction(system, 'criatura', doc, 'conjuro-lanzado', 'lanzar')).toThrow(RollError)
  })
})
