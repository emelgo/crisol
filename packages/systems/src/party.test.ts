import { describe, expect, it } from 'vitest'
import { fiveE } from './examples/5e/system.ts'
import { fronteras } from './fixtures/fronteras.ts'
import type { System } from './format.ts'
import {
  coinsOf,
  emptyParty,
  moveCoins,
  PARTY_CONTAINER,
  type Party,
  PartyError,
  partyFields,
  putInParty,
  putInPlay,
  splitCoins,
  takeFromParty,
  takeFromPlay,
  withCoins
} from './party.ts'

let n = 0
const newId = () => `id${++n}`
const pocion = { key: 'pocion_de_curacion', name: 'Poción de curación' }
const withPotions = (): Party => putInParty(emptyParty(), pocion, 3, PARTY_CONTAINER, () => 'p1')
const code = (fn: () => unknown) => {
  try {
    fn()
  } catch (error) {
    return error instanceof PartyError ? error.code : String(error)
  }
  return null
}

describe('el inventario del grupo (docs/specs/grupo.md)', () => {
  it('los campos del grupo: el inventario y las monedas que se cambian jugando; o los que dice party', () => {
    const five = partyFields(fiveE as System)
    expect(five.items).toEqual({ field: 'inventario', types: ['arma', 'armadura', 'equipo', 'objeto_magico'] })
    expect(five.coins?.field).toBe('monedas')
    expect(five.coins?.coins.map((c) => c.key)).toEqual(['pc', 'pp', 'pe', 'po', 'ppt'])
    // Sin monedas: el grupo no las tiene
    expect(partyFields(fronteras)).toEqual({ items: { field: 'lleva', types: ['objeto'] }, coins: null })
    // Lo que dice party manda, si existe y es de su clase
    const told = { ...fiveE, party: { items: 'armaduras', coins: 'carga' } } as System
    expect(partyFields(told).items?.field).toBe('armaduras')
    expect(partyFields(told).coins?.field).toBe('monedas')
  })

  it('poner en el grupo junta lo igual del mismo contenedor; con nota o a mano, aparte', () => {
    let party = withPotions()
    party = putInParty(party, pocion, 2, PARTY_CONTAINER, newId)
    expect(party.items).toEqual([{ id: 'p1', ...pocion, quantity: 5, container: PARTY_CONTAINER }])
    party = putInParty(party, { ...pocion, note: 'De la cripta' }, 1, PARTY_CONTAINER, () => 'p2')
    party = putInParty(party, { key: null, name: 'Llave de bronce' }, 1, PARTY_CONTAINER, () => 'p3')
    expect(party.items.map((i) => [i.id, i.quantity, i.note ?? null])).toEqual([
      ['p1', 5, null],
      ['p2', 1, 'De la cripta'],
      ['p3', 1, null]
    ])
    expect(code(() => putInParty(party, pocion, 1, 'carro', newId))).toBe('NO_CONTAINER')
    expect(code(() => putInParty(party, pocion, 0, PARTY_CONTAINER, newId))).toBe('BAD_QUANTITY')
  })

  it('del grupo a un personaje y de vuelta, parte o todo, sin duplicar', () => {
    const { party, taken } = takeFromParty(withPotions(), 'p1', 2)
    expect(party.items[0]?.quantity).toBe(1)
    let play = putInPlay({}, taken.key as string, taken.quantity, () => 'c1')
    expect(play.items).toEqual([{ id: 'c1', key: 'pocion_de_curacion', quantity: 2 }])
    // Lo que entra se junta con lo igual que no lleva equipado ni gastado
    play = putInPlay(play, 'pocion_de_curacion', 1, newId)
    expect(play.items).toEqual([{ id: 'c1', key: 'pocion_de_curacion', quantity: 3 }])
    // Todo de vuelta: deja de llevarlo y sus usos se van
    const used = { ...play, uses: { c1: { cargas: 1 } }, active: ['c1'] }
    const back = takeFromPlay(used, 'c1', 3)
    expect(back.play).toEqual({ items: [], uses: {}, active: [] })
    expect(back.taken.quantity).toBe(3)
    expect(code(() => takeFromParty(party, 'p1', 2))).toBe('NOT_ENOUGH')
    expect(code(() => takeFromPlay(play, 'otro', 1))).toBe('NOT_CARRIED')
  })

  it('las monedas: pasar sin quedar en negativo, y repartir a partes iguales (lo que sobra, al grupo)', () => {
    const coins = ['pc', 'pp', 'po']
    const moved = moveCoins({ po: 100, pp: 3 }, { po: 5 }, { po: 40, pp: 0 }, coins)
    expect(moved).toEqual({ from: { po: 60, pp: 3 }, to: { po: 45 } })
    expect(code(() => moveCoins({ po: 1 }, {}, { po: 2 }, coins))).toBe('NOT_ENOUGH')
    expect(code(() => moveCoins({ po: 1 }, {}, { po: -1 }, coins))).toBe('BAD_QUANTITY')
    expect(code(() => moveCoins({ oro: 1 }, {}, { oro: 1 }, coins))).toBe('NO_COIN')
    expect(splitCoins({ po: 100, pp: 7, pc: 0 }, 3)).toEqual({ each: { po: 33, pp: 2 }, left: { po: 1, pp: 1 } })
    expect(code(() => splitCoins({ po: 1 }, 0))).toBe('NO_ONE')
    // Las de un personaje, en su grupo de monedas
    const play = withCoins({ values: { monedas: { po: 2, pp: 1 } } }, 'monedas', { po: 12 })
    expect(coinsOf(play, 'monedas')).toEqual({ po: 12, pp: 1 })
  })
})
