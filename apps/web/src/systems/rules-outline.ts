/**
 * Las reglas de un sistema, para leerlas (ajustes tras los módulos: «Reglas debe ser como calendario»): lo que define,
 * ya en palabras y agrupado como en una hoja de referencia. El personaje (sus conjuntos, lo que se calcula, sus
 * recursos, lo que lleva y lo demás de su ficha), las tiradas con sus dados, las otras fichas, lo que se lleva, cómo se
 * crea un personaje y los ajustes de campaña. Las fórmulas, con los nombres de los campos (formulaText)
 */
import {
  characterType,
  type Field,
  formulaText,
  type Language,
  type Roll,
  type SimpleField,
  type System,
  textOf
} from '@crisol/systems'

type Tone = NonNullable<Roll['bands']>[number]['tone']
type Critical = NonNullable<System['dice']>['critical']

export interface OutlineSet {
  key: string
  label: string
  /** Cada elemento, con su abreviatura y sus valores iniciales en palabras (Sigilo: Destreza) */
  elements: { key: string; label: string; abbr: string; note: string }[]
  /** Lo que se calcula en cada elemento, en palabras */
  derived: { key: string; label: string; formula: string }[]
  /** Lo que se apunta de cada uno */
  noted: string[]
}

export interface OutlineField {
  key: string
  label: string
  /** Lo que tiene, en corto: sus opciones, su rango, lo de dentro */
  detail: string
}

export interface RulesOutline {
  summary: string
  character: {
    label: string
    sets: OutlineSet[]
    derived: { key: string; label: string; formula: string }[]
    resources: { key: string; label: string; max: string; recovery: 'short' | 'long' | null }[]
    items: { key: string; label: string; types: string }[]
    others: OutlineField[]
  } | null
  dice: { default: string | null; critical: Critical | null; initiative: string | null }
  rolls: {
    key: string
    label: string
    formula: string
    each: string
    target: 'none' | 'optional' | 'required'
    variants: { when: string; formula: string }[]
    bands: { label: string; tone: Tone; when: string }[]
    modes: { key: string; label: string; change: string }[]
  }[]
  /** Las otras fichas (las criaturas) */
  actors: { key: string; label: string; fields: number; sample: string[] }[]
  /** Lo que se lleva o se aprende (armas, conjuros), con los bonos que da */
  items: { key: string; label: string; fields: number; sample: string[]; bonuses: string[] }[]
  creation: { key: string; label: string; kind: 'content' | 'scores' | 'fields' | 'summary'; detail: string }[]
  settings: { key: string; label: string; help: string; options: { label: string; chosen: boolean }[] }[]
  license: string | null
}

/** Un tipo de mentira con unos campos: así las fórmulas de un elemento (@este.puntuacion) se leen con sus nombres */
const ELEMENT = 'zz_elemento'
/** El valor de cada campo en una tirada «una por cada uno de estos campos» (@este, sin más) */
const THIS = 'zz_este'

