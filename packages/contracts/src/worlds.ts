import { z } from 'zod'
import { defineAction } from './action.ts'
import { readAs } from './read-as.ts'

const worldName = z.string().trim().min(1).max(120)

/** Los iconos que ofrecía la tarjeta de un mundo (la interfaz ya no los enseña) */
export const WORLD_ICONS = ['tower', 'mountain', 'sword', 'ship', 'crown', 'tree', 'book'] as const
export const worldIcon = z.enum(WORLD_ICONS)

/** Los colores fijos de un mundo: tiñen, sutil, el contorno de su tarjeta (y la portada si no hay imagen) */
export const WORLD_COLORS = ['wine', 'moss', 'slate', 'ochre', 'sea', 'plum'] as const
/** Uno de los fijos o uno propio (#rrggbb) */
export const worldColor = z.union([z.enum(WORLD_COLORS), z.string().regex(/^#[0-9a-f]{6}$/i)])

/** La portada de un mundo: una imagen suya y su encuadre (como la de una página) */
export const worldCover = z.object({
  fileId: z.uuid(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  zoom: z.number().min(1).max(3).optional()
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

export const getWorldHome = defineAction({
  name: 'getWorldHome',
  kind: 'read',
  description:
    'La página de portada de un mundo, donde se abre (null si aún no tiene: ensureWorldHome la crea; un jugador, si no la conoce)',
  input: z.object({ worldId: z.uuid(), ...readAs }),
  output: z.object({ pageId: z.uuid().nullable(), chosen: z.boolean().describe('Si es la elegida a propósito') })
})

export const ensureWorldHome = defineAction({
  name: 'ensureWorldHome',
  kind: 'write',
  description:
    'La página de portada de un mundo (donde se abre, la primera de su árbol): si aún no tiene, la crea con el nombre del mundo',
  input: z.object({ worldId: z.uuid() }),
  output: z.object({ pageId: z.uuid() })
})

export const updateWorld = defineAction({
  name: 'updateWorld',
  kind: 'write',
  description:
    'Cambia un mundo: nombre, descripción (una línea), icono, color (uno de los fijos o #rrggbb: tiñe, sutil, el contorno de su tarjeta), la portada de su tarjeta (una imagen del mundo) o su página de portada (donde se abre). Solo lo que se pase; null quita el icono, el color, la portada o la página elegida',
  input: z
    .object({
      worldId: z.uuid(),
      name: worldName.optional(),
      description: worldDescription.optional(),
      icon: worldIcon.nullable().optional(),
      color: worldColor.nullable().optional(),
      cover: worldCover.nullable().optional(),
      homePageId: z
        .uuid()
        .nullable()
        .optional()
        .describe('Su página de portada, donde se abre el mundo; null: la primera del árbol')
    })
    .refine(
      (input) =>
        input.name !== undefined ||
        input.description !== undefined ||
        input.icon !== undefined ||
        input.color !== undefined ||
        input.cover !== undefined ||
        input.homePageId !== undefined,
      { message: 'name, description, icon, color, cover o homePageId' }
    ),
  output: world
})
