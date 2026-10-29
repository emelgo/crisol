import type { Database, OperationContext } from '@crisol/db'
import type { Actor } from '@crisol/domain'

/** Lo que las acciones necesitan del servidor, además de la base de datos */
export interface ActionEnv {
  db: Database
  /** Para componer enlaces (invitaciones) */
  publicUrl: string
  /** Para cifrar y descifrar los secretos de los enlaces */
  sealKey: Buffer
}

/** Con qué se ejecuta una acción: el servidor y quién la pide, por dónde */
export interface ActionContext extends ActionEnv {
  actor: Actor
  via: 'ui' | 'ai'
  /** La herramienta MCP, si la pide la IA */
  tool?: string
}

/** La petición es válida según el contrato pero no se puede atender así */
export class InvalidRequestError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.code = code
    this.name = 'InvalidRequestError'
  }
}

/** Lo que una acción deja en el historial */
export function historyContext(
  ctx: ActionContext,
  action: string,
  details: Record<string, unknown>,
  organizationId?: string
): OperationContext {
  return {
    actorId: ctx.actor.userId,
    via: ctx.via,
    tool: ctx.tool ?? null,
    action,
    details,
    ...(organizationId ? { organizationId } : {})
  }
}
