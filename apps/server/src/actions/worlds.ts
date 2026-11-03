import {
  createWorld,
  ensureWorldHome,
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
import { pagesChanged, worldsChanged } from '../realtime/events.ts'
import { authorizedWiki, targetOrganization } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { pageContentActions } from './page-content.ts'
import { implement } from './registry.ts'

/** Un mundo de la base de datos, como lo da la API: el icono y el color, solo si son de los que se ofrecen */
export function presentWorld<T extends { icon: string | null; color: string | null }>(
  row: T
): Omit<T, 'icon' | 'color'> & Pick<World, 'icon' | 'color'> {
  const icon = worldIcon.safeParse(row.icon)
  const color = worldColor.safeParse(row.color)
  return { ...row, icon: icon.success ? icon.data : null, color: color.success ? color.data : null }
}

/** El texto con el que nace la portada de un mundo */
const welcome = (world: string) =>
  [
    `> [!nota] La portada de ${world}`,
    '> Es la primera página del mundo y la que se abre al entrar en él. Cuenta aquí lo esencial y enlaza lo demás.',
    '',
    '## Por dónde empezar',
    '',
    '- Crea páginas con «Página nueva» o escribiendo `[[` y su nombre.',
    '- Añade un mapa con «+», junto a «Texto».',
    '- Pon etiquetas a las páginas y búscalas con `#etiqueta` en el árbol.'
  ].join('\n')

/** La página de portada del mundo, si la tiene y sigue fuera de la papelera */
async function homeOf(ctx: ActionContext, worldId: string) {
  const chosen = await worldsRepo.homePageOf(ctx.db, worldId)
  return chosen && (await pagesRepo.existingPages(ctx.db, worldId, [chosen])).has(chosen) ? chosen : null
}

export const worldActions = [
  implement(getWorldHome, async (ctx, { worldId }) => {
    await authorizedWiki(ctx, 'page.read', worldId)
    const home = await homeOf(ctx, worldId)
    return { pageId: home, chosen: home !== null }
  }),

  implement(ensureWorldHome, async (ctx, { worldId }) => {
    const wiki = await authorizedWiki(ctx, 'page.write', worldId)
    const home = await homeOf(ctx, worldId)
    if (home) return { pageId: home }
    const world = await worldsRepo.findWorld(ctx.db, worldId)
    const title = world?.name ?? ''
    const page = await pagesRepo.createHomePage(ctx.db, historyContext(ctx, 'createWorldHome', { title }, wiki), {
      worldId,
      title
    })
    // Con un texto de bienvenida: qué es esta página y por dónde empezar (se borra o se cambia como cualquier texto)
    await pageContentActions.find((impl) => impl.action.name === 'editPage')?.handler(ctx, {
      pageId: page.id,
      body: { mode: 'append', markdown: welcome(title) }
    })
    ctx.realtime.publish(pagesChanged(wiki))
    return { pageId: page.id }
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
