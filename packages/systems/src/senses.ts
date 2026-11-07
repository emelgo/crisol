/**
 * Los sentidos de un personaje para la niebla de la mesa (docs/specs/vision.md): de dónde los saca su hoja lo dice el
 * sistema (`senses`): unos campos numéricos o una lista escrita («Visión en la oscuridad 60 pies»). El alcance va en
 * la unidad de la rejilla; el servidor lo pasa a píxeles
 */
import type { System } from './format.ts'

export const SENSE_KINDS = ['darkvision', 'blindsight', 'truesight', 'tremorsense'] as const
export type SenseKind = (typeof SENSE_KINDS)[number]
/** Hasta dónde llega cada sentido, en la unidad de la rejilla */
export type SenseRanges = Partial<Record<SenseKind, number>>

/** Cómo se escribe cada sentido, en español y en inglés */
const NAMES: Record<SenseKind, RegExp> = {
  darkvision: /visi[oó]n en la oscuridad|visi[oó]n nocturna|infravisi[oó]n|darkvision/i,
  blindsight: /vista ciega|visi[oó]n ciega|blindsight/i,
  truesight: /visi[oó]n verdadera|vista verdadera|truesight/i,
  tremorsense: /sentido s[ií]smico|percepci[oó]n de vibraciones|tremorsense/i
}

const positive = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)

/** Los sentidos de unas entradas escritas: cada trozo (separado por comas o puntos y coma) con su nombre y su alcance */
export function parseSenses(entries: readonly unknown[]): SenseRanges {
  const found: SenseRanges = {}
  for (const entry of entries) {
    if (typeof entry !== 'string') continue
    for (const part of entry.split(/[,;]/)) {
      for (const kind of SENSE_KINDS) {
        const name = NAMES[kind].exec(part)
        if (!name) continue
        // El primer número después del nombre (o, si no hay, antes): «60 pies», «60 ft.», «18 m»
        const after = part.slice(name.index + name[0].length).match(/\d+(?:[.,]\d+)?/)
        const before = part.slice(0, name.index).match(/(\d+(?:[.,]\d+)?)\D*$/)
        const raw = after?.[0] ?? before?.[1]
        const range = raw ? positive(Number(raw.replace(',', '.'))) : null
        if (range !== null) found[kind] = Math.max(found[kind] ?? 0, range)
      }
    }
  }
  return found
}

/** Los sentidos de la hoja de un personaje (sus valores ya calculados), donde dice su sistema */
export function sensesOf(system: Pick<System, 'senses'>, sheet: Readonly<Record<string, unknown>>): SenseRanges {
  const where = system.senses
  if (!where) return {}
  const found: SenseRanges = where.list ? parseSenses(asList(sheet[where.list])) : {}
  for (const kind of SENSE_KINDS) {
    const field = where[kind]
    const value = field ? positive(sheet[field]) : null
    if (value !== null) found[kind] = Math.max(found[kind] ?? 0, value)
  }
  return found
}

const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : typeof value === 'string' ? [value] : [])
