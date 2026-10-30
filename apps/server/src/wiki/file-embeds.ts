/**
 * Los archivos que usa el texto (`![[mapa.png]]`): salen del texto y se guardan en file_embeds con cada guardado, como
 * los enlaces. Los que nombran un archivo que aún no está se quedan sin resolver, por su nombre; al subir (o renombrar,
 * o restaurar) uno que se llame así, se resuelven solos, también en el texto
 */
import { filesRepo, linksRepo } from '@crisol/db'
import { foldName } from '@crisol/domain'
import type { JSONContent } from '@tiptap/core'
import type { ActionEnv } from '../actions/context.ts'
import { patchDocument } from './content.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Los archivos que usa un documento, en el orden en que salen */
export function fileEmbedsIn(json: JSONContent, found: { fileId: string | null; name: string }[] = []) {
  if (json.type === 'fileEmbed') {
    const fileId = typeof json.attrs?.fileId === 'string' && UUID.test(json.attrs.fileId) ? json.attrs.fileId : null
    found.push({ fileId, name: String(json.attrs?.name ?? '') })
  }
  for (const child of json.content ?? []) fileEmbedsIn(child, found)
  return found
}

/** Los archivos del mundo fuera de la papelera, por su nombre sin mayúsculas */
export async function worldFiles(env: Pick<ActionEnv, 'db'>, worldId: string) {
  const rows = await filesRepo.listFiles(env.db, worldId)
  return new Map(rows.map((row) => [foldName(row.name), row.id]))
}

/** El nombre de ahora de cada archivo del mundo (también los de la papelera), para escribir el Markdown */
export async function fileNames(env: Pick<ActionEnv, 'db'>, worldId: string) {
  const rows = await filesRepo.namesInWorld(env.db, worldId)
  const byId = new Map(rows.map((row) => [row.id, row.name]))
  return (fileId: string) => byId.get(fileId)
}

/** Pone su archivo a los que aún no lo tienen y ya se encuentran por su nombre */
export function withResolvedFiles(json: JSONContent, byName: ReadonlyMap<string, string>): JSONContent {
  if (json.type === 'fileEmbed' && !json.attrs?.fileId) {
    const fileId = byName.get(foldName(String(json.attrs?.name ?? '')))
    return fileId ? { ...json, attrs: { ...json.attrs, fileId } } : json
  }
  return json.content ? { ...json, content: json.content.map((child) => withResolvedFiles(child, byName)) } : json
}

/**
 * Rehace los archivos que usa un documento. Devuelve los que llevan solo el nombre y ya tienen archivo (nombre sin
 * mayúsculas → id): hay que ponérselo también en el texto
 */
export async function rebuildFileEmbeds(
  env: ActionEnv,
  source: { worldId: string; pageId: string; documentId: string },
  json: JSONContent,
  /** Un documento recién creado: sin nada que quitar */
  fresh = false
) {
  const embeds = fileEmbedsIn(json)
  const byName = new Map<string, string>()
  if (embeds.length === 0) {
    if (fresh) return byName
    await linksRepo.replaceFileEmbeds(env.db, source, [])
    return byName
  }
  // Por id, solo los de este mundo (aunque estén en la papelera: se ven rotos)
  const ids = new Set(
    (
      await filesRepo.filesInWorld(
        env.db,
        source.worldId,
        embeds.flatMap((e) => (e.fileId ? [e.fileId] : []))
      )
    ).map((row) => row.id)
  )
  const pending = embeds.some((embed) => !embed.fileId || !ids.has(embed.fileId))
  const named = pending ? await worldFiles(env, source.worldId) : new Map<string, string>()
  await linksRepo.replaceFileEmbeds(
    env.db,
    source,
    embeds.map((embed) => {
      const key = foldName(embed.name)
      const byId = embed.fileId && ids.has(embed.fileId) ? embed.fileId : null
      const found = byId ? null : (named.get(key) ?? null)
      if (found && !embed.fileId) byName.set(key, found)
      return { fileId: byId ?? found, name: embed.name, nameKey: key }
    })
  )
  return byName
}

/**
 * Resuelve los archivos que esperaban a estos nombres (uno recién subido, renombrado o restaurado): en file_embeds y en
 * el texto de sus documentos, que se cambian como los de Claude (en vivo si están abiertos)
 */
export async function resolvePendingFiles(env: ActionEnv, worldId: string, actorId: string, names: readonly string[]) {
  const keys = [...new Set(names.map(foldName))].filter(Boolean)
  const waiting = await linksRepo.unresolvedFileEmbeds(env.db, worldId, keys)
  if (waiting.length === 0) return
  const files = await worldFiles(env, worldId)
  const byDocument = new Map<string, { kind: string; pageId: string; resolved: Map<string, string> }>()
  const byFile = new Map<string, string[]>()
  for (const embed of waiting) {
    const fileId = files.get(embed.nameKey)
    if (!fileId) continue
    byFile.set(fileId, [...(byFile.get(fileId) ?? []), embed.id])
    const doc = byDocument.get(embed.sourceDocumentId) ?? {
      kind: embed.documentKind,
      pageId: embed.sourcePageId,
      resolved: new Map<string, string>()
    }
    doc.resolved.set(embed.nameKey, fileId)
    byDocument.set(embed.sourceDocumentId, doc)
  }
  for (const [fileId, ids] of byFile) await linksRepo.resolveFileEmbeds(env.db, ids, fileId)
  for (const [documentId, doc] of byDocument) {
    const ref =
      doc.kind === 'body'
        ? ({ kind: 'body', pageId: doc.pageId } as const)
        : ({ kind: 'separate', documentId, pageId: doc.pageId } as const)
    await patchDocument(env, ref, { userId: actorId, worldId }, (current) => withResolvedFiles(current, doc.resolved))
  }
}
