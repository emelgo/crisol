/**
 * El sonido de una campaña (docs/specs/sonido.md, ADR-0022 § 7): lo que suena, con la hora del servidor en que empezó
 * cada pista y su segundo. Lo pasa de pista el servidor; cada aparato calcula dónde debería ir con su desfase de reloj
 * y corrige. Funciones puras: las usan el servidor (guardar y pasar de pista) y la web (sonar a la vez)
 */

export type SoundClass = 'ambient' | 'effects'
export type SoundListMode = 'sequential' | 'random' | 'simultaneous' | 'soundboard'

/** Lo que hace falta de una pista para llevar la cuenta: su duración (s), si se repite y su volumen */
export interface SoundTrackInfo {
  id: string
  duration: number
  loop: boolean
  volume: number
}

/** Lo que hace falta de una lista: su clase, su modo, su fundido (s) y sus pistas en orden */
export interface SoundListInfo {
  id: string
  kind: SoundClass
  mode: SoundListMode
  fade: number
  tracks: readonly SoundTrackInfo[]
}

/** Una lista sonando: su orden (barajado si es aleatoria), por cuál va y desde cuándo (ms del servidor) */
export interface PlayingList {
  playlistId: string
  order: string[]
  index: number
  startedAt: number
  /** El segundo de la pista en startedAt */
  offset: number
  /** Se está fundiendo: se para entonces */
  stopAt: number | null
}

/** Un efecto sonando por encima: una pista sola */
export interface PlayingEffect {
  id: string
  playlistId: string
  trackId: string
  startedAt: number
  offset: number
  stopAt: number | null
}

/** Lo que suena en una campaña: se guarda en el servidor */
export interface SoundState {
  volume: number
  paused: boolean
  pausedAt: number | null
  lists: PlayingList[]
  effects: PlayingEffect[]
}

export const EMPTY_SOUND: SoundState = { volume: 1, paused: false, pausedAt: null, lists: [], effects: [] }

/** Los efectos que pueden sonar a la vez (el más viejo deja sitio) */
export const MAX_EFFECTS = 12

interface SoundEnv {
  now: number
  random?: () => number
  id?: () => string
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** Baraja (Fisher-Yates) con el azar que se dé */
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j] as T, out[i] as T]
  }
  return out
}

const orderOf = (list: SoundListInfo, random: () => number) => {
  const ids = list.tracks.map((t) => t.id)
  return list.mode === 'random' ? shuffle(ids, random) : ids
}

/** Si está en pausa, sigue antes: así no se pierde lo que sonaba */
const awake = (state: SoundState, env: SoundEnv) => (state.paused ? resumeSound(state, env) : state)

/**
 * Lanza una lista entera (desde una pista, si se pide). Un ambiente nuevo funde el que sonaba (se para al acabar su
 * fundido); la misma lista vuelve a empezar
 */
export function startList(state: SoundState, list: SoundListInfo, env: SoundEnv, fromTrackId?: string): SoundState {
  const s = awake(state, env)
  const random = env.random ?? Math.random
  let order = orderOf(list, random)
  let index = 0
  if (fromTrackId && order.includes(fromTrackId)) {
    // En una aleatoria, la pedida va la primera
    if (list.mode === 'random') order = [fromTrackId, ...order.filter((id) => id !== fromTrackId)]
    else index = order.indexOf(fromTrackId)
  }
  const fadeMs = list.fade * 1000
  const lists = s.lists
    .filter((l) => l.playlistId !== list.id)
    .flatMap((l): PlayingList[] => {
      if (list.kind !== 'ambient' || l.stopAt !== null) return [l]
      return fadeMs > 0 ? [{ ...l, stopAt: env.now + fadeMs }] : []
    })
  // Los efectos de otras listas no se tocan; un ambiente solo funde a otros ambientes (lo marca quien llama)
  return {
    ...s,
    lists: [...lists, { playlistId: list.id, order, index, startedAt: env.now, offset: 0, stopAt: null }]
  }
}

