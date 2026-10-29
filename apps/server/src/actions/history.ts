import { type HistoryEntry, listHistory } from '@crisol/contracts'
import { historyRepo } from '@crisol/db'
import { authorize } from '@crisol/domain'
import { targetOrganization } from './access.ts'
import { implement } from './registry.ts'

type Row = Awaited<ReturnType<typeof historyRepo.listOperations>>[number]

const entry = (row: Row): HistoryEntry => ({
  id: row.id,
  at: row.createdAt.toISOString(),
  actor: row.actorId && row.actorName ? { id: row.actorId, name: row.actorName } : null,
  via: row.via,
  tool: row.tool,
  action: row.action,
  details: row.details,
  worldId: row.worldId
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
  })
]
