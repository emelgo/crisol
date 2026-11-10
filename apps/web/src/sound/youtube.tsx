/**
 * YouTube en el sonido (docs/specs/sonido.md): con su reproductor insertado (la API IFrame) y siempre a la vista, en un
 * recuadro de al menos 200×200 px que se pliega a ese tamaño pero no se esconde (lo piden sus normas). Cada reproductor
 * va por donde debe con la hora del servidor y corrige si se desvía más de 1,5 s (los anuncios desfasan a quien los
 * recibe). Si un vídeo no deja insertarse (errores 101 y 150), se avisa
 */
import type { SoundView, SoundVoice } from '@crisol/contracts'
import { expectedPosition, needsSeek } from '@crisol/domain'
import { Maximize2, Minimize2, SquarePlay } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ServerClock } from './clock.ts'
import type { DeviceSound } from './device.ts'
import { voiceGain } from './engine.ts'
import styles from './sound.module.css'

/** Lo que se desvía como mucho un vídeo antes de saltar (s) */
export const YOUTUBE_MARGIN = 1.5
/** El tamaño más pequeño que admite YouTube para su reproductor */
export const YOUTUBE_MIN = 200

/** Lo que se usa del reproductor de YouTube */
export interface YtPlayer {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  setVolume(volume: number): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  setSize(width: number, height: number): void
  destroy(): void
}

interface YtEvent {
  target: YtPlayer
  data?: number
}

interface YtApi {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string
      width: number
      height: number
      playerVars: Record<string, number | string>
      events: {
        onReady?: (event: YtEvent) => void
        onError?: (event: YtEvent) => void
        onStateChange?: (event: YtEvent) => void
        onAutoplayBlocked?: (event: YtEvent) => void
      }
    }
  ) => YtPlayer
}

declare global {
  interface Window {
    YT?: YtApi & { loaded?: number }
    onYouTubeIframeAPIReady?: () => void
  }
}

const PLAYING = 1
const BUFFERING = 3

let loading: Promise<YtApi> | null = null

/** La API IFrame de YouTube, cargada una vez */
export function loadYoutube(): Promise<YtApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (loading) return loading
  loading = new Promise<YtApi>((resolve, reject) => {
    const before = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      before?.()
      if (window.YT) resolve(window.YT)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => {
      loading = null
      reject(new Error('YOUTUBE_UNAVAILABLE'))
    }
    document.head.append(script)
  })
  return loading
}

/** Qué hacer con un reproductor para que vaya con los demás */
export function youtubeStep(state: {
  expected: number | null
  current: number
  playing: boolean
  paused: boolean
  duration: number
  loop: boolean
}): { seek: number | null; play: boolean; pause: boolean } {
  if (state.expected === null) return { seek: null, play: false, pause: state.playing }
  const seek = needsSeek(state.current, state.expected, YOUTUBE_MARGIN, state.duration, state.loop)
    ? state.expected
    : null
  if (state.paused) return { seek, play: false, pause: state.playing }
  return { seek, play: !state.playing, pause: false }
}

/** El error de un vídeo: no deja insertarse (101, 150) o no existe (lo demás) */
export const youtubeError = (code: number | undefined): 'embed' | 'missing' =>
  code === 101 || code === 150 ? 'embed' : 'missing'

/**
 * Mira un vídeo en un recuadro a la vista: su duración, o por qué no vale. Para añadirlo a una lista (si no deja
 * insertarse, no se guarda)
 */
export async function probeYoutube(videoId: string, host: HTMLElement): Promise<{ duration: number; title: string }> {
  const YT = await loadYoutube()
  const mount = document.createElement('div')
  host.replaceChildren(mount)
  return new Promise<{ duration: number; title: string }>((resolve, reject) => {
    let done = false
    let tries = 0
    const finish = (player: YtPlayer | null, result: number | Error) => {
      if (done) return
      done = true
      // Su título, si el reproductor lo da (no está en su documentación: si no, sin él)
      const title = (player as { getVideoData?: () => { title?: string } } | null)?.getVideoData?.().title ?? ''
      player?.destroy()
      host.replaceChildren()
      if (result instanceof Error) reject(result)
      else resolve({ duration: result, title })
    }
    const player = new YT.Player(mount, {
      videoId,
      width: YOUTUBE_MIN,
      height: YOUTUBE_MIN,
      playerVars: { playsinline: 1, rel: 0 },
      events: {
        onReady: ({ target }) => {
          // La duración llega con los datos del vídeo: se espera un poco
          const check = () => {
            const duration = target.getDuration()
            if (duration > 0) return finish(target, duration)
            if (++tries > 30) return finish(target, new Error('YOUTUBE_NO_DURATION'))
            setTimeout(check, 200)
          }
          check()
        },
        onError: ({ data }) =>
          finish(player, new Error(youtubeError(data) === 'embed' ? 'YOUTUBE_EMBED' : 'YOUTUBE_MISSING'))
      }
    })
  })
}