/** Una pista sola por encima de lo demás (un efecto de la botonera) */
export function startEffect(state: SoundState, list: SoundListInfo, trackId: string, env: SoundEnv): SoundState {
  const s = awake(state, env)
  const id = env.id ? env.id() : `${env.now}-${Math.floor((env.random ?? Math.random)() * 1e9)}`
  const effect: PlayingEffect = { id, playlistId: list.id, trackId, startedAt: env.now, offset: 0, stopAt: null }
  return { ...s, effects: [...s.effects, effect].slice(-MAX_EFFECTS) }
}

/** Para todo, una lista o un efecto; con fundido (s), sigue sonando hasta entonces */
export function stopSound(
  state: SoundState,
  env: SoundEnv,
  what: { playlistId?: string; effectId?: string; fade?: number }
): SoundState {
  const matchesList = (l: PlayingList) => !what.effectId && (!what.playlistId || l.playlistId === what.playlistId)
  const matchesEffect = (e: PlayingEffect) =>
    what.effectId ? e.id === what.effectId : !what.playlistId || e.playlistId === what.playlistId
  const fadeMs = (what.fade ?? 0) * 1000
  // En pausa, el fundido se mide desde la pausa (al seguir se corre con lo demás)
  const from = state.paused && state.pausedAt !== null ? state.pausedAt : env.now
  const stop = <T extends { stopAt: number | null }>(items: T[], matches: (item: T) => boolean): T[] =>
    items.flatMap((item) => {
      if (!matches(item)) return [item]
      if (fadeMs <= 0) return []
      return [{ ...item, stopAt: Math.min(item.stopAt ?? Number.POSITIVE_INFINITY, from + fadeMs) }]
    })
  return { ...state, lists: stop(state.lists, matchesList), effects: stop(state.effects, matchesEffect) }
}

export function pauseSound(state: SoundState, env: SoundEnv): SoundState {
  if (state.paused) return state
  return { ...state, paused: true, pausedAt: env.now }
}

/** Sigue: lo que sonaba se corre lo que duró la pausa */
export function resumeSound(state: SoundState, env: SoundEnv): SoundState {
  if (!state.paused) return state
  const shift = env.now - (state.pausedAt ?? env.now)
  const move = <T extends { startedAt: number; stopAt: number | null }>(item: T): T => ({
    ...item,
    startedAt: item.startedAt + shift,
    stopAt: item.stopAt === null ? null : item.stopAt + shift
  })
  return { ...state, paused: false, pausedAt: null, lists: state.lists.map(move), effects: state.effects.map(move) }
}

export function setSoundVolume(state: SoundState, volume: number): SoundState {
  return { ...state, volume: clamp01(volume) }
}

/** La pista siguiente de una lista (o de la primera que va pista a pista), ya */
export function nextTrack(
  state: SoundState,
  lists: ReadonlyMap<string, SoundListInfo>,
  env: SoundEnv,
  playlistId?: string
): SoundState {
  const target = state.lists.find(
    (l) =>
      l.stopAt === null &&
      (playlistId ? l.playlistId === playlistId : stepwise(lists.get(l.playlistId)?.mode ?? 'simultaneous'))
  )
  const list = target ? lists.get(target.playlistId) : undefined
  if (!target || !list || !stepwise(list.mode)) return state
  const at = state.paused && state.pausedAt !== null ? state.pausedAt : env.now
  const moved = step(target, list, env.random ?? Math.random)
  return {
    ...state,
    lists: state.lists.map((l) => (l === target ? { ...moved, startedAt: at, offset: 0 } : l))
  }
}

/** Las que van pista a pista */
const stepwise = (mode: SoundListMode) => mode === 'sequential' || mode === 'random'

/** A la pista siguiente (al acabar, vuelve a empezar; una aleatoria se baraja otra vez) */
function step(playing: PlayingList, list: SoundListInfo, random: () => number): PlayingList {
  const index = playing.index + 1
  if (index < playing.order.length) return { ...playing, index }
  return { ...playing, index: 0, order: orderOf(list, random) }
}

