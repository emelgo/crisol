/**
 * Lo que cae en un calendario (ajustes tras los módulos, bloque C): para su vista grande, los eventos de todas las
 * cronologías del mundo (cada uno con la suya) y las fechas de las páginas, en ese calendario (lo de otros, convertido con su correspondencia). Solo para quien
 * lleva el mundo: a un jugador, lo que sabe le llega por las cronologías que se le enseñan (ADR-0017)
 */
import { z } from 'zod'
import { defineAction } from './action.ts'
import { chronologyEntry, timelineGroupView } from './chronologies.ts'

export const listCalendarEntries = defineAction({
  name: 'listCalendarEntries',
  kind: 'read',
  description:
    'Lo que cae en un calendario, para quien lleva el mundo: los eventos de todas sus cronologías (con chronologyId) y las páginas con fecha, en orden y en ese calendario (lo de otros calendarios, convertido; outside dice cuántas fechas no se pueden pasar a él por no tener correspondencia), y los grupos de eventos de todas',
  input: z.object({ calendarId: z.uuid() }),
  output: z.object({
    groups: z.array(timelineGroupView),
    entries: z.array(chronologyEntry),
    outside: z.int().describe('Fechas de otros calendarios sin correspondencia (o que ya no caben): no salen')
  })
})
