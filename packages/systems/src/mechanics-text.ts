/**
 * La mecánica de un documento, en palabras, para leerla en el compendio: sus acciones (con su tirada, su salvación y
 * su daño), sus usos, lo que cambia de quien lo lleva, cómo escala y cuánto lo calcula Crisol. Los nombres de los
 * campos, en el idioma de la campaña; las fórmulas, con esos nombres en vez de sus claves
 */
import { actionsOf } from './actions.ts'
import type { SystemDocument } from './evaluate.ts'
import type { Field, System } from './format.ts'
import { type Expr, parseFormula } from './formulas/parse.ts'
import type { Mechanics } from './mechanics.ts'
import { own } from './own.ts'
import { type Language, type Text, textOf } from './text.ts'

/** Lo que se tira de una acción: su ataque, su daño y su curación */
export type ActionPart = 'attack' | 'damage' | 'heal'

export interface MechanicsText {
  /** Sus acciones, con su clave y lo que se puede tirar de cada una (para su botón) */
  actions: { key: string; label: string; parts: string[]; rolls: ActionPart[] }[]
  resources: { label: string; parts: string[] }[]
  effects: string[]
  scaling: string | null
  toggle: string | null
  automation: 'full' | 'partial' | 'text' | null
  manual: string | null
}

type Words = Record<string, { es: string; en: string }>

const WORDS = {
  action: { es: 'Acción', en: 'Action' },
  bonus: { es: 'Acción adicional', en: 'Bonus action' },
  reaction: { es: 'Reacción', en: 'Reaction' },
  free: { es: 'Sin coste', en: 'Free' },
  legendary: { es: 'Acción legendaria', en: 'Legendary action' },
  special: { es: 'Especial', en: 'Special' },
  attack: { es: 'Ataque {x}', en: 'Attack {x}' },
  save: { es: 'Salvación de {x} ({y})', en: '{x} saving throw ({y})' },
  dc: { es: 'CD {x}', en: 'DC {x}' },
  half: { es: 'mitad si la supera', en: 'half on a success' },
  none: { es: 'nada si la supera', en: 'none on a success' },
  saveSpecial: { es: 'si la supera, lo que diga el texto', en: 'on a success, see the text' },
  damage: { es: '{x} ({y})', en: '{x} {y}' },
  heal: { es: 'Cura {x}', en: 'Heals {x}' },
  range: { es: 'Alcance: {x}', en: 'Range: {x}' },
  uses: { es: 'Gasta: {x}', en: 'Uses: {x}' },
  recharge: { es: 'Recarga {x}', en: 'Recharge {x}' },
  cost: { es: 'Cuesta {x}', en: 'Costs {x}' },
  options: { es: '{x} de estas', en: '{x} of these' },
  optionsDistinct: { es: '{x} distintas de estas', en: '{x} different ones of these' },
  pick: { es: 'al azar con {x}', en: 'at random with {x}' },
  spellcasting: { es: 'Lanzamiento de conjuros', en: 'Spellcasting' },
  atWill: { es: 'A voluntad: {x}', en: 'At will: {x}' },
  perDay: { es: '{n}/día cada uno: {x}', en: '{n}/day each: {x}' },
  spellAttack: { es: 'ataque {x}', en: '{x} to hit' },
  max: { es: 'Como mucho, {x}', en: 'Up to {x}' },
  short: { es: 'se recupera con un descanso corto', en: 'recovers on a short rest' },
  long: { es: 'se recupera con un descanso largo', en: 'recovers on a long rest' },
  dawn: { es: 'se recupera al amanecer', en: 'recovers at dawn' },
  other: { es: 'se recupera a mano', en: 'recovered by hand' },
  amount: { es: 'vuelven {x}', en: '{x} come back' },
  base: { es: '{t}: {x} de base', en: '{t}: {x} base' },
  set: { es: '{t}: {x}', en: '{t}: {x}' },
  add: { es: '{t}: +{x}', en: '{t}: +{x}' },
  mul: { es: '{t}: ×{x}', en: '{t}: ×{x}' },
  minimum: { es: '{t}: al menos {x}', en: '{t}: at least {x}' },
  maximum: { es: '{t}: como mucho {x}', en: '{t}: at most {x}' },
  advantage: { es: 'Ventaja en {t}', en: 'Advantage on {t}' },
  disadvantage: { es: 'Desventaja en {t}', en: 'Disadvantage on {t}' },
  append: { es: '{t}: añade {x}', en: '{t}: adds {x}' },
  whileActive: { es: '(mientras está activo)', en: '(while active)' },
  when: { es: '(si {x})', en: '(if {x})' },
  slot: {
    es: 'Con un espacio de más nivel que el {b}: +{x} por cada nivel de más',
    en: 'With a slot above level {b}: +{x} per level above'
  },
  byLevel: { es: 'Según {y}: +{x} por cada nivel por encima de {b}', en: 'By {y}: +{x} per level above {b}' },
  at: { es: 'desde el nivel {b}: {x}', en: 'from level {b}: {x}' },
  toggle: { es: 'Se activa y se desactiva', en: 'Turns on and off' },
  originLevel: { es: 'nivel de su clase', en: 'class level' },
  origin: { es: '{x} de lo que lo concede', en: '{x} of what grants it' },
  ladder: { es: '{x} (según {y})', en: '{x} (by {y})' },
  from: { es: '{x} desde el {b}', en: '{x} from {b}' },
  and: { es: ' y ', en: ' and ' },
  or: { es: ' o ', en: ' or ' },
  not: { es: 'no {x}', en: 'not {x}' },
  ifElse: { es: '{x} si {t}; si no, {y}', en: '{x} if {t}; otherwise {y}' },
  greatest: { es: 'el mayor de {x}', en: 'the greater of {x}' },
  least: { es: 'el menor de {x}', en: 'the lesser of {x}' },
  down: { es: '{x} (hacia abajo)', en: '{x} (rounded down)' },
  up: { es: '{x} (hacia arriba)', en: '{x} (rounded up)' },
  sum: { es: 'la suma de {x}', en: 'the sum of {x}' },
  count: { es: 'cuántos {x}', en: 'how many {x}' },
  first: { es: 'el primero de {x}', en: 'the first of {x}' },
  empty: { es: 'vacío', en: 'empty' },
  with: { es: 'con {x}', en: 'with {x}' },
  without: { es: 'sin {x}', en: 'without {x}' }
} satisfies Words

