/**
 * El motor del creador de personajes (docs/specs/personajes.md § pasos, ADR-0013). De las elecciones de un personaje
 * (lo que guarda) sale su documento (el que calcula `evaluate`), la lista de lo que hay que decidir (de los pasos del
 * sistema y de lo que concede lo elegido a su nivel, con sus opciones y el motivo de las que no valen), el estado de
 * cada paso, su nivel y si ya tiene lo que su sistema pide. Puro: igual en el servidor y en la web
 */
import type { Choices } from './choices.ts'
import { editionOf, resolveConcept, type Seen, visibleContent } from './content.ts'
import { type DocumentItem, evaluate, evaluateWith, type SystemDocument } from './evaluate.ts'
import type { ContentItem } from './file.ts'
import type { System } from './format.ts'
import type { Value } from './formulas/functions.ts'
import type { Mechanics } from './mechanics.ts'
import type { Text } from './text.ts'

/** Algo elegido del contenido en un paso: su clave (con su edición) y, si el paso es de niveles (las clases), su nivel */
export interface BuildPick {
  id: string
  step: string
  key: string
  level?: number
}

/** Lo que guarda un personaje: sus elecciones. La hoja se calcula de ellas */
export interface Build {
  /** Lo escrito en los pasos de campos (su alineamiento, sus notas), por la clave del campo */
  values?: Record<string, unknown>
  /** Las puntuaciones generadas: el método y la base de cada elemento (fue: 15) y, si se tiraron, lo que salió */
  scores?: { method?: string; base?: Record<string, number>; rolls?: number[] }
  /** Lo elegido del contenido, en su orden */
  picks?: BuildPick[]
  /** Lo decidido en cada decisión, por su id */
  decisions?: Record<string, string[]>
}

export interface BuildOption {
  value: string
  label: Text
  available: boolean
  /** Por qué no vale */
  reason?: Text
}

/** Una decisión de lo concedido: elegir de un tipo (una subclase, un estilo) o de un conjunto (dos habilidades) */
export interface Decision {
  id: string
  /** El paso en el que sale: el de lo elegido que la concede */
  step: string
  label: Text
  /** Lo que la concede */
  from: { id: string; name: string }
  level: number | null
  count: number
  repeat: boolean
  /** Lo mismo, como mucho tantas veces */
  most: number
  options: BuildOption[]
  chosen: string[]
  pending: boolean
}

export interface StepState {
  key: string
  kind: string
  label: Text
  /** Cuántas cosas faltan en él (lo marcado con (!)) */
  pending: number
}

export interface Built {
  /** El tipo del personaje (el primer actor del sistema) */
  type: string
  document: SystemDocument
  decisions: Decision[]
  steps: StepState[]
  /** La suma de los niveles de lo elegido en los pasos de niveles (las clases) */
  level: number
  /** Si tiene lo que su sistema pide para dejar de estar «en creación» */
  complete: boolean
  /** Lo elegido que ya no está en el contenido de la campaña: sale como pendiente, sin romperse */
  missing: string[]
  /** El nivel en que entra cada cosa concedida (por su id) */
  levels: Record<string, number>
  /** La clave en el contenido de cada cosa que lleva (por su id) */
  keys: Record<string, string>
}

type Step = NonNullable<System['creation']>[number]
type Grant = NonNullable<Mechanics['grants']>[number]

const nameOf = (item: ContentItem, language: 'es' | 'en' = 'es') => {
  const name = item.data.name
  if (typeof name === 'string') return name
  const names = (name ?? {}) as { es?: string; en?: string }
  return names[language] ?? names.es ?? names.en ?? item.key
}
const labelOf = (item: ContentItem): Text => (item.data.name as Text | undefined) ?? item.key

/** El tipo de los personajes: el primer actor */
export function characterType(system: System): string | null {
  return Object.entries(system.types).find(([, t]) => t.document === 'actor')?.[0] ?? null
}

