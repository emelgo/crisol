import { describe, expect, it } from 'vitest'
import { addCondition, type Play, playSchema, removeCondition, tickConditions } from './play.ts'

describe('los estados de lo de la partida', () => {
  it('se ponen, se cambian sin repetirse y se quitan', () => {
    let play: Play = { values: { pg: { value: 3 } } }
    play = addCondition(play, { name: 'Derribado', key: 'derribado' }, 'a')
    play = addCondition(play, { name: 'Marcado' }, 'b')
    play = addCondition(play, { name: 'Derribado', key: 'derribado', rounds: 2 }, 'c')
    play = addCondition(play, { name: 'marcado', rounds: 1 }, 'd')
    expect(play.conditions).toEqual([
      { id: 'a', name: 'Derribado', key: 'derribado', rounds: 2 },
      { id: 'b', name: 'marcado', rounds: 1 }
    ])
    expect(playSchema.safeParse(play).success).toBe(true)
    play = removeCondition(play, 'a')
    play = removeCondition(play, 'b')
    expect(play).toEqual({ values: { pg: { value: 3 } } })
  })

  it('poner uno sin rondas le quita la caducidad', () => {
    const play = addCondition(addCondition({}, { name: 'Ciego', rounds: 3 }, 'a'), { name: 'Ciego' }, 'b')
    expect(play.conditions).toEqual([{ id: 'a', name: 'Ciego' }])
  })

  it('cada ronda descuenta y se van los que llegan a cero', () => {
    const play: Play = {
      conditions: [
        { id: 'a', name: 'Aturdido', rounds: 1 },
        { id: 'b', name: 'Bendecido', rounds: 3 },
        { id: 'c', name: 'Derribado' }
      ]
    }
    const { play: next, expired } = tickConditions(play)
    expect(expired.map((c) => c.id)).toEqual(['a'])
    expect(next.conditions).toEqual([
      { id: 'b', name: 'Bendecido', rounds: 2 },
      { id: 'c', name: 'Derribado' }
    ])
    expect(tickConditions({ conditions: [{ id: 'x', name: 'Uno', rounds: 1 }] }).play).toEqual({})
  })
})
