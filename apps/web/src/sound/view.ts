/**
 * Lo que suena, como lo manda el servidor (docs/specs/sonido.md), hecho con las listas de la web: para la API de prueba
 * y para las pruebas de los componentes
 */
import type { SoundPlaylistView, SoundView } from '@crisol/contracts'
import { type SoundListInfo, type SoundState, voicesOf } from '@crisol/domain'

export const listInfo = (p: SoundPlaylistView): SoundListInfo => ({
  id: p.id,
  kind: p.kind,
  mode: p.mode,
  fade: p.fade,
  tracks: p.tracks.map((t) => ({ id: t.id, duration: t.duration, loop: t.loop, volume: t.volume }))
})

export function buildSoundView(
  campaignId: string,
  state: SoundState | null,
  playlists: readonly SoundPlaylistView[]
): SoundView {
  if (!state) return { campaignId, volume: 1, paused: false, pausedAt: null, voices: [], lists: [], preload: [] }
  const byId = new Map(playlists.map((p) => [p.id, p]))
  const effects = new Set(state.effects.map((e) => e.id))
  const voices = voicesOf(state, new Map(playlists.map((p) => [p.id, listInfo(p)]))).map((v) => {
    const track = byId.get(v.playlistId)?.tracks.find((t) => t.id === v.trackId)
    return {
      ...v,
      name: track?.name ?? '',
      source: track?.source ?? ({ type: 'none' } as const),
      effectId: effects.has(v.key) ? v.key : null
    }
  })
  const lists = state.lists.flatMap((l) => {
    const p = byId.get(l.playlistId)
    return p
      ? [
          {
            playlistId: p.id,
            name: p.name,
            kind: p.kind,
            mode: p.mode,
            index: l.index,
            count: l.order.length,
            stopAt: l.stopAt
          }
        ]
      : []
  })
  return {
    campaignId,
    volume: state.volume,
    paused: state.paused,
    pausedAt: state.pausedAt,
    voices,
    lists,
    preload: []
  }
}
