import type { ActionDefinition } from '@crisol/contracts'
import type { Database, OperationContext } from '@crisol/db'
import { type Actor, ForbiddenError, NotFoundError } from '@crisol/domain'
import type { Realtime } from '../realtime/hub.ts'

/** Una acción del contrato con su servicio */
export interface Implementation {
  action: ActionDefinition
  handler: (ctx: ActionContext, input: unknown) => Promise<unknown>
}

/** Lo que las acciones necesitan del servidor, además de la base de datos */
export interface ActionEnv {
  db: Database
  /** Para componer enlaces (invitaciones) */
  publicUrl: string
  /** Para cifrar y descifrar los secretos de los enlaces */
  sealKey: Buffer
  /** Para avisar en tiempo real de lo que cambia, a quien pueda verlo */
  realtime: Realtime
  /** Las acciones por su nombre: al aprobarse, lo que pidió la IA se hace con la suya */
  actions: ReadonlyMap<string, Implementation>
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

/** El código de la API de un error esperado (no existe, sin permiso, petición que no se puede atender); si no, null */
export function errorCode(error: unknown): string | null {
  if (error instanceof NotFoundError) return 'NOT_FOUND'
  if (error instanceof ForbiddenError) return 'FORBIDDEN'
  if (error instanceof InvalidRequestError) return error.code
  return null
}

/**
 * Lo que una acción deja en el historial. El ámbito, si los cambios no lo llevan: la organización y el mundo (una
 * campaña ya los trae)
 */
export function historyContext(
  ctx: ActionContext,
  action: string,
  details: Record<string, unknown>,
  scope: { organizationId?: string; worldId?: string } = {}
): OperationContext {
  return {
    actorId: ctx.actor.userId,
    via: ctx.via,
    tool: ctx.tool ?? null,
    action,
    details,
    ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
    ...(scope.worldId ? { worldId: scope.worldId } : {})
  }
}
