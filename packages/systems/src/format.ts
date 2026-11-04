/**
 * El formato de un sistema de reglas (ADR-0011): datos, con la forma del manifiesto de Foundry (tipos por clase de
 * documento, paquetes, idiomas), y lo propio de Crisol: fórmulas, tiradas, dados y ajustes de campaña. Las claves del
 * formato van en inglés; las de cada sistema (sus tipos, campos y tiradas), las que elija quien lo hace.
 *
 * El esquema se construye dos veces: el flexible conserva lo que no conoce (se guarda tal cual) y el estricto solo sirve
 * para avisar de ello
 */
import { z } from 'zod'
import { LANGUAGES, type Text, text } from './text.ts'

/** La versión del formato: sube si un cambio obliga a convertir los sistemas guardados */
export const FORMAT = 1

/** Lo que cabe en un sistema */
export const LIMITS = {
  /** El documento entero, en bytes de JSON */
  bytes: 2 * 1024 * 1024,
  fieldsPerType: 500,
  types: 100,
  rolls: 200,
  /** Grupos dentro de grupos (y columnas de una lista) */
  depth: 3,
  formula: 2000,
  contentDocuments: 5000,
  contentBytes: 64 * 1024
} as const

/** Una clave de un sistema: la de un tipo, un campo, una tirada… No cambia aunque cambie su nombre */
export const KEY = /^[a-z][a-z0-9_]{0,59}$/
export const KEY_MESSAGE = 'Una clave va en minúsculas, sin espacios ni tildes, como «defensa» o «bono_ataque»'
const key = z.string().regex(KEY, KEY_MESSAGE)
const formula = z.string().trim().min(1).max(LIMITS.formula)
const recordOf = <T extends z.ZodType>(value: T, max: number) =>
  z.record(key, value).refine((r) => Object.keys(r).length <= max, `Como mucho, ${max}`)

/** Cómo suena una franja de resultado: la interfaz le da su color */
export const TONES = ['critical', 'success', 'partial', 'failure', 'fumble', 'neutral'] as const
/** Cuándo una tirada es crítica (ADR-0010 lo dejó para cada sistema) */
export const CRITICAL_RULES = ['none', 'd20', 'doubles', 'under'] as const

interface FieldBase {
  label: Text
  help?: Text
  /** Solo lo ve el máster */
  master?: boolean
}

/** Las clases de campo que caben en una columna o dentro de un conjunto */
export type SimpleField = FieldBase &
  (
    | { kind: 'text'; default?: string; max?: number; lines?: number }
    | { kind: 'number'; default?: number; min?: number; max?: number; integer?: boolean }
    | { kind: 'boolean'; default?: boolean }
    | { kind: 'list'; default?: string[]; max?: number }
    | { kind: 'choice'; options: { value: string; label: Text }[]; default?: string }
    | { kind: 'link'; to: string; multiple?: boolean }
    | { kind: 'clock'; segments: number; default?: number }
    | { kind: 'dice'; default?: string }
    | { kind: 'resource'; max?: number | string; default?: number }
    | { kind: 'derived'; formula: string; signed?: boolean }
  )

export type Field =
  | SimpleField
  | (FieldBase & { kind: 'group'; fields: Record<string, Field> })
  | (FieldBase & { kind: 'table'; columns: Record<string, SimpleField>; max?: number })
  | (FieldBase & {
      kind: 'set'
      elements: { key: string; label: Text; abbr?: Text }[]
      fields: Record<string, SimpleField>
    })
  | (FieldBase & { kind: 'items'; of: string[] })

export type FieldKind = Field['kind']

