/**
 * Guardar una criatura en juego desde su hoja (docs/specs/criaturas.md): como un personaje, cada cambio sale en orden
 * (con la versión de la respuesta anterior) y lo de la partida se ve al momento; su hoja llega con la respuesta
 */
import type { Play } from '@crisol/systems'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import type { ActionOutput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import type { Change } from '../characters/save.ts'

export type LoadedCreature = ActionOutput<'getInPlay'>

export const creatureKey = (creatureId: string) => ['creature', creatureId] as const

export function useCreatureSave(creatureId: string, campaignId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  const chain = useRef<Promise<void>>(Promise.resolve())
  // Lo de la partida que guardó el servidor y los cambios que aún esperan: lo que se ve es aquello con estos encima
  // (así dos clics seguidos se suman, como en un personaje)
  const confirmed = useRef<Play | null>(null)
  const waiting = useRef<((play: Play) => Play)[]>([])
  const [error, setError] = useState<unknown>(null)
  const save = useCallback(
    (change: Change) => {
      const key = creatureKey(creatureId)
      void queryClient.cancelQueries({ queryKey: key })
      const before = queryClient.getQueryData<LoadedCreature>(key)
      if (!before) return Promise.resolve()
      if (change.play) {
        if (waiting.current.length === 0) confirmed.current = structuredClone(before.creature.play) as Play
        waiting.current.push(change.play)
        queryClient.setQueryData<LoadedCreature>(key, {
          ...before,
          creature: {
            ...before.creature,
            play: change.play(structuredClone(before.creature.play) as Play) as Record<string, unknown>
          }
        })
      }
      chain.current = chain.current.then(async () => {
        const current = queryClient.getQueryData<LoadedCreature>(key)
        if (!current) return
        try {
          const play = change.play
            ? (change.play(structuredClone(confirmed.current ?? current.creature.play) as Play) as Record<
                string,
                unknown
              >)
            : undefined
          const out = await api.call('playCreature', {
            creatureId,
            version: current.creature.version,
            ...(play ? { play } : {}),
            ...(change.rest ? { rest: change.rest } : {}),
            ...(change.name ? { name: change.name } : {})
          })
          if (change.play) waiting.current.shift()
          confirmed.current = out.creature.play as Play
          // Lo del servidor con lo que aún espera encima
          const shown = waiting.current.reduce<Play>((p, f) => f(structuredClone(p)), out.creature.play as Play)
          queryClient.setQueryData<LoadedCreature>(key, {
            ...out,
            creature: { ...out.creature, play: shown as Record<string, unknown> }
          })
          setError(null)
          void queryClient.invalidateQueries({ queryKey: ['creatures', campaignId] })
        } catch (failure) {
          setError(failure)
          waiting.current = []
          confirmed.current = null
          await queryClient.invalidateQueries({ queryKey: key })
        }
      })
      return chain.current
    },
    [api, queryClient, creatureId, campaignId]
  )
  return { save, error }
}
