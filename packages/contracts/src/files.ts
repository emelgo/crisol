import { z } from 'zod'
import { defineAction } from './action.ts'

/** El nombre de un archivo: sin barras (las carpetas son por tipo) */
export const fileName = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((name) => !/[\\/\0]/.test(name), 'Sin barras')

/** Un archivo del mundo: los bytes se piden aparte, en /api/files/:id, con la sesión */
export const fileView = z.object({
  id: z.uuid(),
  worldId: z.uuid(),
  name: z.string(),
  kind: z.enum(['image', 'pdf', 'other']),
  mime: z.string(),
  size: z.number().int(),
  url: z.string().describe('Dónde se piden sus bytes, con la sesión'),
  version: z.number().int(),
  updatedAt: z.string()
})

export type FileView = z.infer<typeof fileView>

export const listFiles = defineAction({
  name: 'listFiles',
  kind: 'read',
  description:
    'Los archivos del mundo (imágenes, PDF y otros), por nombre y tipo. En una página se usan con ![[nombre]] (una imagen con ![[nombre|300]] de ancho, un PDF en una página con ![[nombre#page=12]])',
  input: z.object({ worldId: z.uuid() }),
  output: z.object({ files: z.array(fileView) })
})

export const renameFile = defineAction({
  name: 'renameFile',
  kind: 'write',
  description: 'Cambia el nombre de un archivo del mundo (no se puede repetir en el mundo)',
  input: z.object({ fileId: z.uuid(), name: fileName }),
  output: fileView
})

export const deleteFile = defineAction({
  name: 'deleteFile',
  kind: 'delete',
  description: 'Manda un archivo a la papelera del mundo: se puede restaurar durante 30 días',
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
