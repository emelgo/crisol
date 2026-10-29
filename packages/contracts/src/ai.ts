import { z } from 'zod'
import { defineAction } from './action.ts'

/**
 * Qué hace Claude con la cuenta que lo conectó. Solo lectura: solo consulta. Asistente: lo demás espera la aprobación.
 * Copiloto: escribe libre; borrar y lo que afecta a los jugadores esperan la aprobación
 */
export const aiMode = z.enum(['readOnly', 'assistant', 'copilot'])

export type AiMode = z.infer<typeof aiMode>

const aiSettings = z.object({
  mode: aiMode,
  /** La dirección que se pega en claude.ai para conectar Crisol */
  connectorUrl: z.url()
})

/** Algo que pidió la IA y espera (o esperaba) la aprobación. La interfaz pone el texto con la acción y sus datos */
export const approval = z.object({
  id: z.uuid(),
  tool: z.string(),
  action: z.string(),
  input: z.record(z.string(), z.unknown()),
  /** Los nombres de lo que toca (mundo, campaña) cuando se pidió */
  details: z.record(z.string(), z.unknown()),
  /** approved: aprobada y haciéndose; failed: aprobada, pero con los permisos de ahora no se pudo */
  status: z.enum(['pending', 'approved', 'done', 'failed', 'rejected', 'expired']),
  requestedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  decidedAt: z.iso.datetime().nullable(),
  /** Si falló: el código del error */
  error: z.string().nullable()
})

export type Approval = z.infer<typeof approval>

export const getAiSettings = defineAction({
  name: 'getAiSettings',
  kind: 'read',
  description: 'El modo de IA de la cuenta y la dirección del conector para claude.ai',
  input: z.object({}),
  output: aiSettings
})

export const setAiMode = defineAction({
  name: 'setAiMode',
  kind: 'write',
  description: 'Cambia el modo de IA de la cuenta. Solo desde la interfaz: la IA no cambia su propio modo',
  input: z.object({ mode: aiMode }),
  output: aiSettings
})

export const listApprovals = defineAction({
  name: 'listApprovals',
  kind: 'read',
  description:
    'Lo que la IA de la cuenta espera que se apruebe (por orden de llegada) y cómo acabaron las últimas peticiones',
  input: z.object({}),
  output: z.object({ pending: z.array(approval), recent: z.array(approval) })
})

export const approve = defineAction({
  name: 'approve',
  kind: 'write',
  description:
    'Aprueba lo que pidió la IA: se hace con la cuenta y queda en el historial como hecho por la IA. Solo desde la interfaz',
  input: z.object({ approvalId: z.uuid() }),
  output: approval
})

export const reject = defineAction({
  name: 'reject',
  kind: 'write',
  description: 'Rechaza lo que pidió la IA: no se hace. Solo desde la interfaz',
  input: z.object({ approvalId: z.uuid() }),
  output: approval
})
