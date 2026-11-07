// Portado de packages/mesa/src/nucleo/iniciativa.test.ts (Crisol actual, commit 3f68f11)
import { describe, expect, it } from 'vitest'
import { type Combatant, initiativeOrder, passTurn, type TurnState, turnAfterRemoval, turnSlots } from './initiative.ts'

type Named = Combatant & { name: string }

const c = (name: string, initiative: number | null, more: Partial<Combatant> = {}): Named => ({
  id: name,
  name,
  initiative,
  modifier: null,
  group: null,
  sort: null,
  defeated: false,
  ...more
})
const names = (list: readonly Named[]) => list.map((x) => x.name)
const state = (round: number, turn: string | null, skipDefeated = true): TurnState => ({ round, turn, skipDefeated })

describe('iniciativa', () => {
  it('de mayor a menor; los empates por el modificador, luego a mano y luego como estaban; sin tirar, al final', () => {
    const list = [
      c('Lía', 12, { modifier: 3 }),
      c('Thora', null),
      c('Orco', 18),
      c('Bruma', 12, { modifier: 1 }),
      c('Kael', 12, { modifier: 3, sort: 0 }),
      c('Nim', 12, { modifier: 3, sort: 1 })
    ]
    expect(names(initiativeOrder(list))).toEqual(['Orco', 'Kael', 'Nim', 'Lía', 'Bruma', 'Thora'])
  })

  it('un grupo va junto, donde cae el primero de los suyos, y tiene un solo turno', () => {
    const list = [
      c('G1', 10, { group: 'goblin' }),
      c('Lía', 15),
      c('G2', 10, { group: 'goblin' }),
      c('Jefe', 12),
      c('G3', 16, { group: 'goblin' })
    ]
    expect(names(initiativeOrder(list))).toEqual(['G3', 'G1', 'G2', 'Lía', 'Jefe'])
    expect(turnSlots(list).map((s) => names(s.members))).toEqual([['G3', 'G1', 'G2'], ['Lía'], ['Jefe']])
  })

  it('el siguiente empieza la ronda 1; al dar la vuelta cambia la ronda; el anterior vuelve atrás', () => {
    const list = [c('A', 20), c('B', 15), c('C', 10)]
    let now = state(0, null)
    const turn = (step: 1 | -1) => {
      const change = passTurn(list, now, step)
      now = { ...now, round: change.round, turn: change.turn }
      return change
    }
    expect(turn(1)).toMatchObject({ round: 1, turn: 'A', started: { key: 'A' } })
    turn(1)
    turn(1)
    expect(turn(1)).toMatchObject({ round: 2, turn: 'A' })
    expect(turn(-1)).toMatchObject({ round: 1, turn: 'C', started: null })
    turn(-1)
    turn(-1)
    expect(now).toMatchObject({ round: 1, turn: 'A' })
    // Antes del primer turno no se vuelve; ni antes de empezar
    expect(passTurn(list, now, -1)).toEqual({ round: 1, turn: 'A', started: null })
    expect(passTurn(list, state(0, null), -1)).toEqual({ round: 0, turn: null, started: null })
    expect(passTurn([], state(1, null), 1)).toEqual({ round: 1, turn: null, started: null })
  })

  it('salta los turnos fuera de combate si se pide (un grupo, solo si lo están todos)', () => {
    const list = [
      c('A', 20),
      c('B', 15, { defeated: true }),
      c('G1', 12, { group: 'g', defeated: true }),
      c('G2', 12, { group: 'g' }),
      c('C', 10, { defeated: true })
    ]
    expect(passTurn(list, state(1, 'A'), 1)).toMatchObject({ round: 1, turn: 'G1' })
    expect(passTurn(list, state(1, 'G1'), 1)).toMatchObject({ round: 2, turn: 'A' })
    expect(passTurn(list, state(2, 'A'), -1)).toMatchObject({ round: 1, turn: 'G1' })
    expect(passTurn(list, state(1, 'A', false), 1)).toMatchObject({ round: 1, turn: 'B' })
    // Todos fuera de combate: no salta
    const down = [c('X', 5, { defeated: true }), c('Y', 3, { defeated: true })]
    expect(passTurn(down, state(1, 'X'), 1)).toMatchObject({ round: 1, turn: 'Y' })
  })

  it('el turno sigue con quien lo tenía aunque cambie el orden', () => {
    const before = [c('A', 20), c('B', 15), c('C', 10)]
    const after = [c('A', 5), c('B', 15), c('C', 10)]
    expect(passTurn(before, state(1, 'B'), 1).turn).toBe('C')
    expect(passTurn(after, state(1, 'B'), 1).turn).toBe('C')
    expect(passTurn(after, state(1, 'C'), 1).turn).toBe('A')
  })

  it('quitar a quien tiene el turno lo pasa al siguiente que queda; en un grupo, al que quede de él', () => {
    const list = [c('A', 20), c('G1', 15, { group: 'g' }), c('G2', 15, { group: 'g' }), c('B', 10)]
    expect(turnAfterRemoval(list, state(1, 'A'), ['A'])).toBe('G1')
    expect(turnAfterRemoval(list, state(1, 'G1'), ['G1'])).toBe('G2')
    expect(turnAfterRemoval(list, state(1, 'B'), ['B', 'A'])).toBe('G1')
    expect(turnAfterRemoval(list, state(1, 'B'), ['A'])).toBe('B')
    expect(turnAfterRemoval(list, state(1, 'A'), ['A', 'G1', 'G2', 'B'])).toBeNull()
    expect(turnAfterRemoval(list, state(0, null), ['A'])).toBeNull()
  })
})
