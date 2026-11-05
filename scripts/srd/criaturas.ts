/**
 * Las criaturas de los dos SRD: su perfil entero como datos (tamaño, tipo, CA, PG, velocidad, características,
 * salvaciones, habilidades, defensas, VD) y sus acciones con su ataque, su salvación, su daño, su recarga y su coste, con
 * fórmulas que dan los valores del SRD (si ninguna los da, el valor tal cual). Su perfil, también como texto
 */
import { ABILITIES, CONDITIONS, DAMAGE_TYPES, SKILLS } from '../../packages/systems/src/catalog/5e/system.ts'
import { PROFILES, range } from './capitulos.ts'
import { concepts, type Doc, pair } from './equipo.ts'
import { CREATURE_PAIRS, CREATURE_RENAMES } from './pares.ts'
import { cut, joinLine, ruleRows } from './reglas.ts'
import { type Edition, type Lang, type Row, SOURCE, slug } from './texto.ts'

const t = (es: string, en: string) => ({ es, en })

/** Dónde están: los monstruos y, en 2014, los apéndices de criaturas y PNJ; en 2024, los animales */
const RANGES: Record<Edition, Record<Lang, [number, number][]>> = {
  '2014': {
    en: [
      [261, 357],
      [366, 403]
    ],
    es: [
      [282, 388],
      [397, 437]
    ]
  },
  '2024': { en: [[258, 364]], es: [[283, 398]] }
}
/** El alto del nombre de un perfil */
const TITLE: Record<Edition, Record<Lang, number>> = {
  '2014': { en: 14.7, es: 16.7 },
  '2024': { en: 17.9, es: 17.9 }
}

const minus = (text: string) => text.replace(/−/g, '-')

/** Las etiquetas de la cabecera de un perfil, en las dos ediciones y los dos idiomas */
const LABELS: [RegExp, string][] = [
  [/^(Armor Class|AC|Clase de Armadura:?|CA:)\s*/, 'ac'],
  [/^(Hit Points|HP|Puntos de golpe:|PG:)\s*/, 'hp'],
  [/^(Speed|Velocidad:)\s*/, 'speed'],
  [/^(Saving Throws|Tiradas de salvación:)\s*/, 'saves'],
  [/^(Skills|Habilidades:)\s*/, 'skills'],
  [/^(Damage Vulnerabilities|Vulnerabilities|Vulnerabilidades(?: a(?:l)? daño)?:)\s*/, 'vulnerable'],
  [/^(Damage Resistances|Resistances|Resistencias(?: a(?:l)? daño)?:)\s*/, 'resistant'],
  [/^(Damage Immunities|Immunities|Inmunidades(?: a(?:l)? daño)?:)\s*/, 'immune'],
  [/^(Condition Immunities|Inmunidades a estados:)\s*/, 'conditions'],
  [/^(Senses|Sentidos:)\s*/, 'senses'],
  [/^(Languages|Idiomas:)\s*/, 'languages'],
  [/^(Challenge|CR|Desafío:|VD:)\s*/, 'cr'],
  [/^(Gear|Equipo:)\s*/, 'gear']
]
/** Cómo se llama cada etiqueta, para el texto */
const LABEL_TEXT: Record<string, Record<Lang, Record<Edition, string>>> = {
  ac: { en: { '2014': 'Armor Class', '2024': 'AC' }, es: { '2014': 'Clase de Armadura', '2024': 'CA' } },
  hp: { en: { '2014': 'Hit Points', '2024': 'HP' }, es: { '2014': 'Puntos de golpe', '2024': 'PG' } },
  speed: { en: { '2014': 'Speed', '2024': 'Speed' }, es: { '2014': 'Velocidad', '2024': 'Velocidad' } },
  saves: {
    en: { '2014': 'Saving Throws', '2024': 'Saving Throws' },
    es: { '2014': 'Tiradas de salvación', '2024': 'Tiradas de salvación' }
  },
  skills: { en: { '2014': 'Skills', '2024': 'Skills' }, es: { '2014': 'Habilidades', '2024': 'Habilidades' } },
  vulnerable: {
    en: { '2014': 'Damage Vulnerabilities', '2024': 'Vulnerabilities' },
    es: { '2014': 'Vulnerabilidades a daño', '2024': 'Vulnerabilidades' }
  },
  resistant: {
    en: { '2014': 'Damage Resistances', '2024': 'Resistances' },
    es: { '2014': 'Resistencias a daño', '2024': 'Resistencias' }
  },
  immune: {
    en: { '2014': 'Damage Immunities', '2024': 'Immunities' },
    es: { '2014': 'Inmunidades a daño', '2024': 'Inmunidades' }
  },
  conditions: {
    en: { '2014': 'Condition Immunities', '2024': 'Condition Immunities' },
    es: { '2014': 'Inmunidades a estados', '2024': 'Inmunidades a estados' }
  },
  senses: { en: { '2014': 'Senses', '2024': 'Senses' }, es: { '2014': 'Sentidos', '2024': 'Sentidos' } },
  languages: { en: { '2014': 'Languages', '2024': 'Languages' }, es: { '2014': 'Idiomas', '2024': 'Idiomas' } },
  cr: { en: { '2014': 'Challenge', '2024': 'CR' }, es: { '2014': 'Desafío', '2024': 'VD' } },
  gear: { en: { '2014': 'Gear', '2024': 'Gear' }, es: { '2014': 'Equipo', '2024': 'Equipo' } }
}

