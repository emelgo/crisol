/**
 * El contenido de las páginas en Markdown, para Claude (ADR-0003): leer una página, crear varias de una vez con su cuerpo
 * y cambiar una. Los secretos van siempre aparte: lo de dentro de un `> [!secreto]` se guarda en su propio documento y
 * nunca entra en el cuerpo
 */
import { randomUUID } from 'node:crypto'
import { createPage, createPages, editPage, type PageProperty, pagePanel, readPage } from '@crisol/contracts'
import { documentsRepo, knowledgeRepo, pagesRepo, worldsRepo } from '@crisol/db'
import {
  applyTemplate,
  ForbiddenError,
  fillTemplate,
  type Instance,
  instantiate,
  keepShapes,
  moveBlocker,
  NotFoundError,
  type PageTemplate,
  propertiesProblem,
  propertyKey,
  reservedList
} from '@crisol/domain'
import { fillJsonIds } from '@crisol/editor'
import {
  type BodyEdit,
  EditTargetError,
  editBody,
  FrontmatterError,
  keepBlockId,
  pageFromMarkdown,
  pageToMarkdown,
  type ReadPage,
  type ReadProperty
} from '@crisol/editor/markdown'
import type { JSONContent } from '@tiptap/core'
import { pagesChanged } from '../realtime/events.ts'
import { readDocument, stateOf, writeDocument } from '../wiki/content.ts'
import { fileNames, worldFiles } from '../wiki/file-embeds.ts'
import { linkName, linksOfNewPages, resolveIncoming, resolvePending, worldNames } from '../wiki/links.ts'
import { filterBody, pageViewFor, unresolvedAsText, viewedPage, visibleProperties } from '../wiki/projection.ts'
import { propertiesOf } from '../wiki/properties.ts'
import { knownBySomeone, type WikiView } from '../wiki/reader.ts'
import { pageTables } from '../wiki/tables.ts'
import { fieldsText, findTemplate, newBlockId } from '../wiki/templates.ts'
import { snapshotPage, versionOf } from '../wiki/versions.ts'
import { authorizedPage, authorizedWiki } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { checkNeighbour, pageView, parentIn, placementOf } from './pages.ts'
import { implement } from './registry.ts'

const SEPARATE = new Set(['secret', 'note'])

/** Lee el Markdown que manda la IA: un YAML que no se entiende dice su línea */
function parse(markdown: string): ReadPage {
  try {
    return pageFromMarkdown(markdown)
  } catch (error) {
    if (error instanceof FrontmatterError) throw new InvalidRequestError('BAD_YAML', error.message)
    throw error
  }
}

/** Los secretos y las notas ocultas de un cuerpo (en cualquier nivel), por su id de bloque */
function separatesIn(body: JSONContent, found = new Map<string, { kind: string; documentId: string | null }>()) {
  if (body.type && SEPARATE.has(body.type) && typeof body.attrs?.id === 'string') {
    found.set(body.attrs.id, { kind: body.type, documentId: (body.attrs.documentId as string | null) ?? null })
  }
  for (const child of body.content ?? []) separatesIn(child, found)
  return found
}

/**
 * La página que se escribe: quien lleva la wiki, cualquiera; un jugador, una que puede editar
 * (docs/specs/pagina-de-jugadores.md), y solo su texto: ni el título, ni el icono, ni los campos, ni una plantilla
 */
async function writablePage(
  ctx: ActionContext,
  input: { pageId: string; title?: unknown; icon?: unknown; properties?: unknown; template?: unknown }
) {
  try {
    return { ...(await authorizedPage(ctx, 'page.write', input.pageId)), player: false }
  } catch (error) {
    if (!(error instanceof ForbiddenError || error instanceof NotFoundError)) throw error
    if (!(await knowledgeRepo.canEditPage(ctx.db, ctx.actor.userId, input.pageId))) throw error
    const page = await pagesRepo.findPage(ctx.db, input.pageId)
    const world = page ? await worldsRepo.findWorld(ctx.db, page.worldId) : null
    if (!page || !world) throw new NotFoundError('page')
    const others = [input.title, input.icon, input.properties, input.template].some((given) => given !== undefined)
    if (others) throw new InvalidRequestError('PLAYER_PAGE', 'en una página de jugadores solo se escribe su texto')
    return { page, wiki: { worldId: world.id, organizationId: world.organizationId }, player: true }
  }
}

