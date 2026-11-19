/**
 * Un calendario en grande (ajustes tras los módulos, bloque C; Crisol antiguo, VistaMes y DetalleDia): con el esqueleto
 * de las pantallas, el título sobre la columna y «Editar calendario» a su derecha. En el centro, el mes grande (la vista
 * «Calendario» de las cronologías) con lo que cae en él, las lunas, la estación, la franja de una festividad y «Hoy
 * de…» si alguna campaña tiene fecha; a la izquierda, el año en pequeño y los datos del calendario; a la derecha, el día
 * elegido con «Nuevo evento» (un evento suelto del mundo, que sale en las cronologías que lo incluyan) y «Página con
 * esta fecha». Solo para quien lleva el mundo
 */
import type { CalendarView as Calendar, ChronologyEntryView, TimelineGroupView } from '@crisol/contracts'
import {
  type CalendarDefinition,
  dateFromDay,
  dateSpan,
  dayNumber,
  daysInMonth,
  describeDate,
  entryOccurrences,
  type FullDate,
  formatYear,
  monthNumber,
  yearLength
} from '@crisol/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate, useNavigate } from '@tanstack/react-router'
import { CalendarPlus, FilePlus, Pencil, Sparkles } from 'lucide-react'
import { type CSSProperties, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { TodayOf, todayIn, useChosenToday } from '../campaign-time/today-mark.tsx'
import { type CalendarPlace, CalendarView, placeOfMonth } from '../chronologies/calendar-view.tsx'
import { EventCard } from '../chronologies/event-card.tsx'
import { EventDialog, type EventDraft } from '../chronologies/event-dialog.tsx'
import { useAnnounce } from '../components/announcer.tsx'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { failed, LoadError, SectionError } from '../components/load-error.tsx'
import { Screen } from '../components/screen.tsx'
import { Tour } from '../components/tour.tsx'
import { pagesOf, startYear } from './preview.tsx'
import styles from './view.module.css'
import { YearStrip } from './year-strip.tsx'

const route = getRouteApi('/mundos/$worldId/calendarios/$calendarId')

/** Lo que cae en un calendario (se vuelve a pedir con lo de las cronologías: eventos, páginas, calendarios) */
export const calendarEntriesQuery = (calendarId: string) => ['chronology', 'calendar', calendarId]

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
  const chosen = useChosenToday(worldId)
  const today = chosen.current ? todayIn(calendars, calendar.id, chosen.current.today) : null
  const placeOfDay = (day: number) => {
    const date = dateFromDay(definition, day)
    return placeOfMonth(pages, date.month, date.year)
  }
  // Se abre en el año de su última era (o el 1); con un «hoy», en él (la primera vez que llega)
  const [place, setPlace] = useState<CalendarPlace>(() => ({ page: 0, year: startYear(definition) }))
  const [selected, setSelected] = useState<number | null>(null)
  const [jumped, setJumped] = useState(false)
  if (today !== null && !jumped) {
    setJumped(true)
    setPlace(placeOfDay(today))
    setSelected(today)
  }
  const [dialog, setDialog] = useState<EventDraft | null>(null)

  const page = pages[Math.min(place.page, pages.length - 1)] ?? pages[0]
  // Los días de la página que se ve (el mes con sus fiestas de fuera de la semana)
  const range = useMemo(() => {
    if (!page) return null
    const ids = [...page.before, page.month, ...page.after]
    const first = dayNumber(definition, { year: place.year, month: ids[0] ?? page.month, day: 1 })
    const last = dateSpan(definition, { year: place.year, month: ids.at(-1) ?? page.month })[1]
    return { first, last, start: dayNumber(definition, { year: place.year, month: page.month, day: 1 }) }
  }, [definition, page, place.year])
  const inPage = (day: number | null): day is number =>
    day !== null && range !== null && day >= range.first && day <= range.last
  // El día que se ve a la derecha: el elegido, si está en el mes; si no, hoy o el primero del mes
  const day = inPage(selected) ? selected : inPage(today) ? today : (range?.start ?? null)

  const entries = data.data?.entries ?? []
  const groups = data.data?.groups ?? []
  const month = definition.months.find((m) => m.id === page?.month)

  const goToDay = (target: number) => {
    setPlace(placeOfDay(target))
    setSelected(target)
  }

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
          {t('calendars.days', { count: daysInMonth(definition, place.year, month.id) })}
        </span>
      </p>
    ) : null

  const tools =
    chosen.options.length > 0 ? (
      <div className={styles.tools}>
        <TodayOf options={chosen.options} value={chosen.chosen} onChange={chosen.choose} />
        <button
          type="button"
          className={styles.todayButton}
          disabled={today === null}
          onClick={() => today !== null && goToDay(today)}
        >
          {t('calendars.view.today')}
        </button>
      </div>
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
        <YearAside
          calendar={calendar}
          year={place.year}
          current={page?.month ?? null}
          onMonth={(id) => {
            setPlace(placeOfMonth(pages, id, place.year))
            setSelected(null)
          }}
        />
      }
      leftLabel={t('calendars.view.yearAside')}
      right={
        day !== null ? (
          <DayAside
            worldId={worldId}
            definition={definition}
            day={day}
            today={today}
            entries={entries}
            groups={groups}
            busy={datedPage.isPending}
            onNewEvent={() => setDialog({ date: { calendarId: calendar.id, start: dateFromDay(definition, day) } })}
            onNewPage={() => datedPage.mutate(dateFromDay(definition, day))}
            onEdit={(entry) => setDialog({ entry })}
          />
        ) : null
      }
      rightLabel={t('calendars.view.dayAside')}
    >
      {failed(data) && <SectionError error={data.error} onRetry={() => data.refetch()} />}
      <div className={styles.month} data-tour="calendario-mes">
        <CalendarView
          worldId={worldId}
          definition={definition}
          entries={entries}
          groups={groups}
          compact={false}
          where={place}
          onWhere={(next) => setPlace(next)}
          selected={day}
          onSelect={setSelected}
          today={today}
          tools={tools}
          banner={banner}
          yearArrows
          onEdit={openEntry}
        />
      </div>
      {(data.data?.outside ?? 0) > 0 && (
        <p className={styles.outside}>{t('calendars.view.outside', { count: data.data?.outside ?? 0 })}</p>
      )}
      {dialog && (
        <EventDialog
          worldId={worldId}
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
          { target: '[data-tour="calendario-dia"]', text: t('tour.calendarView.day'), placement: 'left' },
          { target: '[data-tour="calendario-editar"]', text: t('tour.calendarView.edit'), placement: 'bottom' }
        ]}
      />
    </Screen>
  )
}

