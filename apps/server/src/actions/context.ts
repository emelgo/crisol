import type { ActionDefinition } from '@crisol/contracts'
import type { Database, OperationContext } from '@crisol/db'
import { type Actor, ForbiddenError, NotFoundError } from '@crisol/domain'
import type { Collab } from '../collab/server.ts'
import type { Storage } from '../files/storage.ts'
import type { Embedder } from '../library/embedder.ts'
import type { LibraryJobs } from '../library/jobs.ts'
import type { Realtime } from '../realtime/hub.ts'
import type { TablePresence } from '../table/presence.ts'
import type { TableRooms } from '../table/rooms.ts'
import type { SoundClock } from '../table/sound.ts'
import type { Vision } from '../table/vision.ts'

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
  /** Los documentos de Yjs abiertos: para cerrarlos si su página o su mundo van a la papelera */
  collab?: Collab
  /** Las acciones por su nombre: al aprobarse, lo que pidió la IA se hace con la suya */
  actions: ReadonlyMap<string, Implementation>
  /** Donde van los bytes de los archivos */
  storage?: Storage
  /** Leer el texto de los PDF en segundo plano (docs/specs/biblioteca.md) */
  library?: LibraryJobs
  /** El modelo de la búsqueda por significado; sin él, solo por palabras */
  embedder?: Embedder
  /** Las salas de la mesa abiertas (ADR-0018): se les avisa de lo que cambia en su campaña o en sus escenas */
  table?: TableRooms
  /** Quién está ahora en la Mesa de cada campaña (ADR-0021) */
  presence?: TablePresence
  /** La vista del grupo de cada campaña en sus escenas, calculada en un hilo aparte (docs/specs/vision.md) */
  vision?: Vision
  /** El reloj del sonido de cada campaña: lo manda a sus salas y pasa de pista (docs/specs/sonido.md) */
  sound?: SoundClock
}

/** Con qué se ejecuta una acción: el servidor y quién la pide, por dónde */
export interface ActionContext extends ActionEnv {
  actor: Actor
  via: 'ui' | 'ai'
  /** La herramienta MCP, si la pide la IA */
  tool?: string
  /** Cuándo lo pidió la IA, si se hace al aprobarlo después: para saber si algo cambió entre medias */
  requestedAt?: Date
}

/** La petición es válida según el contrato pero no se puede atender así */
export class InvalidRequestError extends Error {
  readonly code: string
  /** Lo que explica el código a quien lo pidió (la IA lo lee: qué línea, qué página no aparece…) */
  readonly detail: string | null

  constructor(code: string, detail: string | null = null) {
    super(detail ? `${code}: ${detail}` : code)
    this.code = code
    this.detail = detail
    this.name = 'InvalidRequestError'
  }
}

/** Demasiadas seguidas: hay que esperar un poco (429) */
export class TooManyRequestsError extends InvalidRequestError {
  constructor(code: string) {
    super(code)
    this.name = 'TooManyRequestsError'
  }
}

/** El código de la API de un error esperado (no existe, sin permiso, petición que no se puede atender); si no, null */
export function errorCode(error: unknown): string | null {
  if (error instanceof NotFoundError || malformedId(error)) return 'NOT_FOUND'
  if (error instanceof ForbiddenError) return 'FORBIDDEN'
  if (error instanceof InvalidRequestError) return error.code
  return null
}

/**
 * Postgres no pudo leer un valor como su tipo (22P02: un id que no es un uuid, el '' de algo que no existe). Llega
 * envuelto por Drizzle («Failed query…»), con la consulta en el mensaje: es un «no existe», nunca un 500 que la enseñe
 */
export function malformedId(error: unknown): boolean {
  for (let e = error, depth = 0; e && typeof e === 'object' && depth < 4; e = (e as { cause?: unknown }).cause, depth++)
    if ((e as { code?: unknown }).code === '22P02') return true
  return false
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
