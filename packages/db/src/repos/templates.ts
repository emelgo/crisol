/**
 * Las plantillas de página de una cuenta (ADR-0009). Todo lo que las escribe pasa por operation(): queda en el
 * historial y se deshace. Borrar una la aparta (deleted_at) sin tocar sus páginas
 */
import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm'
import type { Database } from '../client.ts'
import { type OperationContext, operation } from '../operation.ts'
import { pageTemplates } from '../schema/templates.ts'

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

export function updateTemplate(db: Database, context: OperationContext, id: string, patch: Partial<TemplateValues>) {
  return operation(db, context, (w) => w.update(pageTemplates, id, patch))
}

/** La aparta: deja de salir, pero sus páginas siguen diciendo de cuál salieron (y el historial la devuelve) */
export function deleteTemplate(db: Database, context: OperationContext, id: string) {
  return operation(db, context, (w) => w.update(pageTemplates, id, { deletedAt: new Date() }))
}