/** Una condición sobre algo (@este) y quien lo lleva; si no se puede calcular, se da por buena */
function holds(formula: string | undefined, values: Record<string, Value>, este?: Record<string, Value>): boolean {
  if (!formula) return true
  try {
    const v = evaluateWith(formula, values, este)
    return v !== null && v !== false && v !== 0 && v !== ''
  } catch {
    return true
  }
}

/** Cuántos: una fórmula (casi siempre un número) */
function countOf(formula: string, values: Record<string, Value>, este: Record<string, Value>): number {
  const n = Number(formula)
  if (Number.isFinite(n)) return Math.max(0, Math.floor(n))
  try {
    const v = evaluateWith(formula, values, este)
    return typeof v === 'number' ? Math.max(0, Math.floor(v)) : 0
  } catch {
    return 0
  }
}

/** Lo que pide un documento para elegirlo, sobre el personaje: el motivo del primero que no cumple */
export function unmetRequirement(item: ContentItem, values: Record<string, Value>): Text | null {
  for (const r of (item.mechanics as Mechanics | undefined)?.requires ?? []) {
    try {
      const v = evaluateWith(r.formula, values)
      if (v === null || v === false || v === 0 || v === '') return r.reason
    } catch {
      return r.reason
    }
  }
  return null
}

interface View {
  seen: Seen<ContentItem>[]
  byKey: Map<string, ContentItem>
  /** Lo que se ve de cada concepto */
  byConcept: Map<string, Seen<ContentItem>[]>
}

/** Lo que se ve del contenido con unas fuentes, una vez por contenido (el de serie es siempre el mismo) */
const views = new WeakMap<readonly ContentItem[], Map<string, View>>()
function viewOf(
  system: System,
  content: readonly ContentItem[],
  choices: Pick<Choices, 'sources' | 'duplicates'>
): View {
  const key = `${system.id}|${[...choices.sources].sort().join(',')}|${choices.duplicates}`
  let byChoices = views.get(content)
  if (!byChoices) {
    byChoices = new Map()
    views.set(content, byChoices)
  }
  let view = byChoices.get(key)
  if (!view) {
    const seen = visibleContent(system, content, choices)
    const byConcept = new Map<string, Seen<ContentItem>[]>()
    for (const s of seen) {
      if (!s.item.concept) continue
      const list = byConcept.get(s.item.concept) ?? []
      list.push(s)
      byConcept.set(s.item.concept, list)
    }
    view = { seen, byKey: new Map(seen.map((s) => [s.item.key, s.item])), byConcept }
    byChoices.set(key, view)
  }
  return view
}

/**
 * Monta un personaje de sus elecciones. `values` son los del personaje ya calculados (de una vuelta anterior): con
 * ellos se miran las condiciones y los requisitos; sin ellos, se calculan aquí
 */
