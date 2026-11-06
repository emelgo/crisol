import { describe, expect, it } from 'vitest'
import { creatureView, damageTaken, defensesOf, nextNumbers, startingPlay } from './creatures.ts'
import { fiveE } from './examples/5e/system.ts'
import type { ContentItem } from './file.ts'

const CHOICES = { sources: ['srd51'], duplicates: 'both' as const, language: 'es' as const, settings: {} }

/** Un goblin del 5e de ejemplo, con su cimitarra y su arco en su mecánica */
const goblin: ContentItem = {
  type: 'criatura',
  key: 'goblin',
  source: 'srd51',
  data: {
    name: { es: 'Goblin', en: 'Goblin' },
    tamano: 'pequena',
    tipo: { es: 'Humanoide', en: 'Humanoid' },
    vd: 0.25,
    ca: 15,
    pg_max: 7,
    dados_golpe: '2d6',
    velocidad: 30,
    caracteristicas: {
      fue: { puntuacion: 8 },
      des: { puntuacion: 14 },
      con: { puntuacion: 10 },
      int: { puntuacion: 10 },
      sab: { puntuacion: 8 },
      car: { puntuacion: 8 }
    },
    resistencias: ['fuego'],
    inmunidades: ['veneno']
  },
  mechanics: {
    actions: [
      {
        key: 'cimitarra',
        label: { es: 'Cimitarra', en: 'Scimitar' },
        activation: 'action',
        attack: '@competencia + @caracteristicas.des.mod',
        damage: [{ formula: '1d6 + @caracteristicas.des.mod', type: 'cortante' }]
      }
    ],
    resources: [{ key: 'grito', label: { es: 'Grito de guerra', en: 'War cry' }, max: '1', recovery: 'long' }]
  }
}

describe('las criaturas en juego (docs/specs/criaturas.md)', () => {
  it('su hoja: la entrada calculada, con su hoja de criatura, sus acciones y sus PG llenos', () => {
    const { view } = creatureView(fiveE, [goblin], CHOICES, goblin, {})
    expect(view.sheet).toMatchObject({ ca: 15, pg: { value: 7, max: 7 }, competencia: 2 })
    expect(view.layout[0]).toEqual({ kind: 'header' })
    expect(view.layout.some((b) => b.kind === 'resource' && b.field === 'pg')).toBe(true)
    expect(view.actions).toEqual([
      expect.objectContaining({ item: null, key: 'cimitarra', label: 'Cimitarra', bonus: 4, attack: '1d20+4' })
    ])
    expect(view.resources).toEqual([expect.objectContaining({ item: null, key: 'grito', max: 1 })])
  })

  it('lo de la partida encima: daño en sus PG, otro máximo y lo gastado', () => {
    const play = { values: { pg: { value: 3, temp: 0 } }, uses: { '': { grito: 1 } } }
    const { view } = creatureView(fiveE, [goblin], CHOICES, goblin, play, { pg: 12 })
    expect(view.sheet).toMatchObject({ pg: { value: 3, max: 12 } })
    expect(view.resources.find((r) => r.key === 'grito')).toMatchObject({ used: 1 })
  })

  it('los PG al ponerla en juego: los medios, o tirados con sus dados de golpe', () => {
    expect(startingPlay(fiveE, goblin, { hp: 'average' })).toEqual({ play: {}, overrides: {} })
    const sixes = (sides: number) => sides
    expect(startingPlay(fiveE, goblin, { hp: 'rolled', roller: sixes })).toEqual({
      play: {},
      overrides: { pg: 12 }
    })
    // Sin dados de golpe, por la media
    const { dados_golpe: _, ...data } = goblin.data
    expect(startingPlay(fiveE, { ...goblin, data }, { hp: 'rolled', roller: sixes })).toEqual({
      play: {},
      overrides: {}
    })
  })

  it('los números de las copias: siguen al mayor mientras haya copias; sin ninguna, desde el 1', () => {
    expect(nextNumbers([], 3)).toEqual([1, 2, 3])
    expect(nextNumbers([1, 2, 3], 2)).toEqual([4, 5])
    expect(nextNumbers([2], 1)).toEqual([3])
  })

  it('el daño: con su multiplicador y sus resistencias, inmunidades y vulnerabilidades, parte a parte', () => {
    const { view } = creatureView(fiveE, [goblin], CHOICES, goblin, {})
    const defenses = defensesOf(fiveE, 'criatura', view.sheet)
    expect(defenses).toEqual({ resist: ['fuego'], immune: ['veneno'], vulnerable: [] })
    expect(damageTaken([{ amount: 10, type: 'cortante' }], 1, defenses)).toBe(10)
    expect(damageTaken([{ amount: 10, type: 'fuego' }], 1, defenses)).toBe(5)
    expect(damageTaken([{ amount: 11, type: 'fuego' }], 0.5, defenses)).toBe(2)
    expect(damageTaken([{ amount: 10, type: 'veneno' }], 2, defenses)).toBe(0)
    expect(damageTaken([{ amount: 7, type: 'frio' }], 2, { ...defenses, vulnerable: ['frio'] })).toBe(28)
    expect(damageTaken([{ amount: 6, type: 'fuego' }, { amount: 4 }], 1, defenses)).toBe(7)
    expect(damageTaken([{ amount: 9 }], 0, defenses)).toBe(0)
    // Lo del mismo tipo, junto antes de redondear
    expect(
      damageTaken(
        [
          { amount: 7, type: 'frio' },
          { amount: 5, type: 'frio' }
        ],
        0.5,
        defenses
      )
    ).toBe(6)
  })
})
