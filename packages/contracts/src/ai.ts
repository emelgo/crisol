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

/**
 * Una conexión de IA de la cuenta (ADR-0030): una app (claude.ai) con un conector, Mundos o el de una campaña. El
 * nombre de la app lo publica ella misma; la interfaz lo enseña con su dominio
 */
export const aiConnection = z.object({
  clientId: z.string(),
  clientName: z.string().nullable(),
  /** La dirección del conector, que es también su recurso OAuth */
  url: z.url(),
  connector: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('worlds') }),
    z.object({
      kind: z.literal('campaign'),
      campaignId: z.uuid(),
      /** null si ya no se ve (se salió, la expulsaron o está en la papelera) */
      campaign: z.object({ name: z.string(), worldId: z.uuid() }).nullable()
    })
  ]),
  /** La última vez que la usó (o, si el servidor se ha reiniciado desde entonces, que renovó su acceso) */
  lastUsedAt: z.iso.datetime()
})

export type AiConnection = z.infer<typeof aiConnection>

export const listAiConnections = defineAction({
  name: 'listAiConnections',
  kind: 'read',
  description: 'Las apps de IA conectadas a la cuenta, cada una con su conector y su último uso',
  input: z.object({}),
  output: z.object({ connections: z.array(aiConnection) })
})

export const removeAiConnection = defineAction({
  name: 'removeAiConnection',
  kind: 'write',
  description:
    'Quita una conexión de IA: deja de valer al momento y, para volver, hay que conectarla otra vez. Solo desde la interfaz',
  input: z.object({ clientId: z.string().min(1).max(500), url: z.url() }),
  output: z.object({ connections: z.array(aiConnection) })
})

/** Un token de acceso personal (ADR-0033): para guiones que llaman a `/api/actions` con `Authorization: Bearer` */
export const apiToken = z.object({
  id: z.uuid(),
  name: z.string(),
  /** Su principio, para reconocerlo (el token entero solo se ve al crearlo) */
  prefix: z.string(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime().nullable()
})

export type ApiToken = z.infer<typeof apiToken>

/** Cuántos días puede valer uno */
export const API_TOKEN_DAYS = [7, 30, 90, 365] as const

export const listApiTokens = defineAction({
  name: 'listApiTokens',
  kind: 'read',
  description: 'Los tokens de acceso de la cuenta, con su caducidad y su último uso. Solo desde la interfaz',
  input: z.object({}),
  output: z.object({ tokens: z.array(apiToken) })
})

export const createApiToken = defineAction({
  name: 'createApiToken',
  kind: 'write',
  description:
    'Crea un token de acceso para guiones: vale como la cuenta en /api/actions (Authorization: Bearer) hasta que caduca o se quita. Se ve una sola vez. Solo desde la interfaz',
  input: z.object({
    name: z.string().trim().min(1).max(80),
    days: z.union(API_TOKEN_DAYS.map((d) => z.literal(d)))
  }),
  output: z.object({ token: apiToken, secret: z.string().describe('El token entero: solo se da ahora') })
})

export const deleteApiToken = defineAction({
  name: 'deleteApiToken',
  kind: 'delete',
  description: 'Quita un token de acceso: deja de valer al momento. Solo desde la interfaz',
  input: z.object({ tokenId: z.uuid() }),
  output: z.object({ tokens: z.array(apiToken) })
})
