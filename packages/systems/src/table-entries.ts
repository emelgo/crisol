/**
 * Las tablas aleatorias del compendio (docs/specs/tablas-compendio.md): un tipo de Crisol, «Tabla» (`tabla`), que tiene
 * todo sistema aunque no lo declare, y sus filas en `table`. Se tiran con el mismo cálculo que la pestaña «Tabla» de
 * la wiki; una fila puede llevar a otra entrada del compendio y, si es otra tabla, se tira también
 */
import { describeTableProblem, tableProblemList } from '@crisol/dice'
import { z } from 'zod'
import type { System } from './format.ts'
import { own } from './own.ts'

/** La clave del tipo «Tabla» */
export const TABLE_TYPE = 'tabla'
/** Tablas dentro de tablas: como mucho tantas (como en la wiki) */
export const TABLE_DEPTH = 5

/** Una fila: su rango, su texto (que puede llevar tiradas) y, si se dice, la clave de la entrada a la que lleva */
export interface TableEntryRow {
  id: string
  from: number
  to: number
  text: string
  key?: string | null
}

export interface TableEntry {
  /** Sin ella, 1dN por la última fila */
  formula?: string | null
  /** Con reemplazo (lo de siempre): lo sacado puede volver a salir; sin él, no hasta reiniciarla */
  replacement?: boolean
  rows: TableEntryRow[]
}

/** La clave de una entrada del contenido (como `CONTENT_KEY`, aquí para no depender del archivo) */
const KEY = /^[a-z0-9][a-z0-9_-]{0,99}$/

export const tableEntrySchema = z.object({
  formula: z.string().trim().max(200).nullable().optional().describe('Sin ella, 1dN por la última fila'),
  replacement: z.boolean().optional().describe('Con reemplazo (lo de siempre): lo sacado puede volver a salir'),
  rows: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        from: z.int().min(-1000).max(100_000),
        to: z.int().min(-1000).max(100_000),
        text: z.string().max(2000),
        key: z
          .string()
          .regex(KEY)
          .nullable()
          .optional()
          .describe('La entrada del compendio a la que lleva; si es otra tabla, se tira también')
      })
    )
    .min(1)
    .max(500)
})

/** El tipo «Tabla» tal como lo ve un sistema que no lo declara */
const tableType: System['types'][string] = {
  document: 'item',
  label: { es: 'Tabla', en: 'Table' },
  icon: 'dices',
  fields: { description: { kind: 'text', label: { es: 'Descripción', en: 'Description' }, lines: 8 } }
}

/** El sistema con el tipo «Tabla» (si ya lo tiene, el suyo) */
export function withTables(system: System): System {
  if (own(system.types, TABLE_TYPE)) return system
  return { ...system, types: { ...system.types, [TABLE_TYPE]: tableType } }
}

/** Lo que ocupan sus filas, como mucho (en JSON) */
export const TABLE_BYTES = 256 * 1024

/** Lo que impide tirar en ella (la fórmula, las filas al revés): en la tabla, un error; lo demás, un aviso */
const BLOCKING = new Set(['formula', 'backwards', 'notIntegers'])

/**
 * Lo que está mal en una tabla: su forma, su tamaño, su fórmula y las filas al revés (errores); y sus huecos (avisos:
 * se tira igual, como en Foundry). Las filas que se pisan salen juntas, como en Foundry: eso no es un problema
 */
export function tableEntryProblems(table: unknown): {
  errors: { path: (string | number)[]; message: string }[]
  warnings: string[]
} {
  const checked = tableEntrySchema.safeParse(table)
  if (!checked.success)
    return {
      errors: checked.error.issues.map((i) => ({ path: i.path as (string | number)[], message: i.message })),
      warnings: []
    }
  const { formula, rows } = checked.data
  const errors: { path: (string | number)[]; message: string }[] = []
  if (new TextEncoder().encode(JSON.stringify(table)).length > TABLE_BYTES)
    errors.push({ path: ['rows'], message: `Sus filas ocupan más de ${TABLE_BYTES / 1024} KB` })
  const ids = new Set<string>()
  for (const [i, r] of rows.entries()) {
    if (ids.has(r.id)) errors.push({ path: ['rows', i, 'id'], message: `La fila «${r.id}» está repetida` })
    ids.add(r.id)
  }
  const warnings: string[] = []
  for (const p of tableProblemList(formula, rows)) {
    if (p.code === 'overlap') continue
    if (BLOCKING.has(p.code))
      errors.push({ path: p.code === 'formula' ? ['formula'] : ['rows'], message: describeTableProblem(p) })
    else warnings.push(describeTableProblem(p))
  }
  return { errors, warnings }
}
