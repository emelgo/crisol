import { z } from 'zod'
import { defineAction } from './action.ts'
import { member } from './members.ts'
import { world, worldColor, worldCover } from './worlds.ts'

const campaignName = z.string().trim().min(1).max(120)
const campaignDescription = z.string().trim().max(280)

/** Una campaña tal como la ve la cuenta que lo pide. Se ve como un mundo: descripción, color y portada */
export const campaign = z.object({
  id: z.uuid(),
  worldId: z.uuid(),
  name: z.string(),
  description: z.string(),
  color: worldColor.nullable(),
  cover: worldCover.nullable(),
  role: z.enum(['master', 'player']),
  version: z.number().int()
})

export type Campaign = z.infer<typeof campaign>

export const listCampaigns = defineAction({
  name: 'listCampaigns',
  kind: 'read',
  description: 'Campañas de un mundo que ve la cuenta, con su rol en cada una',
  input: z.object({ worldId: z.uuid() }),
  output: z.object({ campaigns: z.array(campaign) })
})

export const createCampaign = defineAction({
  name: 'createCampaign',
  kind: 'write',
  description: 'Crea una campaña en un mundo; quien la crea queda de máster',
  input: z.object({ worldId: z.uuid(), name: campaignName }),
  output: campaign
})

export const renameCampaign = defineAction({
  name: 'renameCampaign',
  kind: 'write',
  description: 'Cambia el nombre de una campaña',
  input: z.object({ campaignId: z.uuid(), name: campaignName }),
  output: campaign
})

export const updateCampaign = defineAction({
  name: 'updateCampaign',
  kind: 'write',
  description:
    'Cambia cómo se ve una campaña en su tarjeta: nombre, descripción (una línea), color (uno de los fijos o #rrggbb: tiñe, sutil, el contorno de su tarjeta) o la portada (una imagen de su mundo o común). Solo lo que se pase; null quita el color o la portada',
  input: z
    .object({
      campaignId: z.uuid(),
      name: campaignName.optional(),
      description: campaignDescription.optional(),
      color: worldColor.nullable().optional(),
      cover: worldCover.nullable().optional()
    })
    .refine(
      (input) =>
        input.name !== undefined ||
        input.description !== undefined ||
        input.color !== undefined ||
        input.cover !== undefined,
      { message: 'name, description, color o cover' }
    ),
  output: campaign
})

export const listWorldsWithCampaigns = defineAction({
  name: 'listWorldsWithCampaigns',
  kind: 'read',
  description:
    'Mundos de la cuenta, cada uno con las campañas que ve (el máster, todas; un jugador, las suyas) y su rol en cada uno',
  input: z.object({}),
  output: z.object({ worlds: z.array(world.extend({ campaigns: z.array(campaign) })) })
})

export const getCampaign = defineAction({
  name: 'getCampaign',
  kind: 'read',
  description: 'Una campaña con su mundo, el rol de la cuenta en ella y quiénes están (el máster primero)',
  input: z.object({ campaignId: z.uuid() }),
  output: z.object({
    campaign,
    world: z.object({ id: z.uuid(), name: z.string() }),
    members: z.array(member)
  })
})
