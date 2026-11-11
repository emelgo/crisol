/**
 * Las plantillas con las que se crean páginas (ADR-0009, ADR-0024): las de la cuenta (no hay de serie). Cada una es una
 * página del mundo oculto de la cuenta, y de ella se lee (nombre, icono, campos, panel y su texto como esqueleto); la
 * que aún no la tiene (de antes), de lo que guardaba su ficha, hasta que se abre y pasa a su página
 */
import { randomBytes } from 'node:crypto'
import { type PageTemplate, pagePanel } from '@crisol/contracts'
import { pagesRepo, templatesRepo, worldsRepo } from '@crisol/db'
import { fieldKey, templateEmoji } from '@crisol/domain'
import { fillJsonIds } from '@crisol/editor'
import { pageFromMarkdown, pageToMarkdown } from '@crisol/editor/markdown'
import { type ActionContext, historyContext, InvalidRequestError } from '../actions/context.ts'
import { readDocument, stateOf } from './content.ts'
import { propertiesOf } from './properties.ts'

/** Una plantilla de la cuenta, de su página si la tiene (lo guardado que no valga, fuera) */
export async function ownTemplate(ctx: ActionContext, row: templatesRepo.TemplateRow): Promise<PageTemplate> {
  const page = row.pageId ? await pagesRepo.findPage(ctx.db, row.pageId) : null
  const lineage = { id: row.id, basedOn: row.basedOn, line: row.line }
  if (!page) {
    return {
      ...lineage,
      name: row.name,
      icon: templateEmoji(row.icon),
      pageId: null,
      fields: propertiesOf(row.fields),
      panel: pagePanel.safeParse(row.panel).data ?? [],
      skeleton: row.skeleton
    }
  }
  // Su texto, como esqueleto en Markdown (sin propiedades: esas son sus campos); sin texto, vacío
  const body = await readDocument(ctx, { kind: 'body', pageId: page.id })
  const skeleton = pageToMarkdown({ properties: [], body, separate: () => null })
  return {
    ...lineage,
    name: page.title,
    icon: page.icon,
    pageId: page.id,
    fields: propertiesOf(page.properties),
    panel: pagePanel.safeParse(page.panel).data ?? [],
    skeleton: skeleton.trim() === '' ? '' : skeleton
  }
}

/** Las plantillas que se pueden usar en una organización: las suyas, en el orden en que se hicieron */
export async function usableTemplates(ctx: ActionContext, organizationId: string): Promise<readonly PageTemplate[]> {
  const rows = await templatesRepo.listTemplates(ctx.db, organizationId)
  return Promise.all(rows.map((row) => ownTemplate(ctx, row)))
}

/** Las de la cuenta que se borraron: su nombre, para las páginas que salieron de ellas */
export async function deletedTemplates(ctx: ActionContext, organizationId: string) {
  const rows = await templatesRepo.listTemplates(ctx.db, organizationId, true)
  return Promise.all(
    rows.map(async (row) => {
      const page = row.pageId ? await pagesRepo.findPage(ctx.db, row.pageId) : null
      return { id: row.id, name: page?.title ?? row.name, icon: page ? page.icon : templateEmoji(row.icon) }
    })
  )
}

/**
 * La página de una plantilla: la que tiene o, si aún no la tiene (una de antes del ADR-0024), una nueva en el mundo
 * oculto de su cuenta con lo que guardaba su ficha (su esqueleto, su texto; sus campos, sus propiedades; su panel). Lo
 * hace el sistema: no se deshace (la ficha sigue igual)
 */
export async function templatePage(ctx: ActionContext, row: templatesRepo.TemplateRow): Promise<string> {
  if (row.pageId && (await pagesRepo.findPage(ctx.db, row.pageId))) return row.pageId
  const world = await worldsRepo.templatesWorld(ctx.db, row.organizationId)
  const parsed = pageFromMarkdown(row.skeleton)
  const body = (parsed.body.content ?? []).length > 0 ? stateOf(fillJsonIds(parsed.body)) : null
  const context = {
    ...historyContext(
      ctx,
      'templatePage',
      { name: row.name },
      { organizationId: row.organizationId, worldId: world.id }
    ),
    via: 'system' as const
  }
  const [page] = await pagesRepo.createPagesWithBodies(ctx.db, context, {
    worldId: world.id,
    parentId: null,
    pages: [
      {
        key: 'plantilla',
        parentKey: null,
        title: row.name,
        icon: templateEmoji(row.icon),
        body,
        separates: [],
        panel: row.panel
      }
    ],
    properties: () => new Map([['plantilla', row.fields]])
  })
  if (!page) throw new Error(`No se pudo hacer la página de la plantilla ${row.id}`)
  await templatesRepo.updateTemplate(ctx.db, context, row.id, { pageId: page.id })
  return page.id
}

/** El id de un campo nuevo de una plantilla propia */
export const newFieldId = () => randomBytes(5).toString('hex')

/** Una plantilla por su id o por su nombre (sin mirar mayúsculas ni tildes) */
export async function findTemplate(ctx: ActionContext, organizationId: string, ref: string): Promise<PageTemplate> {
  const all = await usableTemplates(ctx, organizationId)
  const found = all.find((t) => t.id === ref) ?? all.find((t) => fieldKey(t.name) === fieldKey(ref))
  if (!found) {
    throw new InvalidRequestError('TEMPLATE_NOT_FOUND', `no hay ninguna plantilla «${ref}»: mira listar_plantillas`)
  }
  return found
}

/** El id de un bloque del panel nuevo */
export const newBlockId = () => randomBytes(6).toString('hex')

const TYPE_NAMES = {
  text: 'texto',
  number: 'número',
  boolean: 'sí o no',
  list: 'lista',
  pages: 'páginas',
  choice: 'opciones',
  clock: 'reloj'
} as const

/** Los campos de una plantilla en una línea, para los errores: «Facción (páginas), Estado (opciones: Vive, …)» */
export const fieldsText = (template: Pick<PageTemplate, 'fields'>) =>
  template.fields
    .map((field) => {
      const shape =
        field.type === 'choice'
          ? `: ${field.options.join(', ')}`
          : field.type === 'pages' && field.single
            ? ', una'
            : ''
      return `${field.name} (${TYPE_NAMES[field.type]}${shape})`
    })
    .join(', ')
