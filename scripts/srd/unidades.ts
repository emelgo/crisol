/**
 * Las medidas del SRD en español, en las de D&D (Enrique, 2026-11-06: «lo quiero todo en el sistema de dnd, no hace
 * falta pasarlo»). El SRD español pasó cada medida con una regla fija: 5 pies = 1,5 m, 1 milla = 1,5 km, 1 libra =
 * 0,5 kg, 1 pulgada = 2,5 cm y 1 galón = 4 l. Aquí se deshace: «a 1,5 m o menos» → «a 5 pies o menos»
 */

interface Unit {
  /** Cuánto es uno de los suyos en uno de D&D */
  per: number
  one: string
  many: string
  /** Si se dicen con fracciones (media milla, media libra) */
  fractions?: boolean
}

const FEET: Unit = { per: 0.3, one: 'pie', many: 'pies' }
const UNITS: [RegExp, Unit][] = [
  [/^(?:m²)$/i, { per: 0.09, one: 'pie cuadrado', many: 'pies cuadrados' }],
  [/^(?:m³)$/i, { per: 0.027, one: 'pie cúbico', many: 'pies cúbicos' }],
  [/^(?:km|kilómetros?)$/i, { per: 1.5, one: 'milla', many: 'millas', fractions: true }],
  [/^(?:kg|kilos?|kilogramos?)$/i, { per: 0.5, one: 'lb', many: 'lb', fractions: true }],
  [/^(?:g|gramos?)$/i, { per: 500, one: 'lb', many: 'lb', fractions: true }],
  [/^(?:cm|centímetros?)$/i, { per: 2.5, one: 'pulgada', many: 'pulgadas' }],
  [/^(?:l|litros?)$/i, { per: 4, one: 'galón', many: 'galones', fractions: true }],
  [/^(?:m|metros?)$/i, FEET]
]

const NUMBER = String.raw`\d+(?:,\d+)?`
const UNIT = String.raw`m²|m³|km|kg|cm|kilómetros?|kilogramos?|kilos?|centímetros?|metros?|litros?|gramos?|m|g|l`
/** Un número o dos («1,5 y 3», «24/96», «3 a 6»), y su unidad, sin letra pegada detrás */
const MEASURE = new RegExp(
  String.raw`(${NUMBER})(?:(\s*(?:\/|–|-)\s*|\s+(?:y|a|o)\s+)(${NUMBER}))?\s*(${UNIT})(?![\p{L}\d])`,
  'giu'
)

const value = (written: string) => Number(written.replace(',', '.'))

/** Un número como se escribe: entero, o con su fracción (½, ¼, ¾) si la unidad las lleva; si no, con coma */
function shown(n: number, fractions: boolean): string {
  const whole = Math.floor(n)
  const part = Math.round((n - whole) * 100) / 100
  if (part === 0) return String(whole)
  if (fractions && [0.25, 0.5, 0.75].includes(part)) {
    const fraction = part === 0.5 ? '1/2' : part === 0.25 ? '1/4' : '3/4'
    return whole > 0 ? `${whole} y ${fraction}` : fraction
  }
  return String(Math.round(n * 10) / 10).replace('.', ',')
}

/** Un número de la suya, en la de D&D: los pies y las pulgadas, en entero; lo demás, con fracciones si van */
function convert(n: number, unit: Unit): { text: string; amount: number } {
  const exact = n / unit.per
  const amount = unit.fractions ? Math.round(exact * 4) / 4 : Math.round(exact)
  return { text: shown(amount, Boolean(unit.fractions)), amount }
}

/** Un texto en español con sus medidas en las de D&D */
export function toImperial(text: string): string {
  return text.replace(
    MEASURE,
    (match, first: string, joiner: string | undefined, second: string | undefined, written: string) => {
      const unit = UNITS.find(([re]) => re.test(written))?.[1]
      if (!unit) return match
      const a = convert(value(first), unit)
      const b = second === undefined ? null : convert(value(second), unit)
      // Las pulgadas que hacen pies enteros, en pies (30 cm → 1 pie)
      if (unit.one === 'pulgada' && a.amount >= 12 && a.amount % 12 === 0 && (!b || b.amount % 12 === 0)) {
        const feet = (x: { amount: number }) => String(x.amount / 12)
        const last = b ? b.amount / 12 : a.amount / 12
        return `${feet(a)}${b ? `${joiner}${feet(b)}` : ''} ${last === 1 ? FEET.one : FEET.many}`
      }
      const last = b ?? a
      return `${a.text}${b ? `${joiner}${b.text}` : ''} ${last.amount === 1 ? unit.one : unit.many}`
    }
  )
}

/** Lo mismo en todos los textos en español de un valor (un documento, sus datos, su mecánica) */
export function imperialTexts<T>(value: T): T {
  if (Array.isArray(value)) return value.map(imperialTexts) as T
  if (!value || typeof value !== 'object') return value
  const entries = Object.entries(value as Record<string, unknown>).map(([k, v]) => [
    k,
    k === 'es' && typeof v === 'string' ? toImperial(v) : imperialTexts(v)
  ])
  return Object.fromEntries(entries) as T
}
