/**
 * Las armas y las armaduras de los dos SRD: sus tablas, leídas fila a fila en cada idioma, emparejadas (el inglés con
 * el español por lo que dicen sus columnas; 2014 con 2024 por su nombre en inglés) y escritas como documentos del 5e
 */
import { type Edition, type Lang, type Line, SOURCE, slug } from './texto.ts'

/** Un documento del contenido, como lo guarda el 5e */
export interface Doc {
  type: string
  key: string
  source: string
  concept: string
  data: Record<string, unknown>
  mechanics: Record<string, unknown>
  ref: { pages: { en: number; es: number } }
}

// Lo que dicen las tablas, por idioma: los grupos, los tipos de daño, las maestrías, las propiedades y las monedas
const DAMAGE: Record<string, string> = {
  bludgeoning: 'contundente',
  piercing: 'perforante',
  slashing: 'cortante',
  contundente: 'contundente',
  perforante: 'perforante',
  cortante: 'cortante'
}
const MASTERY: Record<string, string> = {
  cleave: 'hender',
  graze: 'rozar',
  nick: 'mellar',
  push: 'empujar',
  sap: 'debilitar',
  slow: 'ralentizar',
  topple: 'derribar',
  vex: 'molestar',
  hender: 'hender',
  rozar: 'rozar',
  mellar: 'mellar',
  empujar: 'empujar',
  debilitar: 'debilitar',
  ralentizar: 'ralentizar',
  derribar: 'derribar',
  molestar: 'molestar'
}
const PROPERTY: [RegExp, string][] = [
  [/^(ammunition|munici[oó]n)/, 'municion'],
  [/^(finesse|sutil)/, 'sutil'],
  [/^(heavy|pesad)/, 'pesada'],
  [/^(light|liger)/, 'ligera'],
  [/^(loading|recarga)/, 'recarga'],
  [/^(reach|gran alcance|alcance$)/, 'alcance'],
  [/^(thrown|arrojadiz)/, 'arrojadiza'],
  [/^(two-handed|a dos manos)/, 'a_dos_manos'],
  [/^(versatile|vers[aá]til)/, 'versatil'],
  [/^(special|especial)/, 'especial']
]
/** En piezas de oro; en español, «pp» es la de plata */
const COINS: Record<Lang, Record<string, number>> = {
  en: { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 },
  es: { pc: 0.01, pp: 0.1, pe: 0.5, po: 1, ppt: 10 }
}

export type Group = 'simple_melee' | 'simple_ranged' | 'martial_melee' | 'martial_ranged'
export type ArmorGroup = 'ligera' | 'media' | 'pesada' | 'escudo'

const WEAPON_GROUPS: [RegExp, Group][] = [
  [/^(Simple Melee Weapons|Armas cuerpo a cuerpo sencillas)$/i, 'simple_melee'],
  [/^(Simple Ranged Weapons|Armas a distancia sencillas)$/i, 'simple_ranged'],
  [/^(Martial Melee Weapons|Armas cuerpo a cuerpo marciales)$/i, 'martial_melee'],
  [/^(Martial Ranged Weapons|Armas a distancia marciales)$/i, 'martial_ranged']
]
const ARMOR_GROUPS: [RegExp, ArmorGroup][] = [
  [/^(Light Armor|Armaduras ligeras)\b/i, 'ligera'],
  [/^(Medium Armor|Armaduras medias)\b/i, 'media'],
  [/^(Heavy Armor|Armaduras pesadas)\b/i, 'pesada'],
  [/^(Shields?|Escudos)( \(.*\))?$/i, 'escudo']
]

