/**
 * Los conjuros de los dos SRD: su cabecera (nivel, escuela, tiempo, alcance, componentes y duración), su texto en
 * Markdown y su mecánica, sacada del texto en inglés: el ataque o la salvación, el daño por partes, la curación y el
 * escalado. Lo que no se saca solo (los efectos de un conjuro que dura) va escrito a mano en `SPELL_MECHANICS`
 */
import { DAMAGE_TYPES } from '../../packages/systems/src/catalog/5e/system.ts'
import { PROFILES, range } from './capitulos.ts'
import { concepts, type Doc, pair } from './equipo.ts'
import { SPELL_PAIRS, SPELL_RENAMES } from './pares.ts'
import { basesOf, cut, joinLine, ruleRows, textOf } from './reglas.ts'
import { type Edition, type Lang, type Row, SOURCE } from './texto.ts'

const t = (es: string, en: string) => ({ es, en })

/** Dónde están las descripciones de los conjuros y dónde acaban */
const PAGES: Record<Edition, Record<Lang, { pages: [number, number]; stop?: RegExp }>> = {
  '2014': { en: { pages: [114, 195], stop: /^Traps$/ }, es: { pages: [120, 209], stop: /^Trampas$/ } },
  '2024': { en: { pages: [107, 175] }, es: { pages: [118, 193] } }
}
/** El alto del nombre de un conjuro */
const NAME_HEIGHT: Record<Edition, Record<Lang, number[]>> = {
  '2014': { en: [14.3], es: [16.1] },
  '2024': { en: [14.3], es: [14.3] }
}

/** Las escuelas, por su nombre en los dos idiomas */
const SCHOOL: Record<string, string> = {
  abjuration: 'abjuracion',
  divination: 'adivinacion',
  conjuration: 'conjuracion',
  enchantment: 'encantamiento',
  evocation: 'evocacion',
  illusion: 'ilusion',
  necromancy: 'nigromancia',
  transmutation: 'transmutacion',
  ilusionismo: 'ilusion',
  abjuracion: 'abjuracion',
  adivinacion: 'adivinacion',
  conjuracion: 'conjuracion',
  encantamiento: 'encantamiento',
  evocacion: 'evocacion',
  ilusion: 'ilusion',
  nigromancia: 'nigromancia',
  transmutacion: 'transmutacion'
}

/** Las clases, por su nombre en los dos idiomas */
const CLASS: Record<string, string> = {
  bard: 'bardo',
  cleric: 'clerigo',
  druid: 'druida',
  paladin: 'paladin',
  ranger: 'explorador',
  sorcerer: 'hechicero',
  warlock: 'brujo',
  wizard: 'mago',
  bardo: 'bardo',
  clerigo: 'clerigo',
  druida: 'druida',
  explorador: 'explorador',
  hechicero: 'hechicero',
  brujo: 'brujo',
  mago: 'mago'
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export interface SpellRow {
  name: string
  level: number
  school: string
  ritual: boolean
  castingTime: string
  range: string
  components: string
  duration: string
  /** Las clases que lo tienen, si lo dice su cabecera (en 2024) */
  classes: string[]
  text: string
  page: number
}

/** La línea del nivel y la escuela, en cada edición e idioma */
export function levelLine(line: string): { level: number; school: string; ritual: boolean; classes: string[] } | null {
  const ritual = /\((ritual)\)/i.test(line)
  // En el 5.1 español, «Evocación (truco)»
  const cantrip = /\(truco\)/i.test(line)
  const classes = (/\(([^)]*)\)\s*$/.exec(line.replace(/\s*\(ritual\)/i, ''))?.[1] ?? '')
    .split(/,\s*/)
    .map((c) => CLASS[fold(c)])
    .filter((c): c is string => Boolean(c))
  const bare = fold(line.replace(/\s*\([^)]*\)/g, ''))
  const patterns: [RegExp, (m: RegExpExecArray) => [number, string]][] = [
    // 2014: «3rd-level evocation», «Evocation cantrip», «Evocación nivel 3», «Truco de evocación»
    [/^(\d)(?:st|nd|rd|th)-level (\w+)$/, (m) => [Number(m[1]), m[2] as string]],
    [/^(\w+) cantrip$/, (m) => [0, m[1] as string]],
    [/^(\w+),? (?:de )?nivel (\d)$/, (m) => [Number(m[2]), m[1] as string]],
    [/^truco de (\w+)$/, (m) => [0, m[1] as string]],
    // 2024: «Level 3 Evocation», «Evocation Cantrip», «Evocación de nivel 3», «Truco de evocación»
    [/^level (\d) (\w+)$/, (m) => [Number(m[1]), m[2] as string]],
    [/^(\w+) de nivel (\d)$/, (m) => [Number(m[2]), m[1] as string]],
    [/^(\w+)$/, (m) => (cantrip ? [0, m[1] as string] : [-1, ''])]
  ]
  for (const [re, read] of patterns) {
    const m = re.exec(bare)
    if (!m) continue
    const [level, school] = read(m)
    const key = SCHOOL[school]
    if (key && level >= 0) return { level, school: key, ritual, classes }
  }
  return null
}

