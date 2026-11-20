/**
 * La mecánica de un documento de contenido (ADR-0012): lo que cambia de quien lo lleva (efectos), sus usos (recursos),
 * lo que se tira con él (acciones), lo que concede, cómo escala y cuánto está automatizado. Vale para cualquier sistema.
 * En sus fórmulas, los nombres son los de quien lo lleva, `@este` es el propio documento y `@ajustes`, los de la campaña
 */
import { z } from 'zod'
import { type Field, KEY, KEY_MESSAGE, LIMITS, type SimpleField, type System } from './format.ts'
import { type Context, checkFormula, type Scope, type Shape, scopeOf, settingsShape } from './formulas/check.ts'
import { own } from './own.ts'
import { text, textOf } from './text.ts'
import { bonusTarget, errorMap } from './validate.ts'

const key = z.string().regex(KEY, KEY_MESSAGE)
const formula = z.string().trim().min(1).max(LIMITS.formula)

/**
 * Lo que hace un efecto con su destino, en este orden al calcular: base (sustituye a lo de siempre y, de varias, gana la
 * mayor: la armadura, Defensa sin armadura), fijar, sumar, multiplicar (la velocidad a la mitad, redondeando hacia abajo), mínimo y máximo. El
 * grado de competencia es un mínimo en su grado (1, competente; 2, pericia; 0.5, media). Ventaja y desventaja se anotan
 * para la tirada; añadir, a una lista
 */
export const EFFECT_OPS = ['base', 'set', 'add', 'mul', 'min', 'max', 'advantage', 'disadvantage', 'append'] as const
/** Cuándo se recupera un uso */
export const RECOVERIES = ['short', 'long', 'dawn', 'other'] as const
/** Cuánto cuesta hacer una acción */
export const ACTIVATIONS = ['action', 'bonus', 'reaction', 'free', 'legendary', 'special'] as const
/** Cuánto lo automatiza Crisol: todo, una parte (lo demás se lleva a mano) o solo el texto */
export const AUTOMATION = ['full', 'partial', 'text'] as const

const effect = z.strictObject({
  target: z.string().trim().min(1).max(200),
  op: z.enum(EFFECT_OPS),
  value: formula.optional(),
  when: formula.optional(),
  label: text().optional()
})

const damage = z.strictObject({ formula, type: key.optional(), label: text().optional() })

const resource = z.strictObject({
  key,
  label: text(),
  max: formula,
  recovery: z.enum(RECOVERIES).optional(),
  // Cuánto se recupera (sin él, todo)
  amount: formula.optional()
})

const save = z.strictObject({ ability: key, dc: formula, success: z.enum(['half', 'none', 'special']).optional() })

/** Una opción de una acción que es «uno de estos efectos» (los rayos del contemplador): lo suyo, sobre lo de la acción */
const actionOption = z.strictObject({
  key,
  label: text(),
  attack: formula.optional(),
  save: save.optional(),
  damage: z.array(damage).max(10).optional(),
  heal: formula.optional(),
  range: text(100).optional()
})

const action = z.strictObject({
  key,
  label: text(),
  activation: z.enum(ACTIVATIONS).optional(),
  // El bono de ataque, lo que se suma al d20
  attack: formula.optional(),
  save: save.optional(),
  damage: z.array(damage).max(10).optional(),
  heal: formula.optional(),
  range: text(100).optional(),
  // Uno de estos efectos (ADR-0033): cuántos se usan cada vez, si distintos, y una fórmula para que salga uno al azar
  // (el puesto que sale, desde 1)
  options: z.array(actionOption).min(2).max(20).optional(),
  count: z.int().min(1).max(20).optional(),
  distinct: z.boolean().optional(),
  pick: z.string().trim().min(1).max(100).optional(),
  // Lo que gasta: un recurso suyo, una recarga (5-6) o su coste en acciones legendarias
  uses: key.optional(),
  recharge: z
    .string()
    .regex(/^[1-6](-6)?$/, 'Una recarga es un número del dado, como 5-6')
    .optional(),
  cost: z.int().min(1).max(10).optional()
})