/** Las partes de un perfil: lo de antes de las acciones (sus atributos) y cada tipo de acción */
const SECTIONS: [RegExp, Section['kind']][] = [
  [/^(Traits|Atributos|Rasgos)$/, 'traits'],
  [/^(Actions|Acciones)$/, 'actions'],
  [/^(Bonus Actions|Acciones adicionales)$/, 'bonus'],
  [/^(Reactions|Reacciones)$/, 'reactions'],
  [/^(Legendary Actions|Acciones legendarias)$/, 'legendary'],
  [/^(Lair Actions|Acciones de guarida)$/, 'lair']
]

export interface Entry {
  name: string
  text: string
}

export interface Section {
  kind: 'traits' | 'actions' | 'bonus' | 'reactions' | 'legendary' | 'lair'
  /** Lo de antes de la primera entrada (cuántas acciones legendarias) */
  intro: string
  entries: Entry[]
}

export interface Statblock {
  name: string
  page: number
  /** Su tamaño, tipo y alineamiento */
  meta: string
  fields: Record<string, string>
  /** Sus puntuaciones (fue, des, con, int, sab, car) y, en 2024, sus salvaciones */
  scores: number[]
  saves: number[] | null
  sections: Section[]
}

/**
 * Lo que empieza una entrada: su nombre en mayúscula y un punto («Tentacle.», «Fire Breath (Recharge 5–6).»). Un
 * nombre no lleva comas ni cifras (salvo en su paréntesis): «DC 21, each creature in a 60-foot Cone.» y «Slashing damage
 * plus 3 (1d6) Acid damage.» siguen a la entrada de antes
 */
const ENTRY = /^([A-ZÁÉÍÓÚÑ¡¿][^.:,\d]{0,70}?(?: \([^)]*\))?)\. (.*)$/