/** Cuándo acaba lo que suena de una lista (ms del servidor); null si no acaba solo */
function listEnd(playing: PlayingList, list: SoundListInfo): number | null {
  const tracks = new Map(list.tracks.map((t) => [t.id, t]))
  if (stepwise(list.mode)) {
    const track = tracks.get(playing.order[playing.index] ?? '')
    // La que ya no está, se salta ya
    if (!track) return playing.startedAt
    if (track.loop) return null
    return playing.startedAt + Math.max(0, track.duration - playing.offset) * 1000
  }
  // Simultánea (o una botonera lanzada entera): acaba con la más larga, si ninguna se repite
  if (list.tracks.length === 0) return playing.startedAt
  if (list.tracks.some((t) => t.loop)) return null
  return playing.startedAt + Math.max(0, Math.max(...list.tracks.map((t) => t.duration)) - playing.offset) * 1000
}

function effectEnd(effect: PlayingEffect, lists: ReadonlyMap<string, SoundListInfo>): number | null {
  const track = lists.get(effect.playlistId)?.tracks.find((t) => t.id === effect.trackId)
  if (!track) return effect.startedAt
  if (track.loop) return null
  return effect.startedAt + Math.max(0, track.duration - effect.offset) * 1000
}

const earliest = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.min(a, b))

/** Cuándo tiene que volver a mirar el servidor (pasar de pista, quitar algo); null si nada acaba solo */
export function nextSoundEvent(state: SoundState, lists: ReadonlyMap<string, SoundListInfo>): number | null {
  if (state.paused) return null
  let at: number | null = null
  for (const playing of state.lists) {
    const list = lists.get(playing.playlistId)
    at = earliest(at, playing.stopAt)
    at = earliest(at, list ? listEnd(playing, list) : playing.startedAt)
  }
  for (const effect of state.effects) at = earliest(earliest(at, effect.stopAt), effectEnd(effect, lists))
  return at
}

/** Las vueltas como mucho al encadenar pistas (un servidor parado mucho tiempo): luego, desde ahora */
const MAX_STEPS = 10_000

/**
 * Pone al día lo que suena: pasa las pistas que se acabaron (encadenadas desde la hora en que acabó cada una, sin
 * perder el compás), quita lo fundido, los efectos acabados y lo de listas que ya no existen
 */
export function advanceSound(state: SoundState, lists: ReadonlyMap<string, SoundListInfo>, env: SoundEnv): SoundState {
  const random = env.random ?? Math.random
  const live = (stopAt: number | null) => stopAt === null || stopAt > env.now
  const known = state.lists.filter((l) => lists.has(l.playlistId))
  if (state.paused) return known.length === state.lists.length ? state : { ...state, lists: known }
  const out: PlayingList[] = []
  for (const original of known) {
    if (!live(original.stopAt)) continue
    const list = lists.get(original.playlistId) as SoundListInfo
    // El orden guardado, sin las pistas que se quitaron y con las nuevas al final
    const ids = new Set(list.tracks.map((t) => t.id))
    const current = original.order[original.index]
    let playing = original
    if (stepwise(list.mode) && original.order.some((id) => !ids.has(id))) {
      const kept = original.order.filter((id) => ids.has(id) || id === current)
      playing = { ...original, order: kept, index: Math.max(0, kept.indexOf(current ?? '')) }
    }
    let end = listEnd(playing, list)
    let steps = 0
    while (end !== null && end <= env.now) {
      if (!stepwise(list.mode)) break
      if (list.tracks.length === 0) break
      if (++steps > MAX_STEPS) {
        playing = { ...step(playing, list, random), startedAt: env.now, offset: 0 }
        break
      }
      const next = step(playing, list, random)
      // Al dar la vuelta, el orden sale ya sin las quitadas
      const nextId = next.order[next.index]
      const order = next.order.filter((id) => ids.has(id))
      playing = { ...next, order, index: Math.max(0, order.indexOf(nextId ?? '')), startedAt: end, offset: 0 }
      end = listEnd(playing, list)
    }
    if (end !== null && end <= env.now) continue
    out.push(playing)
  }
  const effects = state.effects.filter((e) => {
    const end = effectEnd(e, lists)
    return live(e.stopAt) && (end === null || end > env.now)
  })
  return { ...state, lists: out, effects }
}

