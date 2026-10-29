import { z } from 'zod'
import { defineAction } from './action.ts'

const campaignName = z.string().trim().min(1).max(120)

/** Una campaña tal como la ve la cuenta que lo pide */
export const campaign = z.object({
  id: z.uuid(),
  worldId: z.uuid(),
  name: z.string(),
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