function build(strict: boolean) {
  const obj = <S extends z.ZodRawShape>(shape: S) => (strict ? z.strictObject(shape) : z.looseObject(shape))
  const base = { label: text(), help: text(500).optional(), master: z.boolean().optional() }

  // Las clases de campo que caben en una columna o dentro de un conjunto
  const simple = [
    obj({
      ...base,
      kind: z.literal('text'),
      default: z.string().max(20000).optional(),
      max: z.int().min(1).max(20000).optional(),
      lines: z.int().min(1).max(40).optional()
    }),
    obj({
      ...base,
      kind: z.literal('number'),
      default: z.number().finite().optional(),
      min: z.number().finite().optional(),
      max: z.number().finite().optional(),
      integer: z.boolean().optional()
    }),
    obj({ ...base, kind: z.literal('boolean'), default: z.boolean().optional() }),
    obj({
      ...base,
      kind: z.literal('list'),
      default: z.array(z.string().max(200)).max(200).optional(),
      max: z.int().min(1).max(200).optional()
    }),
    obj({
      ...base,
      kind: z.literal('choice'),
      options: z
        .array(obj({ value: key, label: text() }))
        .min(1)
        .max(100),
      default: key.optional()
    }),
    obj({ ...base, kind: z.literal('link'), to: key, multiple: z.boolean().optional() }),
    obj({
      ...base,
      kind: z.literal('clock'),
      segments: z.int().min(2).max(12),
      default: z.int().min(0).max(12).optional()
    }),
    obj({ ...base, kind: z.literal('dice'), default: formula.optional() }),
    obj({
      ...base,
      kind: z.literal('resource'),
      max: z.union([z.number().finite(), formula]).optional(),
      default: z.number().finite().optional()
    }),
    obj({ ...base, kind: z.literal('derived'), formula, signed: z.boolean().optional() })
  ] as const
  const simpleField = z.discriminatedUnion('kind', simple) as unknown as z.ZodType<SimpleField>

  const field: z.ZodType<Field> = z.lazy(() =>
    z.discriminatedUnion('kind', [
      ...simple,
      obj({ ...base, kind: z.literal('group'), fields: recordOf(field, LIMITS.fieldsPerType) }),
      // Una lista de filas, cada una con sus columnas (como el inventario de texto o los ataques)
      obj({
        ...base,
        kind: z.literal('table'),
        columns: recordOf(simpleField, 30),
        max: z.int().min(1).max(1000).optional()
      }),
      // Unos elementos fijos, cada uno con los mismos campos (las características, las habilidades)
      obj({
        ...base,
        kind: z.literal('set'),
        elements: z
          .array(obj({ key, label: text(), abbr: text(10).optional() }))
          .min(1)
          .max(100),
        fields: recordOf(simpleField, 30)
      }),
      // Lo que lleva o tiene: documentos de esos tipos de objeto (una clase, una espada, un conjuro)
      obj({ ...base, kind: z.literal('items'), of: z.array(key).min(1).max(20) })
    ])
  ) as unknown as z.ZodType<Field>

  // Un objeto (un anillo, un rasgo, un estado) da bonos a un campo de quien lo lleva, si se cumple su condición
  const modifier = obj({
    target: z.string().min(1).max(200),
    value: formula,
    when: formula.optional(),
    label: text().optional()
  })

  const type = obj({
    document: z.enum(['actor', 'item']),
    label: text(),
    icon: z.string().max(40).optional(),
    fields: recordOf(field, LIMITS.fieldsPerType),
    modifiers: z.array(modifier).max(50).optional()
  })

  const roll = obj({
    label: text(),
    formula,
    // Una por cada uno de estos campos, o por cada elemento de un conjunto; dentro, @este es ese
    for: z.union([obj({ fields: z.array(key).min(1).max(100) }), obj({ set: key })]).optional(),
    target: z.enum(['none', 'optional', 'required']).optional(),
    variants: z
      .array(obj({ if: formula, formula }))
      .max(20)
      .optional(),
    bands: z
      .array(obj({ if: formula, label: text(), tone: z.enum(TONES) }))
      .max(20)
      .optional(),
    // Cambian los dados de la fórmula, ya leída (la ventaja: 2d6 por 3d6kh2)
    modes: z
      .array(obj({ key, label: text(), from: formula, to: formula }))
      .max(10)
      .optional()
  })

  const source = obj({
    key,
    name: text(),
    license: z.string().trim().min(1).max(200),
    attribution: text(4000),
    url: z.url().optional()
  })
  const setting = obj({
    label: text(),
    help: text(500).optional(),
    kind: z.enum(['boolean', 'number', 'choice', 'choices']),
    options: z
      .array(obj({ value: key, label: text() }))
      .max(50)
      .optional(),
    default: z.union([z.boolean(), z.number(), key, z.array(key)]).optional()
  })

  return obj({
    format: z.literal(FORMAT),
    id: z.string().min(1).max(100),
    name: text(),
    summary: text(8000).optional(),
    version: z.string().trim().min(1).max(40),
    languages: z.array(z.enum(LANGUAGES)).min(1).max(LANGUAGES.length),
    license: source.omit({ key: true }).optional(),
    types: recordOf(type, LIMITS.types),
    rolls: recordOf(roll, LIMITS.rolls).optional(),
    dice: obj({ default: formula.optional(), critical: z.enum(CRITICAL_RULES) }).optional(),
    sources: z.array(source).max(50).optional(),
    // Como en Foundry, un paquete es de una clase de documento y puede mezclar sus tipos (armas, armaduras…); types, si
    // solo lleva algunos
    packs: z
      .array(obj({ key, label: text(), document: z.enum(['actor', 'item']), types: z.array(key).max(50).optional() }))
      .max(100)
      .optional(),
    settings: recordOf(setting, 50).optional(),
    // Su sitio para la hoja y los pasos del creador: los dicen `hoja` y `personajes`
    sheet: z.record(z.string(), z.unknown()).optional(),
    creation: z.array(z.unknown()).max(100).optional(),
    levelUp: z.array(z.unknown()).max(100).optional()
  })
}

/** El que se guarda: conserva lo que no conoce */
export const systemSchema = build(false)
/** Solo para avisar de lo que el formato no conoce */
export const strictSystemSchema = build(true)

export type System = z.infer<typeof systemSchema>
export type SystemType = System['types'][string]
export type Roll = NonNullable<System['rolls']>[string]
