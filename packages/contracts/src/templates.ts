import { z } from 'zod'
import { defineAction } from './action.ts'
import { pageProperty, templateRef } from './pages.ts'
import { pagePanel } from './panel.ts'

/** Los iconos de una plantilla (los mismos que TEMPLATE_ICONS del dominio; lo comprueba una prueba del servidor) */
export const TEMPLATE_ICONS = [
  'user',
  'castle',
  'shield',
  'gem',
  'scroll',
  'calendar',
  'hourglass',
  'flag',
  'swords',
  'crown',
  'skull',
  'map',
  'book',
  'flame',
  'tree',
  'ship',
  'sparkles',
  'template'
] as const

export const templateIcon = z.enum(TEMPLATE_ICONS)

/**
 * Una plantilla de página (ADR-0009): sus campos (propiedades con el id de su campo, su forma y su valor inicial), los
 * bloques de su panel y el esqueleto de su texto en Markdown. Las de serie no se cambian
 */
export const pageTemplate = z.object({
  id: templateRef,
  name: z.string().trim().min(1).max(60),
  icon: templateIcon,
  basedOn: templateRef.nullable().describe('De cuál se copió'),
  line: z.array(templateRef).min(1).max(20).describe('Ella y todas de las que viene: las tablas casan con cualquiera'),
  builtIn: z.boolean().describe('De serie: no se puede cambiar, pero sí copiar'),
  fields: z.array(pageProperty).max(50),
  panel: pagePanel,
  skeleton: z.string().max(20_000).describe('El texto con el que nace la página, en Markdown')
})

export type PageTemplate = z.infer<typeof pageTemplate>

export const listTemplates = defineAction({
  name: 'listTemplates',
  kind: 'read',
  description:
    'Las plantillas de página para crear páginas: las de serie (PNJ, Lugar, Facción, Objeto, Misión y Sesión, que no se cambian) y las de la cuenta, con sus campos, los bloques de su panel y su esqueleto. Sin organización, la única de la que la cuenta es propietaria',
  input: z.object({ organizationId: z.uuid().optional() }),
  output: z.object({ templates: z.array(pageTemplate) })
})

export const getTemplate = defineAction({
  name: 'getTemplate',
  kind: 'read',
  description:
    'Una plantilla de página entera: sus campos (con su id, su tipo, su forma y su valor inicial), los bloques de su panel y su esqueleto en Markdown',
  input: z.object({ templateId: templateRef, organizationId: z.uuid().optional() }),
  output: pageTemplate
})
