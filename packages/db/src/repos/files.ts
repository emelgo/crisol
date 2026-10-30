/**
 * Los archivos del mundo: sus filas, con historial (los bytes van en el almacenamiento, por su clave). El nombre no se
 * repite en el mundo entre los que no están en la papelera
 */
import { and, asc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { files } from '../schema/files.ts'

export type FileKind = 'image' | 'pdf' | 'other'

export interface FileContent {
  kind: FileKind
  mime: string
  size: number
  hash: string
  storageKey: string
}

/** Un nombre libre en el mundo: el pedido o, si ya está, «nombre (2).ext», «nombre (3).ext»… */
export async function freeName(db: Database, worldId: string, wanted: string, except?: string) {
  const rows = await db
    .select({ id: files.id, name: files.name })
    .from(files)
    .where(and(eq(files.worldId, worldId), isNull(files.deletedAt)))
  const taken = new Set(rows.filter((row) => row.id !== except).map((row) => row.name.toLocaleLowerCase('es')))
  if (!taken.has(wanted.toLocaleLowerCase('es'))) return wanted
  const dot = wanted.lastIndexOf('.')
  const [base, extension] = dot > 0 ? [wanted.slice(0, dot), wanted.slice(dot)] : [wanted, '']
  for (let n = 2; ; n++) {
    const name = `${base} (${n})${extension}`
    if (!taken.has(name.toLocaleLowerCase('es'))) return name
  }
}

export function createFile(
  db: Database,
  context: OperationContext,
  input: { worldId: string; name: string } & FileContent
) {
  return operation(db, context, (w) => w.insert(files, input))
}

export function updateFile(
  db: Database,
  context: OperationContext,
  fileId: string,
  patch: Partial<FileContent & { name: string; deletedAt: Date | null }>
) {
  return operation(db, context, (w) => w.update(files, fileId, patch))
}

/** Un archivo del mundo; con trashed, también si está en la papelera */
export async function findFile(db: Database, fileId: string, options: { trashed?: boolean } = {}) {
  const [found] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), options.trashed ? undefined : isNull(files.deletedAt)))
  return found ?? null
}

/** Los archivos del mundo fuera de la papelera, por nombre */
export function listFiles(db: Database, worldId: string) {
  return db
    .select()
    .from(files)
    .where(and(eq(files.worldId, worldId), isNull(files.deletedAt)))
    .orderBy(asc(sql`lower(${files.name})`))
}

/** Los archivos en la papelera de un mundo */
export function trashedFiles(db: Database, worldId: string) {
  return db
    .select()
    .from(files)
    .where(and(eq(files.worldId, worldId), isNotNull(files.deletedAt)))
}

/** Los nombres de los archivos del mundo, también los de la papelera */
export function namesInWorld(db: Database, worldId: string) {
  return db.select({ id: files.id, name: files.name }).from(files).where(eq(files.worldId, worldId))
}

/** De estos ids, los archivos que son de este mundo (también los de la papelera) */
export function filesInWorld(db: Database, worldId: string, ids: readonly string[]) {
  if (ids.length === 0) return Promise.resolve([])
  return db
    .select({ id: files.id })
    .from(files)
    .where(and(eq(files.worldId, worldId), inArray(files.id, [...ids])))
}