export function buildCharacter(
  system: System,
  content: readonly ContentItem[],
  choices: Pick<Choices, 'sources' | 'duplicates'> & { settings?: Record<string, unknown>; language?: 'es' | 'en' },
  build: Build
): Built {
  const type = characterType(system)
  if (!type) throw new Error('El sistema no tiene un tipo de personaje (actor)')
  const steps: readonly Step[] = system.creation ?? []
  const { seen, byKey, byConcept } = viewOf(system, content, choices)
  const missing: string[] = []

  // Sus datos: lo escrito y las puntuaciones
  const data: Record<string, unknown> = {}
  const fields = system.types[type]?.fields ?? {}
  for (const [k, v] of Object.entries(build.values ?? {})) if (k in fields) data[k] = v
  for (const step of steps) {
    if (step.kind !== 'scores') continue
    const set = (data[step.set] ?? {}) as Record<string, Record<string, unknown>>
    for (const [element, value] of Object.entries(build.scores?.base ?? {}))
      set[element] = { ...(set[element] ?? {}), [step.field]: value }
    data[step.set] = set
  }

  const picks = build.picks ?? []
  const stepOf = (key: string) => steps.find((s) => s.key === key)
  const levelsStep = (key: string) => {
    const step = stepOf(key)
    return step?.kind === 'content' && step.levels === true
  }
  // Su nivel: la suma de los de lo elegido en los pasos de niveles
  const level = picks.reduce((n, p) => n + (levelsStep(p.step) && byKey.has(p.key) ? Math.max(1, p.level ?? 1) : 0), 0)

  const items: DocumentItem[] = []
  const levels: Record<string, number> = {}
  const keys: Record<string, string> = {}
  const pendingDecisions: Omit<Decision, 'options' | 'pending'>[] = []
  const decisionOptions = new Map<string, { grant: Grant; edition: string | undefined; item: DocumentItem }>()
  const carry = (item: ContentItem, id: string, extra: Record<string, unknown> = {}, from?: string): DocumentItem => {
    keys[id] = item.key
    return {
      id,
      type: item.type,
      name: nameOf(item, choices.language),
      data: { ...structuredClone(item.data), ...extra },
      ...(item.mechanics ? { mechanics: structuredClone(item.mechanics) as Mechanics } : {}),
      ...(from ? { from } : {})
    }
  }
  const resolve = (concept: string, typeKey: string | undefined, edition: string | undefined) =>
    resolveConcept(system, byConcept.get(concept) ?? [], concept, { ...(typeKey ? { type: typeKey } : {}), edition })

  /** Lo que concede algo hasta su nivel: lo fijo entra solo; lo que se elige, a decisiones (y lo elegido, entra) */
  const expand = (item: DocumentItem, source: ContentItem, at: number, step: string, origin: string, depth = 0) => {
    if (depth > 6) return
    const edition = editionOf(system, source)
    for (const g of item.mechanics?.grants ?? []) {
      if (g.level && g.level > at) continue
      const suffix = g.level ? `@${g.level}` : ''
      if (g.concept) {
        const found = resolve(g.concept, g.type, edition)
        if (!found) {
          missing.push(g.concept)
          continue
        }
        const child = carry(found, `${item.id}>${g.concept}${suffix}`, {}, origin)
        levels[child.id] = g.level ?? levels[item.id] ?? 0
        items.push(child)
        expand(child, found, at, step, origin, depth + 1)
        continue
      }
      const c = g.choose
      if (!c) continue
      if (!holds(c.when, {}, item.data as Record<string, Value>)) continue
      const id = `${item.id}>${c.key}${suffix}`
      const chosen = [...(build.decisions?.[id] ?? [])]
      pendingDecisions.push({
        id,
        step,
        label: c.label,
        from: { id: item.id, name: item.name },
        level: g.level ?? null,
        count: countOf(c.count, {}, item.data as Record<string, Value>),
        repeat: c.repeat === true,
        most: c.repeat ? (c.most ?? 99) : 1,
        chosen
      })
      decisionOptions.set(id, { grant: g, edition, item })
      if (c.set) {
        // Lo mismo, como mucho `most` veces (sin repetir, una); cuántos, al final, con la hoja
        const most = c.repeat ? (c.most ?? 99) : 1
        const times = new Map<string, number>()
        item.choices = {
          ...(item.choices ?? {}),
          [c.key]: chosen.filter((v) => {
            const n = (times.get(v) ?? 0) + 1
            times.set(v, n)
            return n <= most
          })
        }
        continue
      }
      for (const value of chosen) {
        const doc = resolve(value, c.type, edition) ?? byKey.get(value) ?? null
        if (!doc) {
          missing.push(value)
          continue
        }
        const child = carry(doc, `${id}=${value}`, {}, origin)
        levels[child.id] = g.level ?? levels[item.id] ?? 0
        items.push(child)
        expand(child, doc, at, step, origin, depth + 1)
      }
    }
  }

  const firstOfStep = new Set<string>()
  for (const pick of picks) {
    const source = byKey.get(pick.key)
    if (!source) {
      missing.push(pick.key)
      continue
    }
    const levels = levelsStep(pick.step)
    const first = levels && !firstOfStep.has(pick.step)
    if (levels) firstOfStep.add(pick.step)
    const at = levels ? Math.max(1, pick.level ?? 1) : level
    const item = carry(source, pick.id, levels ? { nivel: at, inicial: first } : {})
    items.push(item)
    expand(item, source, at, pick.step, pick.id)
  }

  const document: SystemDocument = { data, items }
  // Con la hoja calculada se miran los requisitos de lo que se puede elegir
  let sheet: Record<string, Value> = {}
  try {
    sheet = evaluate(system, type, document, { settings: choices.settings ?? {} }).values
  } catch {
    sheet = {}
  }

  const setElements = (set: string) => {
    const f = fields[set]
    return f?.kind === 'set' ? f.elements.map((e) => ({ value: e.key, label: e.label })) : []
  }
  const decisions: Decision[] = pendingDecisions.map((d) => {
    const meta = decisionOptions.get(d.id)
    const c = meta?.grant.choose
    let options: BuildOption[] = []
    if (c?.set) {
      const all = setElements(c.set)
      options = (c.from ? all.filter((o) => c.from?.includes(o.value)) : all).map((o) => ({ ...o, available: true }))
    } else if (c?.type) {
      const candidates: ContentItem[] = c.from
        ? c.from.flatMap((concept) => {
            const found = resolve(concept, c.type, meta?.edition)
            return found ? [found] : []
          })
        : seen
            .map((s: Seen<ContentItem>) => s.item)
            .filter((item) => item.type === c.type && (!meta?.edition || editionOf(system, item) === meta.edition))
      options = candidates.map((item) => {
        const reason = unmetRequirement(item, sheet)
        return {
          value: item.concept ?? item.key,
          label: labelOf(item),
          available: reason === null,
          ...(reason ? { reason } : {})
        }
      })
    }
    // Cuántos, con la hoja ya calculada y lo que lo concedió (@origen: la maestría con armas, por el nivel)
    const origin = meta?.item.from ? items.find((i) => i.id === meta.item.from) : undefined
    const count =
      c && meta
        ? countOf(
            c.count,
            { ...sheet, origen: (origin?.data ?? null) as Value },
            meta.item.data as Record<string, Value>
          )
        : d.count
    const valid = new Set(options.map((o) => o.value))
    const chosen = d.chosen.filter((v) => valid.has(v))
    // Lo mismo, como mucho `most` veces (sin repetir, una)
    const most = d.repeat ? (c?.most ?? count) : 1
    const times = new Map<string, number>()
    const distinct = chosen
      .filter((v) => {
        const n = (times.get(v) ?? 0) + 1
        times.set(v, n)
        return n <= most
      })
      .slice(0, count)
    return {
      ...d,
      count,
      options,
      chosen: distinct,
      pending: distinct.length < Math.min(count, d.repeat ? count : options.length)
    }
  })
  // Las que no piden nada (cuántos: 0), fuera; lo elegido de un conjunto, ya recortado, a lo que lo concede
  decisions.splice(0, decisions.length, ...decisions.filter((d) => d.count > 0))
  for (const d of decisions) {
    const meta = decisionOptions.get(d.id)
    const key = meta?.grant.choose?.key
    if (meta?.grant.choose?.set && key) meta.item.choices = { ...(meta.item.choices ?? {}), [key]: d.chosen }
  }

  // Cada paso, con lo que le falta
  const base = build.scores?.base ?? {}
  const scoresMissing = (step: Step) =>
    step.kind === 'scores' && setElements(step.set).some((e) => typeof base[e.value] !== 'number')
  const contentMissing = (step: Step) =>
    step.kind === 'content' && picks.filter((p) => p.step === step.key && byKey.has(p.key)).length < (step.min ?? 1)
  const stepStates: StepState[] = steps.map((step) => ({
    key: step.key,
    kind: step.kind,
    label: step.label,
    pending:
      decisions.filter((d) => d.step === step.key && d.pending).length +
      (contentMissing(step) || scoresMissing(step) ? 1 : 0) +
      picks.filter((p) => p.step === step.key && !byKey.has(p.key)).length
  }))
  // Lo que su sistema pide: lo elegido en cada paso de contenido y las puntuaciones
  const complete = steps.every((step) => !contentMissing(step) && !scoresMissing(step))

  return { type, document, decisions, steps: stepStates, level, complete, missing: [...new Set(missing)], levels, keys }
}