const balanced = (text: string) => (text.match(/\(/g)?.length ?? 0) <= (text.match(/\)/g)?.length ?? 0)

/** La línea del nivel, con lo que la sigue si va partida (la lista de clases de 2024), y cuántas líneas ocupa */
export function headLine(rows: readonly Row[]): [string, number] {
  let line = rows[0]?.text ?? ''
  let used = 1
  while (!balanced(line) && used < rows.length && used < 4) line = joinLine(line, (rows[used++] as Row).text)
  return [line, used]
}

/**
 * El nombre del primer conjuro de 2024 va con letras capitulares de otro tamaño: «A S» y, debajo, «cid plash». Juntos,
 * «Acid Splash», y sin esa línea
 */
export function dropCapName(name: string, rows: readonly Row[]): [string, Row[]] {
  const caps = name.split(' ')
  const rest = rows[0]?.text.split(' ') ?? []
  if (!caps.every((c) => /^[A-ZÁÉÍÓÚ]$/.test(c)) || caps.length !== rest.length) return [name, [...rows]]
  return [caps.map((c, i) => `${c}${rest[i]}`).join(' '), rows.slice(1)]
}

const LABELS: [RegExp, 'castingTime' | 'range' | 'components' | 'duration'][] = [
  [/^(Casting Time|Tiempo de lanzamiento):\s*/, 'castingTime'],
  [/^(Range|Alcance):\s*/, 'range'],
  [/^(Components?|Componentes?):\s*/, 'components'],
  [/^(Duration|Duración):\s*/, 'duration']
]

/** Un conjuro a partir de sus líneas: la de su nivel, las de su cabecera y su texto */
export function parseSpell(
  name: string,
  rows: readonly Row[],
  page: number,
  textRows: (rows: readonly Row[]) => string
): SpellRow {
  const [line, used] = headLine(rows)
  const head = levelLine(line)
  if (!head) throw new Error(`«${name}»: no entiendo «${line}»`)
  const fields = { castingTime: '', range: '', components: '', duration: '' }
  let current: keyof typeof fields | null = null
  let i = used
  for (; i < rows.length; i++) {
    const line = (rows[i] as Row).text
    const label = LABELS.find(([re]) => re.test(line))
    if (label) {
      current = label[1]
      fields[current] = line.replace(label[0], '')
      continue
    }
    // Lo que sigue a un campo partido en dos líneas: hasta la duración (y lo que abre un paréntesis, hasta cerrarlo)
    const open = (fields.components.match(/\(/g)?.length ?? 0) > (fields.components.match(/\)/g)?.length ?? 0)
    if (current && current !== 'duration') fields[current] = joinLine(fields[current], line)
    else if (current === 'duration' && open) fields.components = joinLine(fields.components, line)
    else break
  }
  if (!fields.duration) throw new Error(`«${name}»: sin duración`)
  return { name, ...head, ...fields, text: textRows(rows.slice(i)), page }
}

/** Los conjuros de una edición en un idioma, en su orden */
export function spellRows(edition: Edition, lang: Lang): SpellRow[] {
  const { pages, stop } = PAGES[edition][lang]
  const profile = PROFILES[edition][lang]
  const rows = ruleRows(edition, lang, range(...pages), profile.caps)
  const bases = basesOf(rows, profile.text)
  const names = NAME_HEIGHT[edition][lang]
  // El primero va después del título del capítulo; lo de antes (las listas, en 2014), no
  return cut(rows, (r) => names.includes(r.h) || profile.section.includes(r.h), stop)
    .map((e) => {
      const [name, own] = dropCapName(e.name, e.rows)
      return { ...e, name, rows: own }
    })
    .filter((e) => names.includes(e.h) && levelLine(headLine(e.rows)[0]) !== null)
    .map((e) => parseSpell(e.name, e.rows, e.page, (own) => textOf(own, { bases, profile: profile.text })))
}

