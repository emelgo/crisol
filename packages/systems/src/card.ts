/**
 * La ficha de una entrada del compendio, como en 5etools: una línea de tipo en cursiva bajo el nombre («Arma marcial,
 * común»), un bloque de datos a dos lados (peso y coste a uno; daño, propiedades y maestría al otro) y los campos que
 * quedan. Cada tipo dice la suya en el formato (`types.<tipo>.card`); los campos de la hoja (equipado, cantidad) no
 * salen. Lo que devuelve es Markdown de una línea: un campo de dados sale como tirada escrita (`dice: 1d8`)
 */
import { type CardFormat, cardKeys, type Part, parseTemplate } from './card-template.ts'
import { compendiumFields } from './compendium.ts'
import type { Field, System } from './format.ts'
import { type Language, type Text, textOf } from './text.ts'

/** La ficha de una entrada, ya escrita en su idioma */
export interface EntryCard {
  /** Su línea de tipo (sin nada que decir, null) */
  line: string | null
  left: string[]
  right: string[]
  /** Los demás campos con valor, con su nombre, en el orden del tipo */
  fields: { label: string; value: string }[]
}

/** Las palabras de «sí» (un campo de sí o no que se escribe tal cual) */
const YES: Record<Language, string> = { es: 'sí', en: 'yes' }

const humanize = (key: string) => {
  const text = key.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** El valor de un campo, en Markdown de una línea; sin valor (o «no»), vacío */
export function fieldValue(field: Field | undefined, value: unknown, language: Language): string {
  if (value === undefined || value === null || value === '' || value === false) return ''
  const options = field && 'options' in field ? field.options : undefined
  const option = (v: unknown) => {
    const found = options?.find((o) => o.value === v)
    return found ? textOf(found.label, language) : humanize(String(v))
  }
  switch (field?.kind) {
    case 'boolean':
      return YES[language]
    case 'choice':
      return option(value)
    case 'list':
      return Array.isArray(value)
        ? value.map((v) => (v && typeof v === 'object' ? textOf(v as Text, language) : option(v))).join(', ')
        : ''
    case 'dice':
      return typeof value === 'string' && value.trim() ? `\`dice: ${value.trim()}\`` : ''
    case 'number':
      return typeof value === 'number' ? value.toLocaleString(language) : String(value)
    default:
      if (Array.isArray(value)) return value.map((v) => String(v)).join(', ')
      return typeof value === 'object' ? textOf(value as Text, language) : String(value)
  }
}

/** Si un valor cuenta como que lo tiene (para `{campo: …}`): no vacío, no «no» y no cero */
const present = (value: unknown) =>
  value !== undefined &&
  value !== null &&
  value !== '' &&
  value !== false &&
  value !== 0 &&
  !(Array.isArray(value) && value.length === 0)

/** Lo escrito sin los separadores que quedan sueltos al faltar un campo («Arma, » → «Arma»; «( )» fuera) */
function tidy(text: string) {
  return text
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([,;)])/g, '$1')
    .replace(/([,;])(\s*[,;])+/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,;·—–-]+|[\s,;·—–-]+$/g, '')
}

/** Escribe una plantilla con los datos de una entrada */
export function fillTemplate(
  template: string,
  fields: Record<string, Field>,
  data: Record<string, unknown>,
  language: Language
): string {
  // Si nombra campos y ninguno tiene valor, el renglón entero sobra («Maestría:» de un arma sin maestría)
  let named = 0
  let filled = 0
  const write = (parts: Part[]): string =>
    parts
      .map((part) => {
        if (typeof part === 'string') return part
        const value = data[part.key]
        if (part.inner) return present(value) !== part.negate ? write(part.inner) : ''
        const text = fieldValue(fields[part.key], value, language)
        named++
        if (text) filled++
        return text
      })
      .join('')
  const text = tidy(write(parseTemplate(template)))
  return named > 0 && filled === 0 ? '' : text
}

/** Un renglón del bloque de datos: un campo por su clave (con su nombre delante, en negrita) o una plantilla */
function blockLine(entry: string, fields: Record<string, Field>, data: Record<string, unknown>, language: Language) {
  const field = fields[entry.trim()]
  if (field && !entry.includes('{')) {
    const value = fieldValue(field, data[entry.trim()], language)
    return value ? `**${textOf(field.label, language)}** ${value}` : ''
  }
  return fillTemplate(entry, fields, data, language)
}

/** La ficha de una entrada, si su tipo la tiene; debajo, los demás campos del compendio con valor */
export function entryCard(
  system: System,
  item: { type: string; data: Record<string, unknown> },
  language: Language
): EntryCard | null {
  const type = system.types[item.type]
  const card = (type as { card?: CardFormat } | undefined)?.card
  if (!type || !card || (!card.line && !card.left?.length && !card.right?.length)) return null
  const lines = (list: Text[] | undefined) =>
    (list ?? []).map((entry) => blockLine(textOf(entry, language), type.fields, item.data, language)).filter(Boolean)
  const line = card.line ? fillTemplate(textOf(card.line, language), type.fields, item.data, language) : ''
  return {
    line: line || null,
    left: lines(card.left),
    right: lines(card.right),
    fields: compendiumFields(system, item.type).flatMap(({ key, inCard }) => {
      if (inCard) return []
      const value = fieldValue(type.fields[key], item.data[key], language)
      return value ? [{ label: textOf(type.fields[key]?.label ?? key, language), value }] : []
    })
  }
}
