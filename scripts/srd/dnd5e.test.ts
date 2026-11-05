import { afterEach, describe, expect, it } from 'vitest'
import { dnd5eActors, dnd5eItemMechanics, useDnd5eSource } from './dnd5e.ts'

/** Unos compendios de dnd5e de ejemplo, con la forma de los suyos */
const PACKS: Record<string, Record<string, unknown>> = {
  equipment24: {
    '!items!wand': {
      name: 'Wand of Fireballs',
      type: 'equipment',
      system: {
        uses: { max: '7', recovery: [{ period: 'dawn', type: 'formula', formula: '1d6 + 1' }] },
        activities: {
          a: {
            type: 'cast',
            activation: { type: 'action' },
            spell: { uuid: 'Compendium.dnd5e.spells24.Item.fireball', challenge: { save: 15, override: true } },
            consumption: { targets: [{ type: 'itemUses', value: '1' }] }
          }
        }
      }
    },
    '!items!staff': {
      name: 'Staff of Fire',
      type: 'equipment',
      system: {
        uses: { max: '10', recovery: [{ period: 'lr' }] },
        activities: {
          a: {
            type: 'cast',
            activation: { type: 'action' },
            spell: { uuid: 'Compendium.dnd5e.spells24.Item.fireball', challenge: { override: false } },
            consumption: { targets: [{ type: 'itemUses', value: '3' }] }
          },
          b: {
            type: 'damage',
            name: 'Blast',
            activation: { type: 'bonus' },
            damage: {
              parts: [
                { custom: { enabled: true, formula: '@item.level d6' } },
                { number: 2, denomination: 6, bonus: '2', types: ['cold'] }
              ]
            }
          }
        }
      }
    },
    '!items!potion': {
      name: 'Potion of Healing',
      type: 'consumable',
      system: {
        activities: {
          a: { type: 'heal', activation: { type: 'bonus' }, healing: { number: 2, denomination: 4, bonus: '2' } }
        }
      }
    }
  },
  spells24: {
    '!items!fireball': {
      name: 'Fireball',
      system: {
        activities: {
          a: {
            type: 'save',
            save: { ability: 'dex' },
            damage: { onSave: 'half', parts: [{ number: 8, denomination: 6, types: ['fire'] }] }
          }
        }
      }
    }
  },
  actors24: {
    '!actors!dragon': { name: 'Adult Red Dragon' },
    '!actors.items!dragon.breath': {
      name: 'Fire Breath',
      type: 'feat',
      system: {
        uses: { max: '1', recovery: [{ period: 'recharge', formula: '5' }] },
        activities: {
          a: { type: 'save', activation: { type: 'action' }, save: { ability: ['dex'] }, damage: { parts: [{}] } }
        }
      }
    },
    '!actors.items!dragon.rend': {
      name: 'Rend',
      type: 'weapon',
      system: { activities: { a: { type: 'attack', activation: { type: 'action' }, damage: { parts: [{}, {}] } } } }
    },
    '!actors.items!dragon.fireball': {
      name: 'Fireball',
      type: 'spell',
      system: { activities: { a: { type: 'save' } } }
    }
  }
}

let restore: (() => void) | null = null
afterEach(() => restore?.())

describe('lo que dnd5e dice que hace un objeto mágico', () => {
  it('lanzar un conjuro: su salvación y su daño (los del conjuro), su CD fija, sus cargas y lo que gasta', () => {
    restore = useDnd5eSource((pack) => PACKS[pack] ?? null)
    expect(dnd5eItemMechanics('2024', { es: 'Varita de bolas de fuego', en: 'Wand of Fireballs' })).toEqual({
      charges: {
        key: 'cargas',
        label: { es: 'Cargas', en: 'Charges' },
        max: '7',
        recovery: 'dawn',
        amount: '1d6+1'
      },
      actions: [
        {
          key: 'bola_de_fuego',
          label: { es: 'Bola de fuego', en: 'Fireball' },
          activation: 'action',
          save: { ability: 'des', dc: '15', success: 'half' },
          damage: [{ formula: '8d6', type: 'fuego' }],
          uses: 'cargas'
        }
      ]
    })
  })

  it('sin CD fija, la de conjuros de quien lo lleva; lo que gasta; sin sus fórmulas propias; una curación', () => {
    restore = useDnd5eSource((pack) => PACKS[pack] ?? null)
    const staff = dnd5eItemMechanics('2024', { es: 'Bastón de fuego', en: 'Staff of Fire' })
    expect(staff?.charges).toMatchObject({ max: '10', recovery: 'long' })
    expect(staff?.actions).toEqual([
      expect.objectContaining({
        save: { ability: 'des', dc: '@cd_conjuros', success: 'half' },
        uses: 'cargas',
        cost: 3
      }),
      expect.objectContaining({
        key: 'baston_de_fuego_blast',
        label: { es: 'Bastón de fuego: Blast', en: 'Staff of Fire: Blast' },
        activation: 'bonus',
        damage: [{ formula: '2d6 + 2', type: 'frio' }]
      })
    ])
    expect(dnd5eItemMechanics('2024', { es: 'Poción de curación', en: 'Potion of Healing' })?.actions).toEqual([
      {
        key: 'pocion_de_curacion',
        label: { es: 'Poción de curación', en: 'Potion of Healing' },
        activation: 'bonus',
        heal: '2d4 + 2'
      }
    ])
    expect(dnd5eItemMechanics('2024', { es: 'Nada', en: 'Nothing' })).toBeNull()
  })

  it('sin compendios exportados, nada', () => {
    restore = useDnd5eSource(() => null)
    expect(dnd5eItemMechanics('2014', { es: 'Varita', en: 'Wand of Fireballs' })).toBeNull()
    expect(dnd5eActors('2014').size).toBe(0)
  })
})

describe('las criaturas de dnd5e', () => {
  it('lo que hacen: sus ataques y salvaciones, con su recarga (sin los conjuros)', () => {
    restore = useDnd5eSource((pack) => PACKS[pack] ?? null)
    expect(dnd5eActors('2024').get('adult red dragon')?.actions).toEqual(
      expect.arrayContaining([
        {
          name: 'Fire Breath',
          activation: 'action',
          attack: false,
          save: 'dex',
          damage: 1,
          recharge: '5-6',
          perDay: null
        },
        { name: 'Rend', activation: 'action', attack: true, save: null, damage: 2, recharge: null, perDay: null }
      ])
    )
    expect(dnd5eActors('2024').get('adult red dragon')?.actions).toHaveLength(2)
  })
})
