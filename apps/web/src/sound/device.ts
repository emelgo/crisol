/**
 * El volumen de este aparato (docs/specs/sonido.md): ambiente, efectos y silenciar, guardados en él (el máster puede
 * silenciar su PC y dejar que suene la tele). Las pestañas abiertas del mismo aparato se enteran al momento
 */
import { useCallback, useEffect, useState } from 'react'

export interface DeviceSound {
  ambient: number
  effects: number
  muted: boolean
  /** El máster: oír los sonidos del mapa desde el centro de su vista (docs/specs/sonido-mapa.md) */
  map: boolean
}

export const DEFAULT_DEVICE: DeviceSound = { ambient: 0.8, effects: 1, muted: false, map: true }

const KEY = 'crisol.sonido.aparato'
const EVENT = 'crisol-sonido-aparato'

const clamp01 = (n: unknown, fallback: number) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback

export function readDevice(): DeviceSound {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<DeviceSound> | null
    if (!raw || typeof raw !== 'object') return DEFAULT_DEVICE
    return {
      ambient: clamp01(raw.ambient, DEFAULT_DEVICE.ambient),
      effects: clamp01(raw.effects, DEFAULT_DEVICE.effects),
      muted: raw.muted === true,
      map: raw.map !== false
    }
  } catch {
    return DEFAULT_DEVICE
  }
}

export function writeDevice(device: DeviceSound) {
  try {
    localStorage.setItem(KEY, JSON.stringify(device))
  } catch {
    // Sin almacenamiento (ventana privada…): vale para esta vez
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: device }))
}

export function useDeviceSound() {
  const [device, setDevice] = useState(readDevice)
  useEffect(() => {
    const changed = (event: Event) => setDevice((event as CustomEvent<DeviceSound>).detail)
    const stored = (event: StorageEvent) => {
      if (event.key === KEY) setDevice(readDevice())
    }
    window.addEventListener(EVENT, changed)
    window.addEventListener('storage', stored)
    return () => {
      window.removeEventListener(EVENT, changed)
      window.removeEventListener('storage', stored)
    }
  }, [])
  const change = useCallback((patch: Partial<DeviceSound>) => writeDevice({ ...readDevice(), ...patch }), [])
  return [device, change] as const
}
