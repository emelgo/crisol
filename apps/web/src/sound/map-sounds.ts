/**
 * Los sonidos del mapa en cada aparato (docs/specs/sonido-mapa.md): cuánto se oye cada uno desde los oyentes (las fichas
 * del grupo, las del jugador o el centro de la vista del máster), con los muros que paran el sonido, y su reproducción:
 * un elemento de audio en bucle por sonido, con el volumen del ambiente de este aparato, que sube y baja poco a poco
 * al moverse. No va a la vez entre aparatos: es un ambiente sin principio ni fin
 */
import type { SceneSoundView, ScreenSound } from '@crisol/contracts'
import { SOUND_DARK_FROM } from '@crisol/contracts'
import { audibleSounds, type Edge, type MapSound, type Point } from '@crisol/tabletop'
import { useEffect, useRef } from 'react'
import type { DeviceSound } from './device.ts'
import type { AudioLike } from './engine.ts'

export type MapSoundSource = MapSound & { url: string }

/** Un sonido del mapa que suena aquí, con lo que se oye (0–1, ya con su volumen) */
export interface MapVoice {
  id: string
  url: string
  gain: number
}

/** Lo que se oye de unos sonidos desde unos oyentes */
export function mapVoicesOf(input: {
  sounds: readonly MapSoundSource[]
  walls: readonly Edge[]
  listeners: readonly Point[]
}): MapVoice[] {
  return audibleSounds(input.sounds, input.listeners, input.walls).map(({ sound, gain }) => ({
    id: sound.id,
    url: sound.url,
    gain
  }))
}

/** Los sonidos de la escena que suenan para el máster: encendidos, con pista y con la oscuridad que piden */
export function masterMapSounds(
  sounds: readonly SceneSoundView[],
  scene: { cell: number; darkness: number }
): ScreenSound[] {
  return sounds.flatMap((s): ScreenSound[] => {
    const url = s.source.type === 'none' ? null : s.source.url
    if (!url || s.enabled === false || (s.darkOnly && scene.darkness < SOUND_DARK_FROM)) return []
    return [
      {
        id: s.id,
        x: s.x,
        y: s.y,
        radius: s.radius * scene.cell,
        volume: s.volume,
        easing: s.easing,
        walls: s.walls,
        url
      }
    ]
  })
}

/** Lo que cambia el volumen en cada vuelta (con 250 ms, un segundo de 0 a 1) */
const STEP = 0.25

export interface MapSoundEngine {
  update(voices: readonly MapVoice[]): void
  setDevice(device: DeviceSound): void
  unlock(): void
  tick(): void
  /** Si algo debería sonar */
  playing(): boolean
  dispose(): void
}

interface Entry {
  url: string
  gain: number
  audio: AudioLike
  starting: boolean
}

export function createMapSoundEngine(options: {
  device: DeviceSound
  onBlocked: (blocked: boolean) => void
  createAudio?: (url: string) => AudioLike
  /** Cada cuánto se mira (ms); 0: solo a mano (pruebas) */
  intervalMs?: number
}): MapSoundEngine {
  const createAudio = options.createAudio ?? ((url: string) => new Audio(url) as AudioLike)
  let device = options.device
  let blocked = false
  const entries = new Map<string, Entry>()

  const setBlocked = (value: boolean) => {
    if (blocked === value) return
    blocked = value
    options.onBlocked(value)
  }
  const release = (audio: AudioLike) => {
    audio.pause()
    audio.removeAttribute?.('src')
    audio.load?.()
  }
  const play = (entry: Entry) => {
    entry.starting = true
    let started: Promise<void>
    try {
      started = entry.audio.play()
    } catch (error) {
      started = Promise.reject(error)
    }
    Promise.resolve(started)
      .then(() => setBlocked(false))
      .catch((error: unknown) => {
        if ((error as { name?: string } | null)?.name === 'NotAllowedError') setBlocked(true)
      })
      .finally(() => {
        entry.starting = false
      })
  }
  const target = (entry: Entry) => (device.muted ? 0 : Math.min(1, Math.max(0, entry.gain * device.ambient)))

  const tick = () => {
    for (const entry of entries.values()) {
      const { audio } = entry
      const goal = target(entry)
      const now = audio.volume
      audio.volume = goal > now ? Math.min(goal, now + STEP) : Math.max(goal, now - STEP)
      if (audio.volume === 0 && goal === 0) {
        if (!audio.paused) audio.pause()
      } else if (audio.paused && !entry.starting && !blocked) play(entry)
    }
  }

  const timer = options.intervalMs === 0 ? null : setInterval(tick, options.intervalMs ?? 250)

  return {
    update(voices) {
      const wanted = new Map(voices.map((v) => [v.id, v]))
      for (const [id, entry] of entries) {
        const next = wanted.get(id)
        if (!next || next.url !== entry.url) {
          release(entry.audio)
          entries.delete(id)
        }
      }
      for (const voice of voices) {
        const current = entries.get(voice.id)
        if (current) {
          current.gain = voice.gain
          continue
        }
        const audio = createAudio(voice.url)
        audio.loop = true
        audio.preload = 'auto'
        // Entra desde el silencio
        audio.volume = 0
        entries.set(voice.id, { url: voice.url, gain: voice.gain, audio, starting: false })
      }
    },
    setDevice(next) {
      device = next
    },
    unlock() {
      setBlocked(false)
      for (const entry of entries.values()) if (target(entry) > 0) play(entry)
    },
    tick,
    playing: () => [...entries.values()].some((e) => target(e) > 0),
    dispose() {
      if (timer) clearInterval(timer)
      for (const entry of entries.values()) release(entry.audio)
      entries.clear()
    }
  }
}

/**
 * Oír el mapa: cada poco se miran los oyentes y los sonidos (sin volver a pintar nada) y se pasa al sonido de la mesa
 * lo que se oye (`setMap`, estable). `source` da lo de ahora; null, nada
 */
export function useMapHearing(
  setMap: ((voices: readonly MapVoice[]) => void) | null,
  source: () => { sounds: readonly MapSoundSource[]; walls: readonly Edge[]; listeners: readonly Point[] } | null,
  intervalMs = 300
) {
  const latest = useRef(source)
  latest.current = source
  useEffect(() => {
    if (!setMap) return
    const hear = () => {
      const now = latest.current()
      setMap(now && now.sounds.length > 0 ? mapVoicesOf(now) : [])
    }
    hear()
    const timer = setInterval(hear, intervalMs)
    return () => {
      clearInterval(timer)
      setMap([])
    }
  }, [setMap, intervalMs])
}
