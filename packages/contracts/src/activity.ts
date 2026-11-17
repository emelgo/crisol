/**
 * El centro de actividad de una campaña (docs/specs/modulo-8-10-campana.md, decisiones 4 y 19-23): lo que ha pasado
 * desde la última visita de quien lo mira, con lo que puede ver. El máster: las notas y los personajes de las
 * jugadoras, lo revelado por otros (o por la IA), los cambios de fecha y el registro por día. La jugadora: lo que le
 * revelan, lo que le llega del registro y los cambios de fecha; nunca notas de otras ni nada oculto
 */
import { z } from 'zod'
import { defineAction } from './action.ts'
import { knowledgeKind } from './knowledge.ts'

const person = z.object({ id: z.string(), name: z.string() }).nullable()

export const activityItem = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('note'),
    noteId: z.uuid(),
    title: z.string(),
    by: person,
    created: z.boolean().describe('Nueva (si no, cambiada)'),
    at: z.iso.datetime()
  }),
  z.object({
    type: z.literal('character'),
    characterId: z.uuid(),
    name: z.string(),
    owner: person,
    by: person,
    created: z.boolean(),
    changes: z.int(),
    at: z.iso.datetime()
  }),
  z.object({
    type: z.literal('revealed'),
    kind: knowledgeKind,
    targetId: z.string(),
    pageId: z.uuid().nullable(),
    title: z.string(),
    at: z.iso.datetime()
  }),
  z.object({
    type: z.literal('date'),
    to: z.string().describe('La fecha nueva, como se lee'),
    days: z.int().nullable(),
    travel: z.boolean(),
    ai: z.boolean(),
    at: z.iso.datetime()
  })
])

export type ActivityItem = z.infer<typeof activityItem>

export const getCampaignActivity = defineAction({
  name: 'getCampaignActivity',
  kind: 'read',
  description:
    'Lo que ha pasado en una campaña desde la última visita de la cuenta a su centro de actividad, con lo que puede ver: al máster, las notas y los personajes de los jugadores, lo revelado por otros o por la IA y los cambios de fecha; a un jugador, lo que le han revelado y los cambios de fecha; a los dos, el registro resumido por día real. count es el número de la insignia. No lo marca como visto',
  input: z.object({
    campaignId: z.uuid(),
    timeZone: z.string().max(64).default('UTC').describe('La zona horaria de los días del registro (IANA)')
  }),
  output: z.object({
    since: z.iso.datetime().nullable().describe('La última visita (null: nunca; entonces, desde que está en ella)'),
    count: z.int(),
    items: z.array(activityItem),
    log: z.array(
      z.object({
        day: z.string().describe('AAAA-MM-DD'),
        messages: z.int(),
        rolls: z.int(),
        shown: z.int()
      })
    )
  })
})

export const markActivitySeen = defineAction({
  name: 'markActivitySeen',
  kind: 'read',
  description:
    'La cuenta ha visto el centro de actividad de la campaña (al marcarlo o al salir de él): lo de antes deja de ser nuevo',
  input: z.object({ campaignId: z.uuid() }),
  output: z.object({ seenAt: z.iso.datetime() })
})