/** Un perfil a partir de sus líneas */
export function parseStatblock(name: string, rows: readonly Row[], page: number): Statblock {
  const fields: Record<string, string> = {}
  const scores: number[] = []
  let saves: number[] | null = null
  const sections: Section[] = []
  let label: string | null = null
  let meta = ''
  let i = 0
  // La primera línea, su tamaño, tipo y alineamiento (puede ir partida)
  for (; i < rows.length; i++) {
    const line = (rows[i] as Row).text
    if (LABELS.some(([re]) => re.test(line))) break
    meta = joinLine(meta, line).trim()
  }
  let header = true
  let current: Section = { kind: 'traits', intro: '', entries: [] }
  let last: Row | null = null
  for (; i < rows.length; i++) {
    const row = rows[i] as Row
    const line = minus(row.text)
    const section = SECTIONS.find(([re]) => re.test(row.text))
    if (section) {
      header = false
      if (current.entries.length > 0 || current.intro) sections.push(current)
      current = { kind: section[1], intro: '', entries: [] }
      last = row
      continue
    }
    if (header) {
      // Las características: en 2014, una fila de seis «21 (+5)»; en 2024, dos de tres «Str 21 +5 +5»
      const old = [...line.matchAll(/(\d+) \(([+-]\d+)\)/g)]
      if (old.length === 6) {
        scores.push(...old.map((m) => Number(m[1])))
        continue
      }
      // (Una salvación sin signo, errata del SRD, «Int 6 −2 2», lleva el del modificador)
      const triples = [...line.matchAll(/(\d+) ([+-]\d+) ([+-]?\d+)/g)]
      if (triples.length === 3) {
        scores.push(...triples.map((m) => Number(m[1])))
        const signed = (m: RegExpMatchArray) =>
          /^[+-]/.test(m[3] as string) ? Number(m[3]) : Math.sign(Number(m[2]) || 1) * Number(m[3])
        saves = [...(saves ?? []), ...triples.map(signed)]
        continue
      }
      if (/^(STR|FUE|MOD)\b/.test(line)) continue
      const found = LABELS.find(([re]) => re.test(row.text))
      if (found) {
        label = found[1]
        // En 2024, la CA y la iniciativa van en la misma línea
        const [ac, initiative] = row.text.replace(found[0], '').split(/\s+(?:Initiative|Iniciativa:)\s+/)
        fields[label] = (ac ?? '').trim()
        if (initiative !== undefined) fields.initiative = initiative.trim()
        continue
      }
      // Sigue la etiqueta de antes hasta su VD; después, sus atributos
      if (label && label !== 'cr') {
        fields[label] = joinLine(fields[label] ?? '', row.text)
        continue
      }
      header = false
    }
    // («Bludgeoning damage.» al principio de una línea sigue al daño de la de antes)
    const entry = /\bdamage$/i.test(ENTRY.exec(row.text)?.[1] ?? '') ? null : ENTRY.exec(row.text)
    const ended = !last || /[.:)]$/.test(last.text) || SECTIONS.some(([re]) => re.test(last?.text ?? ''))
    if (entry && ended) current.entries.push({ name: entry[1] as string, text: entry[2] as string })
    else {
      const open = current.entries.at(-1)
      const indented = last !== null && row.x - last.x > 3 && /[.:)]$/.test(last.text)
      if (open) open.text = indented ? `${open.text}\n\n${row.text}` : joinLine(open.text, row.text)
      else current.intro = joinLine(current.intro, row.text).trim()
    }
    last = row
  }
  if (current.entries.length > 0 || current.intro) sections.push(current)
  return { name, page, meta, fields, scores, saves, sections }
}

/** Los perfiles de una edición en un idioma, en su orden */
export function statblocks(edition: Edition, lang: Lang): Statblock[] {
  const profile = PROFILES[edition][lang]
  const title = TITLE[edition][lang]
  return RANGES[edition][lang].flatMap(([from, to]) => {
    const rows = ruleRows(edition, lang, range(from, to), profile.caps)
    // Cada perfil acaba en el siguiente título de cualquier tipo (otro perfil, su grupo, un capítulo)
    const headings = new Set([title, ...profile.chapter, ...profile.section, ...(profile.text.headings[0] ?? [])])
    return cut(rows, (r) => headings.has(r.h))
      .filter((e) => e.h === title && e.rows.some((r) => LABELS.some(([re, k]) => k === 'hp' && re.test(r.text))))
      .map((e) => parseStatblock(e.name, e.rows, e.page))
  })
}

/** Un número de la cabecera (la CA, los PG), sin lo de detrás */
const firstNumber = (text: string | undefined) => Number(/(\d+)/.exec(text ?? '')?.[1] ?? Number.NaN)

/** El VD como número («1/2», «10») */
export function crOf(text: string | undefined): number {
  const m = /^(\d+)(?:\/(\d+))?/.exec((text ?? '').trim())
  if (!m) return Number.NaN
  return m[2] ? Number(m[1]) / Number(m[2]) : Number(m[1])
}

