/** El color de un mundo: los fijos y los propios, que se recuerdan */
import type { World } from '@crisol/contracts'

/** Los colores fijos: de tono medio, para teñir el contorno sin chillar */
export const PRESET_COLORS: Record<'wine' | 'moss' | 'slate' | 'ochre' | 'sea' | 'plum', string> = {
  wine: '#9a4048',
  moss: '#5a8a64',
  slate: '#6a7a94',
  ochre: '#b08a3e',
  sea: '#3f86ad',
  plum: '#86609e'
}

/** El color de verdad (#rrggbb) de un mundo, o null si no tiene */
export function colorHex(color: World['color']): string | null {
  if (!color) return null
  return color.startsWith('#') ? color : PRESET_COLORS[color as keyof typeof PRESET_COLORS]
}

const STORAGE = 'crisol.colores'
const MAX = 10

/** Los colores propios que ha creado la cuenta (en este navegador), el último primero */
export function rememberedColors(email: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(`${STORAGE}.${email}`) ?? '[]') as unknown
    return Array.isArray(value)
      ? value.filter((c): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c))
      : []
  } catch {
    return []
  }
}

export function rememberColor(email: string, color: World['color']) {
  if (!color?.startsWith('#')) return
  try {
    const next = [color, ...rememberedColors(email).filter((c) => c.toLowerCase() !== color.toLowerCase())]
    localStorage.setItem(`${STORAGE}.${email}`, JSON.stringify(next.slice(0, MAX)))
  } catch {
    // Sin almacenamiento, no se recuerda: el mundo lo guarda igual
  }
}