const WEAPON_ROW: Record<Edition, Record<Lang, RegExp>> = {
  '2024': {
    en: /^(?<name>.+?) (?<dmg>\d+d\d+|\d+) (?<type>Bludgeoning|Piercing|Slashing) (?<props>.+?) (?<mastery>Cleave|Graze|Nick|Push|Sap|Slow|Topple|Vex) (?<weight>[\d/]+ lb\.|—) (?<cost>[\d,]+ (?:CP|SP|GP))$/,
    es: /^(?<name>.+?) (?<dmg>\d+d\d+|\d+) (?<type>contundente|perforante|cortante) (?<props>.+?) (?<mastery>Debilitar|Derribar|Empujar|Hender|Mellar|Molestar|Ralentizar|Rozar) (?<weight>[\d,]+ k?g|—) (?<cost>[\d.]+ (?:pc|pp|po))$/
  },
  '2014': {
    en: /^(?<name>.+?) (?<cost>[\d,]+ (?:cp|sp|gp)) (?<dmg>\d+d\d+|\d+|—)(?: (?<type>bludgeoning|piercing|slashing))? (?<weight>[\d/]+ lb\.|—) (?<props>.+)$/,
    es: /^(?<name>.+?) (?<cost>[\d.]+ (?:pc|pp|po)) (?<dmg>\d+d\d+|\d+|—)(?: (?<type>contundente|perforante|cortante))? (?<weight>[\d,]+ k?g|—) (?<props>.+)$/
  }
}
const AC_EN = String.raw`\d+(?: \+ Dex modifier(?: \(max 2\))?)?|\+2`
const AC_ES = String.raw`\d+(?: \+ modificador por Des(?: \(máx\. 2\))?)?|\+2`
const ARMOR_ROW: Record<Edition, Record<Lang, RegExp>> = {
  '2024': {
    en: new RegExp(
      `^(?<name>.+?) (?<ac>${AC_EN}) (?<str>—|Str \\d+) (?<stealth>—|Disadvantage) (?<weight>[\\d/]+ lb\\.) (?<cost>[\\d,]+ GP)$`
    ),
    es: new RegExp(
      `^(?<name>.+?) (?<ac>${AC_ES}) (?<str>—|Fue \\d+) (?<stealth>—|Desventaja) (?<weight>[\\d,]+ kg) (?<cost>[\\d.]+ po)$`
    )
  },
  '2014': {
    en: new RegExp(
      `^(?<name>.+?) (?<cost>[\\d,]+ gp) (?<ac>${AC_EN}) ?(?<str>—|Str \\d+) (?<stealth>—|Disadvantage) (?<weight>[\\d/]+ lb\\.)$`
    ),
    es: new RegExp(
      `^(?<name>.+?) (?<cost>[\\d.]+ po) (?<ac>${AC_ES}) (?<str>—|Fue \\d+) (?<stealth>—|Desventaja) (?<weight>[\\d,]+ kg)$`
    )
  }
}

/** Un precio en piezas de oro («1,500 GP», «5 pp») */
export function costOf(text: string, lang: Lang): number {
  const [amount = '0', unit = ''] = text.split(' ')
  const value = Number(amount.replace(/[,.]/g, ''))
  const rate = COINS[lang][unit.toLowerCase()]
  if (rate === undefined) throw new Error(`Moneda desconocida: ${text}`)
  return Math.round(value * rate * 100) / 100
}

/** Un peso en libras («1/4 lb.»; en español, en kilos o gramos: 1 kg son 2 lb, como en la traducción oficial) */
export function weightOf(text: string): number | null {
  if (text === '—') return null
  const [amount = '0', unit = ''] = text.split(' ')
  if (unit.startsWith('lb')) {
    const [a, b] = amount.replace('½', '.5').split('/').map(Number)
    return b ? (a as number) / b : (a as number)
  }
  const value = Number(amount.replace(',', '.').replace('½', '.5'))
  return unit === 'g' ? (value / 1000) * 2 : value * 2
}

/** Las propiedades de un arma, como claves, y lo que dicen entre paréntesis: su distancia y su daño a dos manos */
export function propertiesOf(text: string): { keys: string[]; range: string | null; versatile: string | null } {
  if (text === '—') return { keys: [], range: null, versatile: null }
  // Separadas por comas, salvo las de dentro de un paréntesis
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const c of text) {
    if (c === '(') depth++
    if (c === ')') depth--
    if (c === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
    } else current += c
  }
  if (current.trim()) parts.push(current.trim())
  const keys: string[] = []
  let range: string | null = null
  let versatile: string | null = null
  for (const part of parts) {
    const lower = part.toLowerCase()
    const key = PROPERTY.find(([re]) => re.test(lower))?.[1]
    if (!key) throw new Error(`Propiedad desconocida: «${part}»`)
    if (!keys.includes(key)) keys.push(key)
    const distance = /(?:range|alcance) ([\d,]+\/[\d,]+)/i.exec(part)
    if (distance?.[1]) range = distance[1]
    const dice = /\((\d+d\d+)\)/.exec(part)
    if (key === 'versatil' && dice?.[1]) versatile = dice[1]
  }
  return { keys, range, versatile }
}

export interface WeaponRow {
  name: string
  group: Group
  damage: string
  type: string | null
  props: string
  mastery: string | null
  weight: number | null
  cost: number
  page: number
}

export interface ArmorRow {
  name: string
  group: ArmorGroup
  ac: string
  strength: number | null
  stealth: boolean
  weight: number
  cost: number
  page: number
}