/** El cuerpo con el documento de cada secreto puesto (por su id de bloque) */
function withDocuments(body: JSONContent, documents: ReadonlyMap<string, string>): JSONContent {
  if (body.type && SEPARATE.has(body.type)) {
    const documentId = documents.get(String(body.attrs?.id ?? ''))
    return documentId ? { ...body, attrs: { ...body.attrs, documentId } } : body
  }
  return body.content ? { ...body, content: body.content.map((child) => withDocuments(child, documents)) } : body
}

/** Lo de dentro de un secreto como documento: con sus ids, y un párrafo si viene vacío */
const separateDoc = (content: JSONContent[]): JSONContent =>
  fillJsonIds({ type: 'doc', content: content.length > 0 ? content : [{ type: 'paragraph' }] })

const fold = (name: string) => name.trim().toLocaleLowerCase('es')

/** Encuentra páginas del mundo por su título, un alias o su id (sin mirar mayúsculas) */
export async function pageResolver(
  ctx: ActionContext,
  worldId: string,
  /** Un jugador (ADR-0017): solo entre las páginas que ve, con sus alias que no estén ocultos */
  view?: WikiView
) {
  const byName = new Map<string, Map<string, string>>()
  const ids = new Set<string>()
  const add = (id: string, title: string, aliases: readonly string[] = []) => {
    ids.add(id)
    for (const name of [title, ...aliases]) {
      const found = byName.get(fold(name)) ?? new Map<string, string>()
      found.set(id, title)
      byName.set(fold(name), found)
    }
  }
  for (const row of await pagesRepo.pageNames(ctx.db, worldId)) {
    if (view && !view.seesPage(row.id)) continue
    const properties = propertiesOf(row.properties)
    add(row.id, row.title, reservedList(view ? visibleProperties(properties, view) : properties, 'alias'))
  }
  const resolve = (name: string): string => {
    if (ids.has(name)) return name
    const found = byName.get(fold(name))
    if (!found || found.size === 0) throw new InvalidRequestError('PAGE_NOT_FOUND', `no hay ninguna página «${name}»`)
    if (found.size > 1) {
      const candidates = [...found].map(([id, title]) => `«${title}» (${id})`).join(', ')
      throw new InvalidRequestError('AMBIGUOUS_PAGE', `«${name}» puede ser ${candidates}: usa su id`)
    }
    return [...found.keys()][0] as string
  }
  return { add, resolve }
}

/** Una propiedad que se escribe a mano: del YAML, o de la IA (que también da opciones y relojes) */
type WantedProperty =
  | ReadProperty
  | { name: string; type: 'number'; value: number | null }
  | { name: string; type: 'pages'; value: string[]; single?: true | undefined }
  | { name: string; type: 'choice'; value: string; options?: string[] | undefined }
  | { name: string; type: 'clock'; value: number; segments?: number | undefined }

/** Los segmentos de un reloj nuevo, si no se dicen */
const CLOCK_DEFAULT = 4

/**
 * Las propiedades tal como se guardan: las de páginas, con sus ids. Las que ya tenía la página con un campo o una forma
 * (opciones, segmentos, una sola página) los conservan si el valor cabe (ADR-0009)
 */