/** Lo de un conjuro que no cambia con el idioma: su nivel, su escuela, sus componentes y sus dados */
export function spellSignature(r: SpellRow): string {
  const components = ['V', 'S', 'M'].filter((c) => new RegExp(`(^|[ ,])${c}([ ,(]|$)`).test(r.components)).join('')
  const time = fold(r.castingTime)
  const kind = /bonus|adicional/.test(time)
    ? 'bonus'
    : /reac/.test(time)
      ? 'reaction'
      : /action|accion/.test(time)
        ? 'action'
        : (/^(\d+)/.exec(time)?.[1] ?? '') + (/hour|hora/.test(time) ? 'h' : /day|dia/.test(time) ? 'd' : 'm')
  // Los dados, sin su orden («a d20» es «1d20»)
  const dice = [...new Set([...r.text.matchAll(/\b(\d*)d(\d+)\b/g)].map((m) => `${m[1] || 1}d${m[2]}`))]
    .sort()
    .join(',')
  const concentration = /^(concentration|concentracion)/.test(fold(r.duration))
  return `${r.level}|${r.school}|${r.ritual ? 'R' : ''}|${concentration ? 'C' : ''}|${components}|${kind}|${dice}|${rangeOf(r.range)}|${durationOf(r.duration)}`
}

/** El alcance en metros (en español van en metros: 5 pies son 1,5 m) o su clase («self», «touch») */
export function rangeOf(text: string): string {
  const t = fold(text).replace(/(\d),(\d)/g, '$1.$2')
  if (/^(self|lanzador|personal|uno mismo)/.test(t)) return 'self'
  if (/^(touch|toque)/.test(t)) return 'touch'
  if (/^(sight|vista)/.test(t)) return 'sight'
  if (/^(unlimited|ilimitado)/.test(t)) return 'unlimited'
  const feet = /([\d.]+) (?:feet|foot)/.exec(t)
  if (feet) return String(Math.round(Number(feet[1]) * 0.3 * 10) / 10)
  const metres = /([\d.]+) (?:m|metros?)\b/.exec(t)
  if (metres) return String(Number(metres[1]))
  const miles = /([\d.]+) miles?/.exec(t)
  if (miles) return `${Math.round(Number(miles[1]) * 1.5 * 10) / 10}km`
  const km = /([\d.]+) (?:km|kilometros?)/.exec(t)
  if (km) return `${Number(km[1])}km`
  return 'special'
}

/** La duración: un número y su unidad, o su clase */
export function durationOf(text: string): string {
  const t = fold(text)
  if (/^(instantaneous|instantane)/.test(t)) return 'inst'
  if (/(dispelled|se disipe|disipado)/.test(t)) return 'disp'
  const n = /(\d+) (round|asalto|minute|minuto|hour|hora|day|dia)/.exec(t)
  if (!n) return 'special'
  const unit = { round: 'r', asalto: 'r', minute: 'm', minuto: 'm', hour: 'h', hora: 'h', day: 'd', dia: 'd' }[
    n[2] as string
  ]
  return `${n[1]}${unit}`
}

/** El tipo de daño por su nombre en inglés */
const DAMAGE: Record<string, string> = Object.fromEntries(DAMAGE_TYPES.map(([key, , en]) => [en.toLowerCase(), key]))
const ABILITY: Record<string, string> = {
  strength: 'fue',
  dexterity: 'des',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'sab',
  charisma: 'car'
}
/** El modificador por característica para lanzar conjuros: el del conjuro (el suyo o el de quien lo lanza) */
const SPELL_MOD = '@este.mod'
const MOD = /\s*(?:\+|plus)\s*your spellcasting ability modifier/i
const WITH_MOD = String.raw`(?:\s*(?:\+|plus)\s*your spellcasting ability modifier)?`
/** Lo de lanzarlo a más nivel (o el truco a más nivel de personaje), que va aparte */
const HIGHER = /(At Higher Levels\.|Using a Higher-Level Spell Slot\.|Cantrip Upgrade\.)/

type Mechanics = Record<string, unknown>

const on = '@este.activo'
/**
 * Lo que cambia de quien lo tiene mientras dura (con el conjuro activo), escrito a mano por su nombre en inglés: la CA,
 * la velocidad, las resistencias. Lo demás de estos conjuros va en su texto
 */