/**
 * Lo que se puede elegir en un paso de contenido: los documentos de su tipo que se ven (de lo que concede otro del
 * mismo tipo, solo el que lo concede: la subraza, no la raza), con el motivo de los que no se pueden. En un paso de
 * niveles, para añadir otro, cuentan también los requisitos de lo ya elegido (la multiclase)
 */
export function stepOptions(
  system: System,
  content: readonly ContentItem[],
  choices: Pick<Choices, 'sources' | 'duplicates'> & { settings?: Record<string, unknown> },
  build: Build,
  stepKey: string,
  values: Record<string, Value>
): BuildOption[] {
  const step = (system.creation ?? []).find((s) => s.key === stepKey && s.kind === 'content')
  if (step?.kind !== 'content') return []
  const { seen } = viewOf(system, content, choices)
  const ofType = seen.map((s) => s.item).filter((item) => item.type === step.type)
  // Lo concedido por otro del mismo tipo (la raza de una subraza) no se elige solo
  const granted = new Set(
    ofType.flatMap((item) =>
      ((item.mechanics as Mechanics | undefined)?.grants ?? [])
        .filter((g) => g.concept && (!g.type || g.type === step.type))
        .map((g) => `${g.concept}|${editionOf(system, item) ?? ''}`)
    )
  )
  const chosen = (build.picks ?? []).filter((p) => p.step === stepKey)
  const current = chosen.flatMap((p) => {
    const found = seen.find((s) => s.item.key === p.key)?.item
    return found ? [found] : []
  })
  return ofType
    .filter((item) => !granted.has(`${item.concept ?? item.key}|${editionOf(system, item) ?? ''}`))
    .map((item) => {
      const already = current.some((c) => c.key === item.key)
      // En un paso de niveles, la primera no pide nada; añadir otra (la multiclase) pide lo suyo y lo de las que tiene
      const adding = !step.levels || current.length > 0
      let reason: Text | null = already
        ? { es: 'Ya la tienes', en: 'Already chosen' }
        : adding
          ? unmetRequirement(item, values)
          : null
      if (!reason && step.levels && current.length > 0)
        for (const c of current) {
          reason = unmetRequirement(c, values)
          if (reason) break
        }
      return { value: item.key, label: labelOf(item), available: reason === null, ...(reason ? { reason } : {}) }
    })
}