function toProperties(
  read: readonly WantedProperty[],
  resolve: (name: string) => string,
  before: readonly PageProperty[] = []
): PageProperty[] {
  const previous = new Map(before.map((p) => [propertyKey(p.name), p]))
  const properties = read.map((property): PageProperty => {
    const old = previous.get(propertyKey(property.name))
    switch (property.type) {
      case 'pages':
        return { ...property, value: [...new Set(property.value.map(resolve))] }
      case 'choice':
        return { ...property, options: property.options ?? (old?.type === 'choice' ? old.options : []) }
      case 'clock':
        return {
          ...property,
          segments: property.segments ?? (old?.type === 'clock' ? old.segments : CLOCK_DEFAULT)
        }
      default:
        return property
    }
  })
  const shaped = keepShapes(before, properties)
  const problem = propertiesProblem(shaped)
  if (problem) throw new InvalidRequestError(problem)
  return shaped
}

/** Las madres antes que sus hijas, y cuántos niveles tiene la tanda; una madre que no está o un ciclo no valen */
function inOrder<T extends { key: string; parent?: string | undefined }>(pages: readonly T[]) {
  const byKey = new Map(pages.map((page) => [page.key, page]))
  const depth = new Map<string, number>()
  const levelOf = (page: T, seen: Set<string>): number => {
    const known = depth.get(page.key)
    if (known !== undefined) return known
    if (seen.has(page.key)) throw new InvalidRequestError('BAD_PARENT', `«${page.key}» es madre de sí misma`)
    seen.add(page.key)
    const parent = page.parent ? byKey.get(page.parent) : undefined
    if (page.parent && !parent) throw new InvalidRequestError('BAD_PARENT', `no hay ninguna key «${page.parent}»`)
    const level = parent ? levelOf(parent, seen) + 1 : 1
    depth.set(page.key, level)
    return level
  }
  for (const page of pages) levelOf(page, new Set())
  const ordered = [...pages].sort((a, b) => (depth.get(a.key) ?? 0) - (depth.get(b.key) ?? 0))
  return { ordered, height: Math.max(...depth.values()) }
}

/** Lo que añade una plantilla a una página ya hecha (sus campos, bloques y apartados que falten), con la plantilla */
async function applying(
  ctx: ActionContext,
  wiki: { organizationId: string },
  page: { id: string; properties: unknown[]; panel: unknown[] },
  ref: string
) {
  const template = await findTemplate(ctx, wiki.organizationId, ref)
  const body = await readDocument(ctx, { kind: 'body', pageId: page.id })
  const headings = (body.content ?? [])
    .filter((node) => node.type === 'heading')
    .map((node) => (node.content ?? []).map((child) => child.text ?? '').join(''))
  const applied = applyTemplate(
    template,
    { properties: propertiesOf(page.properties), panel: pagePanel.safeParse(page.panel).data ?? [], headings },
    newBlockId
  )
  const problem = propertiesProblem(applied.properties)
  if (problem) throw new InvalidRequestError(problem)
  return { template, applied }
}

/** Las propiedades de una página de plantilla: cada una en su campo, y los que no se dan con su valor inicial */
function withTemplate(
  properties: PageProperty[],
  made: { template: PageTemplate; instance: Instance } | undefined
): PageProperty[] {
  if (!made) return properties
  const filled = fillTemplate(made.instance.properties, properties)
  if ('problem' in filled) {
    const { given, field } = filled.problem
    throw new InvalidRequestError(
      'BAD_FIELD',
      `«${given}» no cabe en el campo «${field}» de ${made.template.name}. Sus campos: ${fieldsText(made.template)}`
    )
  }
  const problem = propertiesProblem(filled.properties)
  if (problem) throw new InvalidRequestError(problem)
  return filled.properties
}

/** Una página nueva de la tanda: por su key, con su madre (de la tanda), su texto y su plantilla */
interface BatchPage {
  key: string
  parent?: string | undefined
  title: string
  icon?: string | undefined
  markdown?: string | undefined
  template?: string | undefined
}

/**
 * Crea las páginas de una tanda en una sola operación: con su cuerpo, sus secretos, sus propiedades y, si la llevan, su
 * plantilla (sus campos, su panel y su esqueleto si no traen cuerpo). Es el único camino para crear con plantilla
 */
