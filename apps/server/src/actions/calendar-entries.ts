/**
 * Lo que cae en un calendario, para su vista grande (ajustes tras los módulos, bloque C): los eventos de todas las
 * cronologías del mundo (ADR-0032) y las páginas con fecha, en ese calendario. Solo quien lleva el
 * mundo (page.write): a un jugador, lo que sabe le llega por las cronologías que se le enseñan (ADR-0017)
 */
import { listCalendarEntries } from '@crisol/contracts'
import { calendarsRepo } from '@crisol/db'
import { DEFAULT_CHRONOLOGY_FILTER, NotFoundError } from '@crisol/domain'
import { authorizedView } from '../wiki/reader.ts'
import { authorizedWiki } from './access.ts'
import { entriesOf, groupView, worldData } from './chronologies.ts'
import { implement } from './registry.ts'

export const calendarEntryActions = [
  implement(listCalendarEntries, async (ctx, { calendarId }) => {
    const calendar = calendarId ? await calendarsRepo.findCalendar(ctx.db, calendarId) : null
    await authorizedWiki(ctx, 'page.write', calendar?.worldId ?? '')
    if (!calendar) throw new NotFoundError('calendar')
    const { view } = await authorizedView(ctx, calendar.worldId)
    const data = await worldData(ctx, calendar.worldId, view, { pages: true })
    const { entries, outside } = entriesOf(data, {
      calendarId: calendar.id,
      filter: { ...DEFAULT_CHRONOLOGY_FILTER, pages: true }
    })
    return { groups: data.groups.map(groupView), entries, outside }
  })
]
