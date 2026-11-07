/** Poner o quitar un estado en lo de la partida de un personaje o de una criatura (docs/specs/fichas.md) */
import { randomUUID } from 'node:crypto'
import { addCondition, type Play, removeCondition } from '@crisol/systems'
import { InvalidRequestError } from './context.ts'

type ConditionChange = {
  add?: { name: string; key?: string | undefined; rounds?: number | undefined } | undefined
  remove?: string | undefined
}

export function withCondition(play: Play, change: ConditionChange | undefined): Play {
  if (!change) return play
  if (change.add) {
    const { name, key, rounds } = change.add
    return addCondition(
      play,
      { name, ...(key ? { key } : {}), ...(rounds ? { rounds } : {}) },
      randomUUID().slice(0, 8)
    )
  }
  if (change.remove && !(play.conditions ?? []).some((c) => c.id === change.remove))
    throw new InvalidRequestError('BAD_PLAY', `no tiene el estado «${change.remove}»`)
  return change.remove ? removeCondition(play, change.remove) : play
}
