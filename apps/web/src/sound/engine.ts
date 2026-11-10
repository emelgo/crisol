/**
 * La reproducción de los archivos en cada aparato (docs/specs/sonido.md): un elemento de audio por pista sonando, que
 * calcula dónde debería ir con la hora del servidor, salta ahí al entrar y corrige si se desvía más de medio segundo.
 * El volumen sale del general, el de la pista, el de este aparato y el fundido. Si el navegador no deja sonar, lo dice
 * hasta que un gesto lo desbloquee. YouTube va aparte, con su reproductor a la vista (youtube.tsx)
 */
import type { SoundView, SoundVoice } from '@crisol/contracts'
import { expectedPosition, fadeGain, needsSeek } from '@crisol/domain'
import type { ServerClock } from './clock.ts'
import type { DeviceSound } from './device.ts'

/** Lo que se usa de un elemento de audio (en las pruebas, uno de mentira) */
export interface AudioLike {
  src: string
  currentTime: number
  volume: number
  loop: boolean
  paused: boolean
  readyState: number
  preload: string
  play(): Promise<void>
  pause(): void
  addEventListener?(type: string, listener: () => void): void
  removeAttribute?(name: string): void
  load?(): void
}

/** Lo que se desvía como mucho un archivo antes de saltar (s) */
export const FILE_MARGIN = 0.5
/** Tras saltar, lo que se espera antes de volver a mirar (el salto tarda un poco) */
const SETTLE_MS = 1000

/** El volumen de una pista en este aparato: el general, el suyo, el de su clase aquí y el fundido */
export function voiceGain(voice: SoundVoice, view: SoundView, device: DeviceSound, serverNow: number): number {
  if (device.muted) return 0
  const kind = voice.kind === 'ambient' ? device.ambient : device.effects
  const gain = view.volume * voice.volume * kind * fadeGain(voice, serverNow)
  return Math.min(1, Math.max(0, gain))
}

export interface SoundEngine {
  update(view: SoundView | null): void
  setDevice(device: DeviceSound): void
  /** En un gesto (un clic): lo que el navegador no dejó sonar lo intenta otra vez */
  unlock(): void
  tick(): void
  dispose(): void
}

interface Entry {
  voice: SoundVoice
  audio: AudioLike
  starting: boolean
  seekedAt: number
  ended: boolean
}

export function createSoundEngine(options: {
  clock: ServerClock
  device: DeviceSound
  onBlocked: (blocked: boolean) => void
  createAudio?: (url: string) => AudioLike
  /** Cada cuánto se mira (ms); 0: solo a mano (pruebas) */
  intervalMs?: number
  local?: () => number
}): SoundEngine {
  const createAudio = options.createAudio ?? ((url: string) => new Audio(url) as AudioLike)
  const local = options.local ?? (() => performance.now())
  let device = options.device
  let view: SoundView | null = null
  let blocked = false
  const entries = new Map<string, Entry>()
  const preloaded = new Map<string, AudioLike>()

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

  const tick = () => {
    if (!view) return
    const serverNow = options.clock.now()
    const clock = { serverNow, paused: view.paused, pausedAt: view.pausedAt }
    for (const entry of entries.values()) {
      const { voice, audio } = entry
      const position = expectedPosition(voice, clock)
      if (position === null || (voice.stopAt !== null && serverNow >= voice.stopAt)) {
        if (!entry.ended) {
          entry.ended = true
          audio.pause()
        }
        continue
      }
      audio.volume = voiceGain(voice, view, device, serverNow)
      const ready = audio.readyState >= 1
      const settled = local() - entry.seekedAt > SETTLE_MS
      if (ready && settled && needsSeek(audio.currentTime, position, FILE_MARGIN, voice.duration, voice.loop)) {
        audio.currentTime = position
        entry.seekedAt = local()
      }
      if (view.paused) {
        if (!audio.paused) audio.pause()
      } else if (audio.paused && !entry.starting && !blocked) play(entry)
    }
  }

  const timer = options.intervalMs === 0 ? null : setInterval(tick, options.intervalMs ?? 250)

  return {
    update(next) {
      view = next
      // Los archivos del mundo y los audios de fuera (YouTube va aparte)
      const voices = (next?.voices ?? []).filter((v) => v.source.type === 'file' || v.source.type === 'url')
      const keys = new Set(voices.map((v) => v.key))
      for (const [key, entry] of entries)
        if (!keys.has(key)) {
          release(entry.audio)
          entries.delete(key)
        }
      for (const voice of voices) {
        const current = entries.get(voice.key)
        if (current) {
          current.voice = voice
          continue
        }
        if (voice.source.type !== 'file' && voice.source.type !== 'url') continue
        // Si ya estaba cargado (lo siguiente de la lista), se usa ese
        const url = voice.source.url
        const audio = preloaded.get(url) ?? createAudio(url)
        preloaded.delete(url)
        audio.preload = 'auto'
        audio.loop = voice.loop
        const entry: Entry = { voice, audio, starting: false, seekedAt: Number.NEGATIVE_INFINITY, ended: false }
        audio.addEventListener?.('loadedmetadata', tick)
        entries.set(voice.key, entry)
      }
      // Lo siguiente de cada lista, cargándose
      const wanted = new Set(next?.preload ?? [])
      for (const [url, audio] of preloaded)
        if (!wanted.has(url)) {
          release(audio)
          preloaded.delete(url)
        }
      for (const url of wanted)
        if (!preloaded.has(url)) {
          const audio = createAudio(url)
          audio.preload = 'auto'
          preloaded.set(url, audio)
        }
      tick()
    },
    setDevice(next) {
      device = next
      tick()
    },
    unlock() {
      setBlocked(false)
      for (const entry of entries.values()) if (!entry.ended && !view?.paused) play(entry)
    },
    tick,
    dispose() {
      if (timer) clearInterval(timer)
      for (const entry of entries.values()) release(entry.audio)
      for (const audio of preloaded.values()) release(audio)
      entries.clear()
      preloaded.clear()
    }
  }
}
