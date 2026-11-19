/**
 * Un calendario en grande (ajustes tras los módulos, bloque C; Crisol antiguo, VistaMes y DetalleDia), con el esqueleto
 * de las pantallas: el título sobre la columna y «Editar calendario» a su derecha. En el centro, arriba, las vistas (Mes,
 * Semana y Año) y «Hoy de…» si alguna campaña tiene fecha; debajo, la vista con sus flechas y su título, que se pulsa
 * para ir a otra fecha (jump.tsx). A
 * la derecha, solo cuando hace falta, la ficha de un día: al pasar el ratón (o el foco) por él se ve, al pulsarlo se fija
 * y Esc la quita. Lleva su fecha con su era, su estación, sus lunas, lo que pasa y «Nuevo evento» (un evento suelto del
 * mundo, que sale en las cronologías que lo incluyan) y una página con esta fecha. Solo para quien lleva el mundo
 */
import type { CalendarView as Calendar, ChronologyEntryView, TimelineGroupView } from '@crisol/contracts'
import {
  type CalendarDefinition,
  dateFromDay,
  dayNumber,
  daysInMonth,
  describeDate,
  entryOccurrences,
  type FullDate,
  formatDate,
  seasonOfDay,
  weekGrid,
  yearBounds,
  yearStart
} from '@crisol/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate, useNavigate } from '@tanstack/react-router'
import { CalendarPlus, FilePlus, Pencil, Sparkles, Trash2, X } from 'lucide-react'
import { type CSSProperties, useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { TodayOf, todayIn, useChosenToday } from '../campaign-time/today-mark.tsx'
import { type CalendarPlace, CalendarView, placeOfMonth } from '../chronologies/calendar-view.tsx'
import chrono from '../chronologies/chronologies.module.css'
import { EventCard } from '../chronologies/event-card.tsx'
import { EventDialog, type EventDraft } from '../chronologies/event-dialog.tsx'
import { ConfirmDelete } from '../chronologies/screen.tsx'
import { useAnnounce } from '../components/announcer.tsx'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { FormError } from '../components/field.tsx'
import { failed, LoadError, SectionError } from '../components/load-error.tsx'
import { Screen } from '../components/screen.tsx'
import { Tour } from '../components/tour.tsx'
import { JumpTitle } from './jump.tsx'
import { WeekView, YearView } from './periods.tsx'
import { pagesOf, startYear } from './preview.tsx'
import { monthTitle, SeasonFacts, weekTitle, yearTitle } from './titles.tsx'
import styles from './view.module.css'

const route = getRouteApi('/mundos/$worldId/calendarios/$calendarId')

/** Lo que cae en un calendario (se vuelve a pedir con lo de las cronologías: eventos, páginas, calendarios) */
export const calendarEntriesQuery = (calendarId: string) => ['chronology', 'calendar', calendarId]

/** Las vistas del centro */
const MODES = ['week', 'month', 'year'] as const
type Mode = (typeof MODES)[number]

export function CalendarViewScreen() {
  const { t } = useTranslation()
  const { worldId, calendarId } = route.useParams()
  const api = useApi()
  const { account, pending } = useAccounts().useAccount()
  const worlds = useQuery({
    queryKey: ['worlds'],
    queryFn: () => api.call('listWorlds', {}),
    enabled: Boolean(account)
  })
  const calendars = useQuery({
    queryKey: ['calendars', worldId],
    queryFn: () => api.call('listCalendars', { worldId }),
    enabled: Boolean(account)
  })
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  if (!worlds.data)
    return failed(worlds) ? <LoadError error={worlds.error} onRetry={() => worlds.refetch()} /> : <Loading />
  if (!worlds.data.worlds.some((w) => w.id === worldId && w.role === 'master'))
    return (
      <Screen title={t('wiki.notFound')}>
        <Link to="/mundos">{t('worlds.title')}</Link>
      </Screen>
    )
  if (!calendars.data)
    return failed(calendars) ? <LoadError error={calendars.error} onRetry={() => calendars.refetch()} /> : <Loading />
  const calendar = calendars.data.calendars.find((c) => c.id === calendarId)
  if (!calendar)
    return (
      <Screen title={t('calendars.notFound')}>
        <Link to="/mundos/$worldId/calendarios" params={{ worldId }}>
          {t('calendars.title')}
        </Link>
      </Screen>
    )
  return <BigCalendar key={calendar.id} worldId={worldId} calendar={calendar} calendars={calendars.data.calendars} />
}

function BigCalendar({
  worldId,
  calendar,
  calendars
}: {
  worldId: string
  calendar: Calendar
  calendars: readonly Calendar[]
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const navigate = useNavigate()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const definition = calendar.definition
  const pages = useMemo(() => pagesOf(definition), [definition])
  const data = useQuery({
    queryKey: calendarEntriesQuery(calendar.id),
    queryFn: () => api.call('listCalendarEntries', { calendarId: calendar.id })
  })
  // Borrar un evento desde la ficha del día (se confirma; se deshace desde el historial)
  const [deleting, setDeleting] = useState<ChronologyEntryView | null>(null)
  const removeEvent = useMutation({
    mutationFn: (entry: ChronologyEntryView) => api.call('deleteTimelineEvent', { eventId: entry.eventId ?? '' }),
    onSuccess: async (_, entry) => {
      await client.invalidateQueries({ queryKey: calendarEntriesQuery(calendar.id) })
      await client.invalidateQueries({ queryKey: ['chronology'] })
      announce(t('chronologies.removed', { title: entry.title }))
    },
    onError: (error) => announce(errorText(error))
  })
  // A qué cronología va un evento nuevo (ADR-0032): las del mundo, primero las que usan este calendario
  const chronologies = useQuery({
    queryKey: ['chronologies', worldId],
    queryFn: () => api.call('listChronologies', { worldId })
  })
  const choices = useMemo(() => {
    const rows = chronologies.data?.chronologies ?? []
    const uses = (row: (typeof rows)[number]) =>
      row.calendarId === calendar.id || (row.calendarId === null && calendar.primary)
    return [...rows.filter(uses), ...rows.filter((row) => !uses(row))].map((row) => ({
      id: row.id,
      name: row.name,
      groups: row.groups
    }))
  }, [chronologies.data, calendar.id, calendar.primary])
  const chosen = useChosenToday(worldId)
  const today = chosen.current ? todayIn(calendars, calendar.id, chosen.current.today) : null

  const [mode, setMode] = useState<Mode>('month')
  // Los días que caben en los años del calendario: lo que se ve no pasa de ellos (se para en el borde)
  const { lowest, highest } = useMemo(() => {
    const years = yearBounds(definition)
    return { lowest: yearStart(definition, years.min), highest: yearStart(definition, years.max + 1) - 1 }
  }, [definition])
  const within = (day: number) => Math.min(highest, Math.max(lowest, day))
  // El día que guía lo que se ve (el mes, la semana o el año en que cae): el año de su última era (o el 1); con un
  // «hoy», él (la primera vez que llega)
  const [cursor, setRawCursor] = useState(() => within(dayNumber(definition, { year: startYear(definition) })))
  const setCursor = (day: number) => setRawCursor(within(day))
  const [jumped, setJumped] = useState(false)
  if (today !== null && !jumped) {
    setJumped(true)
    setCursor(today)
  }
  // El día fijado (al pulsarlo) y el que se ve al pasar el ratón; con uno fijado, la ficha se queda en él
  const [pinned, setPinned] = useState<number | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const [dialog, setDialog] = useState<EventDraft | null>(null)
  const shown = pinned ?? hovered

  // Pasar el ratón, como la vista previa de Archivos: la ficha sale al momento y se va al salir
  const hover = (day: number | null) => setHovered(day)

  // Esc quita el día fijado (si no hay un cuadro abierto, que se cierra él)
  useEffect(() => {
    if (shown === null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('dialog[open]')) return
      setHovered(null)
      setPinned(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [shown])

  // Pulsar fuera de la ficha la quita, como Esc (otro día la cambia; el conmutador de vistas y los cuadros, no)
  useEffect(() => {
    if (pinned === null) return
    const outside = (event: PointerEvent) => {
      const at = event.target as Element | null
      if (!at?.closest || at.closest('[data-dia-ficha], [data-tour="calendario-vistas"], [data-calendar-jump], dialog'))
        return
      setHovered(null)
      setPinned(null)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [pinned])

  const at = dateFromDay(definition, cursor)
  const place: CalendarPlace = placeOfMonth(pages, at.month, at.year)
  const page = pages[place.page] ?? pages[0]
  const month = definition.months.find((m) => m.id === page?.month)
  const week = useMemo(() => (mode === 'week' ? weekGrid(definition, cursor) : null), [mode, definition, cursor])
  const entries = data.data?.entries ?? []
  const groups = data.data?.groups ?? []

  const firstOf = (monthId: string, year: number) => dayNumber(definition, { year, month: monthId, day: 1 })
  const goToDay = (target: number) => {
    setCursor(target)
    setPinned(target)
  }
  // Pasar de semana: el día de antes de la primera o el de después de la última
  const stepWeek = (step: -1 | 1) => {
    const current = weekGrid(definition, cursor)
    setCursor(step < 0 ? current.first - 1 : current.last + 1)
  }
  const stepYear = (step: -1 | 1) => setCursor(firstOf(definition.months[0]?.id ?? at.month, at.year + step))
  // El título de la vista, que lleva a otra fecha
  const jumpTitle = (text: string) => (
    <JumpTitle
      text={text}
      mode={mode}
      definition={definition}
      at={at}
      onGo={(date) => setCursor(dayNumber(definition, date))}
    />
  )

  const datedPage = useMutation({
    mutationFn: async (date: FullDate) => {
      const created = await api.call('createPage', { worldId, title: t('wiki.untitled'), parentId: null })
      await api.call('setPageProperties', {
        pageId: created.id,
        properties: [
          { name: t('calendars.view.dateProperty'), type: 'date', value: { calendarId: calendar.id, start: date } }
        ]
      })
      return created
    },
    onSuccess: async (created) => {
      await client.invalidateQueries({ queryKey: ['pages', worldId] })
      await navigate({
        to: '/mundos/$worldId/wiki/$pageId',
        params: { worldId, pageId: created.id },
        search: { nuevo: true }
      })
    },
    onError: (error) => announce(errorText(error))
  })

  const openEntry = (entry: ChronologyEntryView) => {
    if (entry.kind === 'event') setDialog({ entry })
    else if (entry.pageId)
      void navigate({ to: '/mundos/$worldId/wiki/$pageId', params: { worldId, pageId: entry.pageId } })
  }

  const banner =
    month?.festival && !month.outsideWeek ? (
      <p className={styles.band} style={month.color ? ({ '--month-color': month.color } as CSSProperties) : undefined}>
        <Sparkles size={16} aria-hidden="true" />
        <span>{t('calendars.view.festival')}</span>
        <b>{month.name}</b>
        <span className={styles.bandDays}>
          {t('calendars.days', { count: daysInMonth(definition, at.year, month.id) })}
        </span>
      </p>
    ) : null

  return (
    <Screen
      title={calendar.name}
      actions={
        <Link
          to="/mundos/$worldId/calendarios/$calendarId/editar"
          params={{ worldId, calendarId: calendar.id }}
          className={styles.edit}
          data-tour="calendario-editar"
        >
          <Pencil size={16} aria-hidden="true" />
          {t('calendars.view.edit')}
        </Link>
      }
      left={
        shown !== null ? (
          <DayAside
            worldId={worldId}
            definition={definition}
            day={shown}
            today={today}
            pinned={pinned === shown}
            entries={entries}
            groups={groups}
            busy={datedPage.isPending}
            error={datedPage.error ? errorText(datedPage.error) : null}
            onClose={() => {
              setHovered(null)
              setPinned(null)
            }}
            onNewEvent={() => setDialog({ date: { calendarId: calendar.id, start: dateFromDay(definition, shown) } })}
            onNewPage={() => datedPage.mutate(dateFromDay(definition, shown))}
            onEdit={(entry) => setDialog({ entry })}
            onDelete={setDeleting}
          />
        ) : null
      }
      leftLabel={t('calendars.view.dayAside')}
    >
      <div className={styles.bar} data-tour="calendario-vistas">
        <div
          className={styles.modes}
          role="toolbar"
          aria-label={t('calendars.view.modes')}
          // Las flechas pasan de una vista a otra (el foco)
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            const buttons = [...event.currentTarget.querySelectorAll('button')]
            const at = buttons.indexOf(event.target as HTMLButtonElement)
            const step = event.key === 'ArrowLeft' ? -1 : 1
            buttons[(at + step + buttons.length) % buttons.length]?.focus()
            event.preventDefault()
          }}
        >
          {MODES.map((one) => (
            <button
              key={one}
              type="button"
              className={styles.mode}
              aria-pressed={mode === one}
              onClick={() => {
                // A la semana o al año del día fijado, si lo hay
                if (pinned !== null) setCursor(pinned)
                setMode(one)
              }}
            >
              {t(`calendars.view.${one}`)}
            </button>
          ))}
        </div>
        {chosen.options.length > 0 && (
          <div className={styles.tools}>
            <TodayOf options={chosen.options} value={chosen.chosen} onChange={chosen.choose} />
            {today !== null && (
              <button type="button" className={styles.todayButton} onClick={() => goToDay(today)}>
                {t('calendars.view.goToday')}
              </button>
            )}
          </div>
        )}
      </div>
      {failed(data) && <SectionError error={data.error} onRetry={() => data.refetch()} />}
      {mode === 'month' && (
        <div className={styles.month} data-tour="calendario-mes">
          <CalendarView
            worldId={worldId}
            definition={definition}
            entries={entries}
            groups={groups}
            compact={false}
            title={jumpTitle(monthTitle(t, definition, at.year, at.month))}
            where={place}
            onWhere={(next) => {
              const target = pages[next.page] ?? pages[0]
              if (target) setCursor(firstOf(target.month, next.year))
            }}
            selected={pinned}
            onSelect={setPinned}
            onHover={hover}
            today={today}
            banner={banner}
            onEdit={openEntry}
          />
        </div>
      )}
      {mode === 'week' && week && (
        <div className={styles.month} data-tour="calendario-mes">
          <WeekView
            definition={definition}
            week={week}
            title={jumpTitle(weekTitle(t, definition, week.first, week.last))}
            entries={entries}
            groups={groups}
            selected={pinned}
            today={today}
            onSelect={setPinned}
            onHover={hover}
            onOpen={openEntry}
            onStep={stepWeek}
          />
        </div>
      )}
      {mode === 'year' && (
        <div className={styles.month} data-tour="calendario-mes">
          <YearView
            definition={definition}
            year={at.year}
            title={jumpTitle(yearTitle(t, definition, at.year))}
            entries={entries}
            selected={pinned}
            today={today}
            onMonth={(id) => {
              setCursor(firstOf(id, at.year))
              setMode('month')
            }}
            onSelect={setPinned}
            onHover={hover}
            onStep={stepYear}
          />
        </div>
      )}
      {(data.data?.outside ?? 0) > 0 && (
        <p className={styles.outside}>{t('calendars.view.outside', { count: data.data?.outside ?? 0 })}</p>
      )}
      {deleting && (
        <ConfirmDelete
          entry={deleting}
          busy={removeEvent.isPending}
          onConfirm={() => removeEvent.mutate(deleting, { onSettled: () => setDeleting(null) })}
          onClose={() => setDeleting(null)}
        />
      )}
      {dialog && (
        <EventDialog
          worldId={worldId}
          chronologyId={null}
          choices={choices}
          calendarId={calendar.id}
          calendars={calendars}
          groups={groups}
          draft={dialog}
          onClose={() => setDialog(null)}
          onSaved={() => undefined}
        />
      )}
      <Tour
        id="calendario-vista"
        steps={[
          { target: '[data-tour="calendario-mes"]', text: t('tour.calendarView.month') },
          { target: '[data-tour="calendario-vistas"]', text: t('tour.calendarView.views'), placement: 'bottom' },
          { target: '[data-tour="calendario-editar"]', text: t('tour.calendarView.edit'), placement: 'bottom' }
        ]}
      />
    </Screen>
  )
}

/**
 * La ficha de un día: su fecha con su era, su estación y el día del año, sus lunas, lo que pasa en él y lo que se puede
 * crear con su fecha. Fijado, lleva su «×» (y Esc lo quita)
 */
function DayAside({
  worldId,
  definition,
  day,
  today,
  pinned,
  entries,
  groups,
  busy,
  error,
  onClose,
  onNewEvent,
  onNewPage,
  onEdit,
  onDelete
}: {
  worldId: string
  definition: CalendarDefinition
  day: number
  today: number | null
  /** Fijado al pulsarlo (si no, se ve al pasar el ratón) */
  pinned: boolean
  entries: readonly ChronologyEntryView[]
  groups: readonly TimelineGroupView[]
  busy: boolean
  /** Lo que falló al crear la página con su fecha */
  error: string | null
  onClose: () => void
  onNewEvent: () => void
  onNewPage: () => void
  onEdit: (entry: ChronologyEntryView) => void
  onDelete: (entry: ChronologyEntryView) => void
}) {
  const { t } = useTranslation()
  const titleId = useId()
  const date = dateFromDay(definition, day)
  const described = describeDate(definition, date)
  // Lo que cae ese día (con día: lo de todo el mes o el año va arriba de la rejilla)
  const here = useMemo(
    () => entries.filter((e) => e.start.day !== undefined && entryOccurrences(definition, e, day, day).length > 0),
    [entries, definition, day]
  )
  // Su estación, con su punto de color como en la cabecera del mes
  const season = seasonOfDay(definition, described.dayOfYear)
  return (
    <div className={styles.side} data-dia-ficha="">
      <section aria-labelledby={titleId} className={styles.day} data-tour="calendario-dia">
        <div className={styles.dayHead}>
          <h2 id={titleId}>
            {day === today && <span className={styles.todayMark}>{t('calendars.view.today')}</span>}
            {formatDate(definition, date, { weekday: true, era: true })}
          </h2>
          {pinned && (
            <button
              type="button"
              className={styles.close}
              aria-label={t('calendars.view.closeDay')}
              title={t('calendars.view.closeDay')}
              onClick={onClose}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        {season && (
          <p className={`${chrono.calendarFacts} ${styles.dayFacts}`}>
            <SeasonFacts seasons={[season]} />
          </p>
        )}
        {described.moons.length > 0 && (
          <ul className={styles.moons}>
            {described.moons.map((moon) => (
              <li key={moon.id}>
                <span
                  className={styles.moonDisc}
                  style={{ '--moon-color': moon.color, '--lit': moon.illumination } as CSSProperties}
                  aria-hidden="true"
                />
                <b>{moon.name}</b>
                <span>{moon.phase}</span>
              </li>
            ))}
          </ul>
        )}
        {here.length > 0 ? (
          <div className={styles.entries}>
            {here.map((entry) => (
              <EventCard
                key={entry.key}
                worldId={worldId}
                entry={entry}
                group={groups.find((g) => g.id === entry.groupId)}
                compact
                headingLevel={3}
                titleAction={entry.kind === 'event' ? () => onEdit(entry) : undefined}
                actions={
                  entry.kind === 'event' ? (
                    <button
                      type="button"
                      className={styles.deleteEvent}
                      aria-label={t('calendars.view.deleteEvent', { title: entry.title })}
                      title={t('calendars.view.deleteEvent', { title: entry.title })}
                      onClick={() => onDelete(entry)}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  ) : undefined
                }
              />
            ))}
          </div>
        ) : (
          <p className={styles.empty}>{t('calendars.view.dayEmpty')}</p>
        )}
        <div className={styles.dayActions}>
          <button
            type="button"
            className={styles.action}
            title={t('calendars.view.newEventTitle')}
            aria-label={t('calendars.view.newEventTitle')}
            onClick={onNewEvent}
          >
            <CalendarPlus size={16} aria-hidden="true" />
            {t('calendars.view.newEvent')}
          </button>
          <BusyButton
            type="button"
            className={styles.action}
            title={t('calendars.view.newPageTitle')}
            aria-label={t('calendars.view.newPageTitle')}
            busy={busy}
            onClick={onNewPage}
          >
            <FilePlus size={16} aria-hidden="true" />
            {t('calendars.view.newPage')}
          </BusyButton>
          <FormError message={error} />
        </div>
      </section>
    </div>
  )
}
