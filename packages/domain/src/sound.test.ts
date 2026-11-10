import { describe, expect, it } from 'vitest'
import {
  advanceSound,
  clockOffset,
  EMPTY_SOUND,
  expectedPosition,
  fadeGain,
  needsSeek,
  nextSoundEvent,
  nextTrack,
  pauseSound,
  resumeSound,
  type SoundListInfo,
  type SoundState,
  setSoundVolume,
  startEffect,
  startList,
  stopSound,
  voicesOf
} from './sound.ts'

const taberna: SoundListInfo = {
  id: 'taberna',
  kind: 'ambient',
  mode: 'sequential',
  fade: 2,
  tracks: [
    { id: 'a', duration: 60, loop: false, volume: 1 },
    { id: 'b', duration: 30, loop: false, volume: 0.5 },
    { id: 'c', duration: 10, loop: false, volume: 1 }
  ]
}
const bosque: SoundListInfo = { ...taberna, id: 'bosque', mode: 'random' }
const efectos: SoundListInfo = {
  id: 'efectos',
  kind: 'effects',
  mode: 'soundboard',
  fade: 0,
  tracks: [
    { id: 'trueno', duration: 4, loop: false, volume: 1 },
    { id: 'lluvia', duration: 20, loop: true, volume: 1 }
  ]
}
const lists = new Map([taberna, bosque, efectos].map((l) => [l.id, l]))
const T0 = 1_000_000
let ids = 0
const env = (now: number, random = () => 0.5) => ({ now, random, id: () => `e${++ids}` })

describe('lo que suena en una campaña', () => {
  it('lanzar una lista secuencial empieza por su primera pista (o por la pedida)', () => {
    const s = startList(EMPTY_SOUND, taberna, env(T0))
    expect(s.lists).toEqual([
      { playlistId: 'taberna', order: ['a', 'b', 'c'], index: 0, startedAt: T0, offset: 0, stopAt: null }
    ])
    const from = startList(EMPTY_SOUND, taberna, env(T0), 'b')
    expect(from.lists[0]?.index).toBe(1)
  })

  it('una lista aleatoria guarda su orden barajado', () => {
    let n = 0
    const s = startList(
      EMPTY_SOUND,
      bosque,
      env(T0, () => [0.9, 0.1, 0.5][n++ % 3] ?? 0)
    )
    expect([...(s.lists[0]?.order ?? [])].sort()).toEqual(['a', 'b', 'c'])
  })

  it('un ambiente nuevo se funde con el que sonaba (el viejo se para al acabar el fundido)', () => {
    const s1 = startList(EMPTY_SOUND, taberna, env(T0))
    const s2 = startList(s1, bosque, env(T0 + 5000))
    expect(s2.lists.map((l) => [l.playlistId, l.stopAt])).toEqual([
      ['taberna', T0 + 5000 + 2000],
      ['bosque', null]
    ])
    expect(advanceSound(s2, lists, env(T0 + 8000)).lists.map((l) => l.playlistId)).toEqual(['bosque'])
  })

  it('el servidor pasa de pista al acabar y encadena las que se acabaron sin nadie (sin perder el compás)', () => {
    const s = startList(EMPTY_SOUND, taberna, env(T0))
    expect(nextSoundEvent(s, lists)).toBe(T0 + 60_000)
    const later = advanceSound(s, lists, env(T0 + 95_000))
    expect(later.lists[0]).toMatchObject({ index: 2, startedAt: T0 + 90_000, offset: 0 })
    // Al acabar la última vuelve a empezar
    const wrapped = advanceSound(s, lists, env(T0 + 101_000))
    expect(wrapped.lists[0]).toMatchObject({ index: 0, startedAt: T0 + 100_000 })
  })

  it('una pista que se repite no pasa nunca', () => {
    const loop: SoundListInfo = { ...taberna, id: 'loop', tracks: [{ id: 'a', duration: 5, loop: true, volume: 1 }] }
    const s = startList(EMPTY_SOUND, loop, env(T0))
    expect(nextSoundEvent(s, new Map([['loop', loop]]))).toBeNull()
  })

  it('un efecto suena una vez por encima y se va; uno que se repite sigue', () => {
    let s = startList(EMPTY_SOUND, taberna, env(T0))
    s = startEffect(s, efectos, 'trueno', env(T0 + 1000))
    s = startEffect(s, efectos, 'lluvia', env(T0 + 1000))
    expect(s.effects.map((e) => e.trackId)).toEqual(['trueno', 'lluvia'])
    expect(nextSoundEvent(s, lists)).toBe(T0 + 5000)
    const after = advanceSound(s, lists, env(T0 + 6000))
    expect(after.effects.map((e) => e.trackId)).toEqual(['lluvia'])
  })

  it('pausar guarda la hora y seguir corre lo que sonaba', () => {
    const s = startList(EMPTY_SOUND, taberna, env(T0))
    const paused = pauseSound(s, env(T0 + 10_000))
    expect(nextSoundEvent(paused, lists)).toBeNull()
    expect(advanceSound(paused, lists, env(T0 + 500_000)).lists[0]?.index).toBe(0)
    const resumed = resumeSound(paused, env(T0 + 40_000))
    expect(resumed).toMatchObject({ paused: false, pausedAt: null })
    expect(resumed.lists[0]?.startedAt).toBe(T0 + 30_000)
    expect(nextSoundEvent(resumed, lists)).toBe(T0 + 90_000)
  })

  it('parar con fundido lo deja sonar hasta entonces; sin él, se va ya', () => {
    const s = startEffect(startList(EMPTY_SOUND, taberna, env(T0)), efectos, 'lluvia', env(T0))
    const faded = stopSound(s, env(T0 + 1000), { fade: 3 })
    expect(faded.lists[0]?.stopAt).toBe(T0 + 4000)
    expect(faded.effects[0]?.stopAt).toBe(T0 + 4000)
    expect(stopSound(s, env(T0), { playlistId: 'efectos' }).effects).toEqual([])
    expect(stopSound(s, env(T0), {})).toMatchObject({ lists: [], effects: [] })
  })

  it('siguiente pasa de pista ya', () => {
    const s = nextTrack(startList(EMPTY_SOUND, taberna, env(T0)), lists, env(T0 + 3000))
    expect(s.lists[0]).toMatchObject({ index: 1, startedAt: T0 + 3000, offset: 0 })
  })

  it('una lista que ya no existe deja de sonar; una pista quitada se salta', () => {
    const s = startList(EMPTY_SOUND, taberna, env(T0))
    expect(advanceSound(s, new Map(), env(T0)).lists).toEqual([])
    const without: SoundListInfo = { ...taberna, tracks: taberna.tracks.slice(1) }
    const skipped = advanceSound(s, new Map([['taberna', without]]), env(T0 + 1000)).lists[0]
    expect(skipped?.order[skipped.index]).toBe('b')
    expect(
      voicesOf(advanceSound(s, new Map([['taberna', without]]), env(T0 + 1000)), new Map([['taberna', without]]))[0]
        ?.trackId
    ).toBe('b')
  })

  it('el volumen va de 0 a 1', () => {
    expect(setSoundVolume(EMPTY_SOUND, 3).volume).toBe(1)
    expect(setSoundVolume(EMPTY_SOUND, 0.4).volume).toBe(0.4)
  })

  it('las voces: la pista de cada lista, todas las de una simultánea y cada efecto', () => {
    const together: SoundListInfo = { ...taberna, id: 'juntas', mode: 'simultaneous' }
    const all = new Map([...lists, ['juntas', together]])
    let s: SoundState = startList(EMPTY_SOUND, taberna, env(T0))
    s = startList(s, { ...together, kind: 'effects' }, env(T0))
    s = startEffect(s, efectos, 'trueno', env(T0))
    expect(voicesOf(s, all).map((v) => v.trackId)).toEqual(['a', 'a', 'b', 'c', 'trueno'])
  })
})

