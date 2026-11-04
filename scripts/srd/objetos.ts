/**
 * El equipo de aventurero de los dos SRD: sus tablas, cortadas por sus columnas (cada página puede traer dos), con
 * los de dentro de un grupo (munición, canalizadores, símbolos sagrados) sangrados bajo su cabecera
 */
import { costOf, type Doc, weightOf } from './equipo.ts'
import type { Box, Edition, Lang, Row } from './texto.ts'
import { rowsIn, SOURCE } from './texto.ts'

export interface GearRow {
  name: string
  /** De qué tabla sale (gear, tools) */
  table: string
  /** Su grupo, si es de uno: el texto de su cabecera */
  group: string | null
  cost: number
  weight: number | null
  page: number
}

const COST: Record<Lang, string> = { en: String.raw`[\d,]+ (?:cp|sp|gp|CP|SP|GP)`, es: String.raw`[\d.]+ (?:pc|pp|po)` }
const WEIGHT: Record<Lang, string> = {
  en: String.raw`[\d/½]+ lb\.(?: \(full\))?|—`,
  es: String.raw`[\d,½]+ k?g(?: \(llena\))?|—`
}

/** Las cabeceras de los grupos de objetos (lo de dentro va sangrado), en los dos idiomas: revisadas a mano */
export const GROUP_HEADERS =
  /^(Ammunition|Arcane Focus|Druidic Focus|Holy Symbol|Artisan’s Tools|Gaming Set|Musical Instrument|Munición|Canalizador(es)? arcanos?|Canalizador(es)? druídicos?|Símbolos? sagrados?|Herramientas de artesano|Juegos?|Instrumentos? musical(es)?)\b/i

/** Los títulos de las tablas de equipo: lo que sigue es de esa tabla, también en la columna o la página siguiente */
export const TABLE_TITLES: [RegExp, string][] = [
  [/^(Adventuring Gear|Equipo de aventureros)$/, 'gear'],
  [/^(Tools|Herramientas)$/, 'tools']
]

/** Lo que el PDF sangra como de un grupo y no lo es (el kit de disfraz y el de falsificación, sueltos) */
const NOT_IN_GROUP = /^(Disguise kit|Forgery kit|Útiles para disfrazarse|Útiles para falsificar)$/i

/** Los objetos de una columna de una tabla de equipo: los de dentro de un grupo, sangrados bajo su cabecera */
export function gearRows(rows: readonly Row[], edition: Edition, lang: Lang, state = { table: 'gear' }): GearRow[] {
  const order =
    edition === '2014'
      ? `(?<cost>${COST[lang]}) (?<weight>${WEIGHT[lang]})`
      : `(?<weight>${WEIGHT[lang]}) (?<cost>${COST[lang]})`
  const item = new RegExp(`^(?<name>.+?) ${order}$`)
  const matched = rows.map((row) => ({ row, m: item.exec(row.text) }))
  // Donde empieza la columna: lo más a la izquierda de sus objetos
  const base = Math.min(...matched.filter((r) => r.m).map((r) => r.row.x))
  const out: GearRow[] = []
  let group: string | null = null
  let last: { row: Row; out: GearRow } | null = null
  for (const { row, m } of matched) {
    const indented = row.x - base > 4
    if (!m?.groups) {
      const title = TABLE_TITLES.find(([re]) => re.test(row.text))
      if (title) state.table = title[1]
      else if (!indented && GROUP_HEADERS.test(row.text))
        group = row.text.replace(/ (Varies|Variable) (Varies|Variable)$/, '')
      // Un nombre que sigue en la línea de abajo, en minúsculas («Paquete de explorador de» / «mazmorras»)
      else if (last && /^[a-záéíóúñ]/.test(row.text) && row.text.length < 25 && row.y - last.row.y < 14)
        last.out.name = `${last.out.name} ${row.text}`
      last = null
      continue
    }
    if (!indented) group = null
    const name = m.groups.name as string
    const entry: GearRow = {
      name,
      table: state.table,
      group: indented && !NOT_IN_GROUP.test(name) ? group : null,
      cost: costOf(
        (m.groups.cost as string).replace(/ [A-Z]+$/, (u) => u.toLowerCase()),
        lang
      ),
      weight: weightOf((m.groups.weight as string).replace(/ \((full|llena)\)$/, '')),
      page: row.page
    }
    out.push(entry)
    last = { row, out: entry }
  }
  return out
}

/** Las filas de una tabla de equipo en unas páginas a dos columnas: cada mitad, por su sitio */
export function gearTable(
  pages: readonly { boxes: readonly Box[]; width: number }[],
  edition: Edition,
  lang: Lang
): GearRow[] {
  const state = { table: 'gear' }
  return pages.flatMap(({ boxes, width }) =>
    [
      { x0: 0, x1: width / 2 },
      { x0: width / 2, x1: width }
    ].flatMap((half) => gearRows(rowsIn(boxes, half), edition, lang, state))
  )
}

/** La categoría del 5e de un objeto, por su tabla y su grupo (en cualquiera de los dos idiomas) */
export function categoryOf(row: GearRow): string {
  const g = (row.group ?? '').toLowerCase()
  if (/ammunition|munición/.test(g)) return 'municion'
  if (/arcane|arcano/.test(g)) return 'canalizador_arcano'
  if (/druidic|druídico/.test(g)) return 'canalizador_druidico'
  if (/holy|sagrado/.test(g)) return 'simbolo_sagrado'
  if (/artisan|artesano/.test(g)) return 'herramienta_artesano'
  if (/gaming|juego/.test(g)) return 'juego'
  if (/musical/.test(g)) return 'instrumento'
  if (row.table === 'tools') return 'herramienta'
  return /pack$|^paquete/i.test(row.name) ? 'paquete' : 'aventura'
}

/** Lo que se dice tras el nombre de lo que es de un grupo de nombre corto («Cristal (canalizador arcano)») */
const GROUP_SUFFIX: Record<string, { es: string; en: string }> = {
  canalizador_arcano: { es: 'canalizador arcano', en: 'arcane focus' },
  canalizador_druidico: { es: 'canalizador druídico', en: 'druidic focus' },
  simbolo_sagrado: { es: 'símbolo sagrado', en: 'holy symbol' }
}

/** Su nombre a la vista: el de la tabla y, en un canalizador o un símbolo sagrado, de qué es */
export function displayName(row: GearRow, lang: Lang): string {
  const suffix = GROUP_SUFFIX[categoryOf(row)]
  return suffix ? `${row.name} (${suffix[lang]})` : row.name
}

export function gearDoc(
  edition: Edition,
  en: GearRow,
  es: GearRow,
  concept: string,
  mechanics: Record<string, unknown> = { automation: 'text' }
): Doc {
  return {
    type: 'equipo',
    key: `${concept}_${edition}`,
    source: SOURCE[edition],
    concept,
    data: {
      name: { es: displayName(es, 'es'), en: displayName(en, 'en') },
      categoria: categoryOf(en),
      peso: en.weight ?? 0,
      coste: en.cost
    },
    mechanics,
    ref: { pages: { en: en.page, es: es.page } }
  }
}

/** La firma de un objeto: su tabla, si es de un grupo, su precio y su peso */
export const gearSignature = (r: GearRow) => `${categoryOf(r)}|${r.cost}|${r.weight}`
