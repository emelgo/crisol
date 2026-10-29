import { type HistoryEntry, listHistory, undoOperation } from '@crisol/contracts'
import { historyRepo, undoRepo } from '@crisol/db'
import { authorize, NotFoundError } from '@crisol/domain'
import { undoEvents } from '../realtime/events.ts'
import { targetOrganization } from './access.ts'
import { historyContext, InvalidRequestError } from './context.ts'
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
    // Con los permisos de ahora: el máster de su mundo, o el propietario si no es de ningún mundo
    if (target?.worldId) authorize(ctx.actor, 'world.undo', { worldId: target.worldId })
    else authorize(ctx.actor, 'organization.undo', { organizationId: target?.organizationId ?? '' })
    if (!target) throw new NotFoundError('operation')

    const result = await undoRepo.undoOperation(ctx.db, historyContext(ctx, 'undoOperation', {}), operationId)
    if (result.status === 'not-found') throw new NotFoundError('operation')
    if (result.status === 'already-undone') throw new InvalidRequestError('ALREADY_UNDONE')
    if (result.status === 'not-undoable') throw new InvalidRequestError('NOT_UNDOABLE')
    if (result.status === 'conflict') {
      const by = result.by ? await historyRepo.getOperation(ctx.db, result.by) : null
      return { status: 'conflict' as const, by: by ? entry(by) : null }
    }
    const done = await historyRepo.getOperation(ctx.db, result.operationId)
    if (!done) throw new Error('El deshacer no quedó en el historial')
    for (const event of undoEvents(result.applied, { worldId: target.worldId, actorId: ctx.actor.userId })) {
      if ('revoke' in event) ctx.realtime.revoke(event.revoke, event.scope)
      else ctx.realtime.publish(event)
    }
    return { status: 'undone' as const, entry: entry(done) }
  })
]
