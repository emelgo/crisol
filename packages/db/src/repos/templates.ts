/**
 * Las plantillas de página de una cuenta (ADR-0009, ADR-0024): cada una, una página del mundo oculto de la cuenta y
 * esta ficha. Todo lo que las escribe pasa por operation(): queda en el historial y se deshace. Borrar una la aparta
 * (deleted_at) sin tocar sus páginas
 */
import { and, asc, count, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation, type Writer } from '../operation.ts'
import { pageTabs } from '../schema/maps.ts'
import { pages } from '../schema/pages.ts'
import { pageTemplates, templateFolders } from '../schema/templates.ts'
import { worlds } from '../schema/worlds.ts'
import { placeKey } from './pages.ts'

export type TemplateRow = typeof pageTemplates.$inferSelect

/** Las de una organización, en el orden en que se hicieron (las apartadas, aparte) */
export function listTemplates(db: Database, organizationId: string, deleted = false) {
  return db
    .select()
    .from(pageTemplates)
    .where(
      and(
        eq(pageTemplates.organizationId, organizationId),
        deleted ? isNotNull(pageTemplates.deletedAt) : isNull(pageTemplates.deletedAt)
      )
    )
    .orderBy(asc(pageTemplates.createdAt), asc(pageTemplates.id))
}

export async function findTemplate(db: Database, id: string) {
  const [found] = await db.select().from(pageTemplates).where(eq(pageTemplates.id, id))
  return found ?? null
}

/** La plantilla (sin borrar) cuya página es esa (ADR-0024); undefined si la página no es de ninguna */
export async function templateOfPage(db: Database, pageId: string) {
  const [row] = await db
    .select()
    .from(pageTemplates)
    .where(and(eq(pageTemplates.pageId, pageId), isNull(pageTemplates.deletedAt)))
  return row
}

export interface TemplateValues {
  name: string
  icon: string
  fields: unknown[]
  panel: unknown[]
  skeleton: string
}

/** Una nueva: desde cero o copiando otra (basedOn y su linaje). El id se da de antemano: va en su propio linaje */
export function createTemplate(
  db: Database,
  context: OperationContext,
  values: TemplateValues & { id: string; organizationId: string; basedOn: string | null; line: string[] }
) {
  return operation(db, context, (w) => w.insert(pageTemplates, values))
}

export function updateTemplate(
  db: Database,
  context: OperationContext,
  id: string,
  patch: Partial<TemplateValues & { pageId: string }>
) {
  return operation(db, context, (w) => w.update(pageTemplates, id, patch))
}

/** La ficha de una plantilla con su página ya hecha, dentro de una operación (la de la página) */
export const insertTemplate = (
  w: Writer,
  values: TemplateValues & {
    id: string
    organizationId: string
    basedOn: string | null
    line: string[]
    pageId: string
  }
) => w.insert(pageTemplates, values)

/** Una nueva desde cero: su página (vacía, en el mundo de las plantillas) y su ficha, en una sola operación */
export function createTemplateWithPage(
  db: Database,
  context: OperationContext,
  input: {
    worldId: string
    page: { title: string; icon: string | null }
    template: TemplateValues & { id: string; organizationId: string; basedOn: string | null; line: string[] }
  }
) {
  return operation(db, context, async (w) => {
    const position = await placeKey(w.read, input.worldId, { parentId: null })
    const page = await w.insert(pages, { worldId: input.worldId, position, ...input.page })
    return insertTemplate(w, { ...input.template, pageId: page.id })
  })
}

/** Cambia una plantilla en su página (nombre, icono, campos, panel) y su ficha (su nombre), en una sola operación */
export function updateTemplatePage(
  db: Database,
  context: OperationContext,
  input: {
    templateId: string
    pageId: string
    page: Partial<{ title: string; icon: string | null; properties: unknown[]; panel: unknown[] }>
  }
) {
  return operation(db, context, async (w) => {
    if (Object.keys(input.page).length > 0) await w.update(pages, input.pageId, input.page)
    const name = input.page.title
    return w.update(pageTemplates, input.templateId, name ? { name } : {})
  })
}

/** La aparta: deja de salir, pero sus páginas siguen diciendo de cuál salieron (y el historial la devuelve) */
export function deleteTemplate(db: Database, context: OperationContext, id: string) {
  return operation(db, context, (w) => w.update(pageTemplates, id, { deletedAt: new Date() }))
}

/** Un puesto que guardar: el de una hermana, la primera vez que se ordenan */
export type Place = { id: string; position: string }

/**
 * Mueve una plantilla a una carpeta (null: lo más alto) con su puesto entre las de allí (null: detrás, por nombre) y,
 * si se dan, los de sus hermanas (la primera vez que se ordenan, todas), en una sola operación
 */
export function moveTemplate(
  db: Database,
  context: OperationContext,
  templateId: string,
  to: { folderId: string | null; position: string | null },
  siblings: readonly Place[] = []
) {
  return operation(db, context, async (w) => {
    for (const { id, position } of siblings) await w.update(pageTemplates, id, { position })
    return w.update(pageTemplates, templateId, to)
  })
}

/**
 * Las plantillas de una carpeta (null: las de lo más alto), sin las apartadas: para ordenarlas. Su nombre, el de su
 * página (el que se ve), si la tiene
 */
