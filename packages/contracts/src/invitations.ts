import { z } from 'zod'
import { defineAction } from './action.ts'

/** El enlace de invitación de una campaña, tal como lo ve su máster */
export const invitation = z.object({
  campaignId: z.uuid(),
  /** null si la campaña aún no tiene enlace (o el actual ya no se puede leer): hay que generar uno */
  url: z.url().nullable(),
  open: z.boolean(),
  issuedAt: z.iso.datetime().nullable(),
  joins: z.number().int()
})

export type Invitation = z.infer<typeof invitation>

export const getInvitation = defineAction({
  name: 'getInvitation',
  kind: 'read',
  description:
    'El enlace de invitación de una campaña, si las invitaciones están abiertas y cuántos han entrado con él',
  input: z.object({ campaignId: z.uuid() }),
  output: invitation
})

export const regenerateInvitation = defineAction({
  name: 'regenerateInvitation',
  kind: 'players',
  description: 'Genera un enlace de invitación nuevo; el anterior deja de valer para quien aún no haya entrado',
  input: z.object({ campaignId: z.uuid() }),
  output: invitation
})

export const setInvitationsOpen = defineAction({
  name: 'setInvitationsOpen',
  kind: 'players',
  description: 'Abre o cierra las invitaciones de una campaña sin cambiar el enlace',
  input: z.object({ campaignId: z.uuid(), open: z.boolean() }),
  output: invitation
})
