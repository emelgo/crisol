import { z } from 'zod'
import { defineAction } from './action.ts'

/** Algo en la papelera: se puede restaurar hasta purgeAt; luego se borra del todo */
export const trashItem = z.object({
  kind: z.enum(['world', 'campaign']),
  id: z.uuid(),
  name: z.string(),
  worldId: z.uuid(),
  worldName: z.string(),
  deletedAt: z.iso.datetime(),
  purgeAt: z.iso.datetime()
})

export type TrashItem = z.infer<typeof trashItem>

const restored = z.object({ id: z.uuid(), name: z.string() })

export const deleteWorld = defineAction({
  name: 'deleteWorld',
  kind: 'delete',
  description: 'Manda un mundo a la papelera con sus campañas: desaparece para todos y se puede restaurar 30 días',
  input: z.object({ worldId: z.uuid() }),
  output: z.object({})
})

export const deleteCampaign = defineAction({
  name: 'deleteCampaign',
  kind: 'delete',
  description:
    'Manda una campaña a la papelera: desaparece para todos, su enlace deja de valer y se puede restaurar 30 días',
  input: z.object({ campaignId: z.uuid() }),
  output: z.object({})
})

export const listTrash = defineAction({
  name: 'listTrash',
  kind: 'read',
  description:
    'Lo que hay en la papelera: las campañas borradas de un mundo (para su máster) o, en la de la organización (para el propietario), también los mundos',
  input: z.object({ worldId: z.uuid().optional(), organizationId: z.uuid().optional() }),
  output: z.object({ items: z.array(trashItem) })
})

export const restoreWorld = defineAction({
  name: 'restoreWorld',
  kind: 'write',
  description: 'Saca un mundo de la papelera, con sus campañas',
  input: z.object({ worldId: z.uuid() }),
  output: restored
})

export const restoreCampaign = defineAction({
  name: 'restoreCampaign',
  kind: 'write',
  description: 'Saca una campaña de la papelera (si su mundo también está en ella, hay que restaurar el mundo)',
  input: z.object({ campaignId: z.uuid() }),
  output: restored
})
