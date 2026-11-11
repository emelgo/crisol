/**
 * Las plantillas de página de la cuenta (ADR-0009, ADR-0024): se hacen desde cero o copiando otra, se cambian y se
 * borran. No hay de serie. Todo lo que escribe pasa por el historial
 */
import { randomUUID } from 'node:crypto'
import {
  addTemplateTabs,
  createTemplate,
  createTemplateFolder,
  deleteTemplate,
  deleteTemplateFolder,
  getTemplate,
  listTemplates,
  MAX_PAGE_TABS,
  moveTemplate,
  type PageProperty,
  type TemplateFolder,
  updateTemplate,
  updateTemplateFolder
} from '@crisol/contracts'
import { copyRepo, mapsRepo, pagesRepo, templatesRepo, worldsRepo } from '@crisol/db'
import { authorize, fieldKey, lineOf, NotFoundError, propertiesProblem, templateEmoji } from '@crisol/domain'
import { fillJsonIds } from '@crisol/editor'
import { pageFromMarkdown } from '@crisol/editor/markdown'
import { pagesChanged, templatesChanged } from '../realtime/events.ts'
import { writeDocument } from '../wiki/content.ts'
import { copyDocuments } from '../wiki/copy.ts'
import { linksOfNewPages } from '../wiki/links.ts'
import { checkTables } from '../wiki/tables.ts'
import {
  deletedTemplates,
  findTemplate,
  newFieldId,
  ownTemplate,
  templatePage,
  templateView,
  templateViews,
  usableTemplates
} from '../wiki/templates.ts'
import { authorizedPage, targetOrganization } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { nameTaken, placeBeside } from './files.ts'
import { tabView } from './maps.ts'
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

/**
 * El título de la página de una plantilla es su nombre (ADR-0024): al cambiarlo, que no lo tenga ya otra. Devuelve su
 * organización (para avisar a sus listas) o null si la página no es de ninguna plantilla
 */
