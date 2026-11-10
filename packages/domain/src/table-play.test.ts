import { describe, expect, it } from 'vitest'
import { type TablePlay, tableActionAllowed } from './table-play.ts'

const base: TablePlay = {
  master: false,
  userId: 'ana',
  paused: false,
  movement: 'free',
  combat: null,
  controllers: ['ana']
}

describe('lo que puede hacer un jugador en la Mesa', () => {
  it('el máster puede siempre, aunque haya pausa o esté bloqueado', () => {
    expect(tableActionAllowed({ ...base, master: true, userId: 'enrique', paused: true, movement: 'locked' })).toBe(
      'ok'
    )
  })

  it('un jugador mueve lo suyo en libre', () => {
    expect(tableActionAllowed(base)).toBe('ok')
  })

  it('no mueve lo de otro', () => {
    expect(tableActionAllowed({ ...base, controllers: ['bruno'] })).toBe('notYours')
  })

  it('una ficha asignada a varios la mueve cualquiera de ellos', () => {
    expect(tableActionAllowed({ ...base, controllers: ['bruno', 'ana'] })).toBe('ok')
  })

  it('la pausa gana a todo lo demás', () => {
    expect(tableActionAllowed({ ...base, paused: true, controllers: ['bruno'] })).toBe('paused')
    expect(tableActionAllowed({ ...base, paused: true, movement: 'locked' })).toBe('paused')
  })

  it('bloqueado: nadie más que el máster', () => {
    expect(tableActionAllowed({ ...base, movement: 'locked' })).toBe('locked')
  })

  it('en su turno, sin combate, se mueve libre', () => {
    expect(tableActionAllowed({ ...base, movement: 'turn' })).toBe('ok')
  })

  it('en su turno, con combate, solo quien lleva al combatiente activo', () => {
    expect(tableActionAllowed({ ...base, movement: 'turn', combat: { activeControllers: ['ana'] } })).toBe('ok')
    expect(tableActionAllowed({ ...base, movement: 'turn', combat: { activeControllers: ['bruno'] } })).toBe(
      'notYourTurn'
    )
  })

  it('en su turno, con combate y sin nadie activo (aún sin empezar), nadie mueve', () => {
    expect(tableActionAllowed({ ...base, movement: 'turn', combat: { activeControllers: [] } })).toBe('notYourTurn')
  })

  it('para lo que no es de una ficha (una puerta), sin dueños, solo cuentan pausa y modo', () => {
    expect(tableActionAllowed({ ...base, controllers: null })).toBe('ok')
    expect(tableActionAllowed({ ...base, controllers: null, movement: 'locked' })).toBe('locked')
    expect(
      tableActionAllowed({ ...base, controllers: null, movement: 'turn', combat: { activeControllers: ['bruno'] } })
    ).toBe('notYourTurn')
  })
})