async function createBatch(
  ctx: ActionContext,
  input: { worldId: string; parentId: string | null; pages: readonly BatchPage[] },
  describe: (
    ordered: readonly BatchPage[],
    parent: { title: string } | null
  ) => { action: string; details: Record<string, unknown> }
) {
  const wiki = await authorizedWiki(ctx, 'page.write', input.worldId)
  const parent = await parentIn(ctx, wiki, input.parentId)
  const { ordered, height } = inOrder(input.pages)
  const parentPath = parent ? (await pagesRepo.pagePath(ctx.db, parent.id)).map((p) => p.id) : []
  const blocker = moveBlocker({ pageId: '', parentPath, subtreeHeight: height })
  if (blocker) throw new InvalidRequestError(blocker)

  // Todo se lee y se comprueba antes de escribir nada. Los enlaces, contra las páginas del mundo y las de la tanda,
  // que ya tienen su id: así salen resueltos sin volver a escribir el texto (lo que no está, se resuelve al crearlo)
  const pageIds = new Map(ordered.map((page) => [page.key, randomUUID()]))
  const story = describe(ordered, parent)
  // Las de plantilla: sus copias; sin cuerpo, nacen con su esqueleto (las propiedades del YAML van a sus campos)
  const made = new Map<string, { template: PageTemplate; instance: Instance }>()
  for (const page of ordered) {
    if (!page.template) continue
    const template = await findTemplate(ctx, wiki.organizationId, page.template)
    made.set(page.key, { template, instance: instantiate(template, newBlockId) })
  }
  const reads = new Map(
    ordered.map((page) => {
      const read = parse(page.markdown ?? '')
      const instance = made.get(page.key)?.instance
      if (!instance || (read.body.content ?? []).length > 0) return [page.key, read] as const
      return [page.key, { ...parse(instance.markdown), properties: read.properties }] as const
    })
  )
  const above = parent ? (await pagesRepo.pagePath(ctx.db, parent.id)).map((p) => p.title) : []
  const pathOf = (key: string): string[] => {
    const page = ordered.find((p) => p.key === key)
    if (!page) return above
    return [...(page.parent ? pathOf(page.parent) : above), page.title]
  }
  const batch = ordered.map((page) => {
    const aliases = reads.get(page.key)?.properties.find((p) => fold(p.name) === 'alias')
    return {
      id: pageIds.get(page.key) as string,
      title: page.title,
      aliases: aliases?.type === 'list' ? aliases.value : [],
      path: pathOf(page.key)
    }
  })
  const names = [...(await worldNames(ctx, wiki.worldId)), ...batch]
  const files = await worldFiles(ctx, wiki.worldId)
  const links = (json: JSONContent) => resolveIncoming(json, names, files)
  const prepared = ordered.map((page) => {
    const read = reads.get(page.key) as ReadPage
    const documents = new Map(read.separates.map((separate) => [separate.id, randomUUID()]))
    const body = fillJsonIds(withDocuments(links(read.body), documents))
    const bodyState = (read.body.content ?? []).length > 0 ? stateOf(body) : null
    const separates = read.separates.map((separate) => ({
      id: documents.get(separate.id) as string,
      kind: separate.kind,
      state: stateOf(separateDoc(separate.content.map(links)), true)
    }))
    // Con texto, su primera versión va en la misma operación
    const bodyId = bodyState ? randomUUID() : undefined
    const instance = made.get(page.key)?.instance
    const newPage: pagesRepo.NewPage = {
      ...(instance ? { template: { id: instance.template, line: instance.line }, panel: instance.panel } : {}),
      id: pageIds.get(page.key) as string,
      key: page.key,
      parentKey: page.parent ?? null,
      title: page.title,
      icon: page.icon ?? null,
      body: bodyState,
      separates,
      ...(bodyState && bodyId
        ? {
            bodyId,
            version: versionOf([
              { documentId: bodyId, kind: 'body', state: bodyState },
              ...separates.map((separate) => ({
                documentId: separate.id,
                kind: separate.kind,
                state: separate.state
              }))
            ])
          }
        : {})
    }
    return { newPage, properties: read.properties }
  })
  const resolver = await pageResolver(ctx, wiki.worldId)
  // Bajo una página que alguna campaña conoce, nacen ocultas
  const hidden = parent ? await knownBySomeone(ctx, wiki.worldId, parent.id) : false
  const created = await pagesRepo.createPagesWithBodies(
    ctx.db,
    historyContext(ctx, story.action, { ...story.details, ...(hidden ? { hidden } : {}) }, wiki),
    {
      worldId: wiki.worldId,
      parentId: parent?.id ?? null,
      hidden,
      pages: prepared.map((page) => page.newPage),
      // Las de la tanda también se pueden enlazar, por su título o sus alias
      properties: (ids) => {
        for (const { newPage, properties } of prepared) {
          const aliases = properties.find((p) => fold(p.name) === 'alias')
          resolver.add(ids.get(newPage.key) as string, newPage.title, aliases?.type === 'list' ? aliases.value : [])
        }
        return new Map(
          prepared.map(({ newPage, properties }) => [
            newPage.key,
            withTemplate(toProperties(properties, resolver.resolve), made.get(newPage.key))
          ])
        )
      }
    }
  )
  ctx.realtime.publish(pagesChanged(wiki))
  // Sus enlaces, y los que las esperaban (también entre ellas)
  await linksOfNewPages(
    ctx,
    wiki.worldId,
    created.map((page) => {
      const named = batch.find((b) => b.id === page.id)
      return { id: page.id, names: [page.title, ...(named?.aliases ?? [])] }
    }),
    ctx.actor.userId
  )
  const byKey = new Map(created.map((page) => [page.key, page]))
  return input.pages.map((page) => byKey.get(page.key)).filter((page) => page !== undefined)
}

