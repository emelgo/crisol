import { z } from 'zod'
import { defineAction } from './action.ts'

const worldName = z.string().trim().min(1).max(120)

/** Los iconos que ofrece la tarjeta de un mundo */
export const WORLD_ICONS = ['tower', 'mountain', 'sword', 'ship', 'crown', 'tree', 'book'] as const
export const worldIcon = z.enum(WORLD_ICONS)

/** Los colores de la portada cuando no hay imagen */
export const WORLD_COLORS = ['wine', 'moss', 'slate', 'ochre', 'sea', 'plum'] as const
export const worldColor = z.enum(WORLD_COLORS)

/** La portada de un mundo: una imagen suya y su encuadre (como la de una página) */
export const worldCover = z.object({
  fileId: z.uuid(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100)
})

const worldDescription = z.string().trim().max(280)

/** Un mundo tal como lo ve la cuenta que lo pide */
export const world = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  name: z.string(),
  description: z.string(),
  icon: worldIcon.nullable(),
  color: worldColor.nullable(),
  cover: worldCover.nullable(),
  // master: lo administra; player: juega en alguna de sus campañas
  role: z.enum(['master', 'player']),
  version: z.number().int()
})

export type World = z.infer<typeof world>

export const listWorlds = defineAction({
  name: 'listWorlds',
  kind: 'read',
  description: 'Mundos de la cuenta y su rol en cada uno',
  input: z.object({}),
  output: z.object({ worlds: z.array(world) })
})

export const createWorld = defineAction({
  name: 'createWorld',
  kind: 'write',
  description: 'Crea un mundo. Sin organización, usa la única de la que la cuenta es propietaria',
  input: z.object({ name: worldName, organizationId: z.uuid().optional() }),
  output: world
})

export const renameWorld = defineAction({
  name: 'renameWorld',
  kind: 'write',
  description: 'Cambia el nombre de un mundo',
  input: z.object({ worldId: z.uuid(), name: worldName }),
  output: world
})

export const updateWorld = defineAction({
  name: 'updateWorld',
  kind: 'write',
  description:
    'Cambia cómo se ve un mundo en su tarjeta: nombre, descripción (una línea), icono, color de la portada o la portada (una imagen del mundo). Solo lo que se pase; null quita el icono, el color o la portada',
  input: z
    .object({
      worldId: z.uuid(),
      name: worldName.optional(),
      description: worldDescription.optional(),
      icon: worldIcon.nullable().optional(),
      color: worldColor.nullable().optional(),
      cover: worldCover.nullable().optional()
    })
    .refine(
      (input) =>
        input.name !== undefined ||
        input.description !== undefined ||
        input.icon !== undefined ||
        input.color !== undefined ||
        input.cover !== undefined,
      { message: 'name, description, icon, color o cover' }
    ),
  output: world
})
