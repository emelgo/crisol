import {
  createPageDocument,
  getPage,
  getPageTables,
  listPageChildren,
  listPageNames,
  listPageTree,
  listRecentPages,
  listTags,
  movePage,
  type Page,
  pagePanel,
  setPagePanel,
  setPageProperties,
  sheetSettings,
  sortPageChildren,
  updatePage
} from '@crisol/contracts'
import { documentsRepo, filesRepo, pagesRepo, worldsRepo } from '@crisol/db'
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
import { pageViewFor, viewedPage, viewTree } from '../wiki/projection.ts'
import { propertiesOf } from '../wiki/properties.ts'
import { authorizedView } from '../wiki/reader.ts'
import { checkTables, pageTables } from '../wiki/tables.ts'
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
    // Lo guardado que no sea unos ajustes de hoja válidos cuenta como sin hoja
    sheet: sheetSettings.safeParse(found.sheet).data ?? null,
    // Lo guardado que no valga (de una versión anterior) cuenta como panel vacío
    panel: pagePanel.safeParse(found.panel).data ?? [],
    template: found.template,
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
export async function checkNeighbour(
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

export const placementOf = (input: {
  parentId: string | null
  before?: string | undefined
  after?: string | undefined
}) => ({
  parentId: input.parentId,
  ...(input.before ? { before: input.before } : {}),
  ...(input.after ? { after: input.after } : {})
})

export const pageActions = [
  implement(updatePage, async (ctx, { pageId, title, icon, locked, cover, sheet }) => {
    const { page, wiki } = await authorizedPage(ctx, 'page.write', pageId)
    // La portada, una imagen de este mundo o una común de su organización
    if (cover) {
      const file = await filesRepo.findFile(ctx.db, cover.fileId)
      const usable =
        file && (file.worldId ? file.worldId === wiki.worldId : file.organizationId === wiki.organizationId)
      if (!file || !usable || file.kind !== 'image') throw new InvalidRequestError('BAD_COVER')
    }
    // Lo que cambió, para la frase del historial: renombrar, el icono, el candado o la portada
    const details = {
      ...(title !== undefined ? { from: page.title, to: title } : { title: page.title }),
      ...(icon !== undefined ? { icon } : {}),
      ...(locked !== undefined ? { locked } : {}),
      ...(cover !== undefined ? { cover: cover !== null } : {}),
      // La hoja: activada, quitada o con otros ajustes
      ...(sheet !== undefined ? { sheet: sheet === null ? 'off' : page.sheet ? 'changed' : 'on' } : {})
    }
    await pagesRepo.updatePage(ctx.db, historyContext(ctx, 'updatePage', details, wiki), pageId, {
      ...(title !== undefined ? { title } : {}),
      ...(icon !== undefined ? { icon } : {}),
      ...(locked !== undefined ? { locked } : {}),
      ...(cover !== undefined ? { cover } : {}),
      ...(sheet !== undefined ? { sheet } : {})
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

  implement(setPagePanel, async (ctx, { pageId, blocks }) => {
    const { page, wiki } = await authorizedPage(ctx, 'page.write', pageId)
    if (new Set(blocks.map((b) => b.id)).size !== blocks.length) throw new InvalidRequestError('BAD_PANEL')
    for (const block of blocks) {
      if ((block.type === 'meter' || block.type === 'tokens' || block.type === 'rating') && block.value > block.max)
        throw new InvalidRequestError('BAD_PANEL')
      // Las imágenes, de este mundo o comunes de su organización
      if (block.type === 'image' && block.fileId) {
        const file = await filesRepo.findFile(ctx.db, block.fileId)
        const usable =
          file && (file.worldId ? file.worldId === wiki.worldId : file.organizationId === wiki.organizationId)
        if (!file || !usable || file.kind !== 'image') throw new InvalidRequestError('BAD_PANEL')
      }
    }
    // Las tablas que se llenan solas: con una plantilla, un campo de enlace y columnas suyas (ADR-0009)
    await checkTables(ctx, wiki.organizationId, page.panel, blocks)
    await pagesRepo.updatePage(ctx.db, historyContext(ctx, 'setPagePanel', { title: page.title }, wiki), pageId, {
      panel: blocks
    })
    ctx.realtime.publish(pagesChanged(wiki))
    return pageView(ctx, pageId)
  }),

  implement(listPageNames, async (ctx, { worldId }) => {
    const wiki = await authorizedWiki(ctx, 'page.read', worldId)
    const [names, rows] = await Promise.all([
      worldNames(ctx, wiki.worldId),
      pagesRepo.listProperties(ctx.db, wiki.worldId)
    ])
    const tags = new Map(rows.map((row) => [row.id, reservedList(propertiesOf(row.properties), 'etiquetas')]))
    return {
      pages: names.map((page) => ({
        ...page,
        aliases: [...page.aliases],
        path: [...page.path],
        tags: tags.get(page.id) ?? []
      }))
    }
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
    // La portada del mundo se queda en lo más alto
    if (input.parentId && (await worldsRepo.homePageOf(ctx.db, wiki.worldId)) === page.id) {
      throw new InvalidRequestError('HOME_PAGE')
    }
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

  implement(sortPageChildren, async (ctx, { worldId, parentId, order }) => {
    const wiki = await authorizedWiki(ctx, 'page.write', worldId)
    const parent = await parentIn(ctx, wiki, parentId)
    const sorted = await pagesRepo.sortChildren(
      ctx.db,
      historyContext(ctx, 'sortPageChildren', { title: parent?.title ?? null, order }, wiki),
      { worldId: wiki.worldId, parentId, order, keepFirst: await worldsRepo.homePageOf(ctx.db, wiki.worldId) }
    )
    ctx.realtime.publish(pagesChanged(wiki))
    return { sorted }
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

  implement(getPage, async (ctx, { pageId, ...as }) => {
    const { view } = await viewedPage(ctx, pageId, as)
    return pageViewFor(view, await pageView(ctx, pageId))
  }),

  implement(getPageTables, async (ctx, { pageId, ...as }) => {
    const { page, wiki, view } = await viewedPage(ctx, pageId, as)
    return pageTables(ctx, wiki, page, view)
  }),

  implement(listPageChildren, async (ctx, { worldId, parentId, ...as }) => {
    const { wiki, view } = await authorizedView(ctx, worldId, as)
    if (!view.full) {
      // Un jugador: las que cuelgan de ella en su árbol (una madre que no ve, no existe)
      if (parentId && !view.seesPage(parentId)) throw new NotFoundError('page')
      const tree = await viewTree(ctx, wiki, view)
      return { pages: tree.filter((row) => row.parentId === parentId).map((row) => ({ ...row, worldId })) }
    }
    await parentIn(ctx, wiki, parentId)
    const children = await pagesRepo.listChildren(ctx.db, worldId, parentId)
    return { pages: children.map(({ position: _, ...summary }) => summary) }
  }),

  implement(listPageTree, async (ctx, { worldId, parentId, levels, ...as }) => {
    const { wiki, view } = await authorizedView(ctx, worldId, as)
    if (!view.full) {
      if (parentId && !view.seesPage(parentId)) throw new NotFoundError('page')
      const tree = await viewTree(ctx, wiki, view)
      const byParent = Map.groupBy(tree, (row) => row.parentId)
      const pages: {
        id: string
        parentId: string | null
        title: string
        icon: string | null
        template: string | null
        level: number
        hasChildren: boolean
      }[] = []
      const visit = (from: string | null, level: number) => {
        for (const row of byParent.get(from) ?? []) {
          pages.push({
            id: row.id,
            parentId: row.parentId,
            title: row.title,
            icon: row.icon,
            template: row.template,
            level,
            hasChildren: row.hasChildren
          })
          if (level < levels) visit(row.id, level + 1)
        }
      }
      visit(parentId, 1)
      return { pages }
    }
    await parentIn(ctx, wiki, parentId)
    const rows = await pagesRepo.listBranch(ctx.db, worldId, parentId, levels)
    // En orden de lectura: cada página seguida de sus subpáginas
    const byParent = Map.groupBy(rows, (row) => row.parentId)
    const pages: {
      id: string
      parentId: string | null
      title: string
      icon: string | null
      template: string | null
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
  }),

  implement(listRecentPages, async (ctx, { worldId, limit, ...as }) => {
    const { view } = await authorizedView(ctx, worldId, as)
    const visible = view.visiblePageIds()
    const rows = await pagesRepo.recentPages(ctx.db, worldId, limit, visible ? { within: visible } : undefined)
    const paths = await pagesRepo.pagePaths(
      ctx.db,
      rows.map((row) => row.id)
    )
    // La ruta, por las que ve
    for (const [id, path] of paths) paths.set(id, view.pages(path))
    return {
      pages: rows.map((row) => ({
        id: row.id,
        title: row.title,
        icon: row.icon,
        cover: row.cover,
        // Las de encima: la ruta sin ella
        path: (paths.get(row.id) ?? []).slice(0, -1),
        editedAt: new Date(row.editedAt).toISOString()
      }))
    }
  })
]