/** Un vídeo sonando, sincronizado */
function YoutubeVoice({
  voice,
  view,
  clock,
  device,
  size,
  onBlocked,
  registerUnlock
}: {
  voice: SoundVoice
  view: SoundView
  clock: ServerClock
  device: DeviceSound
  size: number
  onBlocked: (blocked: boolean) => void
  registerUnlock: (unlock: () => void) => () => void
}) {
  const { t } = useTranslation()
  const host = useRef<HTMLDivElement>(null)
  const player = useRef<YtPlayer | null>(null)
  const [error, setError] = useState<'embed' | 'missing' | null>(null)
  const latest = useRef({ voice, view, device })
  latest.current = { voice, view, device }
  const sizeNow = useRef(size)
  sizeNow.current = size
  const videoId = voice.source.type === 'youtube' ? voice.source.videoId : ''

  useEffect(() => {
    let alive = true
    let created: YtPlayer | null = null
    const mount = document.createElement('div')
    host.current?.replaceChildren(mount)
    loadYoutube()
      .then((YT) => {
        if (!alive) return
        const { voice: v, view: s } = latest.current
        const start = expectedPosition(v, { serverNow: clock.now(), paused: s.paused, pausedAt: s.pausedAt }) ?? 0
        created = new YT.Player(mount, {
          videoId,
          width: sizeNow.current,
          height: sizeNow.current,
          playerVars: { autoplay: 1, playsinline: 1, rel: 0, start: Math.floor(start), loop: v.loop ? 1 : 0 },
          events: {
            onReady: ({ target }) => {
              player.current = target
            },
            onError: ({ data }) => setError(youtubeError(data)),
            onAutoplayBlocked: () => onBlocked(true),
            onStateChange: ({ data }) => {
              if (data === PLAYING) onBlocked(false)
            }
          }
        })
      })
      .catch(() => setError('missing'))
    const unregister = registerUnlock(() => player.current?.playVideo())
    return () => {
      alive = false
      unregister()
      created?.destroy()
      player.current = null
    }
    // Un vídeo nuevo, un reproductor nuevo; lo demás lo lleva la sincronía
  }, [videoId, clock, onBlocked, registerUnlock])

  useEffect(() => {
    player.current?.setSize(size, size)
  }, [size])

  // Cada medio segundo: volumen, pausa y desfase
  useEffect(() => {
    const sync = () => {
      const target = player.current
      if (!target) return
      const { voice: v, view: s, device: d } = latest.current
      const serverNow = clock.now()
      const state = target.getPlayerState()
      const step = youtubeStep({
        expected: expectedPosition(v, { serverNow, paused: s.paused, pausedAt: s.pausedAt }),
        current: target.getCurrentTime(),
        playing: state === PLAYING || state === BUFFERING,
        paused: s.paused,
        duration: v.duration,
        loop: v.loop
      })
      target.setVolume(Math.round(voiceGain(v, s, d, serverNow) * 100))
      if (step.seek !== null) target.seekTo(step.seek, true)
      if (step.pause) target.pauseVideo()
      if (step.play) target.playVideo()
    }
    const timer = setInterval(sync, 500)
    return () => clearInterval(timer)
  }, [clock])

  return (
    <div className={styles.ytVoice}>
      <div ref={host} className={styles.ytFrame} style={{ inlineSize: size, blockSize: size }} />
      {error && (
        <p className={styles.ytError} role="alert">
          {t(error === 'embed' ? 'sound.youtube.embed' : 'sound.youtube.missing')}
        </p>
      )}
    </div>
  )
}

/**
 * El recuadro de YouTube: mientras suena un vídeo, en una esquina y a la vista. Plegado, a su tamaño mínimo
 * (200×200); nunca se esconde
 */
export function YoutubeDock({
  view,
  clock,
  device,
  onBlocked,
  registerUnlock,
  className
}: {
  view: SoundView | null
  clock: ServerClock
  device: DeviceSound
  onBlocked: (blocked: boolean) => void
  registerUnlock: (unlock: () => void) => () => void
  className?: string
}) {
  const { t } = useTranslation()
  const [small, setSmall] = useState(false)
  const voices = (view?.voices ?? []).filter((v) => v.source.type === 'youtube')
  if (!view || voices.length === 0) return null
  const size = small ? YOUTUBE_MIN : 280
  return (
    <section className={`${styles.ytDock} ${className ?? ''}`} aria-label={t('sound.youtube.title')}>
      <header className={styles.ytHead}>
        <SquarePlay aria-hidden="true" size={15} />
        <span>{voices.map((v) => v.name).join(' · ')}</span>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={small ? t('sound.youtube.grow') : t('sound.youtube.shrink')}
          title={small ? t('sound.youtube.grow') : t('sound.youtube.shrink')}
          onClick={() => setSmall(!small)}
        >
          {small ? <Maximize2 aria-hidden="true" size={14} /> : <Minimize2 aria-hidden="true" size={14} />}
        </button>
      </header>
      {voices.map((voice) => (
        <YoutubeVoice
          key={voice.key}
          voice={voice}
          view={view}
          clock={clock}
          device={device}
          size={size}
          onBlocked={onBlocked}
          registerUnlock={registerUnlock}
        />
      ))}
    </section>
  )
}
