/**
 * Las plantillas de página de una cuenta (ADR-0009, ADR-0024): cada una, una página del mundo oculto de la cuenta y
 * esta ficha. Todo lo que las escribe pasa por operation(): queda en el historial y se deshace. Borrar una la aparta
 * (deleted_at) sin tocar sus páginas
 */
import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation, type Writer } from '../operation.ts'
import { pages } from '../schema/pages.ts'
import { pageTemplates } from '../schema/templates.ts'
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
