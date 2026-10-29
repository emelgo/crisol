import { z } from 'zod'
import { defineAction } from './action.ts'

/** Alguien de la campaña, tal como lo ven sus compañeros y su máster */
export const member = z.object({
  userId: z.string(),
  name: z.string(),
  role: z.enum(['master', 'player'])
})

export type Member = z.infer<typeof member>

export const listMembers = defineAction({
  name: 'listMembers',
  kind: 'read',
  description: 'Quiénes están en una campaña, con su rol: el máster primero',
  input: z.object({ campaignId: z.uuid() }),
  output: z.object({ members: z.array(member) })
})

export const removeMember = defineAction({
  name: 'removeMember',
  kind: 'players',
  description:
    'Expulsa a un jugador de la campaña. Si aún tiene el enlace podría volver a entrar: para evitarlo, genera uno nuevo',
  input: z.object({ campaignId: z.uuid(), userId: z.string().min(1) }),
  output: z.object({ members: z.array(member) })
})

export const leaveCampaign = defineAction({
  name: 'leaveCampaign',
  kind: 'players',
  description: 'La cuenta deja una campaña en la que juega; para volver necesitará un enlace',
  input: z.object({ campaignId: z.uuid() }),
  output: z.object({})
})