/** Lo que se ve de un personaje en su tarjeta: su línea, su nivel y los campos de la tarjeta del sistema */
export interface BuiltSummary {
  line: string
  level: number
  stats: { key: string; label: string; value: string }[]
}

/**
 * Su línea: lo del primer paso de contenido sin niveles (la especie) y lo de los pasos de niveles con el suyo
 * («Enano de las colinas · Guerrero 4 · Mago 1»); y los campos de la tarjeta, calculados
 */
export function summarize(
  system: System,
  content: readonly ContentItem[],
  choices: Pick<Choices, 'sources' | 'duplicates'>,
  build: Build,
  built: Built,
  values: Record<string, Value>,
  language: 'es' | 'en' = 'es'
): BuiltSummary {
  const { byKey } = viewOf(system, content, choices)
  const steps = system.creation ?? []
  const say = (text: Text) => (typeof text === 'string' ? text : (text[language] ?? Object.values(text)[0] ?? ''))
  const picks = build.picks ?? []
  const first = steps.find((s) => s.kind === 'content' && !s.levels)
  const parts: string[] = []
  for (const p of picks.filter((p) => p.step === first?.key)) {
    const item = byKey.get(p.key)
    if (item) parts.push(say(labelOf(item)))
  }
  for (const step of steps.filter((s) => s.kind === 'content' && s.levels))
    for (const p of picks.filter((p) => p.step === step.key)) {
      const item = byKey.get(p.key)
      if (item) parts.push(`${say(labelOf(item))} ${Math.max(1, p.level ?? 1)}`)
    }
  const fields = system.types[built.type]?.fields ?? {}
  const stats = (system.card ?? []).flatMap((key) => {
    const field = fields[key]
    const value = values[key]
    if (!field || value === undefined || value === null || typeof value === 'object') return []
    return [{ key, label: say(field.label), value: String(value) }]
  })
  return { line: parts.join(' · '), level: built.level, stats }
}