const grant = z
  .strictObject({
    // A partir de qué nivel (en una clase)
    level: z.int().min(1).max(30).optional(),
    // Un documento, por su concepto (el rasgo, el conjuro) y, si hay varios con ese concepto, su tipo
    concept: key.optional(),
    type: key.optional(),
    // O una elección: cuántos, de qué tipo (o de qué conjunto de quien lo lleva) y, si se dice, de cuáles
    choose: z
      .strictObject({
        key,
        label: text(),
        count: formula,
        type: key.optional(),
        // De un conjunto (las habilidades): a lo elegido se le aplica `op` con `value` en su campo (el grado, a 1)
        set: key.optional(),
        field: key.optional(),
        op: z.enum(['min', 'add']).optional(),
        value: formula.optional(),
        from: z.array(key).max(500).optional(),
        when: formula.optional(),
        // Se puede elegir lo mismo más de una vez (+1 y +1 a la misma característica), como mucho `most` veces
        repeat: z.boolean().optional(),
        most: z.int().min(1).max(10).optional(),
        // Hasta dónde puede subir lo elegido al sumarle (los dones épicos: una característica, hasta 30)
        max: formula.optional()
      })
      .refine((c) => (c.type === undefined) !== (c.set === undefined), 'Elige de un tipo o de un conjunto')
      .optional()
  })
  .refine((g) => (g.concept === undefined) !== (g.choose === undefined), 'Lleva un concepto o una elección')

const scaling = z.strictObject({
  // Por el nivel al que se tira (el del espacio), o por un nivel de quien lo lleva (el del personaje, en los trucos)
  mode: z.enum(['slot', 'level']),
  // Por nivel: cuál (@nivel, el de una clase)
  by: formula.optional(),
  // Desde qué nivel: por debajo no se tira y, por cada uno por encima, se suma `per`
  base: z.int().min(0).max(30).optional(),
  per: formula.optional(),
  // A partir de un nivel, otra fórmula (la última que se alcance)
  at: z
    .array(z.strictObject({ level: z.int().min(1).max(30), formula }))
    .max(20)
    .optional(),
  // A qué acción (sin ella, a todas) y a qué partes de su daño (sin ellas, a la primera o a la curación)
  action: key.optional(),
  parts: z.array(z.int().min(0).max(9)).max(10).optional()
})

export const mechanicsSchema = z.strictObject({
  effects: z.array(effect).max(100).optional(),
  resources: z.array(resource).max(20).optional(),
  actions: z.array(action).max(50).optional(),
  grants: z.array(grant).max(300).optional(),
  scaling: scaling.optional(),
  // Los conjuros de una criatura (ADR-0033): su característica, su CD y su ataque, y grupos a voluntad (sin uses) o
  // de N al día cada uno; cada conjuro, por su clave o su concepto en el compendio
  spellcasting: z
    .strictObject({
      label: text().optional(),
      ability: key.optional(),
      dc: formula.optional(),
      attack: formula.optional(),
      groups: z
        .array(
          z.strictObject({
            label: text().optional(),
            uses: z.int().min(1).max(20).optional(),
            spells: z.array(key).min(1).max(100)
          })
        )
        .min(1)
        .max(20)
    })
    .optional(),
  // Se activa y se desactiva (la Furia, Mago armadura): sus efectos piden `@este.activo`
  toggle: z.strictObject({ label: text().optional(), duration: text(100).optional() }).optional(),
  automation: z.enum(AUTOMATION).optional(),
  // Lo que se lleva a mano, si no está todo automatizado
  manual: text(2000).optional(),
  // Lo que pide para elegirlo (una dote, la multiclase): una fórmula sobre quien lo elige y su motivo si no se cumple
  requires: z
    .array(z.strictObject({ formula, reason: text() }))
    .max(10)
    .optional()
})

export type Mechanics = z.infer<typeof mechanicsSchema>

/** De dónde sale un documento: su página en cada PDF */
export const refSchema = z.strictObject({
  pages: z.strictObject({ en: z.int().min(1).optional(), es: z.int().min(1).optional() }).optional()
})

export const conceptSchema = key

type Segment = string | number
type Add = (path: Segment[], message: string) => void

