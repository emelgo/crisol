/** Buscar en la wiki: lo mismo para la web y para Claude (buscar_paginas), también por plantilla y campo (ADR-0009) */
import { searchWiki } from '@crisol/contracts'
import { fieldKey } from '@crisol/domain'
import { searchWorld } from '../wiki/search.ts'
import { fieldsText, findTemplate } from '../wiki/templates.ts'
import { authorizedWiki } from './access.ts'
import { InvalidRequestError } from './context.ts'
import { pageResolver } from './page-content.ts'
import { implement } from './registry.ts'

export const searchActions = [
  implement(searchWiki, async (ctx, input) => {
    const wiki = await authorizedWiki(ctx, 'page.read', input.worldId)
    const template = input.template ? await findTemplate(ctx, wiki.organizationId, input.template) : null
    let link: { field: string; pageId: string } | null = null
    if (template && input.field) {
      const wanted = input.field.name
      const field = template.fields.find(
        (f) => f.type === 'pages' && (f.field === wanted || fieldKey(f.name) === fieldKey(wanted))
      )
      if (!field?.field) {
        throw new InvalidRequestError(
          'BAD_FIELD',
          `${template.name} no tiene ningún campo de enlace «${wanted}». Sus campos: ${fieldsText(template)}`
        )
      }
      const pageId = (await pageResolver(ctx, wiki.worldId)).resolve(input.field.page)
      link = { field: field.field, pageId }
    }
    return searchWorld(ctx, { ...input, worldId: wiki.worldId, template: template?.id ?? null, link })
  })
]
