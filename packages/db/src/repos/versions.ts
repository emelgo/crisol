/**
 * Las versiones del texto de las páginas (ADR-0003). Una versión es cómo estaban el cuerpo y los secretos de una página;
 * page_bodies dice en cuál está, y es lo que toca la operación del historial (solo ids y huellas)
 */
import { and, desc, eq } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation, type Writer } from '../operation.ts'
import { pages } from '../schema/pages.ts'
import { pageBodies, pageVersions, snapshots, versionDocuments } from '../schema/versions.ts'

export interface DocumentState {
  documentId: string
  kind: 'body' | 'secret' | 'note'
  state: Uint8Array
  /** La huella del estado (para compartirlo entre versiones si no cambió) */
  hash: string
}

export interface NewVersion {
  pageId: string
  worldId: string
  actorId: string | null
  via: 'ui' | 'ai' | 'system'
  /** La huella del contenido de la página */
  fingerprint: string
  documents: readonly DocumentState[]
}

/** Apunta una versión y deja page_bodies en ella, dentro de una operación. Devuelve su id */
export async function recordVersion(w: Writer, input: NewVersion) {
  const tx = w.read
  const [version] = await tx
    .insert(pageVersions)
    .values({ pageId: input.pageId, worldId: input.worldId, createdBy: input.actorId, via: input.via })
    .returning({ id: pageVersions.id })
  if (!version) throw new Error('No se pudo guardar la versión')
  for (const doc of input.documents) {
    await tx
      .insert(snapshots)
      .values({ documentId: doc.documentId, hash: doc.hash, state: doc.state })
      .onConflictDoNothing({ target: [snapshots.documentId, snapshots.hash] })
    const [snapshot] = await tx
      .select({ id: snapshots.id })
      .from(snapshots)
      .where(and(eq(snapshots.documentId, doc.documentId), eq(snapshots.hash, doc.hash)))
    if (!snapshot) throw new Error('No se pudo guardar el estado')
    await tx
      .insert(versionDocuments)
      .values({ versionId: version.id, documentId: doc.documentId, kind: doc.kind, snapshotId: snapshot.id })
  }
  const [body] = await tx.select({ id: pageBodies.id }).from(pageBodies).where(eq(pageBodies.pageId, input.pageId))
  if (body) await w.update(pageBodies, body.id, { versionId: version.id, fingerprint: input.fingerprint })
  else
    await w.insert(pageBodies, {
      pageId: input.pageId,
      worldId: input.worldId,
      versionId: version.id,
      fingerprint: input.fingerprint
    })
  return version.id
}

/**
 * Una operación que cambia el texto de una página (cerrar una sesión de edición, lo que escribe Claude): su versión,
 * y, si se da, lo que cambia en la fila de la página. Si el contenido no cambió y no hay nada más, no se apunta nada
 */
export function recordEdit(
  db: Database,
  context: OperationContext,
  input: NewVersion & { pagePatch?: { title?: string; icon?: string | null; properties?: unknown[] } }
) {
  return operation(db, context, async (w) => {
    if (input.pagePatch && Object.keys(input.pagePatch).length > 0) await w.update(pages, input.pageId, input.pagePatch)
    const [body] = await w.read
      .select({ fingerprint: pageBodies.fingerprint })
      .from(pageBodies)
      .where(eq(pageBodies.pageId, input.pageId))
    if (body?.fingerprint === input.fingerprint) return null
    return recordVersion(w, input)
  })
}

/** En qué versión está el texto de una página, y con qué huella */
export async function pageBody(db: Database, pageId: string) {
  const [found] = await db.select().from(pageBodies).where(eq(pageBodies.pageId, pageId))
  return found ?? null
}

/** Los documentos de una versión, con su estado */
export function versionDocumentsOf(db: Database, versionId: string) {
  return db
    .select({ documentId: versionDocuments.documentId, kind: versionDocuments.kind, state: snapshots.state })
    .from(versionDocuments)
    .innerJoin(snapshots, eq(snapshots.id, versionDocuments.snapshotId))
    .where(eq(versionDocuments.versionId, versionId))
}

/** Las versiones de una página, de la más reciente a la más antigua */
export function listVersions(db: Database, pageId: string) {
  return db
    .select({
      id: pageVersions.id,
      createdBy: pageVersions.createdBy,
      via: pageVersions.via,
      createdAt: pageVersions.createdAt
    })
    .from(pageVersions)
    .where(eq(pageVersions.pageId, pageId))
    .orderBy(desc(pageVersions.createdAt))
}
