/**
 * Los enlaces entre páginas (ADR-0003): salen del texto y se guardan en page_links con cada guardado. Los que van a una
 * página que aún no existe se quedan sin resolver, por su nombre; cuando aparece una página con ese nombre (al crearla,
 * renombrarla o darle un alias), se resuelven solos, también en el texto
 */
import { documentsRepo, knowledgeRepo, linksRepo, pagesRepo, worldsRepo } from '@crisol/db'
import { foldName, type NamedPage, reservedList, resolveName } from '@crisol/domain'
import type { JSONContent } from '@tiptap/core'
import { type ActionEnv, InvalidRequestError } from '../actions/context.ts'
import { pageContentChanged } from '../realtime/events.ts'
import { documentJson, patchDocument, patchDocuments, writeDocument } from './content.ts'
import { rebuildFileEmbeds, withResolvedFiles } from './file-embeds.ts'
import { editorsNames } from './player-pages.ts'
import { propertiesOf } from './properties.ts'
import { indexDocument, indexDocuments } from './search.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Los enlaces de un documento (también los incrustados, que llevan a una página), en el orden en que salen */
export function linksIn(
  json: JSONContent,
  found: { pageId: string | null; title: string; anchor: string | null }[] = []
) {
  // `[[#Sección]]` lleva a la misma página: no es un enlace a otra
  const sameSection = json.type === 'pageLink' && !json.attrs?.pageId && !String(json.attrs?.title ?? '').trim()
  if ((json.type === 'pageLink' || json.type === 'pageEmbed') && !sameSection) {
    const pageId = typeof json.attrs?.pageId === 'string' && UUID.test(json.attrs.pageId) ? json.attrs.pageId : null
    found.push({
      pageId,
      title: String(json.attrs?.title ?? ''),
      anchor: (json.attrs?.anchor as string | null) ?? null
    })
  }
  for (const child of json.content ?? []) linksIn(child, found)
  return found
}

/** Las páginas del mundo con sus nombres (título y alias) y su ruta, para resolver */
export async function worldNames(env: ActionEnv, worldId: string): Promise<NamedPage[]> {
  const rows = await pagesRepo.worldPages(env.db, worldId)
  const byId = new Map(rows.map((row) => [row.id, row]))
  const pathOf = (id: string, seen = new Set<string>()): string[] => {
    const row = byId.get(id)
    if (!row || seen.has(id)) return []
    seen.add(id)
    return [...(row.parentId ? pathOf(row.parentId, seen) : []), row.title]
  }
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    aliases: reservedList(propertiesOf(row.properties), 'alias'),
    path: pathOf(row.id)
  }))
}

/** Cómo se nombra una página en un enlace escrito: su título si es único; si no, su ruta */
export function linkName(names: readonly NamedPage[]) {
  const count = new Map<string, number>()
  for (const page of names) count.set(foldName(page.title), (count.get(foldName(page.title)) ?? 0) + 1)
  const byId = new Map(names.map((page) => [page.id, page]))
  return (id: string) => {
    const page = byId.get(id)
    if (!page) return ''
    return (count.get(foldName(page.title)) ?? 0) > 1 ? page.path.join('/') : page.title
  }
}

/**
 * Los enlaces de lo que escribe Claude, con su página: uno que lleva a una sola, resuelto; a ninguna, sin resolver;
 * a varias, no se adivina: Claude recibe las candidatas. Los archivos (`![[mapa.png]]`), por su nombre
 */
export function resolveIncoming(
  json: JSONContent,
  names: readonly NamedPage[],
  files: ReadonlyMap<string, string> = new Map()
): JSONContent {
  if (json.type === 'fileEmbed') return withResolvedFiles(json, files)
  if (
    (json.type === 'pageLink' || json.type === 'pageEmbed') &&
    !json.attrs?.pageId &&
    String(json.attrs?.title ?? '').trim()
  ) {
    const title = String(json.attrs?.title ?? '')
    const found = resolveName(title, names)
    if (found.length > 1) {
      const candidates = found.map((page) => `«${page.path.join('/')}»`).join(', ')
      throw new InvalidRequestError('AMBIGUOUS_PAGE', `[[${title}]] puede ser ${candidates}: escribe su ruta`)
    }
    return found[0] ? { ...json, attrs: { ...json.attrs, pageId: found[0].id } } : json
  }
  return json.content ? { ...json, content: json.content.map((child) => resolveIncoming(child, names, files)) } : json
}

/**
 * Rehace los enlaces que salen de un documento con lo que hay ahora en él. Devuelve los que llevan solo el nombre y ya
 * tienen página (nombre sin mayúsculas → id): hay que ponérsela también en el texto
 */