/** Las filas de una tabla: con su grupo, y lo que sigue en la línea de abajo (un nombre o unas propiedades largas) */
function rowsOf<G extends string, R extends { name: string; page: number }>(
  lines: readonly Line[],
  groups: [RegExp, G][],
  row: RegExp,
  first: G,
  build: (m: Record<string, string>, group: G, page: number) => R,
  more: (r: R, text: string, inName: boolean) => void
): R[] {
  const rows: R[] = []
  let group: G = first
  let last: R | null = null
  for (const line of lines) {
    if (!line.text) {
      last = null
      continue
    }
    const header = groups.find(([re]) => re.test(line.text))
    if (header) {
      group = header[1]
      last = null
      continue
    }
    const m = row.exec(line.text)
    if (m?.groups) {
      last = build(m.groups, group, line.page)
      rows.push(last)
      continue
    }
    // La continuación de la fila de arriba: corta y pegada a ella
    if (last && line.text.length < 60) more(last, line.text, line.raw.length - line.raw.trimStart().length < 20)
    else last = null
  }
  return rows
}

/** Une una continuación: si la de arriba acaba en guion partiendo una palabra, sin espacio */
const join = (a: string, b: string) =>
  /[a-záéíóúñ]-$/i.test(a) && /^[a-záéíóúñ]/.test(b) ? a.slice(0, -1) + b : `${a} ${b}`

export function weaponRows(lines: readonly Line[], edition: Edition, lang: Lang, first: Group = 'simple_melee') {
  return rowsOf<Group, WeaponRow>(
    lines,
    WEAPON_GROUPS,
    WEAPON_ROW[edition][lang],
    first,
    (m, group, page) => ({
      name: m.name as string,
      group,
      damage: m.dmg === '—' ? '0' : (m.dmg as string),
      type: m.type ? (DAMAGE[m.type.toLowerCase()] ?? null) : null,
      props: m.props as string,
      mastery: m.mastery ? (MASTERY[m.mastery.toLowerCase()] ?? null) : null,
      weight: weightOf(m.weight as string),
      cost: costOf(m.cost as string, lang),
      page
    }),
    (r, text, inName) => {
      if (inName) r.name = `${r.name} ${text}`
      else r.props = join(r.props, text)
    }
  )
}

export function armorRows(lines: readonly Line[], edition: Edition, lang: Lang, first: ArmorGroup = 'ligera') {
  return rowsOf<ArmorGroup, ArmorRow>(
    lines,
    ARMOR_GROUPS,
    ARMOR_ROW[edition][lang],
    first,
    (m, group, page) => ({
      name: m.name as string,
      group,
      ac: m.ac as string,
      strength: m.str === '—' ? null : Number((m.str as string).split(' ')[1]),
      stealth: m.stealth !== '—',
      weight: weightOf(m.weight as string) as number,
      cost: costOf(m.cost as string, lang),
      page
    }),
    (r, text, inName) => {
      if (inName) r.name = `${r.name} ${text}`
    }
  )
}

/**
 * Empareja las filas del inglés con las del español: por lo que dicen (su firma, dentro de su grupo); si dos dicen lo
 * mismo, por la lista revisada a mano de nombres (inglés → español). Lo que no casa, se dice
 */
export function pair<R extends { name: string }>(
  en: readonly R[],
  es: readonly R[],
  signature: (r: R) => string,
  manual: Record<string, string> = {}
): [R, R][] {
  const norm = (text: string) => text.replace(/[’‘]/g, "'")
  const named = Object.fromEntries(Object.entries(manual).map(([k, v]) => [norm(k), norm(v)]))
  const pairs: [R, R][] = []
  const left = [...es]
  const take = (i: number) => left.splice(i, 1)[0] as R
  const pending: R[] = []
  for (const row of en) {
    const wanted = named[norm(row.name)]
    if (wanted !== undefined) {
      const i = left.findIndex((r) => norm(r.name) === wanted)
      if (i < 0) throw new Error(`No está «${wanted}» en español`)
      pairs.push([row, take(i)])
      continue
    }
    pending.push(row)
  }
  for (const row of pending) {
    const same = left.filter((r) => signature(r) === signature(row))
    if (same.length !== 1)
      throw new Error(
        `«${row.name}» (${signature(row)}) casa con ${same.length} en español: ${same.map((r) => r.name).join(', ') || 'ninguno'}`
      )
    pairs.push([row, take(left.indexOf(same[0] as R))])
  }
  if (left.length > 0) throw new Error(`Sin pareja en inglés: ${left.map((r) => r.name).join(', ')}`)
  // En el orden de la tabla inglesa
  return pairs.sort((a, b) => en.indexOf(a[0]) - en.indexOf(b[0]))
}

/**
 * El nombre en inglés de lo mismo en las dos ediciones («Crossbow, light» es «Light Crossbow»; «Padded», «Padded
 * Armor»; «Acid (vial)», «Acid»), con los cambios de nombre que se digan
 */