/** Lo que suena en un aparato: una voz por pista sonando */
export interface SoundVoiceInfo {
  /** Cambia cuando cambia la pista o vuelve a empezar: entonces es otra voz */
  key: string
  playlistId: string
  trackId: string
  kind: SoundClass
  startedAt: number
  offset: number
  duration: number
  loop: boolean
  volume: number
  fade: number
  stopAt: number | null
}

/** Las voces de lo que suena: la pista de cada lista (todas en una simultánea) y cada efecto */
export function voicesOf(state: SoundState, lists: ReadonlyMap<string, SoundListInfo>): SoundVoiceInfo[] {
  const out: SoundVoiceInfo[] = []
  const voice = (
    key: string,
    list: SoundListInfo,
    track: SoundTrackInfo,
    at: { startedAt: number; offset: number; stopAt: number | null },
    kind: SoundClass
  ) =>
    out.push({
      key,
      playlistId: list.id,
      trackId: track.id,
      kind,
      startedAt: at.startedAt,
      offset: at.offset,
      duration: track.duration,
      loop: track.loop,
      volume: track.volume,
      fade: list.fade,
      stopAt: at.stopAt
    })
  for (const playing of state.lists) {
    const list = lists.get(playing.playlistId)
    if (!list) continue
    const tracks = stepwise(list.mode) ? list.tracks.filter((t) => t.id === playing.order[playing.index]) : list.tracks
    for (const track of tracks) voice(`${list.id}:${track.id}:${playing.startedAt}`, list, track, playing, list.kind)
  }
  for (const effect of state.effects) {
    const list = lists.get(effect.playlistId)
    const track = list?.tracks.find((t) => t.id === effect.trackId)
    if (list && track) voice(effect.id, list, track, effect, 'effects')
  }
  return out
}

/** La hora del servidor y si está en pausa, como la ve un aparato */
export interface SoundClock {
  serverNow: number
  paused: boolean
  pausedAt: number | null
}

/** Dónde debería ir una pista (s); null si ya acabó */
export function expectedPosition(
  voice: { startedAt: number; offset: number; duration: number; loop: boolean },
  clock: SoundClock
): number | null {
  const now = clock.paused && clock.pausedAt !== null ? clock.pausedAt : clock.serverNow
  const at = Math.max(0, (now - voice.startedAt) / 1000 + voice.offset)
  if (voice.loop) return voice.duration > 0 ? at % voice.duration : 0
  return at >= voice.duration ? null : at
}

/** El desfase del reloj del aparato con el del servidor (ms que hay que sumarle), por el punto medio del viaje */
export function clockOffset(sample: { sentAt: number; receivedAt: number; serverNow: number }): number {
  return sample.serverNow - (sample.sentAt + sample.receivedAt) / 2
}

/** Si hay que saltar: se desvía más del margen (s). En una que se repite, cuenta la distancia dando la vuelta */
export function needsSeek(actual: number, expected: number, margin: number, duration: number, loop = false): boolean {
  let gap = Math.abs(actual - expected)
  if (loop && duration > 0) gap = Math.min(gap, duration - gap)
  return gap > margin
}

/** El volumen del fundido (0–1): entra al empezar, sale al acabar (si no se repite) y al pararse */
export function fadeGain(
  voice: { startedAt: number; offset: number; duration: number; loop: boolean; fade: number; stopAt: number | null },
  serverNow: number
): number {
  if (voice.fade <= 0) return voice.stopAt !== null && serverNow >= voice.stopAt ? 0 : 1
  const fadeMs = voice.fade * 1000
  const played = serverNow - voice.startedAt + voice.offset * 1000
  let gain = 1
  if (played < fadeMs) gain = Math.min(gain, played / fadeMs)
  if (!voice.loop) gain = Math.min(gain, (voice.duration * 1000 - played) / fadeMs)
  if (voice.stopAt !== null) gain = Math.min(gain, (voice.stopAt - serverNow) / fadeMs)
  return clamp01(gain)
}
