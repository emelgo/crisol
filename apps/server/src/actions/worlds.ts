import {
  createWorld,
  getWorldHome,
  listWorlds,
  renameWorld,
  updateWorld,
  type World,
  worldColor,
  worldIcon
} from '@crisol/contracts'
import { filesRepo, pagesRepo, worldsRepo } from '@crisol/db'
import { authorize, NotFoundError } from '@crisol/domain'
import { worldsChanged } from '../realtime/events.ts'
import { authorizedWiki, targetOrganization } from './access.ts'
import { historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

/** Un mundo de la base de datos, como lo da la API: el icono y el color, solo si son de los que se ofrecen */
export function presentWorld<T extends { icon: string | null; color: string | null }>(
  row: T
): Omit<T, 'icon' | 'color'> & Pick<World, 'icon' | 'color'> {
  const icon = worldIcon.safeParse(row.icon)
  const color = worldColor.safeParse(row.color)
  return { ...row, icon: icon.success ? icon.data : null, color: color.success ? color.data : null }
}

export const worldActions = [
  implement(getWorldHome, async (ctx, { worldId }) => {
    await authorizedWiki(ctx, 'page.read', worldId)
    const chosen = await worldsRepo.homePageOf(ctx.db, worldId)
    if (chosen && (await pagesRepo.existingPages(ctx.db, worldId, [chosen])).has(chosen)) {
      return { pageId: chosen, chosen: true }
    }
    const [first] = await pagesRepo.listChildren(ctx.db, worldId, null)
    return { pageId: first?.id ?? null, chosen: false }
  }),

  implement(listWorlds, async (ctx) => ({
    worlds: (await worldsRepo.listMemberWorlds(ctx.db, ctx.actor.userId)).map(presentWorld)
  })),

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
    return presentWorld({ ...world, role: 'master' as const })
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
    return presentWorld({ ...world, role })
  }),

  implement(updateWorld, async (ctx, { worldId, ...patch }) => {
    authorize(ctx.actor, 'world.rename', { worldId })
    const current = await worldsRepo.findWorld(ctx.db, worldId)
    const role = ctx.actor.worlds.get(worldId)?.role
    if (!current || !role) throw new NotFoundError('world')
    // La portada, una imagen de este mundo o una común de su organización
    if (patch.cover) {
      const file = await filesRepo.findFile(ctx.db, patch.cover.fileId)
      const usable = file && (file.worldId ? file.worldId === worldId : file.organizationId === current.organizationId)
      if (!file || !usable || file.kind !== 'image') throw new InvalidRequestError('BAD_COVER')
    }
    // La página de portada, una de este mundo fuera de la papelera
    if (patch.homePageId) {
      const found = await pagesRepo.existingPages(ctx.db, worldId, [patch.homePageId])
      if (!found.has(patch.homePageId)) throw new InvalidRequestError('BAD_HOME_PAGE')
    }
    // Lo que cambió, para la frase del historial
    const details = {
      ...(patch.name !== undefined && patch.name !== current.name
        ? { from: current.name, to: patch.name }
        : { name: current.name }),
      ...(patch.description !== undefined ? { description: true } : {}),
      ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
      ...(patch.cover !== undefined ? { cover: patch.cover !== null } : {}),
      ...(patch.homePageId !== undefined ? { home: patch.homePageId !== null } : {})
    }
    const world = await worldsRepo.updateWorld(
      ctx.db,
      historyContext(ctx, 'updateWorld', details, current),
      worldId,
      patch
    )
    ctx.realtime.publish(worldsChanged(worldId))
    return presentWorld({ ...world, role })
  })
]
