/**
 * Las plantillas de página (ADR-0009): las de serie, que viven en el dominio y no se cambian, y las de la cuenta, que se
 * hacen desde cero o copiando otra, se cambian y se borran. Todo lo que escribe pasa por el historial
 */
import { randomUUID } from 'node:crypto'
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  type PageProperty,
  type PageTemplate,
  updateTemplate
} from '@crisol/contracts'
import { templatesRepo } from '@crisol/db'
import { authorize, fieldKey, lineOf, NotFoundError, propertiesProblem } from '@crisol/domain'
import { templatesChanged } from '../realtime/events.ts'
import { checkTables } from '../wiki/tables.ts'
import { deletedTemplates, findTemplate, newFieldId, ownTemplate, usableTemplates } from '../wiki/templates.ts'
import { targetOrganization } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

/** La organización de la que se ven las plantillas, si la cuenta puede verlas */
function readableOrganization(ctx: ActionContext, organizationId: string | undefined) {
  const target = targetOrganization(ctx, organizationId)
  authorize(ctx.actor, 'templates.read', { organizationId: target })
  return target
}

/** Una plantilla propia que se puede cambiar: de una organización que la cuenta administra, y no borrada */
async function ownWritable(ctx: ActionContext, templateId: string) {
  const row = await templatesRepo.findTemplate(ctx.db, templateId)
  if (!row || row.deletedAt) throw new NotFoundError('template')
  authorize(ctx.actor, 'templates.write', { organizationId: row.organizationId })
  return row
}

/** Que el nombre no lo tenga ya otra (tampoco una de serie): se buscan por nombre */
async function checkName(ctx: ActionContext, organizationId: string, name: string, self?: string) {
  const taken = (await usableTemplates(ctx, organizationId)).find(
    (each) => each.id !== self && fieldKey(each.name) === fieldKey(name)
  )
  if (taken) throw new InvalidRequestError('TEMPLATE_TAKEN', `ya hay una plantilla «${taken.name}»`)
}

/**
 * Los campos de una plantilla propia: los nuevos reciben su id; los enlaces, vacíos (una plantilla es de toda la cuenta,
 * no apunta a páginas de un mundo), y sin nombres ni ids repetidos
 */
function checkFields(fields: readonly PageProperty[]): PageProperty[] {
  const withIds = fields.map((field) => (field.field ? field : { ...field, field: newFieldId() }))
  if (withIds.some((field) => field.type === 'pages' && field.value.length > 0)) {
    throw new InvalidRequestError('BAD_FIELD', 'los campos de enlace de una plantilla van vacíos (value: [])')
  }
  const problem = propertiesProblem(withIds)
  if (problem) throw new InvalidRequestError(problem)
  return withIds
}

export const templateActions = [
  implement(listTemplates, async (ctx, { organizationId }) => {
    const target = readableOrganization(ctx, organizationId)
    return {
      templates: structuredClone([...(await usableTemplates(ctx, target))]) as PageTemplate[],
      deleted: await deletedTemplates(ctx, target)
    }
  }),

  implement(getTemplate, async (ctx, { templateId, organizationId }) => {
    const target = readableOrganization(ctx, organizationId)
    const found = (await usableTemplates(ctx, target)).find((each) => each.id === templateId)
    if (!found) throw new NotFoundError('template')
    return structuredClone(found) as PageTemplate
  }),

  implement(createTemplate, async (ctx, { organizationId, name, icon, copyOf }) => {
    const target = targetOrganization(ctx, organizationId)
    authorize(ctx.actor, 'templates.write', { organizationId: target })
    await checkName(ctx, target, name)
    const base = copyOf ? await findTemplate(ctx, target, copyOf) : null
    const id = randomUUID()
    // Copiar conserva los ids de los campos (sus páginas salen en las mismas tablas) y su linaje
    const row = await templatesRepo.createTemplate(
      ctx.db,
      historyContext(ctx, 'createTemplate', { name, copyOf: base?.name ?? null }, { organizationId: target }),
      {
        id,
        organizationId: target,
        name,
        icon,
        basedOn: base?.id ?? null,
        line: lineOf(id, base?.line ?? null),
        fields: structuredClone(base?.fields ?? []),
        panel: structuredClone(base?.panel ?? []),
        skeleton: base?.skeleton ?? ''
      }
    )
    ctx.realtime.publish(templatesChanged(target))
    return ownTemplate(row) as PageTemplate
  }),

  implement(updateTemplate, async (ctx, { templateId, name, icon, fields, panel, skeleton }) => {
    const row = await ownWritable(ctx, templateId)
    if (name !== undefined && name !== row.name) await checkName(ctx, row.organizationId, name, row.id)
    const checked = fields ? checkFields(fields) : undefined
    if (panel) {
      // Sus tablas, contra las plantillas de ahora con esta ya cambiada (una tabla puede nombrarse a sí misma)
      const self = { ...ownTemplate(row), ...(checked ? { fields: checked } : {}) }
      const against = (await usableTemplates(ctx, row.organizationId)).map((each) => (each.id === row.id ? self : each))
      await checkTables(ctx, row.organizationId, row.panel, panel, against)
    }
    const updated = await templatesRepo.updateTemplate(
      ctx.db,
      historyContext(ctx, 'updateTemplate', { name: row.name }, { organizationId: row.organizationId }),
      row.id,
      {
        ...(name !== undefined ? { name } : {}),
        ...(icon !== undefined ? { icon } : {}),
        ...(checked ? { fields: checked } : {}),
        ...(panel ? { panel } : {}),
        ...(skeleton !== undefined ? { skeleton } : {})
      }
    )
    ctx.realtime.publish(templatesChanged(row.organizationId))
    return ownTemplate(updated) as PageTemplate
  }),

  implement(deleteTemplate, async (ctx, { templateId }) => {
    const row = await ownWritable(ctx, templateId)
    await templatesRepo.deleteTemplate(
      ctx.db,
      historyContext(ctx, 'deleteTemplate', { name: row.name }, { organizationId: row.organizationId }),
      row.id
    )
    ctx.realtime.publish(templatesChanged(row.organizationId))
    return { id: row.id, name: row.name }
  })
]
