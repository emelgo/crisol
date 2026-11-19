/**
 * Lo que pide la IA, según el modo de la cuenta que la conectó: se hace, espera su aprobación o no se hace. Lo que
 * espera queda en la cola (Postgres) y la herramienta aguarda la decisión hasta 15 s escuchando el bus del proceso;
 * si no llega, contesta que sigue esperando. Aprobarlo después lo hace igual (la acción approve).
 */
import type { RealtimeMessage } from '@crisol/contracts'
import { aiRepo, historyRepo, loadMemberships, worldsRepo } from '@crisol/db'
import {
  type ActionKind,
  type Actor,
  actorFrom,
  aiDecision,
  authorize,
  MAX_PENDING_APPROVALS,
  NotFoundError,
  ownedOrganizations
} from '@crisol/domain'
import { authorizedCampaign, authorizedPage } from '../actions/access.ts'
import { bookRequest } from '../actions/books.ts'
import { calendarRequest } from '../actions/calendars.ts'
import { chronologyRequest } from '../actions/chronologies.ts'
import {
  type ActionContext,
  type ActionEnv,
  errorCode,
  type Implementation,
  InvalidRequestError
} from '../actions/context.ts'
import { knowledgeRequest } from '../actions/knowledge.ts'
import { partyRequest } from '../actions/party.ts'
import { systemRequest, visibleSystemName } from '../actions/systems.ts'
import { approvalsChanged } from '../realtime/events.ts'
import { openJson } from '../secrets.ts'
import { playerEdits } from '../wiki/player-pages.ts'
import { viewedPage } from '../wiki/projection.ts'
import type { McpScope } from './connectors.ts'

