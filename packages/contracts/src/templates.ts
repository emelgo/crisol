import { z } from 'zod'
import { defineAction } from './action.ts'
import { pageCover, pageIcon, pageProperty, templateRef } from './pages.ts'
import { pagePanel } from './panel.ts'
import { worldColor } from './worlds.ts'

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

/** El icono que se pide para una plantilla: un emoji (como el de una página) o, como antes, uno de los de nombre */
const newTemplateIcon = z
  .union([pageIcon, templateIcon])
  .describe('Un emoji o un icono de rol «gi:<id>» (listar_iconos), como el de una página')

/**
 * Una plantilla de página de la cuenta (ADR-0009, ADR-0024): sus campos (propiedades con el id de su campo, su forma y
 * su valor inicial), los bloques de su panel y el esqueleto de su texto en Markdown. No hay plantillas de serie
 */
export const pageTemplate = z.object({
  id: templateRef,
  name: z.string().trim().min(1).max(200),
  icon: z.string().nullable().describe('Un emoji o un icono de rol «gi:<id>», como el de una página (o ninguno)'),
  pageId: z
    .uuid()
    .nullable()
    .describe('Su página (ADR-0024): una plantilla es una página guardada como modelo; se edita como una página'),
  basedOn: templateRef.nullable().describe('De cuál se copió'),
  line: z.array(templateRef).min(1).max(20).describe('Ella y todas de las que viene: las tablas casan con cualquiera'),
  fields: z.array(pageProperty).max(50),
  panel: pagePanel,
  skeleton: z.string().max(20_000).describe('El texto con el que nace la página, en Markdown')
})

export type PageTemplate = z.infer<typeof pageTemplate>

/** Su puesto entre las de su tipo en su carpeta (orden a mano): sin él, detrás y por nombre */
const placeInFolder = z
  .string()
  .nullable()
  .describe('Su puesto en su carpeta (orden a mano: se compara carácter a carácter); null, detrás y por nombre')

/** Una plantilla como la da la API: con su carpeta y lo que enseña su vista previa (su portada, sus pestañas, sus usos) */
export const templateView = pageTemplate.extend({
  folderId: z.uuid().nullable().describe('Su carpeta; sin ella, en lo más alto'),
  position: placeInFolder,
  cover: pageCover.nullable().describe('La portada de su página'),
  tabs: z
    .array(z.object({ id: z.uuid(), name: z.string(), kind: z.enum(['text', 'map', 'table', 'scene']) }))
    .describe('Las pestañas de su página, que llevan también las páginas que se hacen con ella'),
  uses: z.number().int().describe('En cuántas páginas de los mundos de la cuenta se usa')
})

export type TemplateView = z.infer<typeof templateView>

/** Una carpeta para ordenar las plantillas de la cuenta, como las de archivos */
export const templateFolder = z.object({
  id: z.uuid(),
  parentId: z.uuid().nullable().describe('Sin madre: en lo más alto'),
  name: z.string(),
  position: placeInFolder,
  color: worldColor.nullable().describe('Su color (uno de los fijos o #rrggbb): tiñe su icono'),
  icon: z.string().nullable().describe('Su icono, un emoji o un icono de rol «gi:<id>»; sin él, el de una carpeta')
})

export type TemplateFolder = z.infer<typeof templateFolder>

export const listTemplates = defineAction({
  name: 'listTemplates',
  kind: 'read',
  description:
    'Las plantillas de página de la cuenta para crear páginas, con sus campos, los bloques de su panel, su esqueleto y sus pestañas, y las carpetas en que se ordenan (cada una en el orden de su carpeta: position; sin él, por nombre). No hay plantillas de serie: cada cuenta hace las suyas. Sin organización, la única de la que la cuenta es propietaria',
  input: z.object({ organizationId: z.uuid().optional() }),
  output: z.object({
    templates: z.array(templateView),
    folders: z.array(templateFolder).describe('Sus carpetas, para ordenarlas'),
    deleted: z
      .array(z.object({ id: z.uuid(), name: z.string(), icon: z.string().nullable() }))
      .describe('Las de la cuenta que se borraron: sus páginas aún dicen de cuál salieron')
  })
})

const templateName = z.string().trim().min(1).max(200)

