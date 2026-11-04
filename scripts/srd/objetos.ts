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
  mechanics: Record<string, unknown> = { automation: 'text' },
  extra: { descripcion?: { es: string; en: string }; caracteristica?: string | null } = {}
): Doc {
  return {
    type: 'equipo',
    key: `${concept}_${edition}`,
    source: SOURCE[edition],
    concept,
    data: {
      name: { es: displayName(es, 'es'), en: displayName(en, 'en') },
      categoria: categoryOf(en),
      ...(extra.caracteristica ? { caracteristica: extra.caracteristica } : {}),
      peso: en.weight ?? 0,
      coste: en.cost,
      ...(extra.descripcion?.es && extra.descripcion.en ? { descripcion: extra.descripcion } : {})
    },
    mechanics,
    ref: { pages: { en: en.page, es: es.page } }
  }
}

/** La firma de un objeto: su tabla, si es de un grupo, su precio y su peso */
export const gearSignature = (r: GearRow) => `${categoryOf(r)}|${r.cost}|${r.weight}`

/** Una entrada de 2024 («Acid (25 GP)» y su texto), en el orden de lectura */
export interface Entry {
  name: string
  /** Su precio en piezas de oro (null: «Varies») */
  cost: number | null
  text: string
  page: number
  /** La sección en la que está («Artisan’s Tools», «Other Tools») */
  section: string | null
}

const ENTRY: Record<Lang, RegExp> = {
  en: /^(?<name>[A-Z][^()]*?(?: \([^)]*\))??) \((?<cost>[\d,]+ (?:CP|SP|GP)|Varies)\)$/,
  es: /^(?<name>[A-ZÁÉÍÓÚÑ][^()]*?(?: \([^)]*\))??) \((?<cost>[\d.]+ (?:pc|pp|po)|variable|Variable)\)$/
}

/** Solo el precio, en su línea: el título de la entrada estaba en la de arriba */
const ALONE: Record<Lang, RegExp> = {
  en: /^\((?:[\d,]+ (?:CP|SP|GP)|Varies)\)$/,
  es: /^\((?:[\d.]+ (?:pc|pp|po)|variable|Variable)\)$/
}

/** Las entradas de unas líneas en orden de lectura: cada una hasta la siguiente; las secciones, por su título */
export function entries(rows: readonly Row[], lang: Lang, sectionTitles: RegExp): Entry[] {
  const out: Entry[] = []
  let current: Entry | null = null
  let section: string | null = null
  // El texto de la entrada antes de su última línea: si la siguiente es solo el precio, esa línea era un título partido
  let before = ''
  let lastLine = ''
  for (const row of rows) {
    if (sectionTitles.test(row.text)) {
      section = row.text
      current = null
      continue
    }
    const alone = ALONE[lang].exec(row.text)
    if (alone && lastLine) {
      if (current) current.text = before
      const cost = /var/i.test(row.text)
        ? null
        : costOf(
            row.text.slice(1, -1).replace(/ [A-Z]+$/, (u) => u.toLowerCase()),
            lang
          )
      current = { name: lastLine, cost, text: '', page: row.page, section }
      out.push(current)
      lastLine = ''
      continue
    }
    const m = ENTRY[lang].exec(row.text)
    if (m?.groups) {
      const cost = /var/i.test(m.groups.cost as string)
        ? null
        : costOf(
            (m.groups.cost as string).replace(/ [A-Z]+$/, (u) => u.toLowerCase()),
            lang
          )
      current = { name: m.groups.name as string, cost, text: '', page: row.page, section }
      out.push(current)
      continue
    }
    lastLine = row.text
    if (!current) {
      before = ''
      continue
    }
    before = current.text
    const line = row.text
    if (!current.text) current.text = line
    else if (/[a-záéíóúñ]-$/i.test(current.text) && /^[a-záéíóúñ]/.test(line))
      current.text = current.text.slice(0, -1) + line
    else
      current.text = `${current.text}${/^(Ability|Utilize|Craft|Variants|Característica|Utilizar|Fabricar|Variantes):/.test(line) ? '\n' : ' '}${line}`
  }
  return out
}

/** Las tablas pequeñas de 2024 dentro del texto (la munición, los canalizadores, los símbolos sagrados), por su cabecera */
const SUB_HEADER: Record<Lang, RegExp> = {
  en: /^(Type Amount Storage Weight Cost|Focus Weight Cost|Symbol Weight Cost)$/,
  es: /^(Tipo Cantidad Recipiente Peso Precio|Canalizador Peso Precio|Símbolo Peso Precio)$/
}

/** Sin lo de entre paréntesis que aclara («Staff (also a Quarterstaff)», «Amulet (worn or held)») */
const bare = (name: string) => name.replace(/ \([^)]*\)$/, '')

