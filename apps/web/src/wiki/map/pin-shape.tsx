/**
 * Las ocho formas de pin (las de Everlore, de Enrique): un trazo en una caja de 24 y su hueco blanco, donde va el
 * icono. La gota, la bandera y el banderín se clavan por la punta; las demás, por el centro
 */
import type { MapPinView } from '@crisol/contracts'
import { colorHex } from '../../routes/world-look.ts'

export const SHAPE_NAMES = ['teardrop', 'circle', 'diamond', 'bell', 'shield', 'flag', 'bookmark', 'pennant'] as const

const SHAPE_PATHS = [
  'M12 1.5c-4.7 0-8.5 3.8-8.5 8.5 0 6.3 8.5 12.8 8.5 12.8s8.5-6.5 8.5-12.8c0-4.7-3.8-8.5-8.5-8.5z',
  'M12 2.8a9.2 9.2 0 1 0 0 18.4a9.2 9.2 0 1 0 0-18.4z',
  'M12 2l10 10-10 10-10-10z',
  'M4 21V11a8 8 0 0 1 16 0v10z',
  'M3.5 5.5v6c0 5.5 4.2 8.5 8.5 10.5c4.3-2 8.5-5 8.5-10.5V5.5a2.2 2.2 0 0 0-2.2-2.2H5.7a2.2 2.2 0 0 0-2.2 2.2z',
  'M4.5 1.5h1.5v1c4.6-2 9.3 2 14 0v13c-4.7 2-9.4-2-14 0v4h-1.5z',
  'M4.5 2h15v20l-7.5-5-7.5 5z',
  'M5 2h14v13l-7 6-7-6z'
]

/** El hueco de cada forma: centro y radio */
const HOLES: [number, number, number][] = [
  [12, 9, 3],
  [12, 12, 3.3],
  [12, 12, 2.9],
  [12, 12.5, 3],
  [12, 11, 3],
  [11.5, 8.5, 2.6],
  [12, 9.5, 3],
  [11, 12, 2.8]
]

/** Se clava por la punta (abajo) y no por el centro */
export const tipAnchored = (pin: Pick<MapPinView, 'shape' | 'variant'>) =>
  pin.variant !== 2 && (pin.shape === 0 || pin.shape === 5 || pin.shape === 7)

/** Tinta legible sobre un color: negra sobre los claros, blanca sobre los oscuros */
export function contrastInk(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16)
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255]
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1b1d22' : '#ffffff'
}

export const pinHex = (color: string) => colorHex(color as Parameters<typeof colorHex>[0]) ?? '#9a4048'

/** El dibujo de un pin, sin el botón: para el mapa y para elegir la forma */
export function PinShape({
  shape,
  color,
  icon,
  size
}: {
  shape: number
  color: string
  icon?: string | null
  size: number
}) {
  const hex = pinHex(color)
  const path = SHAPE_PATHS[shape] ?? SHAPE_PATHS[0]
  const [cx, cy, r] = HOLES[shape] ?? HOLES[0] ?? [12, 9, 3]
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path d={path} fill={hex} stroke="rgb(0 0 0 / 0.55)" strokeWidth={1} strokeLinejoin="round" />
      {icon ? (
        <text x={cx} y={cy} fontSize={r * 2.6} textAnchor="middle" dominantBaseline="central" fill={contrastInk(hex)}>
          {icon}
        </text>
      ) : (
        <circle cx={cx} cy={cy} r={r} fill="#ffffff" />
      )}
    </svg>
  )
}