/** Un texto en un idioma */
const sayIn = (language: 'es' | 'en') => (text: Text | undefined) =>
  text === undefined ? '' : typeof text === 'string' ? text : (text[language] ?? Object.values(text)[0] ?? '')

/**
 * El estado de un personaje para el creador y la IA, en el idioma de su campaña: cada paso con lo suyo (las opciones de
 * los de contenido, los métodos de las puntuaciones, los campos), lo que hay que decidir, su resumen y su hoja calculada
 */
export function characterView(
  system: System,
  content: readonly ContentItem[],
  choices: Pick<Choices, 'sources' | 'duplicates' | 'language'> & { settings?: Record<string, unknown> },
  build: Build
) {
  const language = choices.language
  const say = sayIn(language)
  const built = buildCharacter(system, content, choices, build)
  let values: Record<string, Value> = {}
  try {
    values = evaluate(system, built.type, built.document, { settings: choices.settings ?? {}, language }).values
  } catch {
    values = {}
  }
  const { byKey } = viewOf(system, content, choices)
  const fields = system.types[built.type]?.fields ?? {}
  const option = (o: BuildOption) => ({
    value: o.value,
    label: say(o.label),
    available: o.available,
    ...(o.reason ? { reason: say(o.reason) } : {})
  })
  const steps = (system.creation ?? []).map((step, i) => {
    const base = {
      key: step.key,
      label: say(step.label),
      help: step.help ? say(step.help) : null,
      creation: step.creation === true,
      pending: built.steps[i]?.pending ?? 0
    }
    switch (step.kind) {
      case 'content':
        return {
          ...base,
          kind: 'content' as const,
          type: step.type,
          min: step.min ?? 1,
          max: step.max ?? step.min ?? 1,
          levels: step.levels === true,
          picks: (build.picks ?? [])
            .filter((p) => p.step === step.key)
            .map((p) => {
              const item = byKey.get(p.key)
              return {
                id: p.id,
                key: p.key,
                level: p.level ?? null,
                name: item ? say(labelOf(item)) : p.key,
                missing: !item
              }
            }),
          options: stepOptions(system, content, choices, build, step.key, values).map(option)
        }
      case 'scores': {
        const set = fields[step.set]
        return {
          ...base,
          kind: 'scores' as const,
          set: step.set,
          field: step.field,
          elements: set?.kind === 'set' ? set.elements.map((e) => ({ key: e.key, label: say(e.label) })) : [],
          methods: step.methods.map((m) => ({ ...m, label: say(m.label) }))
        }
      }
      case 'fields':
        return {
          ...base,
          kind: 'fields' as const,
          fields: step.fields.flatMap((key) => {
            const f = fields[key]
            if (!f) return []
            return [
              {
                key,
                label: say(f.label),
                kind: f.kind,
                ...((f.kind === 'choice' || f.kind === 'list') && f.options
                  ? { options: f.options.map((o) => ({ value: o.value, label: say(o.label) })) }
                  : {})
              }
            ]
          })
        }
      default:
        return { ...base, kind: 'summary' as const }
    }
  })
  return {
    built,
    view: {
      steps,
      decisions: built.decisions.map((d) => ({ ...d, label: say(d.label), options: d.options.map(option) })),
      level: built.level,
      complete: built.complete,
      missing: built.missing,
      summary: summarize(system, content, choices, build, built, values, language),
      sheet: values,
      // Los campos del personaje, con sus nombres: para pintar su ficha mínima en cualquier sistema
      fields: Object.entries(fields).map(([key, f]) => ({
        key,
        label: say(f.label),
        kind: f.kind,
        ...(f.kind === 'set'
          ? {
              elements: f.elements.map((e) => ({
                key: e.key,
                label: say(e.label),
                ...(e.abbr ? { abbr: say(e.abbr) } : {})
              })),
              columns: Object.entries(f.fields).map(([k, c]) => ({ key: k, label: say(c.label), kind: c.kind }))
            }
          : {}),
        ...(f.kind === 'group'
          ? { columns: Object.entries(f.fields).map(([k, c]) => ({ key: k, label: say(c.label), kind: c.kind })) }
          : {}),
        ...(f.kind === 'items' ? { of: [...f.of] } : {})
      })),
      items: (built.document.items ?? []).map((item) => ({
        id: item.id,
        type: item.type,
        name: item.name,
        from: item.from ?? null,
        level: built.levels[item.id] ?? null,
        key: built.keys[item.id] ?? null
      }))
    }
  }
}

