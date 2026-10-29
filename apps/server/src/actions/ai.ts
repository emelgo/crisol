import { type Approval, approve, getAiSettings, listApprovals, reject, setAiMode } from '@crisol/contracts'
import { aiRepo } from '@crisol/db'
import { type AiMode, approvalStatus, ForbiddenError, NotFoundError } from '@crisol/domain'
import { approvalsChanged } from '../realtime/events.ts'
import { type ActionContext, errorCode, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

/** Lo que solo se hace desde la interfaz: la IA no aprueba lo suyo ni cambia su propio modo */
export const UI_ONLY: ReadonlySet<string> = new Set([setAiMode.name, approve.name, reject.name])

function fromInterface(ctx: ActionContext) {
  if (ctx.via !== 'ui') throw new ForbiddenError('ai')
}

const settings = (ctx: ActionContext, mode: AiMode) => ({
  mode,
  connectorUrl: new URL('/mcp', ctx.publicUrl).toString()
})

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
    const output = impl.action.output.parse(await impl.handler({ ...ctx, via: 'ai', tool: row.tool }, input))
    outcome = { status: 'done', result: output as Record<string, unknown> }
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

  implement(approve, (ctx, { approvalId }) => decide(ctx, approvalId, 'approved')),

  implement(reject, (ctx, { approvalId }) => decide(ctx, approvalId, 'rejected'))
]