export function subTables(rows: readonly Row[], lang: Lang): GearRow[] {
  const out: GearRow[] = []
  const ammo = new RegExp(
    `^(?<name>.+?) (?<amount>\\d+) (?<storage>\\S+) (?<weight>${WEIGHT[lang]}) (?<cost>${COST[lang]})$`
  )
  const plain = new RegExp(`^(?<name>.+?) (?<weight>${WEIGHT[lang]}) (?<cost>${COST[lang]})$`)
  let group: string | null = null
  let isAmmo = false
  let last: { row: Row; out: GearRow } | null = null
  for (const [i, row] of rows.entries()) {
    if (SUB_HEADER[lang].test(row.text)) {
      group = rows[i - 1]?.text ?? null
      isAmmo = /^(Type|Tipo) /.test(row.text)
      last = null
      continue
    }
    if (!group) continue
    const m = (isAmmo ? ammo : plain).exec(row.text)
    if (m?.groups) {
      const entry: GearRow = {
        name: isAmmo ? `${m.groups.name} (${m.groups.amount})` : bare(m.groups.name as string),
        table: 'gear',
        group,
        cost: costOf(
          (m.groups.cost as string).replace(/ [A-Z]+$/, (u) => u.toLowerCase()),
          lang
        ),
        weight: weightOf(m.groups.weight as string),
        page: row.page
      }
      out.push(entry)
      last = { row, out: entry }
      continue
    }
    // Un nombre que sigue abajo (en la munición, el número va en la primera línea)
    if (last && /^[a-záéíóúñ]/.test(row.text) && row.text.length < 25 && row.y - last.row.y < 30) {
      last.out.name = last.out.name.replace(/ \((\d+)\)$/, ` ${row.text} ($1)`)
      last.row = row
      continue
    }
    // Acaba la tabla
    if (last) group = null
    last = null
  }
  return out
}

/** Las herramientas de 2024: cada una con su característica y su texto; las variantes (juegos, instrumentos), sueltas */
export interface ToolRow extends GearRow {
  ability: string | null
  text: string
}

const ABILITY_NAMES: Record<string, string> = {
  strength: 'fue',
  dexterity: 'des',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'sab',
  charisma: 'car',
  fuerza: 'fue',
  destreza: 'des',
  constitución: 'con',
  inteligencia: 'int',
  sabiduría: 'sab',
  carisma: 'car'
}

export function toolRows(found: readonly Entry[], lang: Lang): ToolRow[] {
  const out: ToolRow[] = []
  for (const e of found) {
    const ability = /^(?:Ability|Característica): (\S+)/.exec(e.text)?.[1]?.toLowerCase()
    const weight = /(?:Weight|Peso): ([\d,/½]+ (?:lb\.|kg|g)|—)/.exec(e.text)?.[1]
    const artisan = /artisan|artesano/i.test(e.section ?? '')
    const base: Omit<ToolRow, 'name' | 'cost' | 'weight' | 'group'> = {
      table: 'tools',
      page: e.page,
      ability: ability ? (ABILITY_NAMES[ability] ?? null) : null,
      text: e.text
    }
    const variants = /^(?:Variants|Variantes): (.+)$/m.exec(e.text)?.[1]
    if (variants) {
      const group = /gaming|juego/i.test(e.name) ? 'Gaming Set' : 'Musical Instrument'
      for (const v of variants.matchAll(
        /([^,()]+?) \(([\d.,]+ (?:CP|SP|GP|pc|pp|po))(?:, ([\d,/½]+ (?:lb\.|kg|g)))?\)/g
      )) {
        const name = (v[1] as string).trim()
        out.push({
          ...base,
          name: name.charAt(0).toUpperCase() + name.slice(1),
          group,
          cost: costOf(
            (v[2] as string).replace(/ [A-Z]+$/, (u) => u.toLowerCase()),
            lang
          ),
          weight: v[3] ? weightOf(v[3]) : null
        })
      }
      continue
    }
    if (e.cost === null) continue
    out.push({
      ...base,
      name: e.name,
      group: artisan ? 'Artisan’s Tools' : null,
      cost: e.cost,
      weight: weight ? weightOf(weight) : null
    })
  }
  return out
}

/**
 * Los textos de 2014 que empiezan con su nombre («Acid. As an action…»): de cada nombre conocido, su texto hasta el
 * siguiente. Los nombres se comparan sin mayúsculas
 */
export function runInTexts(rows: readonly Row[], names: readonly string[], stop?: RegExp): Map<string, string> {
  const wanted = new Set(names.map((n) => n.toLowerCase()))
  const out = new Map<string, string>()
  let current: string | null = null
  for (const row of rows) {
    const m = /^([A-ZÁÉÍÓÚÑ][^.]{1,40})\. (.*)$/.exec(row.text)
    const name = m?.[1]?.toLowerCase()
    if (m && name && wanted.has(name)) {
      current = name
      out.set(name, m[2] as string)
      continue
    }
    // Un título de sección corta el texto: uno de los que se dicen o uno sin punto
    if (current && stop?.test(row.text)) {
      current = null
      continue
    }
    if (
      current &&
      row.text.length < 40 &&
      !/[.,;:)]$/.test(row.text) &&
      /^[A-ZÁÉÍÓÚÑ]/.test(row.text) &&
      !/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+ [a-z]/.test(row.text)
    ) {
      current = null
      continue
    }
    if (!current) continue
    const text = out.get(current) ?? ''
    out.set(
      current,
      /[a-záéíóúñ]-$/i.test(text) && /^[a-záéíóúñ]/.test(row.text)
        ? text.slice(0, -1) + row.text
        : `${text} ${row.text}`
    )
  }
  return out
}
