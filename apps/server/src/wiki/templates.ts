/**
 * Las plantillas con las que se crean páginas (ADR-0009): encontrarlas por su id o su nombre y dar sus copias a una
 * página nueva. Las de serie viven en el dominio; las de la cuenta llegan con la tarea 9
 */
import { randomBytes } from 'node:crypto'
import { pagePanel, TEMPLATE_ICONS } from '@crisol/contracts'
import { templatesRepo } from '@crisol/db'
import { BUILT_IN_TEMPLATES, fieldKey, type PageTemplate, type TemplateIcon } from '@crisol/domain'
import { type ActionContext, InvalidRequestError } from '../actions/context.ts'
import { propertiesOf } from './properties.ts'

const iconOf = (icon: string): TemplateIcon =>
  (TEMPLATE_ICONS as readonly string[]).includes(icon) ? (icon as TemplateIcon) : 'template'

/** Una plantilla de la cuenta, como las de serie (lo guardado que no valga, fuera) */
export const ownTemplate = (row: templatesRepo.TemplateRow): PageTemplate => ({
  id: row.id,
  name: row.name,
  icon: iconOf(row.icon),
  basedOn: row.basedOn,
  line: row.line,
  builtIn: false,
  fields: propertiesOf(row.fields),
  panel: pagePanel.safeParse(row.panel).data ?? [],
  skeleton: row.skeleton
})

/** Las plantillas que se pueden usar en una organización: las de serie y las suyas, en el orden en que se hicieron */
export async function usableTemplates(ctx: ActionContext, organizationId: string): Promise<readonly PageTemplate[]> {
  const own = await templatesRepo.listTemplates(ctx.db, organizationId)
  return [...BUILT_IN_TEMPLATES, ...own.map(ownTemplate)]
}

/** Las de la cuenta que se borraron: su nombre, para las páginas que salieron de ellas */
export async function deletedTemplates(ctx: ActionContext, organizationId: string) {
  const rows = await templatesRepo.listTemplates(ctx.db, organizationId, true)
  return rows.map((row) => ({ id: row.id, name: row.name, icon: iconOf(row.icon) }))
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
export const fieldsText = (template: PageTemplate) =>
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