export const pageContentActions = [
  implement(readPage, async (ctx, { pageId, ids, ...as }) => {
    const { page, wiki, view: reading } = await viewedPage(ctx, pageId, as)
    const view = pageViewFor(reading, await pageView(ctx, pageId))
    // Un jugador: sin lo que no ve, y los enlaces a lo que no conoce, como texto (lo que se escribió)
    const read = filterBody(await readDocument(ctx, { kind: 'body', pageId }), reading, pageId) ?? { type: 'doc' }
    const body = reading.full ? read : (unresolvedAsText(read) ?? { type: 'doc' })
    // Solo los secretos que son de esta página
    const own = new Set(
      (await documentsRepo.documentsOfPages(ctx.db, [pageId])).filter((d) => d.kind !== 'body').map((d) => d.id)
    )
    const contents = new Map<string, JSONContent[]>()
    for (const { documentId } of separatesIn(body).values()) {
      if (!documentId || !own.has(documentId)) continue
      // Lo de dentro, filtrado como el cuerpo (un jugador: sus enlaces a lo que no ve, como texto)
      const read = filterBody(await readDocument(ctx, { kind: 'separate', documentId, pageId }), reading, pageId)
      const shown = read && !reading.full ? unresolvedAsText(read) : read
      contents.set(documentId, shown?.content ?? [])
    }
    const linked = view.properties.flatMap((property) => (property.type === 'pages' ? property.value : []))
    const titles = await pagesRepo.titlesOf(ctx.db, wiki.worldId, linked)
    // Las páginas enlazadas, por su título (o su ruta si se repite)
    const nameOf = linkName(await worldNames(ctx, wiki.worldId))
    const markdown = pageToMarkdown({
      properties: view.properties,
      body,
      separate: (documentId) => contents.get(documentId) ?? null,
      pageTitle: (id) => nameOf(id) || titles.get(id) || id,
      fileName: await fileNames(ctx, wiki.worldId),
      ids: ids ?? false
    })
    return { page: view, markdown, tables: (await pageTables(ctx, wiki, page, reading)).tables }
  }),

  implement(createPage, async (ctx, input) => {
    if (input.template) {
      // Con plantilla, por el mismo camino que crear_paginas (ADR-0009): sus campos, su panel y su texto, en una operación
      const wiki = await authorizedWiki(ctx, 'page.write', input.worldId)
      const parent = await parentIn(ctx, wiki, input.parentId)
      const [created] = await createBatch(
        ctx,
        {
          worldId: input.worldId,
          parentId: input.parentId,
          pages: [{ key: 'pagina', title: input.title, template: input.template }]
        },
        () => ({ action: 'createPage', details: { title: input.title, parent: parent?.title ?? null } })
      )
      if (!created) throw new InvalidRequestError('BAD_PAGE')
      return pageView(ctx, created.id)
    }
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
    // Bajo una página que alguna campaña conoce, nace oculta
    const hidden = parent ? await knownBySomeone(ctx, wiki.worldId, parent.id) : false
    const created = await pagesRepo.createPage(
      ctx.db,
      historyContext(ctx, 'createPage', { title: input.title, parent: parent?.title ?? null, hidden }, wiki),
      { worldId: wiki.worldId, title: input.title, placement: placementOf(input), hidden }
    )
    ctx.realtime.publish(pagesChanged(wiki))
    // Lo que la enlazaba antes de existir, ya la encuentra
    await resolvePending(ctx, wiki.worldId, ctx.actor.userId, [input.title])
    return pageView(ctx, created.id)
  }),

  implement(createPages, async (ctx, input) => {
    const pages = await createBatch(ctx, input, (ordered, parent) => ({
      action: 'createPages',
      details: { count: ordered.length, titles: ordered.map((page) => page.title), parent: parent?.title ?? null }
    }))
    return { pages }
  }),

  implement(editPage, async (ctx, input) => {
    const { page, wiki, player } = await writablePage(ctx, input)
    // Lo que se estaba escribiendo queda en su sesión, antes de lo de Claude
    await ctx.collab?.closeSessions(page.id)
    // Con plantilla: lo que le falta (campos, bloques y apartados al final), sin borrar nada (ADR-0009)
    const applied = input.template ? await applying(ctx, wiki, page, input.template) : null
    const bodyInput =
      input.body ??
      (applied?.applied.append ? { mode: 'append' as const, markdown: applied.applied.append } : undefined)
    const parsed = bodyInput ? parse(bodyInput.markdown) : null
    // Las propiedades: las que se dan; o, al cambiar el cuerpo entero, las de su YAML
    const fromYaml =
      bodyInput?.mode === 'replace' && parsed && parsed.properties.length > 0 ? parsed.properties : undefined
    const wanted = input.properties ?? fromYaml
    const properties = applied
      ? applied.applied.properties
      : wanted
        ? toProperties(wanted, (await pageResolver(ctx, wiki.worldId)).resolve, propertiesOf(page.properties))
        : undefined

    const stored = await documentsRepo.findBody(ctx.db, page.id)
    const changedSinceRequest = Boolean(ctx.requestedAt && stored && stored.updatedAt > ctx.requestedAt)
    const edit: BodyEdit | null = bodyInput
      ? bodyInput.mode === 'block'
        ? { mode: 'block', blockId: ('blockId' in bodyInput && bodyInput.blockId) || '' }
        : bodyInput.mode === 'section'
          ? { mode: 'section', section: ('section' in bodyInput && bodyInput.section) || '' }
          : { mode: bodyInput.mode }
      : null

    // El cuerpo nuevo, comprobado contra lo de ahora antes de apuntar nada
    let incoming: JSONContent[] = []
    if (edit && parsed) {
      const current = await readDocument(ctx, { kind: 'body', pageId: page.id })
      try {
        editBody(current, edit, [])
      } catch (error) {
        if (error instanceof EditTargetError) throw new InvalidRequestError(error.code)
        throw error
      }
      // Un bloque cambiado por otro del mismo tipo conserva su id (y un secreto, su documento)
      const read =
        edit.mode === 'block'
          ? keepBlockId(parsed, edit.blockId, current.content?.find((block) => block.attrs?.id === edit.blockId)?.type)
          : parsed
      const names = await worldNames(ctx, wiki.worldId)
      const files = await worldFiles(ctx, wiki.worldId)
      // Cada secreto: el que ya estaba (mismo id de bloque, de esta página) cambia su documento; uno nuevo, se crea
      // Una página que escriben jugadores no lleva secretos ni notas ocultas (docs/specs/pagina-de-jugadores.md)
      if (read.separates.length > 0 && (player || (await knowledgeRepo.isEdited(ctx.db, page.id))))
        throw new InvalidRequestError('PLAYER_PAGE', 'una página de jugadores no lleva secretos ni notas ocultas')
      const existing = separatesIn(current)
      const own = new Set(
        (await documentsRepo.documentsOfPages(ctx.db, [page.id])).filter((d) => d.kind !== 'body').map((d) => d.id)
      )
      const documents = new Map<string, string>()
      for (const separate of read.separates) {
        const before = existing.get(separate.id)
        const content = separateDoc(separate.content.map((block) => resolveIncoming(block, names, files)))
        if (before?.documentId && before.kind === separate.kind && own.has(before.documentId)) {
          await writeDocument(
            ctx,
            { kind: 'separate', documentId: before.documentId, pageId: page.id },
            { userId: ctx.actor.userId, worldId: wiki.worldId },
            () => content
          )
          documents.set(separate.id, before.documentId)
        } else {
          const documentId = await documentsRepo.createSeparate(ctx.db, {
            pageId: page.id,
            worldId: wiki.worldId,
            kind: separate.kind,
            state: stateOf(content, true),
            userId: ctx.actor.userId
          })
          documents.set(separate.id, documentId)
        }
      }
      incoming = withDocuments(resolveIncoming(read.body, names, files), documents).content ?? []
    }

    // Lo que queda en el historial: título, icono y propiedades se pueden deshacer; el cuerpo, con las versiones
    const details = {
      title: page.title,
      // El id, para que el historial pueda llevar a sus versiones
      pageId: page.id,
      ...(input.title !== undefined && input.title !== page.title ? { from: page.title, to: input.title } : {}),
      ...(properties ? { properties: true } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(bodyInput ? { body: bodyInput.mode } : {}),
      ...(applied ? { template: applied.template.name } : {})
    }
    const pagePatch = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(properties ? { properties } : {}),
      ...(applied
        ? { panel: applied.applied.panel, template: applied.template.id, templateLine: [...applied.template.line] }
        : {})
    }

    let changedBlocks: string[] = []
    if (edit) {
      try {
        await writeDocument(
          ctx,
          { kind: 'body', pageId: page.id },
          { userId: ctx.actor.userId, worldId: wiki.worldId },
          (current) => {
            const result = editBody(current, edit, incoming)
            changedBlocks = result.changed
            return result.body
          },
          () => changedBlocks
        )
      } catch (error) {
        if (error instanceof EditTargetError) throw new InvalidRequestError(error.code)
        throw error
      }
    }
    // Una sola operación: el cambio de la fila (título, icono, propiedades) y, si cambió el texto, su versión
    const context = historyContext(ctx, 'editPage', details, wiki)
    if (edit) {
      const via = ctx.via === 'ai' ? 'ai' : 'ui'
      await snapshotPage(ctx, context, { pageId: page.id, worldId: wiki.worldId, via }, pagePatch)
    } else await pagesRepo.updatePage(ctx.db, context, page.id, pagePatch)

    // Un título o un alias nuevos pueden resolver enlaces que los esperaban
    const aliases = properties?.find((p) => fold(p.name) === 'alias')
    const renamed = [...(input.title ? [input.title] : []), ...(aliases?.type === 'list' ? aliases.value : [])]
    if (renamed.length > 0) await resolvePending(ctx, wiki.worldId, ctx.actor.userId, renamed)
    ctx.realtime.publish(pagesChanged(wiki))
    return { page: await pageView(ctx, page.id), changedBlocks, changedSinceRequest }
  })
]