/** Los PX del VD («10 (5,900 XP)», «10 (XP 5,900, or…)», «10 (5900 PX…)») */
export function xpOf(text: string | undefined): number {
  const m = /\((?:XP\s*)?([\d,. ]+)\s*(?:XP|PX)?/.exec(text ?? '')
  return m ? Number((m[1] as string).replace(/[,. ]/g, '')) : Number.NaN
}

/** Lo que no cambia con el idioma: su VD, sus PG, su CA y sus puntuaciones */
export const statblockSignature = (s: Statblock) =>
  `${crOf(s.fields.cr)}|${firstNumber(s.fields.hp)}|${firstNumber(s.fields.ac)}|${s.scores.join(',')}`

const ABILITY_KEYS = ABILITIES.map(([key]) => key)
const ABILITY: Record<string, string> = Object.fromEntries(
  ABILITIES.flatMap(([key, , en, , abbr]) => [
    [en.toLowerCase(), key],
    [abbr.toLowerCase(), key]
  ])
)
const SKILL: Record<string, string> = Object.fromEntries(SKILLS.map(([key, , en]) => [en.toLowerCase(), key]))
const DAMAGE: Record<string, string> = Object.fromEntries(DAMAGE_TYPES.map(([key, , en]) => [en.toLowerCase(), key]))
const CONDITION: Record<string, string> = Object.fromEntries(CONDITIONS.map(([key, , en]) => [en.toLowerCase(), key]))
const SIZE: [RegExp, string][] = [
  [/\b(tiny|diminut[ao])\b/i, 'diminuta'],
  [/\b(small|peque[nñ][ao])\b/i, 'pequena'],
  [/\b(medium|median[ao])\b/i, 'mediana'],
  [/\b(large|grande)\b/i, 'grande'],
  [/\b(huge|enorme)\b/i, 'enorme'],
  [/\b(gargantuan|gargantues[ca][ao]?)\b/i, 'gargantuesca']
]

const mod = (score: number) => Math.floor((score - 10) / 2)
const proficiency = (cr: number) => Math.max(2, Math.ceil(cr / 4) + 1)

/** Las claves de los tipos de daño que nombra un texto (en inglés) */
const damageKeys = (text: string | undefined) =>
  [...new Set([...(text ?? '').toLowerCase().matchAll(/[a-z]+/g)].map((m) => DAMAGE[m[0]]).filter(Boolean))] as string[]
const conditionKeys = (text: string | undefined) =>
  [
    ...new Set([...(text ?? '').toLowerCase().matchAll(/[a-z]+/g)].map((m) => CONDITION[m[0]]).filter(Boolean))
  ] as string[]

type Mechanics = Record<string, unknown>

/**
 * La fórmula de un valor con el modificador de una de sus características (y, si se dice, la competencia) que dé lo del
 * SRD; si ninguna lo da, el valor tal cual
 */
function formulaFor(
  value: number,
  scores: readonly number[],
  { base, prof, order }: { base: number; prof: number; order: readonly string[] }
): { formula: string; ability: string | null } {
  for (const key of order) {
    const score = scores[ABILITY_KEYS.indexOf(key as (typeof ABILITY_KEYS)[number])]
    if (score === undefined) continue
    if (base + prof + mod(score) === value) {
      const parts = [base ? String(base) : '', prof ? '@competencia' : '', `@caracteristicas.${key}.mod`].filter(
        Boolean
      )
      return { formula: parts.join(' + '), ability: key }
    }
  }
  return { formula: String(value), ability: null }
}

/** Los dados de un daño («2d10 + 8»), con el modificador de su característica en vez del número si es el mismo */
function damageFormula(dice: string, scores: readonly number[], ability: string | null): string {
  const m = /^(\d+d\d+)\s*(?:([+-])\s*(\d+))?$/.exec(minus(dice).trim())
  if (!m) return minus(dice).replace(/\s+/g, '')
  if (!m[2]) return m[1] as string
  const bonus = Number(`${m[2]}${m[3]}`)
  const score = ability ? scores[ABILITY_KEYS.indexOf(ability as (typeof ABILITY_KEYS)[number])] : undefined
  if (score !== undefined && mod(score) === bonus) return `${m[1]} + @caracteristicas.${ability}.mod`
  return `${m[1]}${m[2]}${m[3]}`
}

/** El daño de un texto: «12 (2d6 + 5) Bludgeoning damage plus 7 (2d6) fire damage», o «1 piercing damage» */
function damageOf(text: string, scores: readonly number[], ability: string | null) {
  const out: { formula: string; type: string }[] = []
  const written = minus(text)
  for (const m of written.matchAll(/(\d+)(?: \((\d+d\d+(?:\s*[+-]\s*\d+)?)\))? (\w+) damage/gi)) {
    const type = DAMAGE[(m[3] as string).toLowerCase()]
    if (!type) continue
    // Un daño que solo va a veces («plus 2 (1d4) Slashing damage if the attack roll had Advantage») no se suma siempre
    const after = written.slice((m.index ?? 0) + m[0].length).split(/[.;]/)[0] ?? ''
    if (/^\s*if\b/i.test(after)) continue
    out.push({ formula: m[2] ? damageFormula(m[2], scores, ability) : (m[1] as string), type })
  }
  return out
}

const ACTIVATION: Record<Section['kind'], string | null> = {
  traits: null,
  actions: 'action',
  bonus: 'bonus',
  reactions: 'reaction',
  legendary: 'legendary',
  lair: 'special'
}

/** Una acción de un perfil, del texto en inglés: su ataque o su salvación, su daño, su recarga, sus usos y su coste */
export function actionOf(
  entry: Entry,
  kind: Section['kind'],
  scores: readonly number[],
  prof: number,
  label: { es: string; en: string }
): { action: Record<string, unknown>; resource?: Record<string, unknown> } | null {
  const activation = ACTIVATION[kind]
  if (!activation) return null
  const text = minus(entry.text)
  const attack = /(Melee|Ranged|Melee or Ranged)(?: Weapon| Spell)? Attack(?: Roll)?: \+(\d+)/.exec(text)
  // La primera salvación del texto, como la escribe cada edición: [CD, característica]
  const old = /DC (\d+) (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/i.exec(text)
  const now = /(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) Saving Throw: DC (\d+)/.exec(text)
  const save: [string, string] | null =
    old && (!now || old.index < now.index)
      ? [old[1] as string, old[2] as string]
      : now
        ? [now[2] as string, now[1] as string]
        : null
  if (!attack && !save) return null
  const spell = /Spell Attack/.test(text)
  const key = slug(label.es.replace(/\s*\(.*\)$/, '')).slice(0, 50) || 'accion'
  const action: Record<string, unknown> = { key, label, activation }
  let ability: string | null = null
  if (attack) {
    const order = spell ? ['car', 'sab', 'int'] : attack[1] === 'Ranged' ? ['des', 'fue'] : ['fue', 'des']
    const found = formulaFor(Number(attack[2]), scores, { base: 0, prof, order })
    action.attack = found.formula
    ability = found.ability
  }
  if (save) {
    const dc = formulaFor(Number(save[0]), scores, {
      base: 8,
      prof,
      order: ['con', 'car', 'sab', 'int', 'fue', 'des']
    })
    const success = /half as much damage|Success: Half damage/i.test(text) ? 'half' : 'none'
    action.save = { ability: ABILITY[save[1].toLowerCase()], dc: dc.formula, success }
  }
  // El daño del golpe (o, en una salvación, el de fallarla)
  const hit = attack
    ? (/Hit: (.*)/.exec(text)?.[1] ?? '')
    : (/(?:Failure: |failed save[^.]*?|takes )(.*)/.exec(text)?.[1] ?? text)
  const damage = damageOf(hit.split(/(?<=\.)\s(?=[A-Z])/)[0] ?? hit, scores, ability)
  if (damage.length > 0) action.damage = damage
  const recharge = /\(Recharge (\d)(?:[–-]6)?\)/.exec(entry.name)
  if (recharge) action.recharge = recharge[1] === '6' ? '6' : `${recharge[1]}-6`
  const cost = /\(Costs (\d) Actions\)/i.exec(entry.name)
  if (cost) action.cost = Number(cost[1])
  const perDay = /\((\d+)\/Day/i.exec(entry.name)
  if (perDay) {
    action.uses = key
    return {
      action,
      resource: { key, label, max: perDay[1], recovery: 'dawn' }
    }
  }
  return { action }
}

/** Los números que dicen lo que hace una entrada, en los dos idiomas: su bono de ataque, su CD y sus dados */
const signatureOf = (text: string) =>
  [...minus(text).matchAll(/[+-]\d+(?=[,.\s])|(?:DC|CD) \d+|\d+d\d+/g)].map((m) => m[0].replace(/^CD/, 'DC')).join(' ')

/**
 * Su nombre en español: el de la entrada con los mismos números (su ataque, su CD y sus dados), si solo hay una así; si
 * no, el de la misma posición, si las dos secciones tienen las mismas entradas
 */
function spanishName(entry: Entry, index: number, section: Section, other: Section | undefined): string | undefined {
  if (!other) return undefined
  // Primero, por sus números (el orden puede cambiar de un idioma a otro); si no deciden, por su posición
  const signature = signatureOf(entry.text)
  const same = signature ? other.entries.filter((e) => signatureOf(e.text) === signature) : []
  if (same.length === 1) return same[0]?.name
  return other.entries.length === section.entries.length ? other.entries[index]?.name : undefined
}

/** Las acciones de un perfil, con su nombre en los dos idiomas (el español, el de la misma posición o sus números) */
export function creatureMechanics(en: Statblock, es: Statblock): Mechanics {
  const cr = crOf(en.fields.cr)
  const prof = proficiency(cr)
  const actions: Record<string, unknown>[] = []
  const resources: Record<string, unknown>[] = []
  const taken = new Set<string>()
  for (const section of en.sections) {
    const other = es.sections.find((s) => s.kind === section.kind)
    // «Breath Weapons (Recharge 5–6). The dragon uses one of the following»: su recarga es la de los alientos de debajo
    let shared: string | null = null
    section.entries.forEach((entry, i) => {
      const esName = spanishName(entry, i, section, other)
      const found = actionOf(entry, section.kind, en.scores, prof, t(esName ?? entry.name, entry.name))
      const recharge = /\(Recharge (\d)(?:[–-]6)?\)/.exec(entry.name)
      if (!found) {
        shared =
          recharge && /one of the following/i.test(entry.text) ? (recharge[1] === '6' ? '6' : `${recharge[1]}-6`) : null
        return
      }
      if (shared && /Breath$/i.test(entry.name) && !found.action.recharge) found.action.recharge = shared
      else if (!/Breath$/i.test(entry.name)) shared = null
      let key = found.action.key as string
      for (let n = 2; taken.has(key); n++) key = `${found.action.key}_${n}`
      taken.add(key)
      actions.push({ ...found.action, key, ...(found.resource ? { uses: key } : {}) })
      if (found.resource) resources.push({ ...found.resource, key })
    })
    // Cuántas acciones legendarias: «can take 3 legendary actions» o «Legendary Action Uses: 3»
    const legendary = /(?:take (\d+) legendary actions|Legendary Action Uses: (\d+))/i.exec(section.intro)
    if (section.kind === 'legendary' && legendary)
      resources.push({
        key: 'legendarias',
        label: t('Acciones legendarias', 'Legendary actions'),
        max: legendary[1] ?? legendary[2],
        recovery: 'other'
      })
  }
  if (resources.some((r) => r.key === 'legendarias'))
    for (const a of actions) if (a.activation === 'legendary' && !a.uses) a.uses = 'legendarias'
  if (actions.length === 0 && resources.length === 0) return { automation: 'text' }
  return {
    ...(resources.length > 0 ? { resources } : {}),
    ...(actions.length > 0 ? { actions } : {}),
    automation: 'partial'
  }
}

/** Sus datos: lo que dice su perfil, en los campos de la criatura */
export function creatureData(edition: Edition, en: Statblock, es: Statblock): Record<string, unknown> {
  const cr = crOf(en.fields.cr)
  const prof = proficiency(cr)
  const caracteristicas: Record<string, Record<string, number>> = {}
  ABILITY_KEYS.forEach((key, i) => {
    const score = en.scores[i] ?? 10
    caracteristicas[key] = { puntuacion: score }
  })
  // Las salvaciones con competencia: en 2014, las que nombra; en 2024, las que no son su modificador
  if (en.saves)
    en.saves.forEach((save, i) => {
      const key = ABILITY_KEYS[i] as string
      const m = mod(en.scores[i] ?? 10)
      if (save !== m) (caracteristicas[key] as Record<string, number>).salvacion_grado = (save - m) / prof
    })
  for (const m of minus(en.fields.saves ?? '').matchAll(/(\w+) ([+-]\d+)/g)) {
    const key = ABILITY[(m[1] as string).toLowerCase()]
    if (!key) continue
    const value = Number(m[2])
    const score = en.scores[ABILITY_KEYS.indexOf(key as (typeof ABILITY_KEYS)[number])] ?? 10
    ;(caracteristicas[key] as Record<string, number>).salvacion_grado = (value - mod(score)) / prof
  }
  const habilidades: Record<string, { grado: number }> = {}
  for (const m of minus(en.fields.skills ?? '').matchAll(/([A-Za-z][A-Za-z ]+?) ([+-]\d+)/g)) {
    const key = SKILL[(m[1] as string).trim().toLowerCase()]
    if (!key) continue
    const ability = SKILLS.find(([k]) => k === key)?.[3] as string
    const score = en.scores[ABILITY_KEYS.indexOf(ability as (typeof ABILITY_KEYS)[number])] ?? 10
    habilidades[key] = { grado: (Number(m[2]) - mod(score)) / prof }
  }
  // La velocidad andando, en pies; lo demás, como texto
  const walk = /^(\d+) ft\./.exec(en.fields.speed ?? '')
  const others = (lang: Lang, s: Statblock) =>
    (s.fields.speed ?? '').replace(lang === 'en' ? /^\d+ ft\.,?\s*/ : /^[\d,]+ m,?\s*/, '')
  const [type, alignment] = metaOf(en.meta)
  const [tipo, alineamiento] = metaOf(es.meta)
  // En 2024, lo que suma a la iniciativa además de la Destreza
  const initiative = /^([+-]\d+)/.exec(minus(en.fields.initiative ?? ''))?.[1]
  const dexMod = mod(en.scores[1] ?? 10)
  const immune = (en.fields.immune ?? '').split(';')
  return {
    name: t(es.name, en.name),
    tamano: SIZE.find(([re]) => re.test(en.meta))?.[1] ?? 'mediana',
    tipo: t(tipo, type),
    alineamiento: t(alineamiento, alignment),
    vd: cr,
    px: xpOf(en.fields.cr),
    ca: firstNumber(en.fields.ac),
    pg_max: firstNumber(en.fields.hp),
    dados_golpe: minus(/\(([^)]*)\)/.exec(en.fields.hp ?? '')?.[1] ?? '').replace(/\s+/g, ''),
    velocidad: walk ? Number(walk[1]) : 0,
    velocidades: t(others('es', es), others('en', en)),
    caracteristicas,
    habilidades,
    ...(initiative !== undefined && Number(initiative) !== dexMod
      ? { bono_iniciativa: Number(initiative) - dexMod }
      : {}),
    vulnerabilidades: damageKeys(en.fields.vulnerable),
    resistencias: damageKeys(en.fields.resistant),
    inmunidades: damageKeys(edition === '2024' ? immune[0] : en.fields.immune),
    inmunidades_estados: conditionKeys(edition === '2024' ? immune[1] : en.fields.conditions),
    descripcion: t(statblockText('es', edition, es), statblockText('en', edition, en))
  }
}

/** Su tipo y su alineamiento, sin el tamaño («Large aberration, lawful evil») */
function metaOf(meta: string): [string, string] {
  const [first = '', ...rest] = meta.split(',')
  // Sin el tamaño, y sin la «o» que deja «Mediano o Pequeño» («Humanoide o» → «Humanoide»)
  const type = SIZE.reduce((text, [re]) => text.replace(re, ''), first)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:o|or)\s+/i, '')
    .replace(/\s+(?:o|or)$/i, '')
  return [type.charAt(0).toUpperCase() + type.slice(1), rest.join(',').trim()]
}

