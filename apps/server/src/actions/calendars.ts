/**
 * Los calendarios de un mundo (módulo 8, docs/specs/calendarios.md; ADR-0029). Los lleva el máster (page.write); los
 * lee quien lee la wiki (page.view), y a un jugador no le llegan las eras solo del máster (ADR-0017). La definición se
 * valida siempre aquí: con problemas, no se guarda (BAD_CALENDAR)
 */
import {
  type CalendarView,
  convertDate,
  createCalendar,
  deleteCalendar,
  describeDate,
  getCalendar,
  listCalendars,
  updateCalendar
} from '@crisol/contracts'
import { calendarsRepo, chronologiesRepo, operation, schema } from '@crisol/db'
import {
  addDays,
  blankCalendar,
  type CalendarDefinition,
  type CalendarProblem,
  convertDate as convertBetween,
  copyCalendar,
  dateForm,
  dayNumber,
  describeDate as describeIn,
  formatRange,
  gregorianCalendar,
  invertedCorrespondence,
  keyBetween,
  monthNumber,
  NotFoundError,
  normalizeCalendar,
  offsetToPrimary,
  parseDate,
  validateCalendar,
  type WorldDate,
  yearLength
} from '@crisol/domain'
import { calendarsChanged, chronologiesChanged, pagesChanged } from '../realtime/events.ts'
import { worldCalendars as asWorld, retextedPages, seenDefinition as seen } from '../wiki/dates.ts'
import { authorizedView, type ReadAs } from '../wiki/reader.ts'
import { authorizedWiki } from './access.ts'
import { datesClipped, datesInUse } from './calendar-dates.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

type CalendarRow = calendarsRepo.CalendarRow

/** Cuántos calendarios puede tener un mundo */
export const MAX_CALENDARS = 50

const viewOf = (row: CalendarRow, full: boolean): CalendarView => ({
  id: row.id,
  worldId: row.worldId,
  name: row.name,
  primary: row.isPrimary,
  definition: seen(row.definition, full),
  version: row.version
})

/**
 * El calendario para leerlo, con lo que ve quien lo pide (ADR-0017, por la proyección): el máster, todo; un jugador (o
 * el máster viendo como uno), sin las eras solo del máster. Si no existe (o no lo ve), 404
 */
async function viewedCalendar(ctx: ActionContext, calendarId: string, as: ReadAs) {
  const calendar = calendarId ? await calendarsRepo.findCalendar(ctx.db, calendarId) : null
  const { wiki, view } = await authorizedView(ctx, calendar?.worldId ?? '', as)
  if (!calendar) throw new NotFoundError('calendar')
  return { calendar, wiki, full: view.full }
}

/** El calendario y su mundo, para cambiarlo (page.write). Si no existe (o no lo ve), 404 */
async function authorizedCalendar(ctx: ActionContext, capability: 'page.write', calendarId: string) {
  const calendar = calendarId ? await calendarsRepo.findCalendar(ctx.db, calendarId) : null
  const wiki = await authorizedWiki(ctx, capability, calendar?.worldId ?? '')
  if (!calendar) throw new NotFoundError('calendar')
  return { calendar, wiki }
}

/** Los problemas, en el error: la IA lee qué falla y dónde */
function rejectProblems(problems: readonly CalendarProblem[]) {
  if (problems.length === 0) return
  throw new InvalidRequestError('BAD_CALENDAR', problems.map((p) => p.message).join(' '))
}

/**
 * La definición que se guarda, de lo escrito (con sus ids y referencias resueltas), y sus problemas (los de leerla y
 * los de validarla); la del principal no lleva correspondencia (es él con quien se corresponden los demás)
 */
function definitionFrom(
  input: Parameters<typeof normalizeCalendar>[0],
  others: readonly CalendarRow[],
  primary: boolean
): { definition: CalendarDefinition; problems: CalendarProblem[] } {
  const primaryRow = others.find((row) => row.isPrimary) ?? null
  const draft = primary ? { ...input, correspondence: null } : input
  const { definition, problems } = normalizeCalendar(draft, {
    calendars: others.map((row) => ({ id: row.id, definition: row.definition })),
    primaryId: primaryRow?.id ?? null
  })
  return { definition, problems: [...problems, ...validateCalendar(definition, anchorOf(definition, others))] }
}