export const createTemplate = defineAction({
  name: 'createTemplate',
  kind: 'write',
  description:
    'Crea una plantilla de página de la cuenta: desde cero (sin campos ni texto) o copiando otra suya (copyOf, por su id o su nombre), que conserva los ids de sus campos: sus páginas salen en las mismas tablas. Se cambia luego con cambiar_plantilla',
  input: z.object({
    organizationId: z.uuid().optional(),
    name: templateName,
    icon: newTemplateIcon.nullable().optional(),
    copyOf: z.string().trim().min(1).max(200).optional().describe('La plantilla que se copia: su id o su nombre'),
    folderId: z
      .uuid()
      .nullable()
      .optional()
      .describe('Su carpeta (null: en lo más alto); sin decirlo, la copia va en la de la original')
  }),
  output: templateView
})

export const updateTemplate = defineAction({
  name: 'updateTemplate',
  kind: 'write',
  description:
    'Cambia una plantilla de la cuenta: su nombre, su icono, sus campos (todos, como se den; uno nuevo sin field recibe uno, y conservar el field de los que ya estaban mantiene sus tablas; los enlaces van vacíos, value: []), los bloques de su panel o su esqueleto en Markdown. Las páginas ya hechas no cambian',
  input: z.object({
    templateId: z.uuid(),
    name: templateName.optional(),
    icon: newTemplateIcon.nullable().optional(),
    fields: z.array(pageProperty).max(50).optional(),
    panel: pagePanel.optional(),
    skeleton: z.string().max(20_000).optional()
  }),
  output: templateView
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
  output: templateView
})

/** El nombre de una carpeta de plantillas */
const folderName = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine((name) => !/[\\/]/.test(name), 'Sin barras')

/** Delante o detrás de cuál queda, entre las de su tipo en su carpeta de destino */
const besides = (what: string) => ({
  before: z.uuid().optional().describe(`Delante de ${what} (de la carpeta de destino)`),
  after: z.uuid().optional().describe(`Detrás de ${what} (de la carpeta de destino)`)
})
const oneSide = { message: 'before o after, no los dos' }

export const createTemplateFolder = defineAction({
  name: 'createTemplateFolder',
  kind: 'write',
  description: 'Crea una carpeta para ordenar las plantillas de la cuenta, dentro de otra (parentId) o en lo más alto',
  input: z.object({
    organizationId: z.uuid().optional(),
    parentId: z.uuid().nullable().default(null),
    name: folderName
  }),
  output: templateFolder
})

export const updateTemplateFolder = defineAction({
  name: 'updateTemplateFolder',
  kind: 'write',
  description:
    'Cambia el nombre de una carpeta de plantillas, su color o su icono (un emoji o un icono de rol «gi:<id>», listar_iconos; null quita uno u otro), la mete en otra (parentId; null: a lo más alto) o la ordena a mano delante (before) o detrás (after) de otra carpeta de su carpeta de destino. Al cambiar de carpeta sin before ni after, va detrás, por nombre. Se deshace desde el historial',
  input: z
    .object({
      folderId: z.uuid(),
      name: folderName.optional(),
      color: worldColor.nullable().optional(),
      icon: pageIcon.nullable().optional(),
      parentId: z.uuid().nullable().optional(),
      ...besides('esta carpeta')
    })
    .refine((input) => !(input.before && input.after), oneSide)
    .refine(
      (input) =>
        input.name !== undefined ||
        input.color !== undefined ||
        input.icon !== undefined ||
        input.parentId !== undefined ||
        input.before ||
        input.after,
      { message: 'Nada que cambiar' }
    ),
  output: templateFolder
})

export const deleteTemplateFolder = defineAction({
  name: 'deleteTemplateFolder',
  kind: 'delete',
  description:
    'Borra una carpeta de plantillas con todo lo que tiene dentro: sus carpetas se quitan y sus plantillas se borran (sus páginas no cambian). Se deshace de una vez con el historial',
  input: z.object({ folderId: z.uuid() }),
  output: z.object({
    id: z.uuid(),
    name: z.string(),
    templates: z.number().int().describe('Cuántas plantillas se borraron')
  })
})

export const moveTemplate = defineAction({
  name: 'moveTemplate',
  kind: 'write',
  description:
    'Mete una plantilla en una carpeta (folderId; null: a lo más alto) y, si se da, la ordena a mano delante (before) o detrás (after) de otra plantilla de esa carpeta (también sin cambiar de carpeta). Sin before ni after, va detrás, por nombre. Se deshace desde el historial',
  input: z
    .object({ templateId: z.uuid(), folderId: z.uuid().nullable(), ...besides('esta plantilla') })
    .refine((input) => !(input.before && input.after), oneSide),
  output: templateView
})
