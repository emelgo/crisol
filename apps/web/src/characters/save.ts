/**
 * Guardar un personaje mientras se crea: cada cambio sale en orden (con la versión de la respuesta anterior) y se ve
 * al momento en sus elecciones; su estado (lo pendiente, su hoja) llega con la respuesta
 */
import type { Build } from '@crisol/systems'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import type { ActionOutput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'

export type Loaded = ActionOutput<'getCharacter'>

export const characterKey = (characterId: string) => ['character', characterId] as const

export interface Change {
  build?: (build: Build) => Build
  name?: string
  confirm?: 'created' | 'level'
}

export function useCharacterSave(characterId: string, campaignId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  const chain = useRef<Promise<void>>(Promise.resolve())
  const [busy, setBusy] = useState(0)
  const [error, setError] = useState<unknown>(null)
  const save = useCallback(
    (change: Change) => {
      const key = characterKey(characterId)
      // Lo elegido se ve ya; lo que se calcula, al llegar la respuesta
      const before = queryClient.getQueryData<Loaded>(key)
      if (!before) return Promise.resolve()
      const build = change.build ? change.build(structuredClone(before.character.build) as Build) : undefined
      if (build)
        queryClient.setQueryData<Loaded>(key, {
          ...before,
          character: { ...before.character, build: build as Record<string, unknown> }
        })
      setBusy((n) => n + 1)
      chain.current = chain.current.then(async () => {
        const current = queryClient.getQueryData<Loaded>(key)
        if (!current) return
        try {
          const out = await api.call('updateCharacter', {
            characterId,
            version: current.character.version,
            ...(build ? { build: current.character.build } : {}),
            ...(change.name !== undefined ? { name: change.name } : {}),
            ...(change.confirm ? { confirm: change.confirm } : {})
          })
          // Si mientras tanto hubo otro cambio, sus elecciones (las de la pantalla) se quedan
          const latest = queryClient.getQueryData<Loaded>(key)
          queryClient.setQueryData<Loaded>(key, {
            ...out,
            character: { ...out.character, build: latest?.character.build ?? out.character.build }
          })
          setError(null)
          void queryClient.invalidateQueries({ queryKey: ['characters', campaignId] })
          if (change.confirm) void queryClient.invalidateQueries({ queryKey: ['characterVersions', characterId] })
        } catch (failure) {
          setError(failure)
          await queryClient.invalidateQueries({ queryKey: key })
        } finally {
          setBusy((n) => n - 1)
        }
      })
      return chain.current
    },
    [api, queryClient, characterId, campaignId]
  )
  return { save, busy: busy > 0, error }
}

/** Un id corto para algo elegido */
export const pickId = () => crypto.randomUUID().slice(0, 8)