/** El calendario al que apunta su correspondencia (null: no es del mundo) */
function anchorOf(definition: CalendarDefinition, others: readonly CalendarRow[]) {
  const target = definition.correspondence?.calendarId
  if (!target) return {}
  return { anchor: others.find((row) => row.id === target)?.definition ?? null }
}

/** Una fecha escrita (texto u objeto, con el mes por id, nombre o número) contra el calendario: BAD_DATE si no cabe */
function dateIn(
  definition: CalendarDefinition,
  value: string | { year: number; month?: string | number | undefined; day?: number | undefined }
): WorldDate {
  const parsed = parseDate(
    definition,
    typeof value === 'string'
      ? value
      : {
          year: value.year,
          ...(value.month === undefined ? {} : { month: String(value.month) }),
          ...(value.day === undefined ? {} : { day: value.day })
        }
  )
  if (!parsed.ok) throw new InvalidRequestError('BAD_DATE', parsed.message)
  return parsed.date
}

/** Lo que dura su año bisiesto, con todas sus reglas a la vez (null: sin bisiestos) */
function leapYearLength(definition: CalendarDefinition): number | null {
  if (definition.leapRules.length === 0) return null
  return yearLength(definition) + definition.leapRules.reduce((sum, rule) => sum + rule.days, 0)
}

/** Para la cola de la IA: el nombre del calendario que se crea, cambia o borra (como en el historial) */
export async function calendarRequest(ctx: ActionContext, action: string, input: Record<string, unknown>) {
  if (action === 'createCalendar') return { name: String(input.name ?? '') }
  if ((action === 'updateCalendar' || action === 'deleteCalendar') && typeof input.calendarId === 'string') {
    const { calendar } = await authorizedCalendar(ctx, 'page.write', input.calendarId)
    return {
      name: typeof input.name === 'string' ? input.name : calendar.name,
      ...(input.primary ? { primary: true } : {})
    }
  }
  return {}
}

