// Portado de packages/tabletop/src/mesa/widgets/modelo.ts y tiempo.ts (Crisol actual, commit 3f68f11)
/**
 * Los widgets de la campaña (docs/specs/herramientas-mesa.md): contadores, relojes de progreso (segmentos) y
 * temporizadores. Cómo cambia el valor de cada uno, cómo corre un temporizador con el reloj de la pared mientras va
 * (`running.since`) y la cara de un reloj de progreso (cuñas desde las doce, en el sentido de las agujas). Puro.
 */

export type WidgetKind = 'counter' | 'clock' | 'timer'

export const WIDGET_KINDS: readonly WidgetKind[] = ['counter', 'clock', 'timer']

/** Los segmentos posibles de un reloj */
export const CLOCK_SEGMENTS = [3, 4, 6, 8, 10, 12] as const
export const DEFAULT_SEGMENTS = 4
/** La duración de un temporizador nuevo, en segundos */
export const DEFAULT_DURATION = 300
export const DEFAULT_WIDGET_COLOR: Readonly<Record<WidgetKind, string>> = {
  counter: '#f5b942',
  clock: '#e5484d',
  timer: '#4caf50'
}

/** Lo que un contador lee de sí mismo */
export interface CounterLimits {
  min?: number | null | undefined
  max?: number | null | undefined
}

/** Un temporizador: lo que le queda (en segundos) y, si va, desde cuándo (ms de la pared) y con cuánto empezó */
export interface TimerState {
  value: number
  duration: number
  running?: { since: number; remaining: number } | null | undefined
}

/** Ordenados por su orden (y por nombre si empatan) */
export const sortWidgets = <T extends { sort: number; label: string }>(widgets: readonly T[]): T[] =>
  [...widgets].sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label, 'es'))

/** Un orden libre al final de la lista */
export const nextWidgetSort = (widgets: readonly { sort: number }[]): number =>
  widgets.reduce((max, w) => Math.max(max, w.sort + 1), 0)

/** El valor de un contador dentro de su mínimo y su máximo */
export function clampCounter(limits: CounterLimits, value: number): number {
  let out = value
  if (typeof limits.min === 'number') out = Math.max(limits.min, out)
  if (typeof limits.max === 'number') out = Math.min(limits.max, out)
  return out
}

/** El valor de un contador tras sumarle `step`, dentro de sus límites */
export const counterStep = (limits: CounterLimits, value: number, step: number): number =>
  clampCounter(limits, value + step)

/** Segmentos rellenos de un reloj tras rellenar (+1) o vaciar (−1) */
export const clockStep = (segments: number, value: number, step: number): number =>
  Math.min(segments, Math.max(0, value + step))

/** Pulsar un segmento: se rellena hasta él; si era el último relleno, se vacía ese */
export const valueOnClick = (segment: number, value: number): number => (segment + 1 === value ? segment : segment + 1)

/** «MM:SS» (o «M:SS», «SS», «H:MM:SS») en segundos; null si no se entiende */
export function parseDuration(text: string): number | null {
  const parts = text.trim().split(':')
  if (parts.length === 0 || parts.length > 3 || parts.some((p) => !/^\d{1,3}$/.test(p))) return null
  const numbers = parts.map(Number)
  if (numbers.slice(1).some((n) => n >= 60)) return null
  return numbers.reduce((total, n) => total * 60 + n, 0)
}

/** Segundos como «MM:SS» (o «H:MM:SS» desde una hora) */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const two = (n: number): string => String(n).padStart(2, '0')
  const hours = Math.floor(s / 3600)
  return hours > 0
    ? `${hours}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`
    : `${two(Math.floor(s / 60))}:${two(s % 60)}`
}

// ── Temporizadores ──

/** Los segundos que le quedan en `now` (ms) */
export function secondsLeft(timer: TimerState, now: number): number {
  const r = timer.running
  if (!r) return Math.max(0, timer.value)
  return Math.max(0, r.remaining - (now - r.since) / 1000)
}

