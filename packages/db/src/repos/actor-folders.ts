/** Las carpetas de la pestaña Actores de una campaña (sin historial: es orden de la Mesa) */
import { and, asc, eq } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { actorFolderItems, actorFolders } from '../schema/actor-folders.ts'

export type ActorKind = 'character' | 'creature'

export async function listFolders(db: Database, campaignId: string) {
  const [folders, items] = await Promise.all([
    db
      .select({ id: actorFolders.id, name: actorFolders.name })
      .from(actorFolders)
      .where(eq(actorFolders.campaignId, campaignId))
      .orderBy(asc(actorFolders.createdAt), asc(actorFolders.id)),
    db
      .select({ kind: actorFolderItems.kind, id: actorFolderItems.actorId, folderId: actorFolderItems.folderId })
      .from(actorFolderItems)
      .where(eq(actorFolderItems.campaignId, campaignId))
  ])
  return { folders, items }
}

export async function findFolder(db: Database, campaignId: string, folderId: string) {
  const [found] = await db
    .select({ id: actorFolders.id, name: actorFolders.name })
    .from(actorFolders)
    .where(and(eq(actorFolders.id, folderId), eq(actorFolders.campaignId, campaignId)))
  return found ?? null
}

export async function createFolder(db: Database, campaignId: string, name: string) {
  const [row] = await db
    .insert(actorFolders)
    .values({ campaignId, name })
    .returning({ id: actorFolders.id, name: actorFolders.name })
  if (!row) throw new Error('La carpeta no se guardó')
  return row
}

export async function renameFolder(db: Database, folderId: string, name: string) {
  await db.update(actorFolders).set({ name }).where(eq(actorFolders.id, folderId))
}

/** La borra: lo que tenía vuelve a estar fuera de las carpetas */
export async function deleteFolder(db: Database, folderId: string) {
  await db.delete(actorFolders).where(eq(actorFolders.id, folderId))
}

/** Mete un personaje o una criatura en una carpeta (null: la saca) */
export async function moveToFolder(
  db: Database,
  input: { campaignId: string; kind: ActorKind; actorId: string; folderId: string | null }
) {
  const key = and(
    eq(actorFolderItems.campaignId, input.campaignId),
    eq(actorFolderItems.kind, input.kind),
    eq(actorFolderItems.actorId, input.actorId)
  )
  if (!input.folderId) return void (await db.delete(actorFolderItems).where(key))
  await db
    .insert(actorFolderItems)
    .values({ campaignId: input.campaignId, kind: input.kind, actorId: input.actorId, folderId: input.folderId })
    .onConflictDoUpdate({
      target: [actorFolderItems.campaignId, actorFolderItems.kind, actorFolderItems.actorId],
      set: { folderId: input.folderId }
    })
}
