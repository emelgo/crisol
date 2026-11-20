/** «Hace 5 minutos», «ayer»… */
const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
const STEPS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['minute', 60],
  ['hour', 60],
  ['day', 24],
  ['week', 7],
  ['month', 4.35],
  ['year', 12]
]

export function since(at: string, now = Date.now()): string {
  let value = (new Date(at).getTime() - now) / 1000
  if (Math.abs(value) < 60) return relative.format(0, 'second')
  value /= 60
  for (const [unit, next] of STEPS) {
    if (Math.abs(value) < next || unit === 'year') return relative.format(Math.round(value), unit)
    value /= next
  }
  return relative.format(Math.round(value), 'year')
}