export async function rebuildLinks(
  env: ActionEnv,
  source: { worldId: string; pageId: string; documentId: string },
  json: JSONContent,
  names?: readonly NamedPage[],
  /** Un documento recién creado: sin enlaces que quitar */
  fresh = false
) {
  const links = linksIn(json)
  if (fresh && links.length === 0) return new Map<string, string>()
  // Por id, solo los de este mundo (aunque estén en la papelera: se ven rotos)
  const valid = await pagesRepo.inWorld(
    env.db,
    source.worldId,
    links.flatMap((link) => (link.pageId ? [link.pageId] : []))
  )
  const pending = links.filter((link) => !link.pageId || !valid.has(link.pageId))
  const world = pending.length > 0 ? (names ?? (await worldNames(env, source.worldId))) : []
  const byName = new Map<string, string>()
  await linksRepo.replaceLinks(
    env.db,
    source,
    links.map((link) => {
      const byId = link.pageId && valid.has(link.pageId) ? link.pageId : null
      const found = byId ? [] : resolveName(link.title, world)
      const named = found.length === 1 ? (found[0]?.id ?? null) : null
      if (named && !link.pageId) byName.set(foldName(link.title), named)
      return {
        targetPageId: byId ?? named,
        targetTitle: link.title,
        targetKey: foldName(link.title),
        anchor: link.anchor
      }
    })
  )
  return byName
}

/**
 * rebuildLinks para muchos documentos recién creados a la vez: una consulta para ver qué páginas existen y otra para
 * guardar todos los enlaces. Devuelve, por documento, los que se resolvieron por su nombre
 */
async function rebuildLinksMany(
  env: ActionEnv,
  docs: readonly { source: { worldId: string; pageId: string; documentId: string }; json: JSONContent }[],
  names: readonly NamedPage[]
) {
  const found = docs.map((doc) => ({ ...doc, links: linksIn(doc.json) }))
  const worldId = docs[0]?.source.worldId ?? ''
  const valid = await pagesRepo.inWorld(
    env.db,
    worldId,
    found.flatMap((doc) => doc.links.flatMap((link) => (link.pageId ? [link.pageId] : [])))
  )
  const byDocument = new Map<string, Map<string, string>>()
  await linksRepo.replaceLinksMany(
    env.db,
    found.map((doc) => {
      const byName = new Map<string, string>()
      byDocument.set(doc.source.documentId, byName)
      return {
        source: doc.source,
        links: doc.links.map((link) => {
          const byId = link.pageId && valid.has(link.pageId) ? link.pageId : null
          const matches = byId ? [] : resolveName(link.title, names)
          const named = matches.length === 1 ? (matches[0]?.id ?? null) : null
          if (named && !link.pageId) byName.set(foldName(link.title), named)
          return {
            targetPageId: byId ?? named,
            targetTitle: link.title,
            targetKey: foldName(link.title),
            anchor: link.anchor
          }
        })
      }
    })
  )
  return byDocument
}

/** Pone su página a los enlaces sin resolver de un documento que ya la tienen (por su nombre) */
function withResolved(json: JSONContent, resolved: ReadonlyMap<string, string>): JSONContent {
  if ((json.type === 'pageLink' || json.type === 'pageEmbed') && !json.attrs?.pageId) {
    const pageId = resolved.get(foldName(String(json.attrs?.title ?? '')))
    return pageId ? { ...json, attrs: { ...json.attrs, pageId } } : json
  }
  return json.content ? { ...json, content: json.content.map((child) => withResolved(child, resolved)) } : json
}

/**
 * Resuelve los enlaces que esperaban a estos nombres (de páginas recién creadas, renombradas o con alias nuevos): en
 * page_links y en el texto de sus documentos, que se cambian como los de Claude (en vivo si están abiertos). Solo si el
 * nombre lleva a una sola página
 */