export async function checkTemplateTitle(ctx: ActionContext, pageId: string, title: string | undefined) {
  const row = await templatesRepo.templateOfPage(ctx.db, pageId)
  if (!row) return null
  if (title !== undefined) await checkName(ctx, row.organizationId, title, row.id)
  return row.organizationId
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

/** Una carpeta de plantillas, como la da la API */
const folderView = (row: templatesRepo.TemplateFolderRow): TemplateFolder => ({
  id: row.id,
  parentId: row.parentId,
  name: row.name,
  position: row.position,
  color: row.color as TemplateFolder['color'],
  icon: row.icon
})

/** Una carpeta de plantillas que la cuenta puede cambiar */
async function writableFolder(ctx: ActionContext, folderId: string) {
  const folder = await templatesRepo.findTemplateFolder(ctx.db, folderId)
  if (!folder) throw new NotFoundError('folder')
  authorize(ctx.actor, 'templates.write', { organizationId: folder.organizationId })
  return folder
}

/** Una carpeta de destino: de la misma cuenta (null: lo más alto, siempre vale) */
async function folderOf(ctx: ActionContext, organizationId: string, folderId: string | null | undefined) {
  if (!folderId) return null
  const folder = await templatesRepo.findTemplateFolder(ctx.db, folderId)
  if (!folder || folder.organizationId !== organizationId) throw new InvalidRequestError('BAD_FOLDER')
  return folder
}

const folderTaken = (name: string) => new InvalidRequestError('NAME_TAKEN', `Ya hay una carpeta «${name}» ahí`)

export const templateActions = [
  implement(listTemplates, async (ctx, { organizationId }) => {
    const target = readableOrganization(ctx, organizationId)
    const [rows, folders] = await Promise.all([
      templatesRepo.listTemplates(ctx.db, target),
      templatesRepo.listTemplateFolders(ctx.db, target)
    ])
    return {
      templates: await templateViews(ctx, target, rows),
      folders: folders.map(folderView),
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
    return templateView(ctx, fresh)
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
    return templateView(ctx, row)
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
    return templateView(ctx, updated)
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
  }),

  // Las carpetas, como las de archivos: solo ordenan
  implement(createTemplateFolder, async (ctx, { organizationId, parentId, name }) => {
    const target = targetOrganization(ctx, organizationId)
    authorize(ctx.actor, 'templates.write', { organizationId: target })
    await folderOf(ctx, target, parentId)
    try {
      const folder = await templatesRepo.createTemplateFolder(
        ctx.db,
        historyContext(ctx, 'createTemplateFolder', { name }, { organizationId: target }),
        { organizationId: target, parentId, name }
      )
      ctx.realtime.publish(templatesChanged(target))
      return folderView(folder)
    } catch (error) {
      if (nameTaken(error)) throw folderTaken(name)
      throw error
    }
  }),

  implement(updateTemplateFolder, async (ctx, { folderId, name, color, icon, parentId, before, after }) => {
    const folder = await writableFolder(ctx, folderId)
    const organizationId = folder.organizationId
    if (parentId) {
      await folderOf(ctx, organizationId, parentId)
      // Ni dentro de sí misma ni de una de las suyas
      for (
        let at: string | null = parentId;
        at;
        at = (await templatesRepo.findTemplateFolder(ctx.db, at))?.parentId ?? null
      ) {
        if (at === folderId) throw new InvalidRequestError('CYCLE')
      }
    }
    // Su puesto entre las carpetas de su destino (sin parentId, la de ahora); al cambiar de carpeta sin él, ninguno
    const destination = parentId === undefined ? folder.parentId : parentId
    const moves = destination !== folder.parentId
    const placed = await placeBeside(
      () => templatesRepo.templateFoldersIn(ctx.db, organizationId, destination),
      folderId,
      { before, after }
    )
    const renamed = name !== undefined && name !== folder.name
    const [action, details] = renamed
      ? ['updateTemplateFolder', { from: folder.name, to: name }]
      : placed && !moves
        ? ['orderTemplateFolder', { name: folder.name }]
        : ['updateTemplateFolder', { name: folder.name }]
    try {
      const updated = await templatesRepo.updateTemplateFolder(
        ctx.db,
        historyContext(ctx, action, details, { organizationId }),
        folderId,
        {
          ...(name !== undefined ? { name } : {}),
          ...(color !== undefined ? { color } : {}),
          ...(icon !== undefined ? { icon } : {}),
          ...(parentId !== undefined ? { parentId } : {}),
          ...(placed ? { position: placed.own } : moves ? { position: null } : {})
        },
        placed?.others
      )
      ctx.realtime.publish(templatesChanged(organizationId))
      return folderView(updated)
    } catch (error) {
      if (nameTaken(error)) throw folderTaken(name ?? folder.name)
      throw error
    }
  }),

  implement(deleteTemplateFolder, async (ctx, { folderId }) => {
    const folder = await writableFolder(ctx, folderId)
    const templates = await templatesRepo.deleteTemplateFolder(
      ctx.db,
      historyContext(ctx, 'deleteTemplateFolder', { name: folder.name }, { organizationId: folder.organizationId }),
      folderId
    )
    ctx.realtime.publish(templatesChanged(folder.organizationId))
    return { id: folder.id, name: folder.name, templates }
  }),

  implement(moveTemplate, async (ctx, { templateId, folderId, before, after }) => {
    const row = await ownWritable(ctx, templateId)
    const folder = await folderOf(ctx, row.organizationId, folderId)
    const moves = row.folderId !== folderId
    // Su puesto entre las plantillas de esa carpeta; al cambiar de carpeta sin él, ninguno (detrás, por nombre)
    const placed = await placeBeside(
      () => templatesRepo.templatesIn(ctx.db, row.organizationId, folderId),
      templateId,
      { before, after }
    )
    if (moves || placed) {
      const { name } = await ownTemplate(ctx, row)
      await templatesRepo.moveTemplate(
        ctx.db,
        moves
          ? historyContext(
              ctx,
              'moveTemplate',
              { name, folder: folder?.name ?? null },
              { organizationId: row.organizationId }
            )
          : historyContext(ctx, 'orderTemplate', { name }, { organizationId: row.organizationId }),
        templateId,
        { folderId, position: placed?.own ?? null },
        placed?.others
      )
      ctx.realtime.publish(templatesChanged(row.organizationId))
    }
    return templateView(ctx, (await templatesRepo.findTemplate(ctx.db, templateId)) ?? row)
  }),

  // «Pestaña nueva» desde una plantilla: sus pestañas (las elegidas), copiadas detrás de las de la página
  implement(addTemplateTabs, async (ctx, { pageId, templateId, tabIds }) => {
    const { page, wiki } = await authorizedPage(ctx, 'page.write', pageId)
    const template = await findTemplate(ctx, wiki.organizationId, templateId)
    const row = await templatesRepo.findTemplate(ctx.db, template.id)
    if (!row) throw new NotFoundError('template')
    const sourceId = await templatePage(ctx, row)
    const source = await pagesRepo.findPage(ctx.db, sourceId)
    if (!source) throw new NotFoundError('template')
    const theirs = await mapsRepo.listTabs(ctx.db, sourceId)
    const chosen = tabIds ?? theirs.map((tab) => tab.id)
    if (chosen.length === 0)
      throw new InvalidRequestError('NO_TABS', `la plantilla «${template.name}» no trae pestañas`)
    if (chosen.some((id) => !theirs.some((tab) => tab.id === id))) {
      throw new InvalidRequestError('BAD_TAB', 'esas pestañas no son de la plantilla: mira ver_plantilla')
    }
    const mine = await mapsRepo.listTabs(ctx.db, pageId)
    if (mine.length + chosen.length > MAX_PAGE_TABS) {
      throw new InvalidRequestError('TOO_MANY_TABS', `como mucho ${MAX_PAGE_TABS}`)
    }
    const { tabDocuments } = await copyDocuments(ctx, sourceId, source.worldId)
    const made = await copyRepo.addTabsFrom(
      ctx.db,
      historyContext(ctx, 'addTemplateTabs', { title: page.title, name: template.name, count: chosen.length }, wiki),
      { sourceId, pageId, worldId: wiki.worldId, tabIds: chosen, tabDocuments }
    )
    ctx.realtime.publish(pagesChanged(wiki))
    // Lo que enlazan sus textos, como al crear una página
    await linksOfNewPages(ctx, wiki.worldId, [{ id: page.id, names: [page.title] }], ctx.actor.userId)
    return { tabs: made.map(tabView) }
  })
]
