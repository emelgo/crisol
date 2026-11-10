/**
 * El reloj del sonido (docs/specs/sonido.md): un temporizador por campaña que pasa de pista cuando se acaba la que
 * suena (y quita lo fundido y los efectos acabados), sin depender de que el máster siga conectado. Lo que suena se
 * guarda en la mesa de la campaña: al arrancar se retoman los relojes, y al entrar alguien se pone al día
 */
import type { SoundView, TableServerMessage } from '@crisol/contracts'
import { type Database, soundRepo } from '@crisol/db'
import { advanceSound, nextSoundEvent, type SoundListInfo, type SoundState, voicesOf } from '@crisol/domain'

/** Lo que el reloj necesita de las salas: mandar a todas las conexiones de una campaña */
export interface SoundRooms {
  broadcast(campaignId: string, message: TableServerMessage): void
}

export interface SoundClock {
  /** Lo que suena de una campaña, puesto al día (y guardado si cambió), como lo recibe cada aparato */
  view(campaignId: string): Promise<SoundView>
  /** Se cambió lo que suena: reprograma su reloj y lo manda a la sala */
  changed(campaignId: string, state: SoundState | null): Promise<SoundView>
  /** Pone al día una campaña (cambió una lista que puede sonar en ella) */
  refresh(campaignId: string): Promise<void>
  /** Retoma los relojes de las campañas con algo sonando (al arrancar) */
  recover(): Promise<void>
  close(): void
}

/** Un temporizador no puede esperar más de ~24 días: se vuelve a mirar cada hora */
const MAX_WAIT = 3_600_000
/** Un poco después de que acabe: así ya ha acabado según el reloj */
const MARGIN = 20

type Playlist = soundRepo.PlaylistWithTracks

const infoOf = (p: Playlist): SoundListInfo => ({
  id: p.id,
  kind: p.kind,
  mode: p.mode,
  fade: p.fade,
  tracks: p.tracks.map((t) => ({ id: t.id, duration: t.duration, loop: t.loop, volume: t.volume }))
})

const sourceOf = (track: soundRepo.TrackRow): SoundView['voices'][number]['source'] => {
  if (track.fileId) return { type: 'file', fileId: track.fileId, url: `/api/files/${track.fileId}` }
  if (track.youtubeId) return { type: 'youtube', videoId: track.youtubeId }
  return { type: 'none' }
}

/** Las listas que nombra lo que suena (y otras que se pidan), para llevar la cuenta */
export async function listsOf(db: Database, state: SoundState | null, extra: readonly string[] = []) {
  const ids = [...new Set([...(state ? [...state.lists, ...state.effects] : []).map((p) => p.playlistId), ...extra])]
  if (ids.length === 0) return { playlists: [] as Playlist[], lists: new Map<string, SoundListInfo>() }
  const playlists = await soundRepo.playlistsByIds(db, ids)
  return { playlists, lists: new Map(playlists.map((p) => [p.id, infoOf(p)])) }
}

/** Lo que suena, como lo recibe cada aparato */
export function soundView(campaignId: string, state: SoundState | null, playlists: readonly Playlist[]): SoundView {
  if (!state) return { campaignId, volume: 1, paused: false, pausedAt: null, voices: [], lists: [], preload: [] }
  const byId = new Map(playlists.map((p) => [p.id, p]))
  const lists = new Map(playlists.map((p) => [p.id, infoOf(p)]))
  const effects = new Map(state.effects.map((e) => [e.id, e]))
  const voices = voicesOf(state, lists).map((v) => {
    const track = byId.get(v.playlistId)?.tracks.find((t) => t.id === v.trackId)
    return {
      ...v,
      name: track?.name ?? '',
      source: track ? sourceOf(track) : ({ type: 'none' } as const),
      effectId: effects.has(v.key) ? v.key : null
    }
  })
  const preload: string[] = []
  const playing = state.lists.flatMap((l) => {
    const p = byId.get(l.playlistId)
    if (!p) return []
    const next = p.tracks.find((t) => t.id === l.order[(l.index + 1) % Math.max(1, l.order.length)])
    if (next?.fileId && (p.mode === 'sequential' || p.mode === 'random')) preload.push(`/api/files/${next.fileId}`)
    return [
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
  })
  return {
    campaignId,
    volume: state.volume,
    paused: state.paused,
    pausedAt: state.pausedAt,
    voices,
    lists: playing,
    preload
  }
}

const same = (a: SoundState | null, b: SoundState | null) => JSON.stringify(a) === JSON.stringify(b)

export function createSoundClock(options: {
  db: Database
  rooms: SoundRooms
  onError?: (error: unknown) => void
  now?: () => number
}): SoundClock {
  const { db, rooms } = options
  const now = options.now ?? Date.now
  const onError = options.onError ?? (() => {})
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  let closed = false

  const send = (campaignId: string, view: SoundView) =>
    rooms.broadcast(campaignId, { type: 'sound', sound: view, serverNow: now() })

  const schedule = (campaignId: string, state: SoundState | null, lists: ReadonlyMap<string, SoundListInfo>) => {
    clearTimeout(timers.get(campaignId))
    timers.delete(campaignId)
    if (closed || !state) return
    const at = nextSoundEvent(state, lists)
    if (at === null) return
    const wait = Math.min(MAX_WAIT, Math.max(0, at - now()) + MARGIN)
    const timer = setTimeout(() => {
      timers.delete(campaignId)
      tick(campaignId).catch(onError)
    }, wait)
    // Que un reloj no deje el proceso en marcha al cerrar
    timer.unref?.()
    timers.set(campaignId, timer)
  }

  /** Pone al día lo que suena con la fila bloqueada; si cambió, lo manda */
  async function tick(campaignId: string, force = false): Promise<SoundView> {
    let before: SoundState | null = null
    let loaded = { playlists: [] as Playlist[], lists: new Map<string, SoundListInfo>() }
    const after = await soundRepo.changeSound(db, campaignId, async (current) => {
      before = current
      if (!current) return null
      loaded = await listsOf(db, current)
      return advanceSound(current, loaded.lists, { now: now() })
    })
    schedule(campaignId, after, loaded.lists)
    const view = soundView(campaignId, after, loaded.playlists)
    if (force || !same(before, after)) send(campaignId, view)
    return view
  }

  return {
    view: (campaignId) => tick(campaignId),
    async changed(campaignId, state) {
      const loaded = await listsOf(db, state)
      schedule(campaignId, state, loaded.lists)
      const view = soundView(campaignId, state, loaded.playlists)
      send(campaignId, view)
      return view
    },
    async refresh(campaignId) {
      await tick(campaignId, true)
    },
    async recover() {
      for (const { campaignId } of await soundRepo.campaignsWithSound(db)) await tick(campaignId).catch(onError)
    },
    close() {
      closed = true
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
  }
}