const SECTION_TITLE: Record<Section['kind'], Record<Lang, string>> = {
  traits: { en: 'Traits', es: 'Atributos' },
  actions: { en: 'Actions', es: 'Acciones' },
  bonus: { en: 'Bonus Actions', es: 'Acciones adicionales' },
  reactions: { en: 'Reactions', es: 'Reacciones' },
  legendary: { en: 'Legendary Actions', es: 'Acciones legendarias' },
  lair: { en: 'Lair Actions', es: 'Acciones de guarida' }
}
const ABBR: Record<Lang, string[]> = {
  en: ABILITIES.map(([, , , , abbr]) => abbr),
  es: ABILITIES.map(([, , , abbr]) => abbr)
}

/** Su perfil como texto (Markdown), en un idioma */
export function statblockText(lang: Lang, edition: Edition, s: Statblock): string {
  const lines: string[] = [`*${s.meta}*`]
  for (const key of Object.keys(LABEL_TEXT))
    if (s.fields[key]) lines.push(`**${LABEL_TEXT[key]?.[lang][edition]}** ${s.fields[key]}`)
  if (s.fields.initiative)
    lines.splice(2, 0, `**${lang === 'en' ? 'Initiative' : 'Iniciativa'}** ${s.fields.initiative}`)
  const sign = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`)
  const table = [
    `| ${ABBR[lang].join(' | ')} |`,
    `| ${ABBR[lang].map(() => '---').join(' | ')} |`,
    `| ${s.scores.map((n) => `${n} (${sign(mod(n))})`).join(' | ')} |`,
    // En 2024, sus salvaciones van en la tabla
    ...(s.saves ? [`| ${s.saves.map(sign).join(' | ')} |`] : [])
  ]
  const blocks = [lines.join('\n'), table.join('\n')]
  for (const section of s.sections) {
    const parts = [`### ${SECTION_TITLE[section.kind][lang]}`]
    if (section.intro) parts.push(section.intro)
    for (const e of section.entries) parts.push(`**${e.name}.** ${e.text}`)
    blocks.push(parts.join('\n\n'))
  }
  return blocks.join('\n\n')
}

