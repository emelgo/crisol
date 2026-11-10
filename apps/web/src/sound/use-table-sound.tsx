/**
 * El sonido en una Mesa o en la vista de jugadores (docs/specs/sonido.md): lo que suena llega por el canal de la mesa;
 * aquí se mide el desfase con el servidor, suenan los archivos y se sabe si el navegador lo bloquea. Lo comparten la
 * pestaña Sonido, la barra y el recuadro de YouTube
 */
import type { SoundView, TableServerMessage } from '@crisol/contracts'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createServerClock, type ServerClock } from './clock.ts'
import { type DeviceSound, useDeviceSound } from './device.ts'
import { createSoundEngine, type SoundEngine } from './engine.ts'
import { createMapSoundEngine, type MapSoundEngine, type MapVoice } from './map-sounds.ts'

export interface TableSound {
  view: SoundView | null
  /** Lo que devuelve una acción del sonido: se ve al momento, sin esperar al canal */
  setView(view: SoundView): void
  /** Los mensajes del canal de la mesa (los de sonido y la hora) */
  handle(message: TableServerMessage): void
  /** Con qué pedir la hora al servidor por el canal */
  bind(sendTime: (() => void) | null): void
  blocked: boolean
  unlock(): void
  device: DeviceSound
  setDevice(patch: Partial<DeviceSound>): void
  clock: ServerClock
  setYoutubeBlocked(blocked: boolean): void
  registerUnlock(unlock: () => void): () => void
  /** Los sonidos del mapa que se oyen aquí ahora (docs/specs/sonido-mapa.md) */
  setMap(voices: readonly MapVoice[]): void
}

/** Cuándo se vuelve a medir el desfase tras el primero (ms): unas pocas al empezar y luego de vez en cuando */
const FIRST_SAMPLES = [0, 1500, 4000]
const RESAMPLE_MS = 3 * 60_000

export function useTableSound(): TableSound {
  const clock = useMemo(() => createServerClock(), [])
  const [view, setViewState] = useState<SoundView | null>(null)
  const [fileBlocked, setFileBlocked] = useState(false)
  const [youtubeBlocked, setYoutubeBlocked] = useState(false)
  const [mapBlocked, setMapBlocked] = useState(false)
  const [mapPlaying, setMapPlaying] = useState(false)
  const mapEngine = useRef<MapSoundEngine | null>(null)
  const [device, setDevice] = useDeviceSound()
  const engine = useRef<SoundEngine | null>(null)
  const sendTime = useRef<(() => void) | null>(null)
  const sampling = useRef<Array<ReturnType<typeof setTimeout>>>([])
  const unlocks = useRef(new Set<() => void>())
  const deviceNow = useRef(device)
  deviceNow.current = device

  useEffect(() => {
    const created = createSoundEngine({ clock, device: deviceNow.current, onBlocked: setFileBlocked })
    engine.current = created
    const map = createMapSoundEngine({ device: deviceNow.current, onBlocked: setMapBlocked })
    mapEngine.current = map
    return () => {
      created.dispose()
      engine.current = null
      map.dispose()
      mapEngine.current = null
      for (const timer of sampling.current) clearTimeout(timer)
      sampling.current = []
    }
  }, [clock])

  useEffect(() => {
    engine.current?.setDevice(device)
    mapEngine.current?.setDevice(device)
  }, [device])

  const setMap = useCallback((voices: readonly MapVoice[]) => {
    mapEngine.current?.update(voices)
    setMapPlaying(mapEngine.current?.playing() ?? false)
  }, [])

  const setView = useCallback((next: SoundView) => {
    setViewState(next)
    engine.current?.update(next)
  }, [])

  const startSampling = useCallback(() => {
    if (sampling.current.length > 0) return
    const ping = () => sendTime.current?.()
    sampling.current = FIRST_SAMPLES.map((at) => setTimeout(ping, at))
    const again = () => {
      ping()
      sampling.current.push(setTimeout(again, RESAMPLE_MS))
    }
    sampling.current.push(setTimeout(again, RESAMPLE_MS))
  }, [])

  const handle = useCallback(
    (message: TableServerMessage) => {
      if (message.type === 'time') clock.sample(message.t, message.serverNow)
      else if (message.type === 'sound') {
        clock.hint(message.serverNow)
        startSampling()
        setView(message.sound)
      }
    },
    [clock, setView, startSampling]
  )

  const bind = useCallback((send: (() => void) | null) => {
    sendTime.current = send
  }, [])

  const unlock = useCallback(() => {
    engine.current?.unlock()
    mapEngine.current?.unlock()
    setYoutubeBlocked(false)
    for (const run of unlocks.current) run()
  }, [])

  const registerUnlock = useCallback((run: () => void) => {
    unlocks.current.add(run)
    return () => {
      unlocks.current.delete(run)
    }
  }, [])

  // Solo cuenta como bloqueado si hay algo que debería sonar
  const playing = (view?.voices.length ?? 0) > 0 && !view?.paused
  return {
    view,
    setView,
    handle,
    bind,
    blocked: (playing && (fileBlocked || youtubeBlocked)) || (mapPlaying && mapBlocked),
    unlock,
    device,
    setDevice,
    clock,
    setYoutubeBlocked,
    registerUnlock,
    setMap
  }
}

export const SoundContext = createContext<TableSound | null>(null)

export const useSound = () => useContext(SoundContext)
