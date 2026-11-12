import { z } from 'zod'
import { defineAction } from './action.ts'
import { worldColor } from './worlds.ts'

/** Una etiqueta: palabras separadas por «/» para la jerarquía («lugar/ciudad»), sin espacios ni tramos vacíos */
export const tagName = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[^\s/]+(\/[^\s/]+)*$/u, 'Sin espacios; «/» separa la jerarquía')

/**
 * Una etiqueta de la cuenta, en su árbol: las madres van antes que sus hijas. Una madre que nadie ha creado (sale de sus
 * hijas) no tiene id ni color
 */
export const tagView = z.object({
  id: z.uuid().nullable(),
  name: z.string().describe('Con su ruta: «lugar/ciudad»'),
  depth: z.number().int().describe('0 en lo más alto; 1, la hija de una de arriba…'),
  color: worldColor.nullable(),
  pages: z.number().int().describe('Cuántas páginas la llevan, contando las de sus hijas, en todos los mundos'),
  files: z.number().int().describe('Cuántos archivos la llevan, contando los de sus hijas'),
  worlds: z
    .array(z.object({ worldId: z.uuid(), name: z.string(), pages: z.number().int() }))
    .describe('En qué mundos hay páginas con ella, y cuántas')
})

export type TagView = z.infer<typeof tagView>

export const listAccountTags = defineAction({
  name: 'listAccountTags',
  kind: 'read',
  description:
    'Las etiquetas de la cuenta, que comparten las páginas de todos sus mundos y sus archivos, en árbol (la jerarquía va con «/»), con su color y cuántas páginas y archivos las llevan. Sin organización, la única de la que la cuenta es propietaria',
  input: z.object({ organizationId: z.uuid().optional() }),
  output: z.object({ organizationId: z.uuid(), tags: z.array(tagView) })
})

export const createTag = defineAction({
  name: 'createTag',
  kind: 'write',
  description:
    'Crea una etiqueta en la cuenta, con un color opcional. Las que se ponen a una página o a un archivo se crean solas',
  input: z.object({
    organizationId: z.uuid().optional(),
    name: tagName,
    color: worldColor.nullable().optional()
  }),
  output: tagView
})

export const updateTag = defineAction({
  name: 'updateTag',
  kind: 'write',
  description:
    'Cambia una etiqueta de la cuenta: su nombre (lo cambia en todas las páginas y archivos que la llevan, también en sus hijas: renombrar «lugar» a «sitio» deja «sitio/ciudad») y su color (null lo quita). Se deshace entera desde el historial',
  input: z
    .object({
      organizationId: z.uuid().optional(),
      tag: tagName.describe('La etiqueta, por su nombre'),
      name: tagName.optional(),
      color: worldColor.nullable().optional()
    })
    .refine((input) => input.name !== undefined || input.color !== undefined, { message: 'name o color' }),
  output: tagView
})

export const moveTag = defineAction({
  name: 'moveTag',
  kind: 'write',
  description:
    'Mueve una etiqueta de la cuenta en su árbol, con sus hijas: dentro de otra (parent; null, a lo más alto: la renombra, de «lugar/ciudad» a «sitio/ciudad», en todo lo que la lleva) y, si se da, delante (before) o detrás (after) de una de sus nuevas hermanas, para ordenarlas a mano. Se deshace desde el historial',
  input: z
    .object({
      organizationId: z.uuid().optional(),
      tag: tagName.describe('La etiqueta, por su nombre'),
      parent: tagName.nullable().describe('Dentro de cuál queda (por su nombre); null, en lo más alto'),
      before: tagName.optional().describe('Delante de esta hermana (por su nombre completo)'),
      after: tagName.optional().describe('Detrás de esta hermana (por su nombre completo)')
    })
    .refine((input) => !(input.before && input.after), { message: 'before o after, no los dos' }),
  output: tagView
})

export const deleteTag = defineAction({
  name: 'deleteTag',
  kind: 'delete',
  description:
    'Borra una etiqueta de la cuenta y sus hijas: se quitan de todas las páginas y archivos que las llevan. Se deshace desde el historial',
  input: z.object({ organizationId: z.uuid().optional(), tag: tagName }),
  output: z.object({ name: z.string(), pages: z.number().int(), files: z.number().int() })
})

export const addFileTags = defineAction({
  name: 'addFileTags',
  kind: 'write',
  description:
    'Añade unas etiquetas a varios archivos de una vez (las que ya llevan se quedan; las que no estén en la cuenta, se crean). Una sola operación por ámbito, que se deshace de una vez desde el historial',
  input: z.object({ fileIds: z.array(z.uuid()).min(1).max(500), tags: z.array(tagName).min(1).max(50) }),
  output: z.object({ files: z.number().int().describe('Cuántos archivos cambiaron') })
})

export const setFileTags = defineAction({
  name: 'setFileTags',
  kind: 'write',
  description:
    'Deja las etiquetas de un archivo como se dan (de la cuenta; las que no estén, se crean). Una lista vacía las quita',
  input: z.object({ fileId: z.uuid(), tags: z.array(tagName).max(50) }),
  output: z.object({ id: z.uuid(), tags: z.array(z.string()) })
})
