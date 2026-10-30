import {
  createPage,
  createPageDocument,
  getPage,
  listPageChildren,
  listPageNames,
  listPageTree,
  listTags,
  movePage,
  type Page,
  setPageProperties,
  updatePage
} from '@crisol/contracts'
import { documentsRepo, filesRepo, pagesRepo } from '@crisol/db'
import {
  compareKeys,
  moveBlocker,
  NotFoundError,
  propertiesProblem,
  propertyKey,
  reservedList,
  tagCounts
} from '@crisol/domain'
import * as Y from 'yjs'
import { pagesChanged } from '../realtime/events.ts'
import { resolvePending, worldNames } from '../wiki/links.ts'
import { propertiesOf } from '../wiki/properties.ts'
import { authorizedPage, authorizedWiki, type WikiTarget } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

/** La página como la ve la API: con su ruta desde el primer nivel */
export async function pageView(ctx: ActionContext, pageId: string): Promise<Page> {
  const found = await pagesRepo.findPage(ctx.db, pageId)
  if (!found) throw new NotFoundError('page')
  return {
    id: found.id,
    worldId: found.worldId,
    parentId: found.parentId,
    title: found.title,
    icon: found.icon,
    hasChildren: found.hasChildren,
    version: found.version,
    properties: propertiesOf(found.properties),
    locked: found.locked,
    cover: found.cover ?? null,
    path: await pagesRepo.pagePath(ctx.db, pageId),
    updatedAt: found.updatedAt.toISOString()
  }
}

/** La madre (sin ella, el primer nivel): tiene que ser de la misma wiki y no estar en la papelera */
export async function parentIn(ctx: ActionContext, wiki: WikiTarget, parentId: string | null) {
  if (parentId === null) return null
  const parent = await pagesRepo.findPage(ctx.db, parentId)
  if (!parent || parent.worldId !== wiki.worldId) throw new NotFoundError('page')
  return parent
}

/** La hermana junto a la que va: de la misma rama, y no la propia página */
async function checkNeighbour(
  ctx: ActionContext,
  wiki: WikiTarget,
  input: { parentId: string | null; before?: string | undefined; after?: string | undefined },
  pageId?: string
) {
  const neighbourId = input.before ?? input.after
  if (!neighbourId) return
  const neighbour = await pagesRepo.findPage(ctx.db, neighbourId)
  if (
    !neighbour ||
    neighbour.worldId !== wiki.worldId ||
    neighbour.parentId !== input.parentId ||
    neighbourId === pageId
  )
    throw new InvalidRequestError('BAD_PLACEMENT')
}

const placementOf = (input: { parentId: string | null; before?: string | undefined; after?: string | undefined }) => ({
  parentId: input.parentId,
  ...(input.before ? { before: input.before } : {}),
  ...(input.after ? { after: input.after } : {})
})