const say = (word: keyof typeof WORDS, language: Language, values: Record<string, string> = {}) =>
  Object.entries(values).reduce((text, [k, v]) => text.replaceAll(`{${k}}`, v), WORDS[word][language])

const humanize = (key: string) => {
  const text = key.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Lo que nombra cada clave: los campos de quien lo lleva y del documento, las opciones y los elementos */
function namesOf(system: System, type: string, language: Language) {
  const actor = Object.values(system.types).find((t) => t.document === 'actor')
  const own = system.types[type]
  const bearer = own?.document === 'actor' ? own.fields : (actor?.fields ?? {})
  const item = own?.fields ?? {}
  const options = new Map<string, string>()
  const elements = new Map<string, string>()
  const visit = (fields: Record<string, Field>) => {
    for (const f of Object.values(fields)) {
      if ((f.kind === 'choice' || f.kind === 'list') && f.options)
        for (const o of f.options)
          if (!options.has(o.value)) options.set(o.value, textOf(o.label, language).toLocaleLowerCase(language))
      if (f.kind === 'set')
        for (const e of f.elements) if (!elements.has(e.key)) elements.set(e.key, textOf(e.label, language))
      if (f.kind === 'group') visit(f.fields)
    }
  }
  for (const t of Object.values(system.types)) visit(t.fields)
  // Las opciones de los ajustes de campaña también (@ajustes.reglas == "e2024": «2024»)
  for (const s of Object.values(system.settings ?? {}))
    for (const o of s.options ?? [])
      if (!options.has(o.value)) options.set(o.value, textOf(o.label, language).toLocaleLowerCase(language))
  return { bearer, item, options, elements }
}

/** El nombre de una ruta de campos: «caracteristicas.des.mod» → «Modificador de Destreza» */
function pathName(fields: Record<string, Field>, path: string[], language: Language, system: System): string {
  const [first, ...rest] = path
  if (!first) return ''
  const field = own(fields, first)
  const roll = system.rolls ? own(system.rolls, first) : undefined
  if (!field && roll) {
    const label = textOf(roll.label, language)
    return rest[0] ? `${label} (${elementName(system, rest[0], language)})` : label
  }
  if (!field) return humanize(path.join(' '))
  const label = textOf(field.label, language)
  if (field.kind === 'set' && rest[0]) {
    const element = field.elements.find((e) => e.key === rest[0])
    const elementLabel = element ? textOf(element.label, language) : humanize(rest[0])
    const column = rest[1] ? own(field.fields, rest[1]) : undefined
    return column ? `${textOf(column.label, language)} de ${elementLabel}` : elementLabel
  }
  if (field.kind === 'group' && rest[0]) return pathName(field.fields, rest, language, system)
  return label
}

function elementName(system: System, key: string, language: Language) {
  for (const t of Object.values(system.types))
    for (const f of Object.values(t.fields))
      if (f.kind === 'set') {
        const e = f.elements.find((each) => each.key === key)
        if (e) return textOf(e.label, language)
      }
  return humanize(key)
}

/** Una fórmula en palabras: los nombres de sus campos en vez de sus claves, y sus escalas por nivel, en orden */
export function formulaText(formula: string, context: { system: System; type: string; language: Language }): string {
  const { system, type, language } = context
  const names = namesOf(system, type, language)
  let expr: Expr
  try {
    expr = parseFormula(formula)
  } catch {
    return formula
  }
  const ref = (path: (string | Expr)[]): string => {
    // Lo que se elige al calcular (@caracteristicas[@este.car]), por su nombre: «Modificador de Característica»
    const keys = path.map((p) => (typeof p === 'string' ? p : visit(p)))
    const [first, ...rest] = keys
    if (first === 'este') return pathName(names.item, rest, language, system)
    if (first === 'origen')
      return rest.join('.') === 'nivel'
        ? say('originLevel', language)
        : say('origin', language, { x: pathName(names.item, rest, language, system) })
    if (first === 'portador') return pathName(names.bearer, rest, language, system)
    if (first === 'ajustes') {
      const setting = rest[0] ? system.settings?.[rest[0]] : undefined
      return setting ? textOf(setting.label, language) : humanize(rest.join(' '))
    }
    return pathName(names.bearer, keys, language, system)
  }
  const op: Record<string, string> = { '>=': '≥', '<=': '≤', '==': '=', '!=': '≠', '>': '>', '<': '<' }
  // Lo que va antes al calcular: con menos, entre paréntesis ((Puntuación − 10) ÷ 2)
  const strength = (e: Expr): number => {
    if (e.kind === 'conditional') return 0
    if (e.kind !== 'binary') return 9
    if (e.op === '||') return 1
    if (e.op === '&&') return 2
    if (e.op in op) return 3
    return e.op === '+' || e.op === '-' ? 4 : 5
  }
  const side = (child: Expr, parent: Expr, right: boolean) => {
    const text = visit(child)
    const [c, p] = [strength(child), strength(parent)]
    const tight = right && c === p && parent.kind === 'binary' && (parent.op === '-' || parent.op === '/')
    return c < p || tight ? `(${text})` : text
  }
  const visit = (e: Expr): string => {
    switch (e.kind) {
      case 'number':
        return String(e.value)
      case 'string':
        return e.value === '' ? say('empty', language) : (names.options.get(e.value) ?? e.value)
      case 'boolean':
        return String(e.value)
      case 'null':
        return '—'
      case 'dice':
        return e.text
      case 'ref':
        return ref(e.path)
      case 'unary':
        return e.op === '-'
          ? `−${strength(e.value) < 9 ? `(${visit(e.value)})` : visit(e.value)}`
          : say('not', language, { x: visit(e.value) })
      case 'binary': {
        // Comparar con nada es preguntar si lo hay: «con Objetivo», «sin Característica»
        if ((e.op === '!=' || e.op === '==') && e.right.kind === 'null')
          return say(e.op === '!=' ? 'with' : 'without', language, { x: side(e.left, e, false) })
        const left = side(e.left, e, false)
        const right = side(e.right, e, true)
        if (e.op === '&&' || e.op === '||') return `${left}${say(e.op === '&&' ? 'and' : 'or', language)}${right}`
        if (e.op in op) return `${left} ${op[e.op]} ${right}`
        // Restar un número negativo, o sumarlo, se lee mejor con su signo
        if (e.op === '+' && e.right.kind === 'number' && e.right.value < 0) return `${left} − ${-e.right.value}`
        if (e.op === '+' && e.right.kind === 'unary' && e.right.op === '-')
          return `${left} − ${side(e.right.value, { ...e, op: '-' }, true)}`
        return `${left} ${e.op === '*' ? '×' : e.op === '/' ? '÷' : e.op === '-' ? '−' : e.op} ${right}`
      }
      case 'conditional':
        return ladder(e) ?? say('ifElse', language, { x: visit(e.yes), t: visit(e.test), y: visit(e.no) })
      case 'call': {
        const args = e.args.map(visit)
        const list = args.join(', ')
        if (e.name === 'max') return say('greatest', language, { x: list })
        if (e.name === 'min') return say('least', language, { x: list })
        if (e.name === 'floor') return say('down', language, { x: list })
        if (e.name === 'ceil') return say('up', language, { x: list })
        if (e.name === 'sum') return say('sum', language, { x: list })
        if (e.name === 'count') return say('count', language, { x: list })
        if (e.name === 'first') return say('first', language, { x: list })
        return `${e.name}(${list})`
      }
    }
  }
  // Una escala por nivel (`@nivel >= 17 ? 6 : @nivel >= 12 ? 5 : … : 2`): «2, 3 desde el 3… (según nivel)»
  const ladder = (e: Extract<Expr, { kind: 'conditional' }>): string | null => {
    const steps: { at: number; value: string }[] = []
    let by: string | null = null
    let current: Expr = e
    while (current.kind === 'conditional') {
      const test: Expr = current.test
      if (test.kind !== 'binary' || test.op !== '>=' || test.right.kind !== 'number' || test.left.kind !== 'ref')
        return null
      const name = ref(test.left.path)
      if (by !== null && by !== name) return null
      by = name
      steps.push({ at: test.right.value, value: visit(current.yes) })
      current = current.no
    }
    if (by === null || steps.length < 2) return null
    const ordered = steps.sort((a, b) => a.at - b.at)
    const parts = [visit(current), ...ordered.map((s) => say('from', language, { x: s.value, b: String(s.at) }))]
    return say('ladder', language, { x: parts.join(', '), y: by })
  }
  return visit(expr)
}

/**
 * La mecánica de un documento de un tipo, en palabras; sin mecánica, null. Con el documento (una criatura, que tira
 * con lo suyo), sus acciones ya calculadas: «Ataque +4 · 1d6+2 (perforante)» en vez de las fórmulas con nombres
 */
export function mechanicsText(
  system: System,
  type: string,
  mechanics: Mechanics | undefined,
  language: Language = 'es',
  doc?: SystemDocument
): MechanicsText | null {
  if (!mechanics) return null
  const computed = new Map<string, ReturnType<typeof actionsOf>[number]>()
  if (doc)
    try {
      for (const a of actionsOf(system, type, { ...doc, mechanics }, { language }))
        if (a.item === null && !a.error) computed.set(a.key, a)
    } catch {
      // Si no se puede calcular, se queda en palabras
    }
  const context = { system, type, language }
  const names = namesOf(system, type, language)
  const f = (formula: string) => formulaText(formula, context)
  const label = (text: Text | undefined, fallback: string) => (text ? textOf(text, language) : fallback)
  const resources = (mechanics.resources ?? []).map((r) => ({
    label: textOf(r.label, language),
    parts: [
      say('max', language, { x: f(r.max) }),
      ...(r.recovery ? [say(r.recovery, language)] : []),
      ...(r.amount ? [say('amount', language, { x: f(r.amount) })] : [])
    ]
  }))
  const actions = (mechanics.actions ?? []).map((a) => {
    const parts: string[] = []
    const ready = computed.get(a.key)
    if (a.activation) parts.push(say(a.activation, language))
    if (a.attack)
      parts.push(
        say('attack', language, {
          x: ready?.bonus != null ? `${ready.bonus < 0 ? '−' : '+'}${Math.abs(ready.bonus)}` : `+${f(a.attack)}`
        })
      )
    if (a.save) {
      const ability = names.elements.get(a.save.ability) ?? humanize(a.save.ability)
      const success = a.save.success === 'special' ? 'saveSpecial' : a.save.success
      // La CD: «CD 15» o, si ya lo dice su campo, «CD de salvación»
      const dc = ready?.save ? String(ready.save.dc) : f(a.save.dc)
      const shown = /^(CD|DC)\b/.test(dc) ? dc : say('dc', language, { x: dc })
      parts.push(
        [say('save', language, { x: ability, y: shown }), ...(success ? [say(success, language)] : [])].join(', ')
      )
    }
    if (a.damage?.length)
      parts.push(
        a.damage
          .map((d, i) => {
            const x = ready?.damage[i]?.formula ?? f(d.formula)
            return d.type ? say('damage', language, { x, y: names.options.get(d.type) ?? d.type }) : x
          })
          .join(' + ')
      )
    if (a.heal) parts.push(say('heal', language, { x: ready?.heal?.formula ?? f(a.heal) }))
    if (a.range) parts.push(say('range', language, { x: textOf(a.range, language) }))
    if (a.uses) {
      const used = mechanics.resources?.find((r) => r.key === a.uses)
      parts.push(say('uses', language, { x: used ? textOf(used.label, language) : a.uses }))
    }
    if (a.recharge) parts.push(say('recharge', language, { x: a.recharge.replace('-', '–') }))
    if (a.cost) parts.push(say('cost', language, { x: String(a.cost) }))
    // Uno de estos efectos (ADR-0033): cuántos, cómo se sacan y cada uno con su salvación y su daño
    if (a.options) {
      const count = String(a.count ?? 1)
      parts.push(
        [
          say(a.distinct ? 'optionsDistinct' : 'options', language, { x: count }),
          ...(a.pick ? [say('pick', language, { x: a.pick })] : [])
        ].join(', ')
      )
      for (const [i, o] of (ready?.options ?? []).entries()) {
        const bits = [
          ...(o.bonus !== null
            ? [say('attack', language, { x: `${o.bonus < 0 ? '−' : '+'}${Math.abs(o.bonus)}` })]
            : []),
          ...(o.save
            ? [say('save', language, { x: o.save.abilityLabel, y: say('dc', language, { x: String(o.save.dc) }) })]
            : []),
          ...(o.damage.length
            ? [
                o.damage
                  .map((d) =>
                    d.type
                      ? say('damage', language, { x: d.formula, y: names.options.get(d.type) ?? d.type })
                      : d.formula
                  )
                  .join(' + ')
              ]
            : []),
          ...(o.heal ? [say('heal', language, { x: o.heal.formula })] : [])
        ]
        parts.push(`${a.pick ? `${i + 1}. ` : ''}${o.label}${bits.length ? `: ${bits.join(', ')}` : ''}`)
      }
    }
    const rolls: ActionPart[] = [
      ...(a.attack ? (['attack'] as const) : []),
      ...(a.damage?.length ? (['damage'] as const) : []),
      ...(a.heal ? (['heal'] as const) : [])
    ]
    return { key: a.key, label: label(a.label, a.key), parts, rolls }
  })
  const effects = (mechanics.effects ?? []).map((e) => {
    const target = pathName(names.bearer, e.target.split('.'), language, system)
    const word = e.op === 'min' ? 'minimum' : e.op === 'max' ? 'maximum' : (e.op as Exclude<typeof e.op, 'min' | 'max'>)
    const text = say(word, language, { t: target, x: e.value ? f(e.value) : '' })
    const condition = e.when
      ? e.when.replace(/\s/g, '') === '@este.activo'
        ? ` ${say('whileActive', language)}`
        : ` ${say('when', language, { x: f(e.when) })}`
      : ''
    return `${e.label ? `${textOf(e.label, language)}: ` : ''}${text}${condition}`
  })
  const s = mechanics.scaling
  const scaling = !s
    ? null
    : [
        s.per
          ? s.mode === 'slot'
            ? say('slot', language, { b: String(s.base ?? 0), x: f(s.per) })
            : say('byLevel', language, { y: s.by ? f(s.by) : '', x: f(s.per), b: String(s.base ?? 0) })
          : null,
        ...(s.at ?? []).map((a) => say('at', language, { b: String(a.level), x: f(a.formula) }))
      ]
        .filter(Boolean)
        .join('; ') || null
  const duration = mechanics.toggle?.duration
  // Los conjuros de una criatura (ADR-0033), como una acción más: su característica, su CD, su ataque y sus grupos
  const casting = mechanics.spellcasting
  if (casting) {
    const head = [
      ...(casting.ability ? [names.elements.get(casting.ability) ?? humanize(casting.ability)] : []),
      ...(casting.dc ? [say('dc', language, { x: f(casting.dc) })] : []),
      ...(casting.attack ? [say('spellAttack', language, { x: `+${f(casting.attack)}` })] : [])
    ].join(', ')
    const groups = casting.groups.map((g) => {
      const x = g.spells.map(humanize).join(', ')
      const line = g.uses ? say('perDay', language, { n: String(g.uses), x }) : say('atWill', language, { x })
      return g.label ? `${textOf(g.label, language)}: ${x}` : line
    })
    actions.push({
      key: 'conjuros',
      label: casting.label ? textOf(casting.label, language) : say('spellcasting', language),
      parts: [...(head ? [head] : []), ...groups],
      rolls: []
    })
  }
  return {
    actions,
    resources,
    effects,
    scaling,
    toggle: mechanics.toggle
      ? `${say('toggle', language)}${duration ? ` (${textOf(duration as Text, language)})` : ''}`
      : null,
    automation: mechanics.automation ?? null,
    manual: mechanics.manual ? textOf(mechanics.manual, language) : null
  }
}
