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
  const [error, setError] = useState<unknown>(null)
  const save = useCallback(
    (change: Change) => {
      const key = creatureKey(creatureId)
      void queryClient.cancelQueries({ queryKey: key })
      const before = queryClient.getQueryData<LoadedCreature>(key)
      if (!before) return Promise.resolve()
      // Lo de la partida se ve ya; lo que se calcula, al llegar la respuesta
      if (change.play)
        queryClient.setQueryData<LoadedCreature>(key, {
          ...before,
          creature: {
            ...before.creature,
            play: change.play(structuredClone(before.creature.play) as Play) as Record<string, unknown>
          }
        })
      chain.current = chain.current.then(async () => {
        const current = queryClient.getQueryData<LoadedCreature>(key)
        if (!current) return
        try {
          const out = await api.call('playCreature', {
            creatureId,
            version: current.creature.version,
            ...(change.play ? { play: current.creature.play } : {}),
            ...(change.rest ? { rest: change.rest } : {}),
            ...(change.name ? { name: change.name } : {})
          })
          queryClient.setQueryData<LoadedCreature>(key, out)
          setError(null)
          void queryClient.invalidateQueries({ queryKey: ['creatures', campaignId] })
        } catch (failure) {
          setError(failure)
          await queryClient.invalidateQueries({ queryKey: key })
        }
      })
      return chain.current
    },
    [api, queryClient, creatureId, campaignId]
  )
  return { save, error }
}
