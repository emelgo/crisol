/**
 * Las plantillas con las que se crean páginas (ADR-0009): encontrarlas por su id o su nombre y dar sus copias a una
 * página nueva. Las de serie viven en el dominio; las de la cuenta llegan con la tarea 9
 */
import { randomBytes } from 'node:crypto'
import { BUILT_IN_TEMPLATES, fieldKey, type PageTemplate } from '@crisol/domain'
import { type ActionContext, InvalidRequestError } from '../actions/context.ts'

/** Las plantillas que se pueden usar en una organización */
export async function usableTemplates(_ctx: ActionContext, _organizationId: string): Promise<readonly PageTemplate[]> {
  return BUILT_IN_TEMPLATES
}

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