const SPELL_EFFECTS: Record<string, (edition: Edition) => { effects: unknown[]; activation?: string }> = {
  'Mage Armor': () => ({
    effects: [{ target: 'ca', op: 'base', value: '13 + @caracteristicas.des.mod', when: `${on} && !@con_armadura` }]
  }),
  Shield: () => ({ effects: [{ target: 'ca', op: 'add', value: '5', when: on }], activation: 'reaction' }),
  'Shield of Faith': () => ({ effects: [{ target: 'ca', op: 'add', value: '2', when: on }] }),
  Barkskin: (edition) => ({
    effects: [{ target: 'ca', op: 'min', value: edition === '2014' ? '16' : '17', when: on }]
  }),
  Longstrider: () => ({ effects: [{ target: 'velocidad', op: 'add', value: '10', when: on }] }),
  Haste: () => ({
    effects: [
      { target: 'ca', op: 'add', value: '2', when: on },
      { target: 'salvacion.des', op: 'advantage', when: on },
      { target: 'velocidad', op: 'mul', value: '2', when: on }
    ]
  }),
  Aid: () => ({ effects: [{ target: 'pg_max', op: 'add', value: '5', when: on }] }),
  Stoneskin: () => ({
    effects: ['contundente', 'perforante', 'cortante'].map((d) => ({
      target: 'resistencias',
      op: 'append',
      value: `"${d}"`,
      when: on
    }))
  })
}

/** Lo que dura, para el conjuro activo: su duración en los dos idiomas */
export function withEffects(edition: Edition, en: SpellRow, es: SpellRow, mechanics: Mechanics): Mechanics {
  const extra = SPELL_EFFECTS[en.name]?.(edition)
  if (!extra) return mechanics
  const actions = (mechanics.actions as Record<string, unknown>[] | undefined) ?? [
    { key: 'lanzar', label: t(es.name, en.name), activation: extra.activation ?? activationOf(en.castingTime) }
  ]
  return {
    ...mechanics,
    actions,
    effects: extra.effects,
    toggle: { duration: t(es.duration, en.duration) },
    automation: 'partial'
  }
}

const activationOf = (castingTime: string) => {
  const time = castingTime.toLowerCase()
  return /bonus action/.test(time)
    ? 'bonus'
    : /reaction/.test(time)
      ? 'reaction'
      : /^(1 )?action/.test(time)
        ? 'action'
        : 'special'
}

/** Lo que se lanza: la acción, su ataque o su salvación, su daño por partes y su curación, del texto en inglés */
export function spellMechanics(en: SpellRow, name: { es: string; en: string }): Mechanics {
  const [body = '', higher = ''] = en.text.split(HIGHER).reduce<[string, string]>(
    (acc, part, i) => {
      if (i === 0) return [part, '']
      return [acc[0], `${acc[1]}${part}`]
    },
    ['', '']
  )
  const damage: { formula: string; type: string }[] = []
  const found = [
    // «8d6 fire damage», «1d8 + your spellcasting ability modifier force damage»
    ...[...body.matchAll(new RegExp(String.raw`(\d+d\d+(?:\s*\+\s*\d+)?)(${WITH_MOD})\s+(\w+) damage`, 'gi'))].map(
      (m) => ({
        at: m.index,
        dice: m[1] as string,
        mod: m[2] as string,
        type: m[3] as string
      })
    ),
    // «force damage equal to 1d8 + your spellcasting ability modifier»
    ...[...body.matchAll(new RegExp(String.raw`(\w+) damage equal to (\d+d\d+)(${WITH_MOD})`, 'gi'))].map((m) => ({
      at: m.index,
      dice: m[2] as string,
      mod: m[3] as string,
      type: m[1] as string
    }))
  ].sort((a, b) => a.at - b.at)
  for (const m of found) {
    const type = DAMAGE[m.type.toLowerCase()]
    if (!type) continue
    const formula = `${m.dice.replace(/\s+/g, '')}${m.mod && MOD.test(m.mod) ? ` + ${SPELL_MOD}` : ''}`
    if (!damage.some((d) => d.formula === formula && d.type === type)) damage.push({ formula, type })
  }
  const healMatch =
    new RegExp(String.raw`regains? (?:a number of )?hit points equal to (\d+d\d+${WITH_MOD})`, 'i').exec(body) ??
    /(?:regains?|restor(?:e|es|ing)) (\d+) hit points/i.exec(body)
  const heal = healMatch ? (healMatch[1] as string).replace(MOD, ` + ${SPELL_MOD}`) : undefined
  const attack = /\b(ranged|melee) spell attack/i.test(body)
  const saveMatch = /\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/.exec(body)
  if (!attack && !saveMatch && damage.length === 0 && !heal) return { automation: 'text' }
  const activation = activationOf(en.castingTime)
  const success = /half as much damage|half damage|half as much/i.test(body) ? 'half' : 'none'
  const action: Record<string, unknown> = {
    key: 'lanzar',
    label: name,
    activation,
    ...(attack ? { attack: '@este.ataque' } : {}),
    ...(saveMatch
      ? { save: { ability: ABILITY[(saveMatch[1] as string).toLowerCase()], dc: '@este.cd', success } }
      : {}),
    ...(damage.length > 0 ? { damage } : {}),
    ...(heal ? { heal } : {})
  }
  // En 2014, lo de los trucos va en su texto («when you reach 5th level (2d10)»)
  const scaling = scalingOf(en.level, en.level === 0 ? en.text : higher, damage)
  return { actions: [action], ...(scaling ? { scaling } : {}), automation: 'partial' }
}