describe('la sincronía en cada aparato', () => {
  const voice = { startedAt: T0, offset: 5, duration: 60, loop: false }

  it('la posición esperada sale de la hora del servidor', () => {
    expect(expectedPosition(voice, { serverNow: T0 + 10_000, paused: false, pausedAt: null })).toBe(15)
    expect(expectedPosition(voice, { serverNow: T0 + 90_000, paused: false, pausedAt: null })).toBeNull()
    expect(expectedPosition({ ...voice, loop: true }, { serverNow: T0 + 65_000, paused: false, pausedAt: null })).toBe(
      10
    )
    expect(expectedPosition(voice, { serverNow: T0 + 90_000, paused: true, pausedAt: T0 + 1000 })).toBe(6)
  })

  it('el desfase del reloj, por el punto medio del viaje', () => {
    expect(clockOffset({ sentAt: 1000, receivedAt: 1200, serverNow: 5100 })).toBe(4000)
  })

  it('se corrige si se desvía más del margen (también al dar la vuelta una que se repite)', () => {
    expect(needsSeek(10.3, 10, 0.5, 60)).toBe(false)
    expect(needsSeek(10.8, 10, 0.5, 60)).toBe(true)
    expect(needsSeek(11, 10, 1.5, 60)).toBe(false)
    expect(needsSeek(59.9, 0.1, 0.5, 60, true)).toBe(false)
  })

  it('el fundido: entra, sale al acabar y al parar', () => {
    const v = { ...voice, offset: 0, fade: 2, stopAt: null }
    expect(fadeGain(v, T0 + 1000)).toBeCloseTo(0.5)
    expect(fadeGain(v, T0 + 30_000)).toBe(1)
    expect(fadeGain(v, T0 + 59_000)).toBeCloseTo(0.5)
    expect(fadeGain({ ...v, stopAt: T0 + 31_000 }, T0 + 30_000)).toBeCloseTo(0.5)
    expect(fadeGain({ ...v, fade: 0 }, T0)).toBe(1)
  })
})