/** La ficha de la izquierda: el año que se ve, en pequeño (cada mes lleva a él), y los datos del calendario */
function YearAside({
  calendar,
  year,
  current,
  onMonth
}: {
  calendar: Calendar
  year: number
  current: string | null
  onMonth: (monthId: string) => void
}) {
  const { t } = useTranslation()
  const { definition } = calendar
  const yearId = useId()
  const factsId = useId()
  return (
    <div className={styles.side}>
      <section aria-labelledby={yearId}>
        <h2 id={yearId}>{formatYear(definition, year)}</h2>
        <YearStrip definition={definition} label={t('calendars.year', { name: calendar.name })} current={current} />
        <ol className={styles.months} aria-label={t('calendars.view.months')}>
          {definition.months.map((month) => {
            const number = monthNumber(definition, month.id)
            return (
              <li key={month.id}>
                <button
                  type="button"
                  className={styles.monthButton}
                  aria-current={month.id === current ? 'true' : undefined}
                  data-festival={month.festival || undefined}
                  style={month.color ? ({ '--month-color': month.color } as CSSProperties) : undefined}
                  onClick={() => onMonth(month.id)}
                >
                  <span className={styles.monthNumber} aria-hidden="true">
                    {number ?? '·'}
                  </span>
                  <span className={styles.monthName}>{month.name}</span>
                  <span className={styles.monthDays}>{daysInMonth(definition, year, month.id)}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </section>
      <section aria-labelledby={factsId}>
        <h2 id={factsId}>{t('calendars.view.facts')}</h2>
        <CalendarFacts calendar={calendar} />
      </section>
    </div>
  )
}

/** Los datos de un calendario en pocas líneas (también el resumen del editor) */
export function CalendarFacts({ calendar }: { calendar: Calendar }) {
  const { t } = useTranslation()
  const { definition } = calendar
  const regular = definition.months.filter((m) => !m.festival).length
  const festivals = definition.months.length - regular
  const length = yearLength(definition)
  const leap = definition.leapRules.reduce((sum, rule) => sum + rule.days, 0)
  const list = (names: string[]) =>
    names.length <= 1
      ? (names[0] ?? '')
      : t('calendars.and', { first: names.slice(0, -1).join(', '), last: names.at(-1) ?? '' })
  const rows: Array<[string, string]> = [
    [
      t('calendars.view.yearLabel'),
      leap > 0
        ? `${t('calendars.days', { count: length })} · ${t('calendars.editor.leapDays', { days: length + leap })}`
        : t('calendars.days', { count: length })
    ],
    [
      t('calendars.view.monthsLabel'),
      festivals > 0
        ? t('calendars.monthsAndFestivals', {
            months: t('calendars.months', { count: regular }),
            festivals: t('calendars.festivals', { count: festivals })
          })
        : t('calendars.months', { count: regular })
    ],
    [
      t('calendars.view.weekLabel'),
      t('calendars.view.weekFacts', { count: definition.weekdays.length, first: definition.weekdays[0] ?? '' })
    ],
    [
      t('calendars.view.moonsLabel'),
      definition.moons.length > 0 ? list(definition.moons.map((m) => m.name)) : t('calendars.view.none')
    ],
    [
      t('calendars.view.seasonsLabel'),
      definition.seasons.length > 0 ? list(definition.seasons.map((s) => s.name)) : t('calendars.view.none')
    ],
    [
      t('calendars.view.erasLabel'),
      definition.eras.length > 0 ? t('calendars.eras', { count: definition.eras.length }) : t('calendars.noEras')
    ]
  ]
  return (
    <>
      {calendar.primary && <p className={styles.badge}>{t('calendars.primary')}</p>}
      <dl className={styles.facts}>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {definition.description && <p className={styles.description}>{definition.description}</p>}
    </>
  )
}

/** La ficha de la derecha: el día elegido, con lo que pasa en él y lo que se puede crear con su fecha */
function DayAside({
  worldId,
  definition,
  day,
  today,
  entries,
  groups,
  busy,
  onNewEvent,
  onNewPage,
  onEdit
}: {
  worldId: string
  definition: CalendarDefinition
  day: number
  today: number | null
  entries: readonly ChronologyEntryView[]
  groups: readonly TimelineGroupView[]
  busy: boolean
  onNewEvent: () => void
  onNewPage: () => void
  onEdit: (entry: ChronologyEntryView) => void
}) {
  const { t } = useTranslation()
  const titleId = useId()
  const described = describeDate(definition, dateFromDay(definition, day))
  // Lo que cae ese día (con día: lo de todo el mes o el año va arriba de la rejilla)
  const here = useMemo(
    () => entries.filter((e) => e.start.day !== undefined && entryOccurrences(definition, e, day, day).length > 0),
    [entries, definition, day]
  )
  const facts = [described.season, described.era?.name, t('calendars.view.dayOfYear', { day: described.dayOfYear })]
  return (
    <div className={styles.side}>
      <section aria-labelledby={titleId} className={styles.day} data-tour="calendario-dia">
        <h2 id={titleId}>
          {day === today && <span className={styles.todayMark}>{t('calendars.view.today')}</span>}
          {described.text}
        </h2>
        <p className={styles.dayFacts}>{facts.filter(Boolean).join(' · ')}</p>
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
              />
            ))}
          </div>
        ) : (
          <p className={styles.empty}>{t('calendars.view.dayEmpty')}</p>
        )}
        <div className={styles.dayActions}>
          <button type="button" className={styles.action} onClick={onNewEvent}>
            <CalendarPlus size={16} aria-hidden="true" />
            {t('calendars.view.newEvent')}
          </button>
          <BusyButton type="button" className={styles.action} busy={busy} onClick={onNewPage}>
            <FilePlus size={16} aria-hidden="true" />
            {t('calendars.view.newPage')}
          </BusyButton>
        </div>
      </section>
    </div>
  )
}
