/**
 * El contenido de las páginas en Markdown, para Claude (ADR-0003): leer una página, crear varias de una vez con su cuerpo
 * y cambiar una. Los secretos van siempre aparte: lo de dentro de un `> [!secreto]` se guarda en su propio documento y
 * nunca entra en el cuerpo
 */
import { randomUUID } from 'node:crypto'
import { createPages, editPage, type PageProperty, readPage } from '@crisol/contracts'
import { documentsRepo, pagesRepo } from '@crisol/db'
import { moveBlocker, propertiesProblem, reservedList } from '@crisol/domain'
import { fillJsonIds } from '@crisol/editor'
import {
  type BodyEdit,
  EditTargetError,
  editBody,
  FrontmatterError,
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
import { propertiesOf } from '../wiki/properties.ts'
import { snapshotPage, versionOf } from '../wiki/versions.ts'
import { authorizedPage, authorizedWiki } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { pageView, parentIn } from './pages.ts'
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
async function pageResolver(ctx: ActionContext, worldId: string) {
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
    add(row.id, row.title, reservedList(propertiesOf(row.properties), 'alias'))
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

/** Las propiedades tal como se guardan: las de páginas, con sus ids */
function toProperties(read: readonly ReadProperty[], resolve: (name: string) => string): PageProperty[] {
  const properties = read.map(
    (property): PageProperty =>
      property.type === 'pages' ? { ...property, value: [...new Set(property.value.map(resolve))] } : property
  )
  const problem = propertiesProblem(properties)
  if (problem) throw new InvalidRequestError(problem)
  return properties
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

export const pageContentActions = [
  implement(readPage, async (ctx, { pageId, ids }) => {
    const { wiki } = await authorizedPage(ctx, 'page.read', pageId)
    const view = await pageView(ctx, pageId)
    const body = await readDocument(ctx, { kind: 'body', pageId })
    // Solo los secretos que son de esta página
    const own = new Set(
      (await documentsRepo.documentsOfPages(ctx.db, [pageId])).filter((d) => d.kind !== 'body').map((d) => d.id)
    )
    const contents = new Map<string, JSONContent[]>()
    for (const { documentId } of separatesIn(body).values()) {
      if (!documentId || !own.has(documentId)) continue
      contents.set(documentId, (await readDocument(ctx, { kind: 'separate', documentId, pageId })).content ?? [])
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
    return { page: view, markdown }
  }),

  implement(createPages, async (ctx, input) => {
    const wiki = await authorizedWiki(ctx, 'page.write', input.worldId)
    const parent = await parentIn(ctx, wiki, input.parentId)
    const { ordered, height } = inOrder(input.pages)
    const parentPath = parent ? (await pagesRepo.pagePath(ctx.db, parent.id)).map((p) => p.id) : []
    const blocker = moveBlocker({ pageId: '', parentPath, subtreeHeight: height })
    if (blocker) throw new InvalidRequestError(blocker)

    // Todo se lee y se comprueba antes de escribir nada. Los enlaces, contra las páginas del mundo y las de la tanda,
    // que ya tienen su id: así salen resueltos sin volver a escribir el texto (lo que no está, se resuelve al crearlo)
    const pageIds = new Map(ordered.map((page) => [page.key, randomUUID()]))
    const reads = new Map(ordered.map((page) => [page.key, parse(page.markdown ?? '')]))
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
      const newPage: pagesRepo.NewPage = {
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
    const created = await pagesRepo.createPagesWithBodies(
      ctx.db,
      historyContext(
        ctx,
        'createPages',
        { count: ordered.length, titles: ordered.map((page) => page.title), parent: parent?.title ?? null },
        wiki
      ),
      {
        worldId: wiki.worldId,
        parentId: parent?.id ?? null,
        pages: prepared.map((page) => page.newPage),
        // Las de la tanda también se pueden enlazar, por su título o sus alias
        properties: (ids) => {
          for (const { newPage, properties } of prepared) {
            const aliases = properties.find((p) => fold(p.name) === 'alias')
            resolver.add(ids.get(newPage.key) as string, newPage.title, aliases?.type === 'list' ? aliases.value : [])
          }
          return new Map(
            prepared.map(({ newPage, properties }) => [newPage.key, toProperties(properties, resolver.resolve)])
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
    return { pages: input.pages.map((page) => byKey.get(page.key)).filter((page) => page !== undefined) }
  }),

  implement(editPage, async (ctx, input) => {
    const { page, wiki } = await authorizedPage(ctx, 'page.write', input.pageId)
    // Lo que se estaba escribiendo queda en su sesión, antes de lo de Claude
    await ctx.collab?.closeSessions(page.id)
    const read = input.body ? parse(input.body.markdown) : null
    // Las propiedades: las que se dan; o, al cambiar el cuerpo entero, las de su YAML
    const fromYaml = input.body?.mode === 'replace' && read && read.properties.length > 0 ? read.properties : undefined
    const wanted = input.properties ?? fromYaml
    const properties = wanted ? toProperties(wanted, (await pageResolver(ctx, wiki.worldId)).resolve) : undefined

    const stored = await documentsRepo.findBody(ctx.db, page.id)
    const changedSinceRequest = Boolean(ctx.requestedAt && stored && stored.updatedAt > ctx.requestedAt)
    const edit: BodyEdit | null = input.body
      ? input.body.mode === 'block'
        ? { mode: 'block', blockId: input.body.blockId ?? '' }
        : input.body.mode === 'section'
          ? { mode: 'section', section: input.body.section ?? '' }
          : { mode: input.body.mode }
      : null

    // El cuerpo nuevo, comprobado contra lo de ahora antes de apuntar nada
    let incoming: JSONContent[] = []
    if (edit && read) {
      const current = await readDocument(ctx, { kind: 'body', pageId: page.id })
      try {
        editBody(current, edit, [])
      } catch (error) {
        if (error instanceof EditTargetError) throw new InvalidRequestError(error.code)
        throw error
      }
      const names = await worldNames(ctx, wiki.worldId)
      const files = await worldFiles(ctx, wiki.worldId)
      // Cada secreto: el que ya estaba (mismo id de bloque, de esta página) cambia su documento; uno nuevo, se crea
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
      ...(input.body ? { body: input.body.mode } : {})
    }
    const pagePatch = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(properties ? { properties } : {})
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