export function rulesOutline(
  system: System,
  language: Language,
  words: { thisOne: string; yes: string; no: string }
): RulesOutline {
  const text = (value: Parameters<typeof textOf>[0]) => textOf(value, language)
  const typeKey = characterType(system)
  const character = typeKey ? system.types[typeKey] : undefined
  const typeLabel = (key: string) => (system.types[key] ? text(system.types[key].label) || key : key)

  // Las fórmulas en palabras, en el contexto de un tipo o de los campos de un elemento
  const read = (formula: string, type = typeKey ?? '') => formulaText(formula, { system, type, language })
  const readWith = (formula: string, fields: Record<string, Field>, extra: Record<string, Field> = {}) => {
    const actor = typeKey && character ? { [typeKey]: { ...character, fields: { ...character.fields, ...extra } } } : {}
    const shaped: System = {
      ...system,
      types: { ...system.types, ...actor, [ELEMENT]: { document: 'item', label: '', fields } }
    }
    return formulaText(formula, { system: shaped, type: ELEMENT, language })
  }

  const detailOf = (field: Field): string => {
    switch (field.kind) {
      case 'number':
        return field.min !== undefined && field.max !== undefined
          ? `${field.min}–${field.max}`
          : field.max !== undefined
            ? `≤ ${field.max}`
            : ''
      case 'choice':
        return field.options.map((o) => text(o.label)).join(', ')
      case 'list':
        return (field.options ?? []).map((o) => text(o.label)).join(', ')
      case 'group':
        return Object.values(field.fields)
          .map((f) => text(f.label))
          .join(', ')
      case 'table':
        return Object.values(field.columns)
          .map((f) => text(f.label))
          .join(', ')
      case 'dice':
        return field.default ?? ''
      case 'clock':
        return `${field.segments}`
      case 'link':
        return typeLabel(field.to)
      default:
        return ''
    }
  }

  let outlineCharacter: RulesOutline['character'] = null
  if (character) {
    const sets: OutlineSet[] = []
    const derived: { key: string; label: string; formula: string }[] = []
    const resources: { key: string; label: string; max: string; recovery: 'short' | 'long' | null }[] = []
    const items: { key: string; label: string; types: string }[] = []
    const others: OutlineField[] = []
    for (const [key, field] of Object.entries(character.fields)) {
      const label = text(field.label) || key
      if (field.kind === 'set') {
        const columns = Object.entries(field.fields)
        const nameOf = (column: SimpleField | undefined, value: string | number | boolean) => {
          if (column?.kind === 'choice') {
            // Una opción que es otro elemento (Sigilo: des → Destreza): su nombre
            const option = column.options.find((o) => o.value === value)
            if (option) return text(option.label)
          }
          if (typeof value === 'boolean') return value ? words.yes : words.no
          const element = Object.values(character.fields)
            .flatMap((f) => (f.kind === 'set' ? f.elements : []))
            .find((e) => e.key === value)
          return element ? text(element.label) : String(value)
        }
        sets.push({
          key,
          label,
          elements: field.elements.map((e) => ({
            key: e.key,
            label: text(e.label) || e.key,
            abbr: text(e.abbr),
            note: Object.entries(e.values ?? {})
              .map(([k, v]) => nameOf(field.fields[k], v))
              .join(', ')
          })),
          derived: columns
            .filter(
              (entry): entry is [string, Extract<SimpleField, { kind: 'derived' }>] => entry[1].kind === 'derived'
            )
            .map(([k, f]) => ({ key: k, label: text(f.label) || k, formula: readWith(f.formula, field.fields) })),
          noted: columns.filter(([, f]) => f.kind !== 'derived').map(([k, f]) => text(f.label) || k)
        })
      } else if (field.kind === 'derived') derived.push({ key, label, formula: read(field.formula) })
      else if (field.kind === 'resource')
        resources.push({
          key,
          label,
          max: field.max === undefined ? '' : typeof field.max === 'number' ? String(field.max) : read(field.max),
          recovery: field.recovery ?? null
        })
      else if (field.kind === 'items') items.push({ key, label, types: field.of.map(typeLabel).join(', ') })
      else others.push({ key, label, detail: detailOf(field) })
    }
    outlineCharacter = { label: text(character.label) || typeKey || '', sets, derived, resources, items, others }
  }

  const fieldLabel = (key: string) => (character?.fields[key] ? text(character.fields[key].label) || key : key)
  const rolls: RulesOutline['rolls'] = Object.entries(system.rolls ?? {}).map(([key, roll]) => {
    // Dentro de la tirada, @este es cada elemento, cada objeto o cada campo
    const each = roll.for
    let say = (formula: string) => read(formula)
    let eachText = ''
    if (each && 'set' in each) {
      const set = character?.fields[each.set]
      if (set?.kind === 'set') say = (formula) => readWith(formula, set.fields)
      eachText = fieldLabel(each.set)
    } else if (each && 'items' in each) {
      const first = each.items[0]
      if (first && system.types[first]) say = (formula) => read(formula, first)
      eachText = each.items.map(typeLabel).join(', ')
    } else if (each && 'fields' in each) {
      const extra = { [THIS]: { kind: 'number', label: words.thisOne } as Field }
      say = (formula) => readWith(formula.replace(/@este\b(?!\.)/g, `@${THIS}`), {}, extra)
      eachText = each.fields.map(fieldLabel).join(', ')
    }
    return {
      key,
      label: text(roll.label) || key,
      formula: say(roll.formula),
      each: eachText,
      target: roll.target ?? 'none',
      variants: (roll.variants ?? []).map((v) => ({ when: say(v.if), formula: say(v.formula) })),
      bands: (roll.bands ?? []).map((b) => ({
        label: text(b.label),
        tone: b.tone,
        when: b.if.trim() === 'true' ? '' : say(b.if)
      })),
      modes: (roll.modes ?? []).map((m) => ({
        key: m.key,
        label: text(m.label) || m.key,
        change: [
          m.from && m.to ? `${m.from} → ${m.to}` : '',
          m.add ? (m.add.startsWith('-') ? m.add : `+${m.add}`) : ''
        ]
          .filter(Boolean)
          .join(' · ')
      }))
    }
  })

  const sample = (fields: Record<string, Field>) =>
    Object.values(fields)
      .map((f) => text(f.label))
      .filter(Boolean)
  const others = Object.entries(system.types).filter(([key]) => key !== typeKey)
  const actors = others
    .filter(([, type]) => type.document === 'actor')
    .map(([key, type]) => ({
      key,
      label: text(type.label) || key,
      fields: Object.keys(type.fields).length,
      sample: sample(type.fields)
    }))
  const items = others
    .filter(([, type]) => type.document === 'item')
    .map(([key, type]) => ({
      key,
      label: text(type.label) || key,
      fields: Object.keys(type.fields).length,
      sample: sample(type.fields),
      bonuses: (type.modifiers ?? []).map((m) => {
        const target = m.target.split('.')
        const name = text(m.label) || read(`@${target.join('.')}`)
        return `${name} + ${read(m.value, key)}`
      })
    }))

  const creation: RulesOutline['creation'] = (system.creation ?? []).map((step) => {
    const label = text(step.label) || step.key
    const detail =
      step.kind === 'content'
        ? typeLabel(step.type)
        : step.kind === 'scores'
          ? step.methods.map((m) => text(m.label)).join(', ')
          : step.kind === 'fields'
            ? step.fields.map(fieldLabel).join(', ')
            : ''
    return { key: step.key, label, kind: step.kind, detail }
  })

  const settings: RulesOutline['settings'] = Object.entries(system.settings ?? {}).map(([key, setting]) => {
    const chosen = (value: string | boolean) =>
      Array.isArray(setting.default) ? setting.default.includes(String(value)) : setting.default === value
    const options =
      setting.kind === 'boolean'
        ? [
            { label: words.yes, chosen: chosen(true) },
            { label: words.no, chosen: setting.default === false || setting.default === undefined }
          ]
        : setting.kind === 'number'
          ? setting.default !== undefined
            ? [{ label: String(setting.default), chosen: true }]
            : []
          : (setting.options ?? []).map((o) => ({ label: text(o.label) || o.value, chosen: chosen(o.value) }))
    return { key, label: text(setting.label) || key, help: text(setting.help), options }
  })

  const initiative = system.initiative ? system.rolls?.[system.initiative] : undefined
  return {
    summary: text(system.summary),
    character: outlineCharacter,
    dice: {
      default: system.dice?.default ?? null,
      critical: system.dice?.critical ?? null,
      initiative: initiative ? text(initiative.label) || (system.initiative ?? null) : null
    },
    rolls,
    actors,
    items,
    creation,
    settings,
    license: system.license ? `${text(system.license.name)} · ${system.license.license}` : null
  }
}

/** Si no define nada todavía (un sistema recién hecho a mano) */
export const isEmptyOutline = (outline: RulesOutline) =>
  !outline.character && outline.rolls.length === 0 && outline.items.length === 0 && outline.actors.length === 0
