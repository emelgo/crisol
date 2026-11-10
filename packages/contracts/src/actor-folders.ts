/** Las carpetas de la pestaña Actores de una campaña (Enrique, 2026-11-10): agrupar personajes y criaturas en juego */
import { z } from 'zod'
import { defineAction } from './action.ts'

const folderName = z.string().trim().min(1).max(80)
export const actorKind = z.enum(['character', 'creature'])

const foldersOutput = z.object({
  folders: z.array(z.object({ id: z.uuid(), name: z.string() })),
  /** Lo que va en cada una (lo que no sale aquí, fuera de las carpetas) */
  items: z.array(z.object({ kind: actorKind, id: z.uuid(), folderId: z.uuid() }))
})

export type ActorFolders = z.infer<typeof foldersOutput>

export const listActorFolders = defineAction({
  name: 'listActorFolders',
  kind: 'read',
  description:
    'Las carpetas de la pestaña Actores de una campaña (del máster) y qué personajes y criaturas van en cada una',
  input: z.object({ campaignId: z.uuid() }),
  output: foldersOutput
})

export const createActorFolder = defineAction({
  name: 'createActorFolder',
  kind: 'write',
  description: 'Crea una carpeta en la pestaña Actores de una campaña, para agrupar personajes y criaturas en juego',
  input: z.object({ campaignId: z.uuid(), name: folderName }),
  output: z.object({ id: z.uuid(), name: z.string() })
})

export const renameActorFolder = defineAction({
  name: 'renameActorFolder',
  kind: 'write',
  description: 'Cambia el nombre de una carpeta de Actores',
  input: z.object({ campaignId: z.uuid(), folderId: z.uuid(), name: folderName }),
  output: z.object({ ok: z.literal(true) })
})

export const deleteActorFolder = defineAction({
  name: 'deleteActorFolder',
  kind: 'write',
  description:
    'Quita una carpeta de Actores: lo que tenía vuelve a quedar fuera de las carpetas (no se borra nada más)',
  input: z.object({ campaignId: z.uuid(), folderId: z.uuid() }),
  output: z.object({ ok: z.literal(true) })
})

export const moveToActorFolder = defineAction({
  name: 'moveToActorFolder',
  kind: 'write',
  description:
    'Mete un personaje o una criatura en juego de la campaña en una carpeta de Actores (folderId null: la saca de las carpetas)',
  input: z.object({ campaignId: z.uuid(), kind: actorKind, id: z.uuid(), folderId: z.uuid().nullable() }),
  output: z.object({ ok: z.literal(true) })
})