export function sameName(name: string, renames: Record<string, string> = {}): string {
  const lower = name
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/ \(.*\)$/, '')
    .replace(/ armor$/, '')
  const flipped = /^(.+), (.+)$/.exec(lower)
  const same = flipped ? `${flipped[2]} ${flipped[1]}` : lower
  return renames[same] ?? same
}

const isRanged = (g: Group) => g.endsWith('_ranged')

export function weaponDoc(edition: Edition, en: WeaponRow, es: WeaponRow, concept: string): Doc {
  const props = propertiesOf(en.props)
  const data: Record<string, unknown> = {
    name: { es: es.name, en: en.name },
    categoria: en.group.startsWith('simple') ? 'sencilla' : 'marcial',
    base: concept,
    distancia: isRanged(en.group),
    propiedades: props.keys,
    dano: en.damage,
    ...(props.versatile ? { dano_versatil: props.versatile } : {}),
    ...(en.type ? { tipo_dano: en.type } : {}),
    ...(props.range ? { alcance_distancia: props.range } : {}),
    ...(en.mastery ? { maestria: en.mastery } : {}),
    peso: en.weight ?? 0,
    coste: en.cost
  }
  const special = props.keys.includes('especial')
  return {
    type: 'arma',
    key: `${concept}_${edition}`,
    source: SOURCE[edition],
    concept,
    data,
    mechanics: special
      ? {
          automation: 'partial',
          manual: { es: 'Su propiedad especial se lleva a mano', en: 'Its special property is tracked by hand' }
        }
      : { automation: 'full' },
    ref: { pages: { en: en.page, es: es.page } }
  }
}

/** Las armaduras: la base de la CA cuando se lleva puesta; el escudo suma embrazado. Su Fuerza y su Sigilo, también */
const ARMOR_EFFECTS = [
  { target: 'ca', op: 'base', value: '@este.ca', when: '@este.puesta' },
  { target: 'habilidad.sigilo', op: 'disadvantage', when: '@este.puesta && @este.sigilo_desventaja' },
  {
    target: 'velocidad',
    op: 'add',
    value: '-10',
    when: '@este.puesta && @caracteristicas.fue.puntuacion < @este.fuerza'
  }
]
const SHIELD_EFFECTS = [{ target: 'ca', op: 'add', value: '@este.ca', when: '@este.embrazado' }]

export function armorDoc(edition: Edition, en: ArmorRow, es: ArmorRow, concept: string): Doc {
  const base = /^\+?(\d+)/.exec(en.ac)?.[1] ?? '0'
  const data: Record<string, unknown> = {
    name: { es: es.name, en: en.name },
    categoria: en.group,
    ca_base: Number(base),
    ...(/Dex/.test(en.ac) ? { suma_des: true } : {}),
    ...(/max 2/.test(en.ac) ? { des_max: 2 } : {}),
    ...(en.strength ? { fuerza: en.strength } : {}),
    ...(en.stealth ? { sigilo_desventaja: true } : {}),
    peso: en.weight,
    coste: en.cost
  }
  return {
    type: 'armadura',
    key: `${concept}_${edition}`,
    source: SOURCE[edition],
    concept,
    data,
    mechanics: { effects: en.group === 'escudo' ? SHIELD_EFFECTS : ARMOR_EFFECTS, automation: 'full' },
    ref: { pages: { en: en.page, es: es.page } }
  }
}

/** La firma de un arma: lo que dicen sus columnas, igual en los dos idiomas */
export const weaponSignature = (r: WeaponRow) => `${r.group}|${r.damage}|${r.type}|${r.cost}|${r.mastery ?? ''}`
/** La de una armadura: su grupo, su CA, su Fuerza, su Sigilo y su precio */
export const armorSignature = (r: ArmorRow) =>
  `${r.group}|${/^\+?\d+/.exec(r.ac)?.[0]}|${r.strength}|${r.stealth}|${r.cost}`

/** Los conceptos: el de 2024 por su nombre en español; el de 2014, el de su versión de 2024 (si la tiene) */
export function concepts<R extends { name: string }>(
  newer: readonly [R, R][],
  older: readonly [R, R][],
  renames: Record<string, string> = {},
  nameOf: (es: R) => string = (es) => es.name
) {
  const byEnglish = new Map(newer.map(([en, es]) => [sameName(en.name, renames), slug(nameOf(es))]))
  return {
    newer: newer.map(([, es]) => slug(nameOf(es))),
    older: older.map(([en, es]) => byEnglish.get(sameName(en.name, renames)) ?? slug(nameOf(es)))
  }
}

export { slug }