/** Cómo escala: más dados por espacio de más nivel o, en un truco, por el nivel del personaje */
export function scalingOf(
  level: number,
  higher: string,
  damage: readonly { formula: string; type: string }[]
): Record<string, unknown> | null {
  const typed = /the (\w+) damage/i.exec(higher)?.[1]?.toLowerCase()
  const index = typed ? damage.findIndex((d) => d.type === DAMAGE[typed]) : -1
  const parts = index > 0 ? { parts: [index] } : {}
  if (level === 0) {
    const steps = [...higher.matchAll(/(\d+)(?:th)? (?:level )?\((\d+d\d+)\)/g)].map((m) => ({
      level: Number(m[1]),
      formula: m[2] as string
    }))
    return steps.length > 0 ? { mode: 'level', by: '@nivel', at: steps, ...parts } : null
  }
  const per = /(?:damage|healing)[^.]*?increases by (\d+d\d+|\d+) for each (?:spell )?slot level above/i.exec(
    higher
  )?.[1]
  return per ? { mode: 'slot', base: level, per, ...parts } : null
}

/** El documento de un conjuro de una edición: su cabecera, su texto en los dos idiomas y su mecánica */
export function spellDoc(
  edition: Edition,
  en: SpellRow,
  es: SpellRow,
  concept: string,
  classes: readonly string[],
  mechanics: Mechanics = withEffects(edition, en, es, spellMechanics(en, t(es.name, en.name)))
): Doc {
  return {
    type: 'conjuro',
    key: `${concept}_${edition}`,
    source: SOURCE[edition],
    concept,
    data: {
      name: t(es.name, en.name),
      nivel: en.level,
      escuela: en.school,
      tiempo: t(es.castingTime, en.castingTime),
      alcance: t(es.range, en.range),
      componentes: t(es.components, en.components),
      duracion: t(es.duration, en.duration),
      concentracion: /^concentration/i.test(en.duration),
      ritual: en.ritual,
      clases: [...classes],
      descripcion: t(es.text, en.text)
    },
    mechanics,
    ref: { pages: { en: en.page, es: es.page } }
  }
}

/** Con los apóstrofos rectos («Hunter’s Mark» es «Hunter's Mark») */
const straight = (name: string) => name.replace(/[’‘]/g, "'")

/** Las listas de conjuros por clase de 2014 (en inglés): cada conjuro, con las clases que lo tienen */
export function spellLists2014(rows: readonly Row[]): Map<string, string[]> {
  const out = new Map<string, string[]>()
  let current: string | null = null
  for (const row of rows) {
    const heading = /^(\w+) Spells$/.exec(row.text)
    if (heading) {
      current = CLASS[fold(heading[1] as string)] ?? null
      continue
    }
    if (!current || row.h !== 11.5) continue
    const name = straight(row.text)
    out.set(name, [...(out.get(name) ?? []), current])
  }
  return out
}

export function classesOf2014(): Map<string, string[]> {
  return spellLists2014(ruleRows('2014', 'en', range(105, 113)))
}

/** Los conjuros de una edición, emparejados: por la lista revisada y, los demás, por su firma */
export function spellPairs(edition: Edition): [SpellRow, SpellRow][] {
  return pair(spellRows(edition, 'en'), spellRows(edition, 'es'), spellSignature, SPELL_PAIRS[edition])
}

/** Los conjuros de las dos ediciones, con su concepto (el de 2024 en lo que está en las dos) y sus clases */
export function spellDocs(taken: ReadonlySet<string> = new Set()): Doc[] {
  const newer = spellPairs('2024')
  const older = spellPairs('2014')
  const names = concepts(newer, older, SPELL_RENAMES)
  // Un concepto que ya es de otro tipo (el escudo) lleva delante «conjuro_», para que su clave no se repita
  const own = (concept: string) => (taken.has(concept) ? `conjuro_${concept}` : concept)
  const lists = classesOf2014()
  return [
    ...older.map(([en, es], i) =>
      spellDoc('2014', en, es, own(names.older[i] as string), lists.get(straight(en.name)) ?? [])
    ),
    ...newer.map(([en, es], i) => spellDoc('2024', en, es, own(names.newer[i] as string), en.classes))
  ]
}