/** Lo que contesta una herramienta */
export interface ToolResult {
  [key: string]: unknown
  content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

const text = (value: string) => [{ type: 'text' as const, text: value }]
/**
 * Lo que sale bien. Si trae una imagen (la de un mapa, `image.data`), va como imagen para que la IA la vea; el resto,
 * como siempre, sin repetir sus datos
 */
export const success = (output: Record<string, unknown>): ToolResult => {
  const image = output.image as { data?: unknown; mimeType?: unknown } | null | undefined
  if (image && typeof image.data === 'string' && typeof image.mimeType === 'string') {
    const rest = { ...output, image: { mimeType: image.mimeType } }
    return {
      content: [{ type: 'image', data: image.data, mimeType: image.mimeType }, ...text(JSON.stringify(rest, null, 2))],
      structuredContent: rest
    }
  }
  return { content: text(JSON.stringify(output, null, 2)), structuredContent: output }
}
const failure = (message: string): ToolResult => ({ isError: true, content: text(message) })

const READ_ONLY =
  'READ_ONLY: el modo de IA de esta cuenta es «solo lectura». El máster lo cambia en Crisol, en los ajustes de IA'
const REJECTED = 'REJECTED: el máster lo ha rechazado. No insistas: pregúntale qué prefiere'
const PLAYER_READS =
  'READ_ONLY: la IA de un jugador solo lee lo que sabe su campaña. Lo demás lo hace el jugador en Crisol'
const PLAYER_OWN =
  'READ_ONLY: en esta campaña, la IA de una jugadora lee lo que sabe y hace lo suyo (su personaje, sus tiradas, el registro, sus notas y su página). Lo demás lo hace el máster'
const PENDING =
  'PENDING_APPROVAL: espera la aprobación del máster en Crisol. Se hará en cuanto la apruebe (caduca a las 24 h): no lo repitas'
const TOO_MANY = `TOO_MANY_PENDING: ya hay ${MAX_PENDING_APPROVALS} peticiones esperando la aprobación del máster. Espera a que las decida`

/** Texto del error para la IA (los códigos son los de la API); un fallo inesperado se relanza */
export function errorText(error: unknown): string {
  const code = errorCode(error)
  if (code === 'NOT_FOUND') return 'NOT_FOUND: no existe o no lo puedes ver'
  if (code === 'FORBIDDEN') return 'FORBIDDEN: no tienes permiso'
  if (code === null) throw error
  return error instanceof InvalidRequestError && error.detail ? `${code}: ${error.detail}` : code
}

export interface AiCall {
  userId: string
  tool: string
  impl: Implementation
  /** La entrada, ya validada con el contrato */
  input: Record<string, unknown>
  /** Cuánto espera la decisión (15 s; las pruebas lo acortan) */
  waitMs: number
  /** El conector por el que llega (ADR-0030); sin él, Mundos */
  scope?: McpScope
}

/**
 * Lo que escribe la IA de una jugadora en su campaña: lo que la web le deja (cada acción mira que sea suyo). Cuenta
 * como «escribir» para su modo de IA: su personaje es suyo, no «de los jugadores». editPage, solo en una página que su
 * campaña puede escribir
 */
export const PLAYER_WRITES: ReadonlySet<string> = new Set([
  'createCharacter',
  'chooseForCharacter',
  'updateCharacter',
  'restoreCharacterVersion',
  'playCharacter',
  'rollForCharacter',
  'rollDice',
  'sendMessage',
  'createPlayerNote',
  'updatePlayerNote',
  'editPage'
])

/** Lo que la IA de un jugador escribe de sus notas */
const NOTE_WRITES = new Set(['createPlayerNote', 'updatePlayerNote'])

/**
 * Quién pide algo por un conector: en el de una campaña, la cuenta solo con esa campaña (y su mundo y su organización),
 * para que la IA no vea ni toque otras aunque la cuenta juegue en ellas (ADR-0030)
 */
export async function scopedActor(
  env: Pick<ActionEnv, 'db'>,
  userId: string,
  scope: McpScope | undefined
): Promise<{ actor: Actor }> {
  const memberships = await loadMemberships(env.db, userId)
  if (scope?.kind !== 'campaign') return { actor: actorFrom(userId, memberships) }
  return {
    actor: actorFrom(userId, {
      organizations: memberships.organizations.filter((m) => m.organizationId === scope.organizationId),
      worlds: memberships.worlds.filter((m) => m.worldId === scope.worldId),
      campaigns: memberships.campaigns.filter((m) => m.campaignId === scope.campaignId)
    })
  }
}

/**
 * Lo que cuenta para el modo de IA, o null si no se deja hacer. En Mundos, la IA de quien solo juega (no lleva ninguna
 * cuenta ni ningún mundo) solo lee (ADR-0017), salvo el texto de una página que puede escribir
 * (docs/specs/pagina-de-jugadores.md: lo comprueba editPage) y sus notas (que sean suyas lo comprueba la acción). En
 * una campaña manda el papel en ella: la de una jugadora hace lo suyo (PLAYER_WRITES), que para su modo es escribir
 */
async function allowedKind(env: ActionEnv, ctx: ActionContext, call: AiCall): Promise<ActionKind | 'player' | null> {
  const { impl, input, scope, userId } = call
  const kind = impl.action.kind
  if (kind === 'read') return kind
  if (scope?.kind === 'campaign') {
    if (scope.role === 'master') return kind
    if (!PLAYER_WRITES.has(impl.action.name)) return 'player'
    if (
      impl.action.name === 'editPage' &&
      !(await playerEdits(env, userId, String(input.pageId ?? ''), scope.campaignId))
    )
      return 'player'
    return 'write'
  }
  const playerOnly =
    ownedOrganizations(ctx.actor).length === 0 && ![...ctx.actor.worlds.values()].some((w) => w.role === 'master')
  if (!playerOnly) return kind
  if (impl.action.name === 'editPage' && (await playerEdits(env, userId, String(input.pageId ?? '')))) return kind
  if (NOTE_WRITES.has(impl.action.name)) return kind
  return null
}

export async function callAsAi(env: ActionEnv, call: AiCall): Promise<ToolResult> {
  const { db } = env
  const { userId, tool, impl, input } = call
  // Las pertenencias y el modo se leen en cada llamada, como en la API
  const ctx: ActionContext = { ...env, ...(await scopedActor(env, userId, call.scope)), via: 'ai', tool }
  try {
    const kind = await allowedKind(env, ctx, call)
    if (kind === null) return failure(PLAYER_READS)
    if (kind === 'player') return failure(PLAYER_OWN)
    const decision = aiDecision(await aiRepo.findAiMode(db, userId), kind)
    if (decision === 'refuse') return failure(READ_ONLY)
    if (decision === 'run') {
      return success(impl.action.output.parse(await impl.handler(ctx, input)) as Record<string, unknown>)
    }
    const details = await describe(ctx, impl.action.name, input, call.scope)
    const now = new Date()
    const { pending } = await aiRepo.listApprovals(db, userId, now)
    if (pending.length >= MAX_PENDING_APPROVALS) return failure(TOO_MANY)
    const request = await aiRepo.createApproval(db, { userId, tool, action: impl.action.name, input, details, now })
    return answer(await waitForDecision(env, request, call.waitMs), env.sealKey)
  } catch (error) {
    return failure(errorText(error))
  }
}

/**
 * Los nombres de lo que toca la petición, para el resumen de la cola. Solo de lo que la cuenta ve: si no, para ella no
 * existe y no se pide nada. Cubre lo que piden las herramientas: un mundo, una campaña, una página (y su madre) o una
 * operación del historial
 */
async function describe(ctx: ActionContext, action: string, input: Record<string, unknown>, scope?: McpScope) {
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
  if (typeof input.pageId === 'string') {
    // Un jugador pide escribir en su página: la ve (docs/specs/pagina-de-jugadores.md)
    details.page = (
      action === 'editPage' && (await playerEdits(ctx, ctx.actor.userId, input.pageId, campaignOf(scope)))
        ? await viewedPage(ctx, input.pageId)
        : await authorizedPage(ctx, 'page.read', input.pageId)
    ).page.title
  }
  if (typeof input.parentId === 'string') {
    details.parent = (await authorizedPage(ctx, 'page.read', input.parentId)).page.title
  }
  // Crear varias páginas: sus títulos
  if (Array.isArray(input.pages)) {
    details.titles = input.pages.map((page) => String((page as { title?: unknown }).title ?? ''))
  }
  // Un sistema: lo que se haría, comprobado ya; y el que elige una campaña
  Object.assign(details, await systemRequest(ctx, action, input))
  // Los libros de un sistema: cuál, de qué sistema y cuántas entradas
  Object.assign(details, await bookRequest(ctx, action, input))
  // El grupo: qué, cuánto y los nombres (como en el historial)
  Object.assign(details, await partyRequest(ctx, action, input))
  // Un calendario: su nombre
  Object.assign(details, await calendarRequest(ctx, action, input))
  // Una cronología o un evento: su nombre o su título
  Object.assign(details, await chronologyRequest(ctx, action, input))
  // Lo que sabe una campaña: qué se marca y a quién (como en el historial)
  Object.assign(details, await knowledgeRequest(ctx, action, input))
  if (action === 'updateCampaign' && typeof input.system === 'string')
    details.system = await visibleSystemName(ctx, input.system)
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

const campaignOf = (scope: McpScope | undefined) => (scope?.kind === 'campaign' ? scope.campaignId : undefined)

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
function answer(row: aiRepo.Approval, sealKey: Buffer): ToolResult {
  if (row.status === 'done') return success(openJson(row.result, sealKey))
  if (row.status === 'failed') return failure(`${row.error}: se aprobó, pero no se pudo hacer`)
  if (row.status === 'rejected') return failure(REJECTED)
  return {
    content: text(PENDING),
    structuredContent: { approval: { id: row.id, status: row.status, expiresAt: row.expiresAt.toISOString() } }
  }
}
