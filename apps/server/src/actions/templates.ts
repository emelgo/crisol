/**
 * Las plantillas de página (ADR-0009): las de serie, que viven en el dominio y no se cambian, y (desde la tarea 9) las de
 * la cuenta. Se ven para crear páginas con ellas
 */
import { getTemplate, listTemplates, type PageTemplate } from '@crisol/contracts'
import { authorize, BUILT_IN_TEMPLATES, builtInTemplate, NotFoundError } from '@crisol/domain'
import { targetOrganization } from './access.ts'
import type { ActionContext } from './context.ts'
import { implement } from './registry.ts'

/** Las de serie, tal como las da la API */
const builtIns = (): PageTemplate[] => BUILT_IN_TEMPLATES.map((template) => structuredClone(template) as PageTemplate)

/** La organización de la que se ven las plantillas, si la cuenta puede verlas */
function readableOrganization(ctx: ActionContext, organizationId: string | undefined) {
  const target = targetOrganization(ctx, organizationId)
  authorize(ctx.actor, 'templates.read', { organizationId: target })
  return target
}

export const templateActions = [
  implement(listTemplates, async (ctx, { organizationId }) => {
    readableOrganization(ctx, organizationId)
    return { templates: builtIns() }
  }),

  implement(getTemplate, async (ctx, { templateId, organizationId }) => {
    readableOrganization(ctx, organizationId)
    const found = builtInTemplate(templateId)
    if (!found) throw new NotFoundError('template')
    return structuredClone(found) as PageTemplate
  })
]
