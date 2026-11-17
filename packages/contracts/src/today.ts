/**
 * El «hoy» de cada campaña (docs/specs/modulo-8-10-campana.md, decisiones 1 y 5-10): una fecha con día de un
 * calendario del mundo (al ponerla, el principal), que el máster pone o avanza y la jugadora solo lee. Cada cambio queda
 * en el registro de la partida y se deshace desde el historial
 */
import { z } from 'zod'
import { defineAction } from './action.ts'
import { dateInput, fullDate } from './calendars.ts'
import { sunView, weatherDayView, weatherZone } from './weather.ts'

/** Una fecha de la campaña, como se lee (sin lo solo del máster para una jugadora) */
export const campaignDate = z.object({
  calendarId: z.uuid(),
  calendar: z.string(),
  date: fullDate,
  text: z.string().describe('«Frostelle, 18 de Siega de 1250 RC»'),
  form: z.string().describe('La forma con el nombre del mes: 1250-Siega-18'),
  weekday: z.string().nullable(),
  season: z.string().nullable(),
  day: z.int().describe('Su día absoluto en su calendario: para contar «hace / dentro de N días»')
})

export type CampaignDate = z.infer<typeof campaignDate>

export const getCampaignToday = defineAction({
  name: 'getCampaignToday',
  kind: 'read',
  description:
    'El «hoy» de una campaña: su fecha (null si aún no tiene), cuántos días tiene su semana, su zona y su latitud, el clima y el sol de hoy y, al máster, la previsión de los 7 días siguientes. Sin fecha, al máster le propone la de otra campaña del mismo mundo (suggestion)',
  input: z.object({ campaignId: z.uuid() }),
  output: z.object({
    today: campaignDate.nullable(),
    suggestion: campaignDate.nullable().describe('Sin fecha: la de otra campaña del mundo, para copiarla (al máster)'),
    weekLength: z.int().describe('Los días de la semana de su calendario: lo que avanza «+1 semana»'),
    zone: weatherZone,
    latitude: z.number(),
    weather: weatherDayView.nullable().describe('El clima de hoy, con su sol (null sin fecha)'),
    sun: sunView.nullable(),
    forecast: z.array(weatherDayView).describe('Los 7 días siguientes, solo al máster')
  })
})

export const setCampaignToday = defineAction({
  name: 'setCampaignToday',
  kind: 'write',
  description:
    'Cambia el «hoy» de una campaña (solo su máster): una fecha con día del calendario principal del mundo (date, como 1250-Siega-18), o avanzar o retroceder días (days) o semanas (weeks, los días de la semana de su calendario) desde la que tiene. Queda en el registro de la partida y se deshace desde el historial',
  input: z
    .object({
      campaignId: z.uuid(),
      date: dateInput.optional(),
      days: z.int().min(-100_000).max(100_000).optional(),
      weeks: z.int().min(-10_000).max(10_000).optional()
    })
    .refine((input) => [input.date, input.days, input.weeks].filter((v) => v !== undefined).length === 1, {
      message: 'date, days o weeks'
    }),
  output: z.object({ today: campaignDate })
})
