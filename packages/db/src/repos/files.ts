/**
 * Los archivos: sus filas, con historial (los bytes van en el almacenamiento, por su clave). Son de un mundo o comunes a
 * los de su organización (ADR-0005). El nombre no se repite en su ámbito entre los que no están en la papelera
 */
import { and, asc, eq, inArray, isNotNull, isNull, or, type SQL, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { files } from '../schema/files.ts'

export type FileKind = 'image' | 'pdf' | 'other'

/** Dónde vive un archivo: en un mundo o, sin mundo, entre los comunes de una organización */
export type FileScope = { worldId: string } | { organizationId: string }

const inScope = (scope: FileScope): SQL | undefined =>
  'worldId' in scope
    ? eq(files.worldId, scope.worldId)
    : and(isNull(files.worldId), eq(files.organizationId, scope.organizationId))

/** Lo que un mundo puede usar: los suyos y los comunes de su organización */
const usableIn = (worldId: string): SQL | undefined =>
  or(
    eq(files.worldId, worldId),
    and(
      isNull(files.worldId),
      sql`${files.organizationId} = (select organization_id from worlds where id = ${worldId})`
    )
  )

export interface FileContent {
  kind: FileKind
  mime: string
  size: number
  hash: string
  storageKey: string
}

/** Un nombre libre en su ámbito: el pedido o, si ya está, «nombre (2).ext», «nombre (3).ext»… */
export async function freeName(db: Database, scope: FileScope, wanted: string, except?: string) {
  const rows = await db
    .select({ id: files.id, name: files.name })
    .from(files)
    .where(and(inScope(scope), isNull(files.deletedAt)))
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
  input: { organizationId: string; worldId: string | null; name: string } & FileContent
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

/** Un archivo (de un mundo o común); con trashed, también si está en la papelera */
export async function findFile(db: Database, fileId: string, options: { trashed?: boolean } = {}) {
  const [found] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), options.trashed ? undefined : isNull(files.deletedAt)))
  return found ?? null
}

/** Los archivos de un ámbito (un mundo o los comunes de una organización) fuera de la papelera, por nombre */
export function listFiles(db: Database, scope: FileScope) {
  return db
    .select()
    .from(files)
    .where(and(inScope(scope), isNull(files.deletedAt)))
    .orderBy(asc(sql`lower(${files.name})`))
}

/**
 * Los archivos que un mundo puede usar fuera de la papelera, por nombre: los suyos y los comunes de su organización
 * (`worldId` null). Un nombre en los dos: primero va el del mundo
 */
export function usableFiles(db: Database, worldId: string) {
  return db
    .select()
    .from(files)
    .where(and(usableIn(worldId), isNull(files.deletedAt)))
    .orderBy(asc(sql`lower(${files.name})`), sql`${files.worldId} is null`)
}

/** Los archivos en la papelera de un mundo */
export function trashedFiles(db: Database, worldId: string) {
  return db
    .select()
    .from(files)
    .where(and(eq(files.worldId, worldId), isNotNull(files.deletedAt)))
}

/** Los nombres de los archivos que el mundo puede usar (los suyos y los comunes), también los de la papelera */
export function namesInWorld(db: Database, worldId: string) {
  return db.select({ id: files.id, name: files.name }).from(files).where(usableIn(worldId))
}

/** De estos ids, los archivos que el mundo puede usar: suyos o comunes (también los de la papelera) */
export function filesInWorld(db: Database, worldId: string, ids: readonly string[]) {
  if (ids.length === 0) return Promise.resolve([])
  return db
    .select({ id: files.id })
    .from(files)
    .where(and(usableIn(worldId), inArray(files.id, [...ids])))
}
