import { describe, expect, it } from 'vitest'
import { fiveE } from './examples/index.ts'
import { type Play, playSchema, rechargeSpent, setRecharge, startTurn, type TurnAction } from './play.ts'
import { initiativeRoll } from './rolls.ts'
import { validateSystem } from './validate.ts'

const dragon: TurnAction[] = [
  { item: null, key: 'mordisco' },
  { item: null, key: 'aliento', recharge: '5-6' },
  { item: null, key: 'cola', activation: 'legendary', uses: 'legendarias' },
  { item: null, key: 'alas', activation: 'legendary', uses: 'legendarias' }
]

describe('empezar el turno (docs/specs/combate.md)', () => {
  it('una acción con recarga se gasta y se recarga, con su marca entre lo gastado', () => {
    const spent = setRecharge({}, null, 'aliento', true)
    expect(spent).toEqual({ uses: { '': { 'recarga:aliento': 1 } } })
    expect(rechargeSpent(spent, null, 'aliento')).toBe(true)
    expect(playSchema.safeParse(setRecharge({}, null, 'a'.repeat(60), true)).success).toBe(true)
    expect(setRecharge(spent, null, 'aliento', false)).toEqual({ uses: {} })
  })

  it('caducan los estados, se tira la recarga y se reponen las legendarias', () => {
    const play: Play = {
      conditions: [
        { id: 'a', name: 'Aturdido', rounds: 1 },
        { id: 'b', name: 'Bendecido', rounds: 3 }
      ],
      uses: { '': { 'recarga:aliento': 1, legendarias: 2, otra: 1 } }
    }
    const lucky = startTurn(play, dragon, () => 5)
    expect(lucky.expired.map((c) => c.name)).toEqual(['Aturdido'])
    expect(lucky.recharged).toEqual(['aliento'])
    expect(lucky.restored).toEqual(['legendarias'])
    expect(lucky.play).toEqual({ conditions: [{ id: 'b', name: 'Bendecido', rounds: 2 }], uses: { '': { otra: 1 } } })
    // Con un 4 no se recarga; sin nada gastado, no se tira
    const rolls: number[] = []
    const unlucky = startTurn(play, dragon, () => {
      rolls.push(4)
      return 4
    })
    expect(unlucky.recharged).toEqual([])
    expect(rechargeSpent(unlucky.play, null, 'aliento')).toBe(true)
    expect(startTurn({}, dragon, () => 6)).toEqual({ play: {}, expired: [], recharged: [], restored: [] })
    expect(rolls).toHaveLength(1)
  })
})

describe('la tirada de iniciativa de un sistema', () => {
  it('la que marca; si no marca ninguna, la que se llama así; una sola tirada', () => {
    expect(initiativeRoll(fiveE)).toBe('iniciativa')
    const { initiative: _, ...unmarked } = fiveE
    expect(initiativeRoll(unmarked)).toBe('iniciativa')
    expect(initiativeRoll({ rolls: { ini: { label: 'Ini', formula: '1d6' } }, initiative: 'ini' })).toBe('ini')
    expect(initiativeRoll({ rolls: { otra: { label: 'Otra', formula: '1d6' } } })).toBeNull()
    expect(initiativeRoll({})).toBeNull()
  })

  it('validar dice si la marcada no existe o va por cada campo', () => {
    const problems = (initiative: string) =>
      validateSystem({ ...fiveE, initiative }).problems.filter((p) => String(p.path).startsWith('initiative'))
    expect(problems('iniciativa')).toEqual([])
    expect(problems('no_hay')[0]?.message).toMatch(/No existe la tirada/)
    expect(problems('salvacion')[0]?.message).toMatch(/una sola tirada/)
  })
})
