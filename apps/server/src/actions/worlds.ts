import { createWorld, listWorlds, renameWorld } from '@crisol/contracts'
import { worldsRepo } from '@crisol/db'
import { authorize, NotFoundError } from '@crisol/domain'
import { worldsChanged } from '../realtime/events.ts'
import { targetOrganization } from './access.ts'
import { historyContext } from './context.ts'
import { implement } from './registry.ts'

export const worldActions = [
  implement(listWorlds, async (ctx) => ({ worlds: await worldsRepo.listMemberWorlds(ctx.db, ctx.actor.userId) })),

  implement(createWorld, async (ctx, { name, organizationId }) => {
    const target = targetOrganization(ctx, organizationId)
    authorize(ctx.actor, 'world.create', { organizationId: target })
    const world = await worldsRepo.createWorldWithMaster(
      ctx.db,
      historyContext(ctx, 'createWorld', { name }, { organizationId: target }),
      {
        organizationId: target,
        name,
        masterId: ctx.actor.userId
      }
    )
    ctx.realtime.publish(worldsChanged(world.id))
    return { ...world, role: 'master' as const }
  }),

  implement(renameWorld, async (ctx, { worldId, name }) => {
    authorize(ctx.actor, 'world.rename', { worldId })
    const current = await worldsRepo.findWorld(ctx.db, worldId)
    const role = ctx.actor.worlds.get(worldId)?.role
    if (!current || !role) throw new NotFoundError('world')
    const world = await worldsRepo.renameWorld(
      ctx.db,
      historyContext(ctx, 'renameWorld', { from: current.name, to: name }, current),
      worldId,
      name
    )
    ctx.realtime.publish(worldsChanged(worldId))
    return { ...world, role }
  })
]