/** El documento de una criatura de una edición */
export function creatureDoc(edition: Edition, en: Statblock, es: Statblock, concept: string): Doc {
  return {
    type: 'criatura',
    key: `${concept}_${edition}`,
    source: SOURCE[edition],
    concept,
    data: creatureData(edition, en, es),
    mechanics: creatureMechanics(en, es),
    ref: { pages: { en: en.page, es: es.page } }
  }
}

/** Las criaturas de una edición, emparejadas por la lista revisada y, las demás, por su firma */
export function creaturePairs(edition: Edition): [Statblock, Statblock][] {
  return pair(statblocks(edition, 'en'), statblocks(edition, 'es'), statblockSignature, CREATURE_PAIRS[edition])
}

/** Las criaturas de las dos ediciones, con su concepto; la que ya es de otro tipo, con «criatura_» */
export function creatureDocs(taken: ReadonlySet<string> = new Set()): Doc[] {
  const newer = creaturePairs('2024')
  const older = creaturePairs('2014')
  const names = concepts(newer, older, CREATURE_RENAMES)
  const own = (concept: string) => (taken.has(concept) ? `criatura_${concept}` : concept)
  return [
    ...older.map(([en, es], i) => creatureDoc('2014', en, es, own(names.older[i] as string))),
    ...newer.map(([en, es], i) => creatureDoc('2024', en, es, own(names.newer[i] as string)))
  ]
}
