/**
 * Guardar un personaje mientras se crea: cada cambio sale en orden (con la versión de la respuesta anterior) y se ve
 * al momento en sus elecciones; su estado (lo pendiente, su hoja) llega con la respuesta
 */
import type { Build, Play } from '@crisol/systems'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import type { ActionOutput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'

export type Loaded = ActionOutput<'getCharacter'>

export const characterKey = (characterId: string) => ['character', characterId] as const

export interface Change {
  build?: (build: Build) => Build
  /** Lo de la partida (los PG, los usos, lo que lleva): se aplica a lo último guardado, así dos clics se suman */
  play?: (play: Play) => Play
  /** Descansar: lo hace el servidor (tira lo que vuelve con dados) */
  rest?: 'short' | 'long'
  name?: string
  confirm?: 'created' | 'level'
}

export function useCharacterSave(characterId: string, campaignId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  const chain = useRef<Promise<void>>(Promise.resolve())
  // Lo de la partida que guardó el servidor y los cambios que aún esperan: lo que se ve es aquello con estos encima
  const confirmed = useRef<Play | null>(null)
  const waiting = useRef<((play: Play) => Play)[]>([])
  const [busy, setBusy] = useState(0)
  const [error, setError] = useState<unknown>(null)
  const save = useCallback(
    (change: Change) => {
      const key = characterKey(characterId)
      // Una recarga a medias no pisa lo elegido: se cancela, y la pantalla no recarga mientras se guarda
      void queryClient.cancelQueries({ queryKey: key })
      // Lo elegido se ve ya; lo que se calcula, al llegar la respuesta
      const before = queryClient.getQueryData<Loaded>(key)
      if (!before) return Promise.resolve()
      if (change.play) {
        if (waiting.current.length === 0) confirmed.current = structuredClone(before.character.play) as Play
        waiting.current.push(change.play)
      }
      const build = change.build ? change.build(structuredClone(before.character.build) as Build) : undefined
      const play = change.play ? change.play(structuredClone(before.character.play) as Play) : undefined
      if (build || play)
        queryClient.setQueryData<Loaded>(key, {
          ...before,
          character: {
            ...before.character,
            ...(build ? { build: build as Record<string, unknown> } : {}),
            ...(play ? { play: play as Record<string, unknown> } : {})
          }
        })
      setBusy((n) => n + 1)
      chain.current = chain.current.then(async () => {
        const current = queryClient.getQueryData<Loaded>(key)
        if (!current) return
        try {
          const version = current.character.version
          const out = change.rest
            ? await api.call('playCharacter', { characterId, version, rest: change.rest })
            : await api.call('updateCharacter', {
                characterId,
                version,
                ...(build ? { build: current.character.build } : {}),
                ...(change.play
                  ? {
                      play: change.play(structuredClone(confirmed.current ?? current.character.play) as Play) as Record<
                        string,
                        unknown
                      >
                    }
                  : {}),
                ...(change.name !== undefined ? { name: change.name } : {}),
                ...(change.confirm ? { confirm: change.confirm } : {})
              })
          if (change.play) waiting.current.shift()
          // Lo de la partida, lo del servidor con lo que aún espera encima; las elecciones de la pantalla se quedan
          const latest = queryClient.getQueryData<Loaded>(key)
          let shown = (latest?.character.play ?? out.character.play) as Play
          if (change.play || change.rest) {
            confirmed.current = out.character.play as Play
            shown = waiting.current.reduce<Play>((p, f) => f(structuredClone(p)), out.character.play as Play)
          }
          queryClient.setQueryData<Loaded>(key, {
            ...out,
            character: {
              ...out.character,
              build: latest?.character.build ?? out.character.build,
              play: shown as Record<string, unknown>
            }
          })
          setError(null)
          void queryClient.invalidateQueries({ queryKey: ['characters', campaignId] })
          if (change.confirm) void queryClient.invalidateQueries({ queryKey: ['characterVersions', characterId] })
        } catch (failure) {
          setError(failure)
          waiting.current = []
          confirmed.current = null
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