/** La lista de quien lo lleva a la que lleva una ruta (añadir: los idiomas, las resistencias) */
function listTarget(
  fields: Record<string, Field | SimpleField>,
  segments: readonly string[]
): (Field & { kind: 'list' }) | null {
  const [first, ...rest] = segments
  const field = first === undefined ? undefined : own(fields, first)
  if (!field) return null
  if (rest.length === 0) return field.kind === 'list' ? field : null
  return field.kind === 'group' ? listTarget(field.fields, rest) : null
}

/** Valida la mecánica de un documento de su tipo; cada problema, con su ruta */
export function validateMechanics(system: System, type: string, mechanics: unknown, at: Segment[], add: Add) {
  const parsed = mechanicsSchema.safeParse(mechanics, { error: errorMap })
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 30)) add([...at, ...(issue.path as Segment[])], issue.message)
    return
  }
  const m = parsed.data
  const actors = Object.entries(system.types).filter(([, t]) => t.document === 'actor')
  const [ownerKey, ownerType] = actors[0] ?? []
  const owner = ownerType ? textOf(ownerType.label) || (ownerKey as string) : 'el personaje'
  const itemType = own(system.types, type)
  const este: Shape = {
    type: 'object',
    label: 'este',
    fields: {
      ...(itemType ? scopeOf(itemType.fields, `${type}:`, owner, system) : {}),
      name: { type: 'string', label: 'nombre' }
    }
  }
  const scope: Scope = {
    ...(ownerType ? scopeOf(ownerType.fields, '', owner, system) : {}),
    este,
    ajustes: settingsShape(system),
    // Lo que lo concedió (la clase de un rasgo): de cualquier tipo
    origen: { type: 'any', label: 'origen' }
  }
  const context = (dice: boolean): Context => ({ scope, dice, owner })

  /** Una fórmula en su sitio: los problemas de siempre y, si da dados donde no van, el porqué */
  const check = (value: string, path: Segment[], noDice?: string) => {
    const checked = checkFormula(value, context(true))
    for (const p of checked.problems) add(path, p.message)
    if (noDice && checked.problems.length === 0 && checked.type === 'dice') add(path, noDice)
    return checked
  }
  const yesOrNo = (value: string, path: Segment[]) => {
    const checked = check(value, path, 'Una condición no lleva dados')
    if (checked.problems.length === 0 && !['boolean', 'any', 'null', 'dice'].includes(checked.type))
      add(path, 'Aquí va sí o no: una comparación, como @nivel >= 5')
  }

  m.effects?.forEach((e, i) => {
    const here = [...at, 'effects', i]
    const segments = e.target.split('.')
    const first = segments[0] ?? ''
    if (e.op === 'advantage' || e.op === 'disadvantage') {
      if (!system.rolls || !own(system.rolls, first)) add([...here, 'target'], `No existe la tirada «${first}»`)
    } else {
      if (!e.value) add([...here, 'value'], 'Esta operación necesita un valor')
      if (!actors.some(([, t]) => own(t.fields, first))) add([...here, 'target'], `Ningún personaje tiene «${first}»`)
      else if (e.op === 'append') {
        const lists = actors.map(([, t]) => listTarget(t.fields, segments)).filter((l) => l !== null)
        if (lists.length === 0) add([...here, 'target'], `«${e.target}» no es una lista de los personajes`)
        // Un texto escrito tal cual que no es una de sus opciones (un tipo de daño mal escrito)
        const literal = e.value?.trim().match(/^"([^"]*)"$/)?.[1]
        const options = lists.find((l) => l.options)?.options
        if (literal !== undefined && options && !options.some((o) => o.value === literal))
          add([...here, 'value'], `«${literal}» no es una de sus opciones`)
      } else if (!actors.some(([, t]) => bonusTarget(t.fields, segments)))
        add([...here, 'target'], `«${e.target}» no es un número ni un calculado de los personajes`)
    }
    if (e.value) check(e.value, [...here, 'value'], 'Un efecto no lleva dados: los dados van en las acciones')
    if (e.when) yesOrNo(e.when, [...here, 'when'])
  })
  m.resources?.forEach((r, i) => {
    const here = [...at, 'resources', i]
    check(r.max, [...here, 'max'], 'El máximo de un recurso no lleva dados')
    if (r.amount) check(r.amount, [...here, 'amount'])
  })
  m.actions?.forEach((a, i) => {
    const here = [...at, 'actions', i]
    if (a.attack) check(a.attack, [...here, 'attack'], 'Un bono de ataque no lleva dados: es lo que se suma al dado')
    if (a.save) check(a.save.dc, [...here, 'save', 'dc'], 'Una CD no lleva dados')
    for (const [j, d] of (a.damage ?? []).entries()) check(d.formula, [...here, 'damage', j, 'formula'])
    if (a.heal) check(a.heal, [...here, 'heal'])
    if (a.uses && !m.resources?.some((r) => r.key === a.uses)) add([...here, 'uses'], `No tiene el recurso «${a.uses}»`)
    if (a.pick) check(a.pick, [...here, 'pick'])
    if ((a.count !== undefined || a.distinct !== undefined || a.pick !== undefined) && !a.options)
      add([...here, 'options'], 'count, distinct y pick van con options')
    if (a.options && a.count && a.distinct && a.count > a.options.length)
      add([...here, 'count'], `Son ${a.options.length} opciones: no se pueden usar ${a.count} distintas`)
    const keys = new Set<string>()
    a.options?.forEach((o, j) => {
      const there = [...here, 'options', j]
      if (keys.has(o.key)) add([...there, 'key'], `«${o.key}» está repetida`)
      keys.add(o.key)
      if (o.attack) check(o.attack, [...there, 'attack'], 'Un bono de ataque no lleva dados: es lo que se suma al dado')
      if (o.save) check(o.save.dc, [...there, 'save', 'dc'], 'Una CD no lleva dados')
      for (const [k, d] of (o.damage ?? []).entries()) check(d.formula, [...there, 'damage', k, 'formula'])
      if (o.heal) check(o.heal, [...there, 'heal'])
    })
  })
  if (m.spellcasting) {
    const here = [...at, 'spellcasting']
    if (m.spellcasting.dc) check(m.spellcasting.dc, [...here, 'dc'], 'Una CD no lleva dados')
    if (m.spellcasting.attack)
      check(m.spellcasting.attack, [...here, 'attack'], 'Un bono de ataque no lleva dados: es lo que se suma al dado')
  }
  m.grants?.forEach((g, i) => {
    const here = [...at, 'grants', i]
    if (g.type && !own(system.types, g.type)) add([...here, 'type'], `No existe el tipo «${g.type}»`)
    if (!g.choose) return
    const c = g.choose
    if (c.type && !own(system.types, c.type)) add([...here, 'choose', 'type'], `No existe el tipo «${c.type}»`)
    if (c.set) {
      const set = actors.map(([, t]) => own(t.fields, c.set as string)).find((f) => f?.kind === 'set')
      if (set?.kind !== 'set') add([...here, 'choose', 'set'], `Ningún personaje tiene el conjunto «${c.set}»`)
      else {
        const field = c.field ?? 'grado'
        if (!own(set.fields, field)) add([...here, 'choose', 'field'], `«${c.set}» no tiene el campo «${field}»`)
        for (const [j, k] of (c.from ?? []).entries())
          if (!set.elements.some((e) => e.key === k)) add([...here, 'choose', 'from', j], `«${c.set}» no tiene «${k}»`)
      }
      if (c.value) check(c.value, [...here, 'choose', 'value'], 'Un valor no lleva dados')
    }
    check(g.choose.count, [...here, 'choose', 'count'], 'Cuántos se eligen no lleva dados')
    if (g.choose.max) check(g.choose.max, [...here, 'choose', 'max'], 'Un tope no lleva dados')
    if (g.choose.when) yesOrNo(g.choose.when, [...here, 'choose', 'when'])
  })
  const s = m.scaling
  if (s?.mode === 'level' && !s.by) add([...at, 'scaling', 'by'], 'Por nivel: di cuál, como @nivel')
  if (s?.by) check(s.by, [...at, 'scaling', 'by'], 'Un nivel no lleva dados')
  if (s?.per) check(s.per, [...at, 'scaling', 'per'])
  for (const [i, step] of (s?.at ?? []).entries()) check(step.formula, [...at, 'scaling', 'at', i, 'formula'])
  if (s?.action && !m.actions?.some((a) => a.key === s.action))
    add([...at, 'scaling', 'action'], `No tiene la acción «${s.action}»`)
}
