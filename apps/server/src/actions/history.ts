import { type HistoryEntry, listHistory, undoOperation } from '@crisol/contracts'
import { historyRepo, trashRepo, undoRepo } from '@crisol/db'
import { authorize, can, NotFoundError } from '@crisol/domain'
import { undoEvents } from '../realtime/events.ts'
import { targetOrganization } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

type Row = NonNullable<Awaited<ReturnType<typeof historyRepo.getOperation>>>

const entry = (row: Row): HistoryEntry => ({
  id: row.id,
  at: row.createdAt.toISOString(),
  actor: row.actorId && row.actorName ? { id: row.actorId, name: row.actorName } : null,
  via: row.via,
  tool: row.tool,
  action: row.action,
  details: row.details,
  worldId: row.worldId,
  undoneBy: row.undoneById,
  undoes: row.undoesId
})

export const historyActions = [
  implement(listHistory, async (ctx, { worldId, organizationId, before, limit }) => {
    let scope: historyRepo.HistoryScope
    if (worldId) {
      authorize(ctx.actor, 'world.history', { worldId })
      scope = { worldId }
    } else {
      const target = targetOrganization(ctx, organizationId)
      authorize(ctx.actor, 'organization.history', { organizationId: target })
      scope = { organizationId: target }
    }
    // Una de más para saber si hay otra página
    const rows = await historyRepo.listOperations(ctx.db, { ...scope, limit: limit + 1, ...(before ? { before } : {}) })
    const page = rows.slice(0, limit)
    return { entries: page.map(entry), next: rows.length > limit ? (page.at(-1)?.id ?? null) : null }
  }),

  implement(undoOperation, async (ctx, { operationId }) => {
    const target = await historyRepo.getOperation(ctx.db, operationId)
    // Con los permisos de ahora: el propietario, lo de toda su organización (también de un mundo en la papelera,
    // que ya no ve ni su máster); el máster, lo de su mundo
    authorizeUndo(ctx, target ?? { organizationId: '', worldId: null })
    if (!target) throw new NotFoundError('operation')

    const result = await undoRepo.undoOperation(ctx.db, historyContext(ctx, 'undoOperation', {}), operationId)
    if (result.status === 'not-found') throw new NotFoundError('operation')
    if (result.status === 'already-undone') throw new InvalidRequestError('ALREADY_UNDONE')
    if (result.status === 'not-undoable') throw new InvalidRequestError('NOT_UNDOABLE')
    if (result.status === 'conflict') {
      const by = result.by ? await historyRepo.getOperation(ctx.db, result.by) : null
      // Solo si quien deshace puede verla en el historial
      return { status: 'conflict' as const, by: by && canUndo(ctx, by) ? entry(by) : null }
    }
    const done = await historyRepo.getOperation(ctx.db, result.operationId)
    if (!done) throw new Error('El deshacer no quedó en el historial')
    for (const event of undoEvents(result.applied, {
      worldId: target.worldId,
      organizationId: target.organizationId,
      actorId: ctx.actor.userId
    })) {
      if ('revoke' in event) ctx.realtime.revoke(event.revoke, event.scope)
      else ctx.realtime.publish(event)
    }
    await tellTrashChanges(ctx, result.applied)
    return { status: 'undone' as const, entry: entry(done) }
  })
]

type Scope = { organizationId: string; worldId: string | null }

const canUndo = (ctx: ActionContext, op: Scope) =>
  can(ctx.actor, 'organization.undo', { organizationId: op.organizationId }) ||
  (op.worldId !== null && can(ctx.actor, 'world.undo', { worldId: op.worldId }))

function authorizeUndo(ctx: ActionContext, op: Scope) {
  if (can(ctx.actor, 'organization.undo', { organizationId: op.organizationId })) return
  if (op.worldId) authorize(ctx.actor, 'world.undo', { worldId: op.worldId })
  else authorize(ctx.actor, 'organization.undo', { organizationId: op.organizationId })
}

/**
 * Deshacer un borrado o una restauración cambia quién ve el mundo o la campaña, como en la papelera: a los que estaban
 * dentro se les avisa (si vuelve a la papelera, dejan de estar en sus campañas al momento)
 */
async function tellTrashChanges(ctx: ActionContext, applied: undoRepo.AppliedChange[]) {
  for (const change of applied) {
    if (change.tableName !== 'worlds' && change.tableName !== 'campaigns') continue
    const before = change.before?.deleted_at ?? null
    const after = change.after?.deleted_at ?? null
    if ((before === null) === (after === null)) continue
    const scope = change.tableName === 'worlds' ? { worldId: change.rowId } : { campaignId: change.rowId }
    const people = await trashRepo.peopleOf(ctx.db, scope)
    const worldId = change.tableName === 'worlds' ? change.rowId : String(change.after?.world_id ?? '')
    if (after !== null) {
      for (const { userId, campaignId } of people) if (campaignId) ctx.realtime.revoke(userId, { worldId, campaignId })
    }
    const users = new Set(people.map((p) => p.userId))
    ctx.realtime.publish(
      ...[...users].map((userId) => ({
        to: { userId },
        message: { type: 'changed' as const, what: 'worlds' as const }
      }))
    )
  }
}