export type CharacterView = ReturnType<typeof characterView>['view']

/** Elegir por partes (para la IA): añadir, cambiar de nivel, quitar, decidir, puntuaciones y campos */
export interface Choose {
  add?: { step: string; key: string; level?: number }[]
  levels?: Record<string, number>
  remove?: string[]
  decisions?: Record<string, string[]>
  scores?: { method?: string; base?: Record<string, number> }
  values?: Record<string, unknown>
}

export class ChooseError extends Error {}

/**
 * Lo elegido por partes, sobre sus elecciones: en un paso sin niveles, lo añadido sustituye a lo que había; en uno de
 * niveles, se suma. Lo quitado se lleva sus decisiones
 */
export function applyChoices(system: System, build: Build, choose: Choose, newId: () => string): Build {
  const steps = system.creation ?? []
  const removed = new Set(choose.remove ?? [])
  const picks = [...(build.picks ?? [])]
  for (const a of choose.add ?? []) {
    const step = steps.find((s) => s.key === a.step)
    if (step?.kind !== 'content') throw new ChooseError(`No hay un paso de contenido «${a.step}»`)
    if (!step.levels) for (const p of picks) if (p.step === a.step) removed.add(p.id)
    picks.push({ id: newId(), step: a.step, key: a.key, ...(step.levels ? { level: a.level ?? 1 } : {}) })
  }
  for (const id of Object.keys(choose.levels ?? {}))
    if (!picks.some((p) => p.id === id)) throw new ChooseError(`No hay nada elegido con el id «${id}»`)
  const kept = picks
    .filter((p) => !removed.has(p.id))
    .map((p) => (choose.levels?.[p.id] ? { ...p, level: choose.levels[p.id] } : p))
  const decisions = Object.fromEntries(
    Object.entries({ ...(build.decisions ?? {}), ...(choose.decisions ?? {}) }).filter(
      ([k]) => ![...removed].some((id) => k.startsWith(`${id}>`))
    )
  )
  return {
    ...build,
    picks: kept,
    decisions,
    ...(choose.scores
      ? {
          scores: {
            ...build.scores,
            ...(choose.scores.method ? { method: choose.scores.method } : {}),
            base: { ...(build.scores?.base ?? {}), ...(choose.scores.base ?? {}) }
          }
        }
      : {}),
    ...(choose.values ? { values: { ...(build.values ?? {}), ...choose.values } } : {})
  }
}
