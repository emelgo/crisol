import { z } from 'zod'
import { defineAction } from './action.ts'

/** Lo que no puede llevar el nombre de un archivo: barras (las carpetas son por tipo) ni lo que rompe `![[…]]` */
export const FILE_NAME_FORBIDDEN = /[\\/\0[\]|#^]/g

/** El nombre de un archivo */
export const fileName = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((name) => !new RegExp(FILE_NAME_FORBIDDEN.source).test(name), 'Sin barras, corchetes, |, # ni ^')

/**
 * Un archivo de un mundo o común a los mundos de la cuenta (sin mundo, ADR-0005): los bytes se piden aparte, en
 * /api/files/:id, con la sesión
 */
export const fileView = z.object({
  id: z.uuid(),
  worldId: z.uuid().nullable().describe('Sin mundo: es común a todos los mundos de la cuenta'),
  organizationId: z.uuid(),
  name: z.string(),
  kind: z.enum(['image', 'pdf', 'other']),
  mime: z.string(),
  size: z.number().int(),
  url: z.string().describe('Dónde se piden sus bytes, con la sesión'),
  version: z.number().int(),
  updatedAt: z.string()
})

export type FileView = z.infer<typeof fileView>

const listed = z.object({
  files: z.array(fileView.extend({ usedBy: z.number().int().describe('Cuántas páginas lo usan') }))
})

export const listFiles = defineAction({
  name: 'listFiles',
  kind: 'read',
  description:
    'Los archivos que puede usar el mundo (imágenes, PDF y otros), por nombre y tipo: los suyos y los comunes de la cuenta (worldId null), que comparten todos sus mundos. En una página se usan con ![[nombre]] (una imagen con ![[nombre|300]] de ancho, un PDF en una página con ![[nombre#page=12]]); si un nombre está en los dos, ![[nombre]] usa el del mundo',
  input: z.object({ worldId: z.uuid() }),
  output: listed
})

export const listCommonFiles = defineAction({
  name: 'listCommonFiles',
  kind: 'read',
  description:
    'Los archivos comunes de la cuenta, que comparten todos sus mundos. Sin organización, la única de la que la cuenta es propietaria',
  input: z.object({ organizationId: z.uuid().optional() }),
  output: listed
})

export const renameFile = defineAction({
  name: 'renameFile',
  kind: 'write',
  description: 'Cambia el nombre de un archivo (no se puede repetir en su mundo, o entre los comunes)',
  input: z.object({ fileId: z.uuid(), name: fileName }),
  output: fileView
})

export const deleteFile = defineAction({
  name: 'deleteFile',
  kind: 'delete',
  description:
    'Manda un archivo a la papelera (la de su mundo, o la de la cuenta si es común): se puede restaurar durante 30 días',
  input: z.object({ fileId: z.uuid() }),
  output: z.object({ id: z.uuid(), name: z.string() })
})

export const restoreFile = defineAction({
  name: 'restoreFile',
  kind: 'write',
  description: 'Saca un archivo de la papelera (si su nombre ya lo usa otro, se le añade un número)',
  input: z.object({ fileId: z.uuid() }),
  output: z.object({ id: z.uuid(), name: z.string() })
})
