import { z } from 'zod'
import { defineAction } from './action.ts'
import { pageIcon } from './pages.ts'
import { worldColor } from './worlds.ts'

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
 * Su puesto entre los de su tipo en su carpeta: se ordenan por él (comparando caracteres) y, sin él, detrás y por nombre
 */
const placeInFolder = z
  .string()
  .nullable()
  .describe('Su puesto en su carpeta (orden a mano: se compara carácter a carácter); null, detrás y por nombre')

/**
 * Un archivo de un mundo o común a los mundos de la cuenta (sin mundo, ADR-0005): los bytes se piden aparte, en
 * /api/files/:id, con la sesión
 */
export const fileView = z.object({
  id: z.uuid(),
  worldId: z.uuid().nullable().describe('Sin mundo: es común a todos los mundos de la cuenta'),
  organizationId: z.uuid(),
  name: z.string(),
  folderId: z.uuid().nullable().describe('Su carpeta; sin ella, en lo más alto'),
  position: placeInFolder,
  kind: z.enum(['image', 'pdf', 'other']),
  mime: z.string(),
  size: z.number().int(),
  url: z.string().describe('Dónde se piden sus bytes, con la sesión'),
  tags: z.array(z.string()).describe('Sus etiquetas, de las de la cuenta'),
  version: z.number().int(),
  updatedAt: z.string()
})

export type FileView = z.infer<typeof fileView>

/** El nombre de una carpeta */
const folderName = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine((name) => !/[\\/]/.test(name), 'Sin barras')

/** Una carpeta para ordenar archivos (solo ordena: el nombre de un archivo es único en todo su ámbito) */
export const folderView = z.object({
  id: z.uuid(),
  worldId: z.uuid().nullable().describe('Sin mundo: es de los comunes de la cuenta'),
  organizationId: z.uuid(),
  parentId: z.uuid().nullable().describe('Sin madre: en lo más alto'),
  name: z.string(),
  position: placeInFolder,
  color: worldColor.nullable().describe('Su color (uno de los fijos o #rrggbb): tiñe su icono'),
  icon: z.string().nullable().describe('Su icono, un emoji o un icono de rol «gi:<id>»; sin él, el de una carpeta')
})

export type FolderView = z.infer<typeof folderView>

const listed = z.object({
  files: z.array(fileView.extend({ usedBy: z.number().int().describe('Cuántas páginas lo usan') })),
  folders: z.array(folderView)
})

export const listFiles = defineAction({
  name: 'listFiles',
  kind: 'read',
  description:
    'Los archivos que puede usar el mundo (imágenes, PDF y otros) y sus carpetas, cada uno en el orden de su carpeta (position; sin él, por nombre): los suyos y los comunes de la cuenta (worldId null), que comparten todos sus mundos. En una página se usan con ![[nombre]] (una imagen con ![[nombre|300]] de ancho, un PDF en una página con ![[nombre#page=12]]); si un nombre está en los dos, ![[nombre]] usa el del mundo',
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

export const createFolder = defineAction({
  name: 'createFolder',
  kind: 'write',
  description:
    'Crea una carpeta para ordenar archivos: en un mundo (worldId) o entre los comunes de la cuenta (organizationId), dentro de otra (parentId) o en lo más alto',
  input: z
    .object({
      worldId: z.uuid().optional(),
      organizationId: z.uuid().optional(),
      parentId: z.uuid().nullable().default(null),
      name: folderName
    })
    .refine((input) => Boolean(input.worldId) !== Boolean(input.organizationId), {
      message: 'worldId u organizationId, uno de los dos'
    }),
  output: folderView
})

/** Delante o detrás de cuál queda, entre los de su tipo en su carpeta de destino */
const besides = (what: string) => ({
  before: z.uuid().optional().describe(`Delante de ${what} (de la carpeta de destino)`),
  after: z.uuid().optional().describe(`Detrás de ${what} (de la carpeta de destino)`)
})
const oneSide = { message: 'before o after, no los dos' }

export const updateFolder = defineAction({
  name: 'updateFolder',
  kind: 'write',
  description:
    'Cambia el nombre de una carpeta, su color o su icono (un emoji o un icono de rol «gi:<id>», listar_iconos; null quita uno u otro), la mete en otra (parentId; null: a lo más alto) o la ordena a mano delante (before) o detrás (after) de otra carpeta de su carpeta de destino (sin parentId, la de ahora). Al cambiar de carpeta sin before ni after, va detrás, por nombre. Se deshace desde el historial',
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
      { message: 'name, color, icon, parentId, before o after' }
    ),
  output: folderView
})

export const deleteFolder = defineAction({
  name: 'deleteFolder',
  kind: 'delete',
  description:
    'Borra una carpeta con todo lo que tiene dentro: sus archivos van a la papelera y sus carpetas se quitan. Se deshace con el historial',
  input: z.object({ folderId: z.uuid() }),
  output: z.object({ id: z.uuid(), name: z.string() })
})

export const deleteFiles = defineAction({
  name: 'deleteFiles',
  kind: 'delete',
  description:
    'Borra de una vez varios archivos (a la papelera) y carpetas (con todo lo que tienen dentro). Se deshace con el historial',
  input: z
    .object({
      fileIds: z.array(z.uuid()).max(500).default([]),
      folderIds: z.array(z.uuid()).max(200).default([])
    })
    .refine((input) => input.fileIds.length + input.folderIds.length > 0, { message: 'fileIds o folderIds' }),
  output: z.object({ files: z.number().int().describe('Cuántos archivos fueron a la papelera') })
})

export const moveFiles = defineAction({
  name: 'moveFiles',
  kind: 'write',
  description:
    'Mete de una vez varios archivos y carpetas de un mismo ámbito (un mundo, o los comunes) en una carpeta de ese ámbito (folderId; null: a lo más alto), detrás y por nombre. Una carpeta no va dentro de sí misma ni de las suyas. Una sola operación, que se deshace de una vez desde el historial',
  input: z
    .object({
      fileIds: z.array(z.uuid()).max(500).default([]),
      folderIds: z.array(z.uuid()).max(200).default([]),
      folderId: z.uuid().nullable()
    })
    .refine((input) => input.fileIds.length + input.folderIds.length > 0, { message: 'fileIds o folderIds' }),
  output: z.object({
    moved: z.number().int().describe('Cuántos cambiaron de carpeta (los que ya estaban, no cuentan)')
  })
})

export const moveFile = defineAction({
  name: 'moveFile',
  kind: 'write',
  description:
    'Mete un archivo en una carpeta de su ámbito (folderId; null: a lo más alto) y, si se da, lo ordena a mano delante (before) o detrás (after) de otro archivo de esa carpeta (también sin cambiar de carpeta). Sin before ni after, va detrás, por nombre. Se deshace desde el historial',
  input: z
    .object({ fileId: z.uuid(), folderId: z.uuid().nullable(), ...besides('este archivo') })
    .refine((input) => !(input.before && input.after), oneSide),
  output: fileView
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
