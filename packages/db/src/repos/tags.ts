/**
 * Las etiquetas de la cuenta (ADR-0006): las guardadas (creadas a mano o con color) y las que llevan las páginas (en su
 * propiedad `etiquetas`) y los archivos (`files.tags`). Renombrar y borrar cambian todo lo que las lleva, en una sola
 * operación del historial
 */
import { removeTagIn, renameTagIn, tagKey, tagParent } from '@crisol/domain'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { files } from '../schema/files.ts'
import { pages } from '../schema/pages.ts'
import { tags } from '../schema/tags.ts'
import { worlds } from '../schema/worlds.ts'

type Property = { name: string; type: string; value: unknown }

const isTagsProperty = (property: Property) =>
  property.name.trim().toLocaleLowerCase('es') === 'etiquetas' && property.type === 'list'

/** Las etiquetas de unas propiedades de página */
export const tagsOfProperties = (properties: unknown[]): string[] => {
  const found = (properties as Property[]).find(isTagsProperty)
  return found && Array.isArray(found.value) ? (found.value as string[]) : []
}

/** Las mismas propiedades con otras etiquetas (vacías, sin la propiedad) */
const withTags = (properties: unknown[], next: string[]): unknown[] =>
  next.length === 0
    ? (properties as Property[]).filter((property) => !isTagsProperty(property))
    : (properties as Property[]).map((property) => (isTagsProperty(property) ? { ...property, value: next } : property))

/** Las guardadas de una organización */
export function listRows(db: Database, organizationId: string) {
  return db.select().from(tags).where(eq(tags.organizationId, organizationId))
}

/** Una guardada, por su nombre (sin mirar mayúsculas) */
export async function findRow(db: Database, organizationId: string, name: string) {
  const [found] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.organizationId, organizationId), sql`lower(${tags.name}) = ${tagKey(name)}`))
  return found ?? null
}

/** Las páginas con etiquetas de los mundos de una organización (fuera de la papelera), con su mundo */
export function taggedPages(db: Database, organizationId: string) {
  return db
    .select({ id: pages.id, worldId: pages.worldId, worldName: worlds.name, properties: pages.properties })
    .from(pages)
    .innerJoin(worlds, eq(worlds.id, pages.worldId))
    .where(
      and(
        eq(worlds.organizationId, organizationId),
        isNull(worlds.deletedAt),
        isNull(pages.deletedAt),
        sql`exists (select 1 from jsonb_array_elements(${pages.properties}) p
          where lower(trim(p->>'name')) = 'etiquetas' and p->>'type' = 'list')`
      )
    )
}

/** Los archivos con etiquetas de una organización (de sus mundos y comunes), fuera de la papelera */
export function taggedFiles(db: Database, organizationId: string) {
  return db
    .select({ id: files.id, tags: files.tags })
    .from(files)
    .where(and(eq(files.organizationId, organizationId), isNull(files.deletedAt), sql`cardinality(${files.tags}) > 0`))
}

export function createRow(
  db: Database,
  context: OperationContext,
  values: { organizationId: string; name: string; color: string | null }
) {
  return operation(db, context, (w) => w.insert(tags, values))
}

/** Les pone su puesto entre sus hermanas, todas de una vez; las que no estaban guardadas, se guardan */
export function setPositions(
  db: Database,
  context: OperationContext,
  organizationId: string,
  entries: readonly { name: string; position: string }[]
) {
  return operation(db, context, async (w) => {
    for (const { name, position } of entries) {
      const row = await findRow(w.read as unknown as Database, organizationId, name)
      if (row) await w.update(tags, row.id, { position })
      else await w.insert(tags, { organizationId, name, color: null, position })
    }
  })
}

/** Le pone color (null lo quita); si no estaba guardada, la guarda */
export function setColor(
  db: Database,
  context: OperationContext,
  organizationId: string,
  name: string,
  color: string | null
) {
  return operation(db, context, async (w) => {
    const row = await findRow(w.read as unknown as Database, organizationId, name)
    if (row) return w.update(tags, row.id, { color })
    return w.insert(tags, { organizationId, name, color })
  })
}

/**
 * Cambia una etiqueta (con sus hijas) en todo lo que la lleva: renombrar (to) o quitar (to null). Las guardadas
 * también: renombradas, o borradas. Si cambia de madre, pierde su puesto entre las hermanas de antes (sus hijas
 * conservan el suyo entre ellas). Devuelve cuántas páginas y archivos cambió
 */
export function retag(
  db: Database,
  context: OperationContext,
  organizationId: string,
  from: string,
  to: string | null
) {
  const change = (list: readonly string[]) => (to === null ? removeTagIn(list, from) : renameTagIn(list, from, to))
  return operation(db, context, async (w) => {
    const read = w.read as unknown as Database
    let pagesChanged = 0
    const worldsChanged = new Set<string>()
    for (const page of await taggedPages(read, organizationId)) {
      const next = change(tagsOfProperties(page.properties))
      if (!next) continue
      await w.update(pages, page.id, { properties: withTags(page.properties, next) })
      pagesChanged++
      worldsChanged.add(page.worldId)
    }
    let filesChanged = 0
    const filePlaces = new Set<string | null>()
    for (const file of await read
      .select({ id: files.id, tags: files.tags, worldId: files.worldId })
      .from(files)
      .where(and(eq(files.organizationId, organizationId), sql`cardinality(${files.tags}) > 0`))) {
      const next = change(file.tags)
      if (!next) continue
      await w.update(files, file.id, { tags: next })
      filesChanged++
      filePlaces.add(file.worldId)
    }
    // Las guardadas: la misma y sus hijas
    const rows = (await listRows(read, organizationId)).filter((row) => change([row.name]) !== null)
    for (const row of rows) {
      const next = change([row.name])
      const name = next?.[0]
      if (!name) {
        await w.remove(tags, row.id)
        continue
      }
      // Si ya hay una con el nombre nuevo, se queda esa (con su color, o el de esta si no tiene)
      const taken = await findRow(read, organizationId, name)
      if (taken && taken.id !== row.id) {
        if (!taken.color && row.color) await w.update(tags, taken.id, { color: row.color })
        await w.remove(tags, row.id)
      } else {
        const parentOf = (tag: string) => tagKey(tagParent(tag) ?? '')
        const leaves = tagKey(row.name) === tagKey(from) && parentOf(from) !== parentOf(name)
        await w.update(tags, row.id, leaves ? { name, position: null } : { name })
      }
    }
    return { pages: pagesChanged, files: filesChanged, worlds: [...worldsChanged], filePlaces: [...filePlaces] }
  })
}

/** Deja las etiquetas de un archivo */
export function setFileTags(db: Database, context: OperationContext, fileId: string, next: string[]) {
  return operation(db, context, (w) => w.update(files, fileId, { tags: next }))
}
