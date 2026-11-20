import {
  type AiConnection,
  type ApiToken,
  type Approval,
  approve,
  createApiToken,
  deleteApiToken,
  getAiSettings,
  listAiConnections,
  listApiTokens,
  listApprovals,
  reject,
  removeAiConnection,
  setAiMode
} from '@crisol/contracts'
import { aiRepo, apiTokensRepo, campaignsRepo } from '@crisol/db'
import { type AiMode, approvalStatus, can, ForbiddenError, NotFoundError } from '@crisol/domain'
import { newApiToken } from '../auth/api-tokens.ts'
import { campaignOfResource, mcpResource } from '../mcp/scope.ts'
import { approvalsChanged } from '../realtime/events.ts'
import { sealJson } from '../secrets.ts'
import { type ActionContext, errorCode, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

/**
 * Lo que solo se hace desde la interfaz: la IA no aprueba lo suyo, ni cambia su propio modo, ni quita conexiones, ni
 * ve, crea o quita tokens de acceso (tampoco con un token: ADR-0033)
 */
export const UI_ONLY: ReadonlySet<string> = new Set([
  setAiMode.name,
  approve.name,
  reject.name,
  removeAiConnection.name,
  listApiTokens.name,
  createApiToken.name,
  deleteApiToken.name
])

function fromInterface(ctx: ActionContext) {
  if (ctx.via !== 'ui') throw new ForbiddenError('ai')
}

const settings = (ctx: ActionContext, mode: AiMode) => ({
  mode,
  connectorUrl: mcpResource(ctx.publicUrl)
})

/**
 * Las conexiones de IA de la cuenta (ADR-0030): las de los conectores de este servidor, con el nombre de la campaña si
 * aún la ve, y su último uso (el de este proceso o, si no lo hay, la última vez que renovó su acceso)
 */
async function connections(ctx: ActionContext): Promise<AiConnection[]> {
  const userId = ctx.actor.userId
  const worlds = mcpResource(ctx.publicUrl)
  const rows = await aiRepo.listAiConnections(ctx.db, userId, new Date())
  const found: AiConnection[] = []
  for (const row of rows) {
    const campaignId = campaignOfResource(ctx.publicUrl, row.resource)
    if (row.resource !== worlds && !campaignId) continue
    let connector: AiConnection['connector'] = { kind: 'worlds' }
    if (campaignId) {
      const campaign = await campaignsRepo.findCampaign(ctx.db, campaignId)
      const sees = campaign && can(ctx.actor, 'campaign.read', { campaignId, worldId: campaign.worldId })
      connector = {
        kind: 'campaign',
        campaignId,
        campaign: campaign && sees ? { name: campaign.name, worldId: campaign.worldId } : null
      }
    }
    const used = ctx.aiConnections?.lastUsed(userId, row.clientId, row.resource)
    const lastUsedAt = used && used > row.renewedAt ? used : row.renewedAt
    found.push({
      clientId: row.clientId,
      clientName: row.clientName,
      url: row.resource,
      connector,
      lastUsedAt: lastUsedAt.toISOString()
    })
  }
  // En un orden que no cambia al usarlas (docs/diseno.md): Mundos primero, luego cada campaña por su nombre
  const order = (c: AiConnection) =>
    c.connector.kind === 'worlds' ? '' : (c.connector.campaign?.name ?? `\uffff${c.connector.campaignId}`)
  return found.sort(
    (a, b) =>
      order(a).localeCompare(order(b), 'es') || a.clientId.localeCompare(b.clientId) || a.url.localeCompare(b.url)
  )
}

/** Una petición tal como la ve la cuenta: la caducidad se decide con la hora de ahora */
export function approvalView(row: aiRepo.Approval, now: Date): Approval {
  return {
    id: row.id,
    tool: row.tool,
    action: row.action,
    input: row.input,
    details: row.details,
    status: approvalStatus(row, now),
    requestedAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    error: row.error
  }
}

/**
 * Lo aprobado se hace con la cuenta, con sus permisos de ahora, y queda en el historial como hecho por la IA con su
 * herramienta. Si no se puede, queda como fallida con el código del error
 */
async function execute(ctx: ActionContext, row: aiRepo.Approval): Promise<aiRepo.Approval> {
  const impl = ctx.actions.get(row.action)
  let outcome: Parameters<typeof aiRepo.finishApproval>[2]
  let unexpected: unknown = null
  try {
    if (!impl) throw new InvalidRequestError('UNKNOWN_ACTION')
    const input = impl.action.input.parse(row.input)
    const output = impl.action.output.parse(
      await impl.handler({ ...ctx, via: 'ai', tool: row.tool, requestedAt: row.createdAt }, input)
    )
    // Cifrado: puede llevar un enlace de invitación, y una copia de la base de datos no debe dar enlaces válidos
    outcome = { status: 'done', result: sealJson(output, ctx.sealKey) }
  } catch (error) {
    const code = errorCode(error)
    if (code === null) unexpected = error
    outcome = { status: 'failed', error: code ?? 'INTERNAL' }
  }
  const finished = await aiRepo.finishApproval(ctx.db, row.id, outcome)
  if (unexpected) throw unexpected
  if (!finished) throw new NotFoundError('approval')
  return finished
}

const DAY = 24 * 60 * 60 * 1000

const tokenView = (row: apiTokensRepo.ApiToken): ApiToken => ({
  id: row.id,
  name: row.name,
  prefix: row.prefix,
  createdAt: row.createdAt.toISOString(),
  expiresAt: row.expiresAt.toISOString(),
  lastUsedAt: row.lastUsedAt?.toISOString() ?? null
})

const tokensOf = async (ctx: ActionContext) =>
  (await apiTokensRepo.listApiTokens(ctx.db, ctx.actor.userId)).map(tokenView)

/** Aprobar o rechazar: solo la propia cuenta, una sola vez y antes de que caduque */
async function decide(ctx: ActionContext, approvalId: string, decision: 'approved' | 'rejected') {
  fromInterface(ctx)
  const now = new Date()
  const userId = ctx.actor.userId
  const decided = await aiRepo.decideApproval(ctx.db, { userId, approvalId, decision, now })
  if (!decided) {
    const found = await aiRepo.findApproval(ctx.db, userId, approvalId)
    if (!found) throw new NotFoundError('approval')
    throw new InvalidRequestError(approvalStatus(found, now) === 'expired' ? 'APPROVAL_EXPIRED' : 'ALREADY_DECIDED')
  }
  try {
    return approvalView(decision === 'approved' ? await execute(ctx, decided) : decided, now)
  } finally {
    // A la interfaz y a la herramienta que espera la decisión
    ctx.realtime.publish(approvalsChanged(userId))
  }
}

export const aiActions = [
  implement(getAiSettings, async (ctx) => settings(ctx, await aiRepo.findAiMode(ctx.db, ctx.actor.userId))),

  implement(setAiMode, async (ctx, { mode }) => {
    fromInterface(ctx)
    return settings(ctx, await aiRepo.setAiMode(ctx.db, ctx.actor.userId, mode))
  }),

  implement(listApprovals, async (ctx) => {
    const now = new Date()
    const { pending, recent } = await aiRepo.listApprovals(ctx.db, ctx.actor.userId, now)
    return {
      pending: pending.map((row) => approvalView(row, now)),
      recent: recent.map((row) => approvalView(row, now))
    }
  }),

  implement(listAiConnections, async (ctx) => ({ connections: await connections(ctx) })),

  // Quitarla revoca sus tokens de refresco y rechaza al momento los de acceso que ya tenía (no es del historial: son
  // tablas de Better Auth, ADR-0002)
  implement(removeAiConnection, async (ctx, { clientId, url }) => {
    fromInterface(ctx)
    if (url !== mcpResource(ctx.publicUrl) && !campaignOfResource(ctx.publicUrl, url))
      throw new InvalidRequestError('NOT_A_CONNECTOR')
    const userId = ctx.actor.userId
    await aiRepo.revokeAiConnection(ctx.db, { userId, clientId, resource: url, now: new Date() })
    ctx.aiConnections?.removed(userId, clientId, url)
    return { connections: await connections(ctx) }
  }),

  // Los tokens de acceso (ADR-0033): un ajuste de la cuenta, como el modo; no pasan por el historial
  implement(listApiTokens, async (ctx) => {
    fromInterface(ctx)
    return { tokens: await tokensOf(ctx) }
  }),

  implement(createApiToken, async (ctx, { name, days }) => {
    fromInterface(ctx)
    const userId = ctx.actor.userId
    const existing = await apiTokensRepo.listApiTokens(ctx.db, userId)
    if (existing.length >= apiTokensRepo.MAX_API_TOKENS) throw new InvalidRequestError('TOO_MANY_TOKENS')
    const { secret, hash, prefix } = newApiToken()
    const expiresAt = new Date(Date.now() + days * DAY)
    const token = await apiTokensRepo.createApiToken(ctx.db, { userId, name, hash, prefix, expiresAt })
    return { token: tokenView(token), secret }
  }),

  implement(deleteApiToken, async (ctx, { tokenId }) => {
    fromInterface(ctx)
    if (!(await apiTokensRepo.deleteApiToken(ctx.db, ctx.actor.userId, tokenId))) throw new NotFoundError('token')
    return { tokens: await tokensOf(ctx) }
  }),

  implement(approve, (ctx, { approvalId }) => decide(ctx, approvalId, 'approved')),

  implement(reject, (ctx, { approvalId }) => decide(ctx, approvalId, 'rejected'))
]