export const calendarActions = [
  implement(listCalendars, async (ctx, { worldId, campaignId, asCharacterId }) => {
    const { view } = await authorizedView(ctx, worldId, { campaignId, asCharacterId })
    const full = view.full
    const rows = await calendarsRepo.listCalendars(ctx.db, worldId)
    return { calendars: rows.map((row) => viewOf(row, full)) }
  }),

  implement(getCalendar, async (ctx, { calendarId, campaignId, asCharacterId }) => {
    const { calendar, full } = await viewedCalendar(ctx, calendarId, { campaignId, asCharacterId })
    const view = viewOf(calendar, full)
    const rows = await calendarsRepo.listCalendars(ctx.db, calendar.worldId)
    return {
      calendar: view,
      months: view.definition.months.map((m) => ({
        id: m.id,
        name: m.name,
        number: monthNumber(view.definition, m.id),
        days: m.days,
        festival: !!m.festival,
        outsideWeek: !!m.outsideWeek
      })),
      yearLength: yearLength(view.definition),
      leapYearLength: leapYearLength(view.definition),
      convertible: offsetToPrimary(asWorld(rows), calendar.id) !== null
    }
  }),

  implement(createCalendar, async (ctx, { worldId, name, from }) => {
    const wiki = await authorizedWiki(ctx, 'page.write', worldId)
    const rows = await calendarsRepo.listCalendars(ctx.db, worldId)
    if (rows.length >= MAX_CALENDARS)
      throw new InvalidRequestError('TOO_MANY_CALENDARS', `un mundo tiene como mucho ${MAX_CALENDARS} calendarios`)
    const primary = rows.length === 0
    let definition: CalendarDefinition
    if (from === 'blank') definition = blankCalendar()
    else if (from === 'gregorian') definition = gregorianCalendar()
    else if ('copyOf' in from) {
      const source = rows.find((row) => row.id === from.copyOf)
      if (!source) throw new NotFoundError('calendar')
      definition = copyCalendar(source.definition)
    } else {
      const written = definitionFrom(from.definition, rows, primary)
      rejectProblems(written.problems)
      definition = written.definition
    }
    const last = rows.at(-1)?.position ?? null
    const created = await calendarsRepo.createCalendar(
      ctx.db,
      historyContext(ctx, 'createCalendar', { name }, { organizationId: wiki.organizationId, worldId }),
      { worldId, name, position: keyBetween(last, null), isPrimary: primary, definition }
    )
    ctx.realtime.publish(calendarsChanged(wiki))
    return viewOf(created, true)
  }),

  implement(updateCalendar, async (ctx, { calendarId, version, name, primary, after, definition: input }) => {
    const { calendar, wiki } = await authorizedCalendar(ctx, 'page.write', calendarId)
    if (version !== undefined && version !== calendar.version)
      throw new InvalidRequestError('CALENDAR_CHANGED', 'alguien lo cambió entre medias: vuelve a leerlo')
    const rows = await calendarsRepo.listCalendars(ctx.db, calendar.worldId)
    const others = rows.filter((row) => row.id !== calendar.id)
    const becomesPrimary = primary === true && !calendar.isPrimary
    const patch: Partial<Pick<CalendarRow, 'name' | 'position' | 'definition'>> = {}
    // Un mes que se acorta: las fechas con un día que ya no cabe se leen en su último (no se reescriben); se dice
    let clipped = 0
    if (name !== undefined) patch.name = name
    if (input) {
      const { definition: next, problems } = definitionFrom(input, others, calendar.isPrimary || becomesPrimary)
      // Un mes que se quita y tiene fechas: no (no se reescribe ninguna); antes que los demás problemas, que pueden
      // venir de quitarlo
      const kept = new Set(next.months.map((m) => m.id))
      const removed = calendar.definition.months.filter((m) => !kept.has(m.id)).map((m) => m.id)
      const used = await datesInUse(ctx.db, calendar.id, removed)
      if (used > 0)
        throw new InvalidRequestError(
          'CALENDAR_MONTH_IN_USE',
          `${used === 1 ? 'una fecha usa' : `${used} fechas usan`} un mes que se quita: cámbialas antes`
        )
      rejectProblems(problems)
      patch.definition = next
      clipped = await datesClipped(ctx.db, calendar.id, next)
    }
    // Cómo se leen sus fechas en las páginas (lo que se busca), al día en la misma operación
    const dated = patch.definition ? await retextedPages(ctx.db, calendar.id, patch.definition) : []
    if (after !== undefined) {
      const index = after === null ? -1 : others.findIndex((row) => row.id === after)
      if (after !== null && index < 0) throw new NotFoundError('calendar')
      patch.position = keyBetween(others[index]?.position ?? null, others[index + 1]?.position ?? null)
    }
    const context = historyContext(
      ctx,
      'updateCalendar',
      {
        name: name ?? calendar.name,
        ...(name !== undefined && name !== calendar.name ? { from: calendar.name, to: name } : {}),
        ...(becomesPrimary ? { primary: true } : {}),
        ...(after !== undefined && !input && name === undefined && !becomesPrimary ? { moved: true } : {})
      },
      { organizationId: wiki.organizationId, worldId: calendar.worldId }
    )
    let saved: CalendarRow
    if (becomesPrimary) {
      // El principal no lleva correspondencia; el anterior recibe la inversa si este la tenía con él
      const own = patch.definition ?? calendar.definition
      const previous = others.find((row) => row.isPrimary) ?? null
      const inverse = previous
        ? invertedCorrespondence(
            { id: previous.id, primary: true, definition: previous.definition },
            { id: calendar.id, primary: false, definition: own }
          )
        : null
      patch.definition = { ...own, correspondence: null }
      saved = await calendarsRepo.makePrimary(
        ctx.db,
        context,
        calendar.id,
        patch,
        previous
          ? { id: previous.id, ...(inverse ? { definition: { ...previous.definition, correspondence: inverse } } : {}) }
          : null,
        dated
      )
    } else if (Object.keys(patch).length > 0) {
      saved = await calendarsRepo.updateCalendar(ctx.db, context, calendar.id, patch, dated)
    } else return viewOf(calendar, true)
    ctx.realtime.publish(calendarsChanged(wiki))
    if (dated.length > 0) ctx.realtime.publish(pagesChanged(wiki))
    return { ...viewOf(saved, true), ...(clipped > 0 ? { clipped } : {}) }
  }),

  implement(deleteCalendar, async (ctx, { calendarId }) => {
    const { calendar, wiki } = await authorizedCalendar(ctx, 'page.write', calendarId)
    const rows = await calendarsRepo.listCalendars(ctx.db, calendar.worldId)
    if (calendar.isPrimary && rows.length > 1)
      throw new InvalidRequestError('CALENDAR_IS_PRIMARY', 'es el principal: haz principal a otro antes de borrarlo')
    const used = await datesInUse(ctx.db, calendar.id)
    if (used > 0)
      throw new InvalidRequestError('CALENDAR_IN_USE', `${used === 1 ? 'lo usa una fecha' : `lo usan ${used} fechas`}`)
    // Los que se correspondían con él se quedan sin correspondencia, y las cronologías que lo usaban pasan al
    // principal, en la misma operación (deshacer lo devuelve)
    const linked = rows.filter((row) => row.definition.correspondence?.calendarId === calendar.id)
    const using = (await chronologiesRepo.listChronologies(ctx.db, calendar.worldId)).filter(
      (row) => row.calendarId === calendar.id
    )
    await operation(
      ctx.db,
      historyContext(
        ctx,
        'deleteCalendar',
        { name: calendar.name },
        { organizationId: wiki.organizationId, worldId: calendar.worldId }
      ),
      async (w) => {
        for (const row of linked)
          await w.update(schema.calendars, row.id, { definition: { ...row.definition, correspondence: null } })
        for (const row of using) await w.update(schema.chronologies, row.id, { calendarId: null })
        await w.remove(schema.calendars, calendar.id)
      }
    )
    ctx.realtime.publish(calendarsChanged(wiki))
    if (using.length > 0) ctx.realtime.publish(chronologiesChanged(wiki))
    return { id: calendar.id }
  }),

  implement(describeDate, async (ctx, input) => {
    const as = { campaignId: input.campaignId, asCharacterId: input.asCharacterId }
    let calendar: CalendarRow
    let full: boolean
    if (input.calendarId) ({ calendar, full } = await viewedCalendar(ctx, input.calendarId, as))
    else {
      const { wiki, view } = await authorizedView(ctx, input.worldId ?? '', as)
      const primary = await calendarsRepo.primaryCalendar(ctx.db, wiki.worldId)
      if (!primary) throw new InvalidRequestError('NO_CALENDAR', 'este mundo aún no tiene calendario')
      calendar = primary
      full = view.full
    }
    const definition = seen(calendar.definition, full)
    const date = dateIn(definition, input.date)
    let primary = null
    if (!calendar.isPrimary) {
      const rows = await calendarsRepo.listCalendars(ctx.db, calendar.worldId)
      const target = rows.find((row) => row.isPrimary)
      const converted = target ? convertBetween(asWorld(rows, full), calendar.id, target.id, date) : null
      if (target && converted) {
        const targetDefinition = seen(target.definition, full)
        primary = {
          calendarId: target.id,
          name: target.name,
          text: formatRange(targetDefinition, converted.start, converted.end),
          form: dateForm(targetDefinition, converted.start)
        }
      }
    }
    return {
      calendarId: calendar.id,
      calendar: calendar.name,
      date: describeIn(definition, date),
      primary,
      added: input.addDays === undefined ? null : describeIn(definition, addDays(definition, date, input.addDays)),
      daysUntil:
        input.until === undefined
          ? null
          : dayNumber(definition, dateIn(definition, input.until)) - dayNumber(definition, date)
    }
  }),

  implement(convertDate, async (ctx, { calendarId, to, date: value, campaignId, asCharacterId }) => {
    const { calendar, full } = await viewedCalendar(ctx, calendarId, { campaignId, asCharacterId })
    const rows = await calendarsRepo.listCalendars(ctx.db, calendar.worldId)
    const target = rows.find((row) => row.id === to)
    if (!target) throw new NotFoundError('calendar')
    const definition = seen(calendar.definition, full)
    const date = dateIn(definition, value)
    const converted = convertBetween(asWorld(rows, full), calendar.id, target.id, date)
    if (!converted)
      throw new InvalidRequestError(
        'CALENDAR_NOT_CONVERTIBLE',
        'alguno de los dos no tiene correspondencia con el principal: ponla en su editor'
      )
    const targetDefinition = seen(target.definition, full)
    return {
      from: formatRange(definition, date, null),
      to: {
        calendarId: target.id,
        name: target.name,
        text: formatRange(targetDefinition, converted.start, converted.end),
        form: dateForm(targetDefinition, converted.start)
      }
    }
  })
]
