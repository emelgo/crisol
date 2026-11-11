/**
 * Los archivos: sus filas, con historial (los bytes van en el almacenamiento, por su clave). Son de un mundo o comunes a
 * los de su organización (ADR-0005). El nombre no se repite en su ámbito entre los que no están en la papelera
 */
import { and, asc, eq, inArray, isNotNull, isNull, or, type SQL, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { fileFolders, files } from '../schema/files.ts'

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
  input: { organizationId: string; worldId: string | null; folderId?: string | null; name: string } & FileContent
) {
  return operation(db, context, (w) => w.insert(files, input))
}

export function updateFile(
  db: Database,
  context: OperationContext,
  fileId: string,
  patch: Partial<FileContent & { name: string; folderId: string | null; deletedAt: Date | null }>
) {
  return operation(db, context, (w) => w.update(files, fileId, patch))
}

/** Un puesto entre hermanas, para guardarlo */
export type Place = { id: string; position: string }

/**
 * Mueve un archivo a una carpeta de su ámbito (null: lo más alto) con su puesto entre los de allí (null: detrás, por
 * nombre) y, si se dan, los de sus hermanos (la primera vez que se ordenan, todos), en una sola operación
 */
export function moveFile(
  db: Database,
  context: OperationContext,
  fileId: string,
  to: { folderId: string | null; position: string | null },
  siblings: readonly Place[] = []
) {
  return operation(db, context, async (w) => {
    for (const { id, position } of siblings) await w.update(files, id, { position })
    return w.update(files, fileId, to)
  })
}

/** Los archivos de una carpeta de un ámbito (null: los de lo más alto), fuera de la papelera */
export function filesIn(db: Database, scope: FileScope, folderId: string | null) {
  return db
    .select({ id: files.id, name: files.name, position: files.position })
    .from(files)
    .where(
      and(
        inScope(scope),
        isNull(files.deletedAt),
        folderId === null ? isNull(files.folderId) : eq(files.folderId, folderId)
      )
    )
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

const folderInScope = (scope: FileScope): SQL | undefined =>
  'worldId' in scope
    ? eq(fileFolders.worldId, scope.worldId)
    : and(isNull(fileFolders.worldId), eq(fileFolders.organizationId, scope.organizationId))

/** Las carpetas de un ámbito (un mundo o los comunes de una organización), por nombre */
export function listFolders(db: Database, scope: FileScope) {
  return db
    .select()
    .from(fileFolders)
    .where(folderInScope(scope))
    .orderBy(asc(sql`lower(${fileFolders.name})`))
}

/** Las carpetas que se ven desde un mundo: las suyas y las de los comunes de su organización */
export function usableFolders(db: Database, worldId: string) {
  return db
    .select()
    .from(fileFolders)
    .where(
      or(
        eq(fileFolders.worldId, worldId),
        and(
          isNull(fileFolders.worldId),
          sql`${fileFolders.organizationId} = (select organization_id from worlds where id = ${worldId})`
        )
      )
    )
    .orderBy(asc(sql`lower(${fileFolders.name})`))
}

export async function findFolder(db: Database, folderId: string) {
  const [found] = await db.select().from(fileFolders).where(eq(fileFolders.id, folderId))
  return found ?? null
}

export function createFolder(
  db: Database,
  context: OperationContext,
  input: { organizationId: string; worldId: string | null; parentId: string | null; name: string }
) {
  return operation(db, context, (w) => w.insert(fileFolders, input))
}

/**
 * Cambia una carpeta (su nombre, su madre o su puesto entre sus hermanas) y, si se dan, los puestos de sus hermanas (la
 * primera vez que se ordenan, todas), en una sola operación
 */
export function updateFolder(
  db: Database,
  context: OperationContext,
  folderId: string,
  patch: Partial<{ name: string; parentId: string | null; position: string | null }>,
  siblings: readonly Place[] = []
) {
  return operation(db, context, async (w) => {
    for (const { id, position } of siblings) await w.update(fileFolders, id, { position })
    return w.update(fileFolders, folderId, patch)
  })
}

/** Las carpetas dentro de otra de un ámbito (null: las de lo más alto) */
export function foldersIn(db: Database, scope: FileScope, parentId: string | null) {
  return db
    .select({ id: fileFolders.id, name: fileFolders.name, position: fileFolders.position })
    .from(fileFolders)
    .where(
      and(folderInScope(scope), parentId === null ? isNull(fileFolders.parentId) : eq(fileFolders.parentId, parentId))
    )
}

/** Borra una carpeta con lo que tiene dentro (sus archivos, a la papelera), en una operación */
export function deleteFolder(db: Database, context: OperationContext, folderId: string) {
  return trashItems(db, context, { fileIds: [], folderIds: [folderId] })
}

/**
 * Borra de una vez (una operación, que se deshace entera) archivos y carpetas de un mismo ámbito: los archivos van a
 * la papelera, y las carpetas se quitan con todo lo que tengan dentro (sus archivos, a la papelera; sus carpetas,
 * también quitadas). Un archivo de la papelera vuelve a lo más alto (detrás, por nombre). Devuelve cuántos archivos fueron a la papelera
 */
export function trashItems(
  db: Database,
  context: OperationContext,
  items: { fileIds: readonly string[]; folderIds: readonly string[] }
) {
  return operation(db, context, async (w) => {
    // Las carpetas y todas las de dentro
    const gone = new Set<string>()
    let level = [...items.folderIds]
    while (level.length > 0) {
      for (const id of level) gone.add(id)
      const children = await w.read
        .select({ id: fileFolders.id })
        .from(fileFolders)
        .where(inArray(fileFolders.parentId, level))
      level = children.map((child) => child.id).filter((id) => !gone.has(id))
    }
    const inside =
      gone.size > 0
        ? await w.read
            .select({ id: files.id })
            .from(files)
            .where(and(inArray(files.folderId, [...gone]), isNull(files.deletedAt)))
        : []
    const fileIds = new Set([...items.fileIds, ...inside.map((file) => file.id)])
    const now = new Date()
    // Sin su puesto, que era el de su carpeta
    for (const id of fileIds) await w.update(files, id, { deletedAt: now, folderId: null, position: null })
    // De las de dentro a las de fuera (una madre no se quita antes que sus hijas)
    for (const id of [...gone].reverse()) await w.remove(fileFolders, id)
    return fileIds.size
  })
}
