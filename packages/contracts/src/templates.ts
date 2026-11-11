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
 * Una plantilla de página de la cuenta (ADR-0009, ADR-0024): sus campos (propiedades con el id de su campo, su forma y
 * su valor inicial), los bloques de su panel y el esqueleto de su texto en Markdown. No hay plantillas de serie
 */
export const pageTemplate = z.object({
  id: templateRef,
  name: z.string().trim().min(1).max(60),
  icon: templateIcon,
  basedOn: templateRef.nullable().describe('De cuál se copió'),
  line: z.array(templateRef).min(1).max(20).describe('Ella y todas de las que viene: las tablas casan con cualquiera'),
  fields: z.array(pageProperty).max(50),
  panel: pagePanel,
  skeleton: z.string().max(20_000).describe('El texto con el que nace la página, en Markdown')
})

export type PageTemplate = z.infer<typeof pageTemplate>

export const listTemplates = defineAction({
  name: 'listTemplates',
  kind: 'read',
  description:
    'Las plantillas de página de la cuenta para crear páginas, con sus campos, los bloques de su panel y su esqueleto. No hay plantillas de serie: cada cuenta hace las suyas. Sin organización, la única de la que la cuenta es propietaria',
  input: z.object({ organizationId: z.uuid().optional() }),
  output: z.object({
    templates: z.array(pageTemplate),
    deleted: z
      .array(z.object({ id: z.uuid(), name: z.string(), icon: templateIcon }))
      .describe('Las de la cuenta que se borraron: sus páginas aún dicen de cuál salieron')
  })
})

const templateName = z.string().trim().min(1).max(60)

export const createTemplate = defineAction({
  name: 'createTemplate',
  kind: 'write',
  description:
    'Crea una plantilla de página de la cuenta: desde cero (sin campos ni texto) o copiando otra suya (copyOf, por su id o su nombre), que conserva los ids de sus campos: sus páginas salen en las mismas tablas. Se cambia luego con cambiar_plantilla',
  input: z.object({
    organizationId: z.uuid().optional(),
    name: templateName,
    icon: templateIcon.default('template'),
    copyOf: z.string().trim().min(1).max(60).optional().describe('La plantilla que se copia: su id o su nombre')
  }),
  output: pageTemplate
})

export const updateTemplate = defineAction({
  name: 'updateTemplate',
  kind: 'write',
  description:
    'Cambia una plantilla de la cuenta: su nombre, su icono, sus campos (todos, como se den; uno nuevo sin field recibe uno, y conservar el field de los que ya estaban mantiene sus tablas; los enlaces van vacíos, value: []), los bloques de su panel o su esqueleto en Markdown. Las páginas ya hechas no cambian',
  input: z.object({
    templateId: z.uuid(),
    name: templateName.optional(),
    icon: templateIcon.optional(),
    fields: z.array(pageProperty).max(50).optional(),
    panel: pagePanel.optional(),
    skeleton: z.string().max(20_000).optional()
  }),
  output: pageTemplate
})

export const deleteTemplate = defineAction({
  name: 'deleteTemplate',
  kind: 'delete',
  description:
    'Borra una plantilla de la cuenta: deja de salir al crear, pero sus páginas no cambian y siguen en sus tablas. Se deshace desde el historial',
  input: z.object({ templateId: z.uuid() }),
  output: z.object({ id: z.uuid(), name: z.string() })
})

export const getTemplate = defineAction({
  name: 'getTemplate',
  kind: 'read',
  description:
    'Una plantilla de página entera: sus campos (con su id, su tipo, su forma y su valor inicial), los bloques de su panel y su esqueleto en Markdown',
  input: z.object({ templateId: templateRef, organizationId: z.uuid().optional() }),
  output: pageTemplate
})