export function templatesIn(db: Database, organizationId: string, folderId: string | null) {
  return db
    .select({
      id: pageTemplates.id,
      name: sql<string>`coalesce(${pages.title}, ${pageTemplates.name})`,
      position: pageTemplates.position
    })
    .from(pageTemplates)
    .leftJoin(pages, eq(pages.id, pageTemplates.pageId))
    .where(
      and(
        eq(pageTemplates.organizationId, organizationId),
        isNull(pageTemplates.deletedAt),
        folderId === null ? isNull(pageTemplates.folderId) : eq(pageTemplates.folderId, folderId)
      )
    )
}

export type TemplateFolderRow = typeof templateFolders.$inferSelect

/** Las carpetas de plantillas de una organización */
export function listTemplateFolders(db: Database, organizationId: string) {
  return db
    .select()
    .from(templateFolders)
    .where(eq(templateFolders.organizationId, organizationId))
    .orderBy(asc(sql`lower(${templateFolders.name})`))
}

export async function findTemplateFolder(db: Database, folderId: string) {
  const [found] = await db.select().from(templateFolders).where(eq(templateFolders.id, folderId))
  return found ?? null
}

/** Las carpetas dentro de otra (null: las de lo más alto): para ordenarlas */
export function templateFoldersIn(db: Database, organizationId: string, parentId: string | null) {
  return db
    .select({ id: templateFolders.id, name: templateFolders.name, position: templateFolders.position })
    .from(templateFolders)
    .where(
      and(
        eq(templateFolders.organizationId, organizationId),
        parentId === null ? isNull(templateFolders.parentId) : eq(templateFolders.parentId, parentId)
      )
    )
}

export function createTemplateFolder(
  db: Database,
  context: OperationContext,
  input: { organizationId: string; parentId: string | null; name: string }
) {
  return operation(db, context, (w) => w.insert(templateFolders, input))
}

/**
 * Cambia una carpeta (su nombre, su color, su icono, su madre o su puesto) y, si se dan, los puestos de sus hermanas,
 * en una sola operación
 */
export function updateTemplateFolder(
  db: Database,
  context: OperationContext,
  folderId: string,
  patch: Partial<{
    name: string
    parentId: string | null
    position: string | null
    color: string | null
    icon: string | null
  }>,
  siblings: readonly Place[] = []
) {
  return operation(db, context, async (w) => {
    for (const { id, position } of siblings) await w.update(templateFolders, id, { position })
    return w.update(templateFolders, folderId, patch)
  })
}

/**
 * Borra una carpeta con lo que tiene dentro, en una operación que se deshace entera: sus carpetas se quitan y sus
 * plantillas se apartan (como al borrar una; sus páginas no cambian). Devuelve cuántas plantillas se apartaron
 */
export function deleteTemplateFolder(db: Database, context: OperationContext, folderId: string) {
  return operation(db, context, async (w) => {
    const gone = new Set<string>()
    let level = [folderId]
    while (level.length > 0) {
      for (const id of level) gone.add(id)
      const children = await w.read
        .select({ id: templateFolders.id })
        .from(templateFolders)
        .where(inArray(templateFolders.parentId, level))
      level = children.map((child) => child.id).filter((id) => !gone.has(id))
    }
    const inside = await w.read
      .select({ id: pageTemplates.id })
      .from(pageTemplates)
      .where(and(inArray(pageTemplates.folderId, [...gone]), isNull(pageTemplates.deletedAt)))
    const now = new Date()
    // Apartadas y fuera de la carpeta (si vuelven solas, a lo más alto)
    for (const { id } of inside) await w.update(pageTemplates, id, { deletedAt: now, folderId: null, position: null })
    // De las de dentro a las de fuera (una madre no se quita antes que sus hijas)
    for (const id of [...gone].reverse()) await w.remove(templateFolders, id)
    return inside.length
  })
}

/** En cuántas páginas de los mundos de la organización (sin el de las plantillas ni la papelera) se usa cada una */
export async function templateUses(db: Database, organizationId: string, templateIds: readonly string[]) {
  if (templateIds.length === 0) return new Map<string, number>()
  const rows = await db
    .select({ template: pages.template, uses: count() })
    .from(pages)
    .innerJoin(worlds, eq(worlds.id, pages.worldId))
    .where(
      and(
        eq(worlds.organizationId, organizationId),
        isNull(worlds.purpose),
        isNull(pages.deletedAt),
        inArray(pages.template, [...templateIds])
      )
    )
    .groupBy(pages.template)
  return new Map(rows.map((row) => [row.template ?? '', row.uses]))
}

/** Las pestañas de unas páginas (las de unas plantillas), en su orden: su id, su nombre y su tipo */
export async function tabsOfPages(db: Database, pageIds: readonly string[]) {
  const byPage = new Map<string, { id: string; name: string; kind: (typeof pageTabs.$inferSelect)['kind'] }[]>()
  if (pageIds.length === 0) return byPage
  const rows = await db
    .select({ id: pageTabs.id, pageId: pageTabs.pageId, name: pageTabs.name, kind: pageTabs.kind })
    .from(pageTabs)
    .where(inArray(pageTabs.pageId, [...pageIds]))
    .orderBy(sql`${pageTabs.position} collate "C"`)
  for (const row of rows) {
    byPage.set(row.pageId, [...(byPage.get(row.pageId) ?? []), { id: row.id, name: row.name, kind: row.kind }])
  }
  return byPage
}
