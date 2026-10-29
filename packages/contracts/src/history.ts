import { z } from 'zod'
import { defineAction } from './action.ts'

/** Una operación del historial: quién, cuándo, por dónde y qué (la interfaz pone el texto con la acción y sus datos) */
export const historyEntry = z.object({
  id: z.uuid(),
  at: z.iso.datetime(),
  /** null: el sistema o una cuenta ya borrada */
  actor: z.object({ id: z.string(), name: z.string() }).nullable(),
  via: z.enum(['ui', 'ai', 'system']),
  /** La herramienta MCP, si lo hizo la IA */
  tool: z.string().nullable(),
  action: z.string(),
  details: z.record(z.string(), z.unknown()),
  worldId: z.uuid().nullable(),
  /** La operación que la deshizo, si se deshizo */
  undoneBy: z.uuid().nullable(),
  /** Si es un deshacer: la operación que deshace */
  undoes: z.uuid().nullable()
})

export type HistoryEntry = z.infer<typeof historyEntry>

export const listHistory = defineAction({
  name: 'listHistory',
  kind: 'read',
  description:
    'Lo último que ha cambiado, de lo más reciente a lo más antiguo: de un mundo (para su máster) o de toda la organización (para el propietario). Para seguir, pasa en before el next de la respuesta',
  input: z.object({
    worldId: z.uuid().optional(),
    /** Sin mundo ni organización: la única de la que es propietaria */
    organizationId: z.uuid().optional(),
    before: z.uuid().optional(),
    limit: z.number().int().min(1).max(100).default(50)
  }),
  output: z.object({ entries: z.array(historyEntry), next: z.uuid().nullable() })
})

export const undoOperation = defineAction({
  name: 'undoOperation',
  kind: 'delete',
  description:
    'Deshace una operación del historial con una operación nueva, que a su vez se puede deshacer. Si algo de lo que tocó se cambió después, no deshace nada y dice qué operación lo cambió (hay que deshacer esa antes)',
  input: z.object({ operationId: z.uuid() }),
  output: z.discriminatedUnion('status', [
    z.object({ status: z.literal('undone'), entry: historyEntry }),
    /** by: la operación posterior que lo impide (null si no se sabe) */
    z.object({ status: z.literal('conflict'), by: historyEntry.nullable() })
  ])
})