export async function resolvePending(env: ActionEnv, worldId: string, actorId: string, names: readonly string[]) {
  const keys = [...new Set(names.map(foldName))].filter(Boolean)
  // Las páginas de jugadores se resuelven al guardarlas, contra lo que ven quienes las editan: aquí no
  const edited = await knowledgeRepo.editedPages(env.db, worldId)
  const waiting = (await linksRepo.unresolvedNamed(env.db, worldId, keys)).filter(
    (link) => !edited.has(link.sourcePageId)
  )
  if (waiting.length === 0) return
  const world = await worldNames(env, worldId)
  const byDocument = new Map<string, { kind: string; pageId: string; resolved: Map<string, string>; ids: string[] }>()
  const resolvedTo = new Map<string, string[]>()
  for (const link of waiting) {
    const found = resolveName(link.targetTitle, world)
    if (found.length !== 1 || !found[0]) continue
    const target = found[0].id
    resolvedTo.set(target, [...(resolvedTo.get(target) ?? []), link.id])
    const doc = byDocument.get(link.sourceDocumentId) ?? {
      kind: link.documentKind,
      pageId: link.sourcePageId,
      resolved: new Map<string, string>(),
      ids: []
    }
    doc.resolved.set(link.targetKey, target)
    byDocument.set(link.sourceDocumentId, doc)
  }
  for (const [target, ids] of resolvedTo) await linksRepo.resolveLinks(env.db, ids, target)
  await patchDocuments(
    env,
    { userId: actorId, worldId },
    [...byDocument].map(([documentId, doc]) => ({
      documentId,
      ref:
        doc.kind === 'body'
          ? ({ kind: 'body', pageId: doc.pageId } as const)
          : ({ kind: 'separate', documentId, pageId: doc.pageId } as const),
      change: (current: JSONContent) => withResolved(current, doc.resolved)
    }))
  )
}

/** Los enlaces de los documentos recién creados (sin pasar por Hocuspocus), y lo que esperaba a esas páginas */
export async function linksOfNewPages(
  env: ActionEnv,
  worldId: string,
  created: readonly { id: string; names: readonly string[] }[],
  actorId: string
) {
  const pageIds = created.map((page) => page.id)
  const names = await worldNames(env, worldId)
  const indexed: { documentId: string; json: JSONContent }[] = []
  const docs = (await documentsRepo.documentsWithState(env.db, pageIds)).map((doc) => {
    const ref =
      doc.kind === 'body'
        ? ({ kind: 'body', pageId: doc.pageId } as const)
        : ({ kind: 'separate', documentId: doc.id, pageId: doc.pageId } as const)
    return { ref, source: { worldId, pageId: doc.pageId, documentId: doc.id }, json: documentJson(env, ref, doc.state) }
  })
  const resolved = await rebuildLinksMany(env, docs, names)
  for (const { ref, source, json: read } of docs) {
    let json = read
    const byName = resolved.get(source.documentId) ?? new Map<string, string>()
    const filesByName = await rebuildFileEmbeds(env, source, json, true)
    // Lo que se resolvió por su nombre (de la tanda ya llevan su id) se pone también en el texto
    if (byName.size > 0 || filesByName.size > 0) {
      const resolve = (current: JSONContent) => withResolvedFiles(withResolved(current, byName), filesByName)
      await patchDocument(env, ref, { userId: actorId, worldId }, resolve)
      json = resolve(json)
    }
    indexed.push({ documentId: source.documentId, json })
  }
  await indexDocuments(env, indexed)
  await resolvePending(
    env,
    worldId,
    actorId,
    created.flatMap((page) => page.names)
  )
}

/** Tras guardar un documento en Hocuspocus: sus enlaces y su texto plano, de nuevo, y el aviso de que cambió */
export async function linksOfStored(
  env: ActionEnv,
  source: { worldId: string; pageId: string; documentId: string },
  json: JSONContent,
  { kind, actorId, onError }: { kind: 'body' | 'separate'; actorId: string | null; onError: (error: unknown) => void }
) {
  // Una página de jugadores: los nombres, contra lo que ven todos los que la editan; los archivos, nunca por su nombre
  const audience = await editorsNames(env, source.worldId, source.pageId)
  const byName = await rebuildLinks(env, source, json, audience ?? undefined)
  const filesByName = await rebuildFileEmbeds(env, source, json, false, audience === null)
  await indexDocument(env, source.documentId, json)
  // Lo que la enseña en otra página (vista previa, incrustados) se vuelve a pedir
  const world = await worldsRepo.findWorld(env.db, source.worldId)
  if (world) {
    env.realtime.publish(pageContentChanged({ worldId: world.id, organizationId: world.organizationId }, source.pageId))
  }
  // Un enlace con solo el nombre que ya tiene página: se le pone también en el texto, después (no dentro del guardado)
  if ((byName.size > 0 || filesByName.size > 0) && actorId) {
    const ref =
      kind === 'separate'
        ? ({ kind: 'separate', documentId: source.documentId, pageId: source.pageId } as const)
        : ({ kind: 'body', pageId: source.pageId } as const)
    setTimeout(() => {
      writeDocument(env, ref, { userId: actorId, worldId: source.worldId }, (current) =>
        withResolvedFiles(withResolved(current, byName), filesByName)
      ).catch(onError)
    }, 0)
  }
}