/** Los segundos enteros que enseña: uno de 5 minutos recién empezado enseña 05:00 hasta que pasa su primer segundo */
export const secondsShown = (timer: TimerState, now: number): number => Math.ceil(secondsLeft(timer, now) - 1e-9)

/** Milisegundos hasta que cambie lo que enseña (o hasta que se acabe) */
export function msToNextSecond(timer: TimerState, now: number): number {
  const left = secondsLeft(timer, now)
  if (left <= 0) return Number.POSITIVE_INFINITY
  const fraction = left - Math.floor(left)
  return Math.max(1, Math.round((fraction > 1e-9 ? fraction : 1) * 1000))
}

export const timerDone = (timer: TimerState, now: number): boolean => secondsLeft(timer, now) <= 0

/** Lo pone en marcha en `now`; si ya se acabó, empieza otra vez desde su duración entera */
export function startTimer(timer: TimerState, now: number): Pick<TimerState, 'value' | 'running'> {
  const left = secondsLeft(timer, now)
  const from = left > 0 ? left : timer.duration
  return { value: from, running: { since: now, remaining: from } }
}

/** El temporizador en pausa en `now`, con lo que le queda */
export const pauseTimer = (timer: TimerState, now: number): Pick<TimerState, 'value' | 'running'> => ({
  value: secondsLeft(timer, now),
  running: null
})

/** De vuelta a su duración entera, parado */
export const resetTimer = (timer: TimerState): Pick<TimerState, 'value' | 'running'> => ({
  value: timer.duration,
  running: null
})

// ── Relojes de progreso ──

/** Lado del cuadrado en que se dibuja la cara de un reloj */
export const CLOCK_SIDE = 32

export interface ClockFace {
  /** El trazado SVG de cada cuña, desde las doce en el sentido de las agujas */
  wedges: string[]
  /** La cuenta «3/6» del centro, con su tamaño para caber en el hueco */
  count: { text: string; fontSize: number } | null
}

/** Las cuñas (y la cuenta del centro, si se pide) de un reloj de `segments` en un cuadrado de `CLOCK_SIDE` */
export function clockFace(segments: number, value: number, withCount: boolean): ClockFace {
  const n = Math.max(1, Math.round(segments))
  const c = CLOCK_SIDE / 2
  const outer = c - 1
  // Con la cuenta en el centro, un anillo; sin ella, porciones hasta el centro
  const inner = withCount ? outer * 0.55 : 0
  const at = (radius: number, angle: number): string =>
    `${(c + radius * Math.sin(angle)).toFixed(3)} ${(c - radius * Math.cos(angle)).toFixed(3)}`
  const wedges = Array.from({ length: n }, (_, i) => {
    const a0 = (i / n) * Math.PI * 2
    const a1 = ((i + 1) / n) * Math.PI * 2
    const large = a1 - a0 > Math.PI ? 1 : 0
    // Una sola cuña: el círculo entero
    if (n === 1) return `M ${c} ${c - outer} A ${outer} ${outer} 0 1 1 ${c - 0.001} ${c - outer} Z`
    if (inner <= 0) return `M ${c} ${c} L ${at(outer, a0)} A ${outer} ${outer} 0 ${large} 1 ${at(outer, a1)} Z`
    return `M ${at(inner, a0)} L ${at(outer, a0)} A ${outer} ${outer} 0 ${large} 1 ${at(outer, a1)} L ${at(inner, a1)} A ${inner} ${inner} 0 ${large} 0 ${at(inner, a0)} Z`
  })
  const filled = Math.max(0, Math.min(n, Math.round(value)))
  const text = `${filled}/${n}`
  return {
    wedges,
    count: withCount ? { text, fontSize: Math.min(9, (inner * 2 * 0.8) / Math.max(2, text.length * 0.6)) } : null
  }
}
