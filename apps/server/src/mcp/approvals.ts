/**
 * Lo que pide la IA, según el modo de la cuenta que la conectó: se hace, espera su aprobación o no se hace. Lo que
 * espera queda en la cola (Postgres) y la herramienta aguarda la decisión hasta 15 s escuchando el bus del proceso;
 * si no llega, contesta que sigue esperando. Aprobarlo después lo hace igual (la acción approve).
 */
import type { RealtimeMessage } from '@crisol/contracts'
import { aiRepo, historyRepo, loadMemberships, worldsRepo } from '@crisol/db'
import { actorFrom, aiDecision, authorize, NotFoundError } from '@crisol/domain'
import { authorizedCampaign } from '../actions/access.ts'
import { type ActionContext, type ActionEnv, errorCode, type Implementation } from '../actions/context.ts'
import { approvalsChanged } from '../realtime/events.ts'

/** Lo que contesta una herramienta */
export interface ToolResult {
  [key: string]: unknown
  content: Array<{ type: 'text'; text: string }>
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

const text = (value: string) => [{ type: 'text' as const, text: value }]
const success = (output: Record<string, unknown>): ToolResult => ({
  content: text(JSON.stringify(output, null, 2)),
  structuredContent: output
})
const failure = (message: string): ToolResult => ({ isError: true, content: text(message) })

const READ_ONLY =
  'READ_ONLY: el modo de IA de esta cuenta es «solo lectura». El máster lo cambia en Crisol, en los ajustes de IA'
const REJECTED = 'REJECTED: el máster lo ha rechazado. No insistas: pregúntale qué prefiere'
const PENDING =
  'PENDING_APPROVAL: espera la aprobación del máster en Crisol. Se hará en cuanto la apruebe (caduca a las 24 h): no lo repitas'

/** Texto del error para la IA (los códigos son los de la API); un fallo inesperado se relanza */
export function errorText(error: unknown): string {
  const code = errorCode(error)
  if (code === 'NOT_FOUND') return 'NOT_FOUND: no existe o no lo puedes ver'
  if (code === 'FORBIDDEN') return 'FORBIDDEN: no tienes permiso'
  if (code === null) throw error
  return code
}

export interface AiCall {
  userId: string
  tool: string
  impl: Implementation
  /** La entrada, ya validada con el contrato */
  input: Record<string, unknown>
  /** Cuánto espera la decisión (15 s; las pruebas lo acortan) */
  waitMs: number
}

export async function callAsAi(env: ActionEnv, call: AiCall): Promise<ToolResult> {
  const { db } = env
  const { userId, tool, impl, input } = call
  // Las pertenencias y el modo se leen en cada llamada, como en la API
  const ctx: ActionContext = { ...env, actor: actorFrom(userId, await loadMemberships(db, userId)), via: 'ai', tool }
  try {
    const decision = aiDecision(await aiRepo.findAiMode(db, userId), impl.action.kind)
    if (decision === 'refuse') return failure(READ_ONLY)
    if (decision === 'run') {
      return success(impl.action.output.parse(await impl.handler(ctx, input)) as Record<string, unknown>)
    }
    const request = await aiRepo.createApproval(db, {
      userId,
      tool,
      action: impl.action.name,
      input,
      details: await describe(ctx, input),
      now: new Date()
    })
    return answer(await waitForDecision(env, request, call.waitMs))
  } catch (error) {
    return failure(errorText(error))
  }
}

/**
 * Los nombres de lo que toca la petición, para el resumen de la cola. Solo de lo que la cuenta ve: si no, para ella no
 * existe y no se pide nada. Cubre lo que piden las herramientas: un mundo, una campaña o una operación del historial
 */
async function describe(ctx: ActionContext, input: Record<string, unknown>) {
  const details: Record<string, unknown> = {}
  if (typeof input.worldId === 'string') {
    authorize(ctx.actor, 'world.read', { worldId: input.worldId })
    const world = await worldsRepo.findWorld(ctx.db, input.worldId)
    if (!world) throw new NotFoundError('world')
    details.world = world.name
  }
  if (typeof input.campaignId === 'string') {
    details.campaign = (await authorizedCampaign(ctx, 'campaign.read', input.campaignId)).name
  }
  if (typeof input.operationId === 'string') {
    const operation = await historyRepo.getOperation(ctx.db, input.operationId)
    // Como al deshacer: el historial de su mundo, o el de la organización
    if (operation?.worldId) authorize(ctx.actor, 'world.history', { worldId: operation.worldId })
    else authorize(ctx.actor, 'organization.history', { organizationId: operation?.organizationId ?? '' })
    if (!operation) throw new NotFoundError('operation')
    details.operation = { action: operation.action, details: operation.details }
  }
  return details
}

const FINISHED: ReadonlySet<aiRepo.Approval['status']> = new Set(['done', 'failed', 'rejected'])

/**
 * Avisa de la petición y espera a que se decida (y, si se aprueba, a que se haga), escuchando los avisos de la cola de
 * la cuenta en el bus del proceso. Al acabar el tiempo, devuelve cómo esté
 */
function waitForDecision(env: ActionEnv, request: aiRepo.Approval, waitMs: number): Promise<aiRepo.Approval> {
  const { db, realtime } = env
  const read = async () => {
    const row = await aiRepo.findApproval(db, request.userId, request.id)
    if (!row) throw new NotFoundError('approval')
    return row
  }
  return new Promise((resolve, reject) => {
    let settled = false
    const settle = (outcome: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      disconnect()
      outcome()
    }
    const disconnect = realtime.connect(request.userId, {
      send(data) {
        const message = JSON.parse(data) as RealtimeMessage
        if (message.type !== 'changed' || message.what !== 'approvals') return
        read().then(
          (row) => {
            if (FINISHED.has(row.status)) settle(() => resolve(row))
          },
          (error) => settle(() => reject(error))
        )
      }
    })
    const timer = setTimeout(() => {
      read().then(
        (row) => settle(() => resolve(row)),
        (error) => settle(() => reject(error))
      )
    }, waitMs)
    // A la interfaz (la cola aparece sin recargar) y a esta espera, que ya escucha
    realtime.publish(approvalsChanged(request.userId))
  })
}

/** Lo que contesta la herramienta según cómo quedó la petición */
function answer(row: aiRepo.Approval): ToolResult {
  if (row.status === 'done') return success(row.result ?? {})
  if (row.status === 'failed') return failure(`${row.error}: se aprobó, pero no se pudo hacer`)
  if (row.status === 'rejected') return failure(REJECTED)
  return {
    content: text(PENDING),
    structuredContent: { approval: { id: row.id, status: row.status, expiresAt: row.expiresAt.toISOString() } }
  }
}
