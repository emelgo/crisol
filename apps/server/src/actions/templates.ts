/**
 * Las plantillas de página de la cuenta (ADR-0009, ADR-0024): se hacen desde cero o copiando otra, se cambian y se
 * borran. No hay de serie. Todo lo que escribe pasa por el historial
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
import { copyRepo, templatesRepo, worldsRepo } from '@crisol/db'
import { authorize, fieldKey, lineOf, NotFoundError, propertiesProblem, templateEmoji } from '@crisol/domain'
import { fillJsonIds } from '@crisol/editor'
import { pageFromMarkdown } from '@crisol/editor/markdown'
import { pagesChanged, templatesChanged } from '../realtime/events.ts'
import { writeDocument } from '../wiki/content.ts'
import { copyDocuments } from '../wiki/copy.ts'
import { checkTables } from '../wiki/tables.ts'
import {
  deletedTemplates,
  findTemplate,
  newFieldId,
  ownTemplate,
  templatePage,
  usableTemplates
} from '../wiki/templates.ts'
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

/** Que el nombre no lo tenga ya otra: se buscan por nombre */
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

  // Abrirla la pasa a su página, si aún no la tenía (las de antes del ADR-0024)
  implement(getTemplate, async (ctx, { templateId, organizationId }) => {
    const target = readableOrganization(ctx, organizationId)
    const row = await templatesRepo.findTemplate(ctx.db, templateId).catch(() => null)
    if (!row || row.deletedAt || row.organizationId !== target) throw new NotFoundError('template')
    const writable = ctx.actor.organizations.get(target) === 'owner'
    if (writable && !row.pageId) await templatePage(ctx, row)
    const fresh = (await templatesRepo.findTemplate(ctx.db, templateId)) ?? row
    return structuredClone(await ownTemplate(ctx, fresh)) as PageTemplate
  }),

  // Desde cero (una página vacía en el mundo de las plantillas) o copiando otra: su página entera, sin los enlaces
  implement(createTemplate, async (ctx, { organizationId, name, icon, copyOf }) => {
    const target = targetOrganization(ctx, organizationId)
    authorize(ctx.actor, 'templates.write', { organizationId: target })
    await checkName(ctx, target, name)
    const base = copyOf ? await findTemplate(ctx, target, copyOf) : null
    const id = randomUUID()
    const world = await worldsRepo.templatesWorld(ctx.db, target)
    const context = historyContext(
      ctx,
      'createTemplate',
      { name, copyOf: base?.name ?? null },
      { organizationId: target, worldId: world.id }
    )
    // Copiar conserva los ids de los campos (sus páginas salen en las mismas tablas) y su linaje
    const values = {
      id,
      organizationId: target,
      name,
      icon: '',
      basedOn: base?.id ?? null,
      line: lineOf(id, base?.line ?? null),
      fields: [],
      panel: [],
      skeleton: ''
    }
    const emoji = icon === undefined ? (base?.icon ?? null) : templateEmoji(icon ?? null)
    if (base) {
      const baseRow = await ownWritable(ctx, base.id)
      const pageId = await templatePage(ctx, baseRow)
      await copyRepo.copyPage(ctx.db, context, {
        sourceId: pageId,
        title: name,
        ...(await copyDocuments(ctx, pageId, world.id)),
        hidden: false,
        place: { worldId: world.id, parentId: null },
        overrides: { template: null, templateLine: [], icon: emoji },
        links: 'drop',
        alongside: async (w, page) => {
          await templatesRepo.insertTemplate(w, { ...values, pageId: page.id })
        }
      })
    } else {
      await templatesRepo.createTemplateWithPage(ctx.db, context, {
        worldId: world.id,
        page: { title: name, icon: emoji },
        template: values
      })
    }
    ctx.realtime.publish(templatesChanged(target), pagesChanged({ worldId: world.id, organizationId: target }))
    const row = await templatesRepo.findTemplate(ctx.db, id)
    if (!row) throw new NotFoundError('template')
    return (await ownTemplate(ctx, row)) as PageTemplate
  }),

  // En su página: nombre (su título), icono, campos (sus propiedades), panel y esqueleto (su texto)
  implement(updateTemplate, async (ctx, { templateId, name, icon, fields, panel, skeleton }) => {
    const row = await ownWritable(ctx, templateId)
    if (name !== undefined && name !== row.name) await checkName(ctx, row.organizationId, name, row.id)
    const checked = fields ? checkFields(fields) : undefined
    const current = await ownTemplate(ctx, row)
    if (panel) {
      // Sus tablas, contra las plantillas de ahora con esta ya cambiada (una tabla puede nombrarse a sí misma)
      const self = { ...current, ...(checked ? { fields: checked } : {}) }
      const against = (await usableTemplates(ctx, row.organizationId)).map((each) => (each.id === row.id ? self : each))
      await checkTables(ctx, row.organizationId, current.panel, panel, against)
    }
    const pageId = await templatePage(ctx, row)
    const world = await worldsRepo.templatesWorld(ctx.db, row.organizationId)
    const scope = { organizationId: row.organizationId, worldId: world.id }
    await templatesRepo.updateTemplatePage(
      ctx.db,
      historyContext(ctx, 'updateTemplate', { name: current.name }, scope),
      {
        templateId: row.id,
        pageId,
        page: {
          ...(name !== undefined ? { title: name } : {}),
          ...(icon !== undefined ? { icon: templateEmoji(icon) } : {}),
          ...(checked ? { properties: checked } : {}),
          ...(panel ? { panel } : {})
        }
      }
    )
    // El esqueleto es su texto: se escribe entero, como cualquier página (Yjs lo fusiona con lo que se edite a la vez)
    if (skeleton !== undefined) {
      await writeDocument(ctx, { kind: 'body', pageId }, { userId: ctx.actor.userId, worldId: world.id }, () =>
        fillJsonIds(pageFromMarkdown(skeleton).body)
      )
    }
    ctx.realtime.publish(templatesChanged(row.organizationId), pagesChanged(scope))
    const updated = (await templatesRepo.findTemplate(ctx.db, row.id)) ?? row
    return (await ownTemplate(ctx, updated)) as PageTemplate
  }),

  implement(deleteTemplate, async (ctx, { templateId }) => {
    const row = await ownWritable(ctx, templateId)
    const { name } = await ownTemplate(ctx, row)
    await templatesRepo.deleteTemplate(
      ctx.db,
      historyContext(ctx, 'deleteTemplate', { name }, { organizationId: row.organizationId }),
      row.id
    )
    ctx.realtime.publish(templatesChanged(row.organizationId))
    return { id: row.id, name }
  })
]
