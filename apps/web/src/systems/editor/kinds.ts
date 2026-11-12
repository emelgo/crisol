/**
 * Las clases de campo con palabras de mesa (lienzo de la tanda 8): cómo se llaman, qué se pone al añadir una, su
 * resumen en la fila y su ayuda con un ejemplo. Las seis de siempre, a la vista; las demás, en «Más»
 */
import type { Field, FieldKind, Language, Text } from '@crisol/systems'
import { textOf } from '@crisol/systems'

/** Las que se ofrecen a la vista, en este orden; las demás, en «Más» */
export const MAIN_KINDS = ['number', 'set', 'resource', 'choice', 'text', 'derived'] as const
export const MORE_KINDS = ['boolean', 'dice', 'list', 'clock', 'group', 'table', 'link'] as const

/** Un texto en el idioma del editor: si ya era de dos idiomas, se cambia solo el suyo */
export function withText(old: Text | undefined, value: string, language: Language): Text {
  if (old === undefined || typeof old === 'string') return value
  return { ...old, [language]: value }
}

/** Una clave a partir de un nombre, sin tildes ni repetir las que ya hay (fuerza, fuerza_2) */
export function keyFor(name: string, taken: Iterable<string>): string {
  const base =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^(\d)/, 'c_$1') || 'campo'
  const used = new Set(taken)
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}_${n}`)) n += 1
  return `${base}_${n}`
}

/** Lo que se pone al añadir una de cada clase: con algo dentro, para que se vea en la ficha */
export function blankField(kind: FieldKind, label: string): Field {
  switch (kind) {
    case 'number':
      return { kind, label, default: 0 }
    case 'set':
      return {
        kind,
        label,
        elements: [
          { key: 'uno', label: 'Uno' },
          { key: 'dos', label: 'Dos' }
        ],
        fields: { valor: { kind: 'number', label: 'Valor', default: 10 } }
      }
    case 'resource':
      return { kind, label, max: 10, default: 10 }
    case 'choice':
      return {
        kind,
        label,
        options: [
          { value: 'una', label: 'Una' },
          { value: 'otra', label: 'Otra' }
        ]
      }
    case 'text':
      return { kind, label }
    case 'derived':
      return { kind, label, formula: '0' }
    case 'boolean':
      return { kind, label, default: false }
    case 'dice':
      return { kind, label, default: '1d6' }
    case 'list':
      return { kind, label }
    case 'clock':
      return { kind, label, segments: 4 }
    case 'group':
      return { kind, label, fields: {} }
    case 'table':
      return { kind, label, columns: { nombre: { kind: 'text', label: 'Nombre' } } }
    case 'link':
      return { kind, label, to: '' }
    case 'items':
      return { kind, label, of: [] }
  }
}

/** Su resumen en la fila: lo que tiene, en corto («de 1 a 20», «Fuerza, Agilidad…», «máx. 10») */
export function summaryOf(
  field: Field,
  language: Language,
  words: (key: string, values?: Record<string, unknown>) => string
) {
  switch (field.kind) {
    case 'number':
      return field.min !== undefined && field.max !== undefined
        ? words('rules.summary.range', { min: field.min, max: field.max })
        : field.default !== undefined
          ? words('rules.summary.starts', { value: field.default })
          : ''
    case 'set':
      return field.elements.map((e) => textOf(e.label, language)).join(', ')
    case 'resource':
      return field.max !== undefined ? words('rules.summary.max', { value: field.max }) : ''
    case 'choice':
      return field.options.map((o) => textOf(o.label, language)).join(', ')
    case 'derived':
      return field.formula
    case 'dice':
      return field.default ?? ''
    case 'clock':
      return words('rules.summary.segments', { count: field.segments })
    case 'group':
      return words('rules.summary.inside', { count: Object.keys(field.fields).length })
    case 'table':
      return words('rules.summary.columns', { count: Object.keys(field.columns).length })
    default:
      return ''
  }
}
