import { z } from 'zod'
import { defineAction } from './action.ts'

const worldName = z.string().trim().min(1).max(120)

/** Un mundo tal como lo ve la cuenta que lo pide */
export const world = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  name: z.string(),
  role: z.enum(['master']),
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