export const pageActions = [
  implement(createPage, async (ctx, input) => {
    const wiki = await authorizedWiki(ctx, 'page.write', input.worldId)
    const parent = await parentIn(ctx, wiki, input.parentId)
    if (parent) {
      const blocker = moveBlocker({
        pageId: '',
        parentPath: (await pagesRepo.pagePath(ctx.db, parent.id)).map((p) => p.id),
        subtreeHeight: 1
      })
      if (blocker) throw new InvalidRequestError(blocker)
    }
    await checkNeighbour(ctx, wiki, input)
    const created = await pagesRepo.createPage(
      ctx.db,
      historyContext(ctx, 'createPage', { title: input.title, parent: parent?.title ?? null }, wiki),
      { worldId: wiki.worldId, title: input.title, placement: placementOf(input) }
    )
    ctx.realtime.publish(pagesChanged(wiki))
    // Lo que la enlazaba antes de existir, ya la encuentra
    await resolvePending(ctx, wiki.worldId, ctx.actor.userId, [input.title])
    return pageView(ctx, created.id)
  }),

  implement(updatePage, async (ctx, { pageId, title, icon, locked, cover }) => {
    const { page, wiki } = await authorizedPage(ctx, 'page.write', pageId)
    // La portada, una imagen de este mundo
    if (cover) {
      const file = await filesRepo.findFile(ctx.db, cover.fileId)
      if (!file || file.worldId !== wiki.worldId || file.kind !== 'image') throw new InvalidRequestError('BAD_COVER')
    }
    // Lo que cambió, para la frase del historial: renombrar, el icono, el candado o la portada
    const details = {
      ...(title !== undefined ? { from: page.title, to: title } : { title: page.title }),
      ...(icon !== undefined ? { icon } : {}),
      ...(locked !== undefined ? { locked } : {}),
      ...(cover !== undefined ? { cover: cover !== null } : {})
    }
    await pagesRepo.updatePage(ctx.db, historyContext(ctx, 'updatePage', details, wiki), pageId, {
      ...(title !== undefined ? { title } : {}),
      ...(icon !== undefined ? { icon } : {}),
      ...(locked !== undefined ? { locked } : {}),
      ...(cover !== undefined ? { cover } : {})
    })
    ctx.realtime.publish(pagesChanged(wiki))
    if (title !== undefined) await resolvePending(ctx, wiki.worldId, ctx.actor.userId, [title])
    return pageView(ctx, pageId)
  }),

  implement(setPageProperties, async (ctx, { pageId, properties }) => {
    const { page, wiki } = await authorizedPage(ctx, 'page.write', pageId)
    const problem = propertiesProblem(properties)
    if (problem) throw new InvalidRequestError(problem)
    // Las que enlazan páginas, a páginas de la misma wiki
    const linked = properties.flatMap((p) => (p.type === 'pages' ? p.value : []))
    const existing = await pagesRepo.existingPages(ctx.db, wiki.worldId, linked)
    if (linked.some((id) => !existing.has(id))) throw new InvalidRequestError('BAD_PROPERTY')
    const before = new Map(propertiesOf(page.properties).map((p) => [propertyKey(p.name), JSON.stringify(p)]))
    const after = new Map(properties.map((p) => [propertyKey(p.name), JSON.stringify(p)]))
    const changed = [...new Set([...before.keys(), ...after.keys()])].filter(
      (key) => before.get(key) !== after.get(key)
    )
    await pagesRepo.updatePage(
      ctx.db,
      historyContext(ctx, 'setPageProperties', { title: page.title, changed }, wiki),
      pageId,
      { properties }
    )
    ctx.realtime.publish(pagesChanged(wiki))
    // Un alias nuevo puede resolver enlaces que esperaban ese nombre
    await resolvePending(ctx, wiki.worldId, ctx.actor.userId, reservedList(properties, 'alias'))
    return pageView(ctx, pageId)
  }),

  implement(listPageNames, async (ctx, { worldId }) => {
    const wiki = await authorizedWiki(ctx, 'page.read', worldId)
    const names = await worldNames(ctx, wiki.worldId)
    return { pages: names.map((page) => ({ ...page, aliases: [...page.aliases], path: [...page.path] })) }
  }),

  implement(listTags, async (ctx, { worldId }) => {
    await authorizedWiki(ctx, 'page.read', worldId)
    const rows = await pagesRepo.listProperties(ctx.db, worldId)
    const pages = rows.map((row) => ({ pageId: row.id, tags: reservedList(propertiesOf(row.properties), 'etiquetas') }))
    return { tags: tagCounts(pages) }
  }),

  implement(movePage, async (ctx, input) => {
    const { page, wiki } = await authorizedPage(ctx, 'page.write', input.pageId)
    const parent = await parentIn(ctx, wiki, input.parentId)
    const blocker = moveBlocker({
      pageId: page.id,
      parentPath: parent ? (await pagesRepo.pagePath(ctx.db, parent.id)).map((p) => p.id) : [],
      subtreeHeight: await pagesRepo.subtreeHeight(ctx.db, page.id)
    })
    if (blocker) throw new InvalidRequestError(blocker)
    await checkNeighbour(ctx, wiki, input, page.id)
    await pagesRepo.movePage(
      ctx.db,
      historyContext(ctx, 'movePage', { title: page.title, parent: parent?.title ?? null }, wiki),
      page.id,
      { worldId: wiki.worldId, placement: placementOf(input) }
    )
    ctx.realtime.publish(pagesChanged(wiki))
    return pageView(ctx, page.id)
  }),

  implement(createPageDocument, async (ctx, { pageId, kind, copyOf }) => {
    const { wiki } = await authorizedPage(ctx, 'page.write', pageId)
    let state = Y.encodeStateAsUpdate(new Y.Doc())
    if (copyOf) {
      // La copia sale de un secreto que quien pega puede leer: de esta wiki o de otra que también vea
      const source = await documentsRepo.findSeparate(ctx.db, copyOf)
      await authorizedPage(ctx, 'page.read', source?.pageId ?? '')
      if (!source) throw new NotFoundError('document')
      state = source.state
    }
    // No va al historial: lo cuenta la sesión de edición del cuerpo, que es donde aparece el bloque
    const id = await documentsRepo.createSeparate(ctx.db, {
      pageId,
      worldId: wiki.worldId,
      kind,
      state,
      userId: ctx.actor.userId
    })
    return { id }
  }),

  implement(getPage, async (ctx, { pageId }) => {
    await authorizedPage(ctx, 'page.read', pageId)
    return pageView(ctx, pageId)
  }),

  implement(listPageChildren, async (ctx, { worldId, parentId }) => {
    const wiki = await authorizedWiki(ctx, 'page.read', worldId)
    await parentIn(ctx, wiki, parentId)
    const children = await pagesRepo.listChildren(ctx.db, worldId, parentId)
    return { pages: children.map(({ position: _, ...summary }) => summary) }
  }),

  implement(listPageTree, async (ctx, { worldId, parentId, levels }) => {
    const wiki = await authorizedWiki(ctx, 'page.read', worldId)
    await parentIn(ctx, wiki, parentId)
    const rows = await pagesRepo.listBranch(ctx.db, worldId, parentId, levels)
    // En orden de lectura: cada página seguida de sus subpáginas
    const byParent = Map.groupBy(rows, (row) => row.parentId)
    const pages: {
      id: string
      parentId: string | null
      title: string
      icon: string | null
      level: number
      hasChildren: boolean
    }[] = []
    const visit = (from: string | null, level: number) => {
      const children = [...(byParent.get(from) ?? [])].sort(
        (a, b) => compareKeys(a.position, b.position) || compareKeys(a.id, b.id)
      )
      for (const child of children) {
        const { position: _, ...rest } = child
        pages.push({ ...rest, level })
        visit(child.id, level + 1)
      }
    }
    visit(parentId, 1)
    return { pages }
  })
]
