/**
 * El «hoy» de la campaña en su Inicio (lienzo «El tiempo de la campaña», pantallas 1, 1b, 1c, 1d y 8; decisiones 1, 6,
 * 7, 14, 27, 28 y 31). Al máster, grande: la fecha con su estación y sus lunas, −1 día, +1 día, +1 semana y «Poner
 * fecha» (con «Deshacer» unos segundos), el clima de hoy, el sol, la zona con «Cambiar» y la previsión de 7 días (cada
 * día se cambia a mano). Sin fecha, «Poner fecha» y, si otra campaña del mundo tiene, copiarla. A quien juega, hoy y el
 * sol, sin previsión
 */
import type { Campaign, CampaignDate, SunView, WeatherDayView } from '@crisol/contracts'
import { type CalendarDefinition, type FullDate, formatDate, formatYear, moonPhases, weekdayName } from '@crisol/domain'
import { CalendarDays, Copy, Pencil, Sunrise, Sunset, Undo2, Wind } from 'lucide-react'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useErrorText } from '../api/errors.ts'
import { FormError } from '../components/field.tsx'
import { useWorldCalendars } from '../wiki/date-field.tsx'
import { ReadAsProvider } from '../wiki/read-as.tsx'
import { DayPicker } from './day-picker.tsx'
import { useCampaignToday, useSetToday, useUndoToday } from './queries.ts'
import styles from './time.module.css'
import { WeatherDialog } from './weather-dialog.tsx'
import { WeatherIcon } from './weather-icon.tsx'
import { clockText, daylightText, latitudeText, temperatureText, windText } from './words.ts'
import { ZoneDialog } from './zone-dialog.tsx'

/** Cuánto se queda «Deshacer» a la vista */
const UNDO_MS = 7000

/** «Solen, 6 de Brumas» y «1247 RV» por separado (sin el calendario, el texto entero) */
export function dateParts(definition: CalendarDefinition | null, today: Pick<CampaignDate, 'date' | 'text'>) {
  if (!definition) return { main: today.text, year: '' }
  try {
    const full = formatDate(definition, today.date, { weekday: true })
    const year = formatYear(definition, today.date.year, today.date)
    const suffix = ` de ${year}`
    return full.endsWith(suffix) ? { main: full.slice(0, -suffix.length), year } : { main: full, year: '' }
  } catch {
    return { main: today.text, year: '' }
  }
}

/** La estación (con su color) y las lunas de un día, en una línea */
export function SeasonAndMoons({
  definition,
  today
}: {
  definition: CalendarDefinition | null
  today: Pick<CampaignDate, 'date' | 'season'>
}) {
  const season = definition?.seasons.find((s) => s.name === today.season)
  let moons: ReturnType<typeof moonPhases> = []
  try {
    moons = definition ? moonPhases(definition, today.date) : []
  } catch {
    moons = []
  }
  if (!today.season && moons.length === 0) return null
  return (
    <ul className={styles.facts}>
      {today.season && (
        <li>
          <span
            className={styles.seasonDot}
            aria-hidden="true"
            style={{ '--season': season?.color ?? 'var(--color-h3)' } as CSSProperties}
          />
          {today.season}
        </li>
      )}
      {moons.map((phase) => (
        <li key={phase.moon.id}>
          <span
            className={styles.moon}
            aria-hidden="true"
            style={
              {
                '--moon': phase.moon.color ?? 'var(--color-text)',
                '--lit': `${Math.round(phase.illumination * 100)}%`,
                '--side': phase.cycle < 0.5 ? 'right' : 'left'
              } as CSSProperties
            }
          />
          {phase.moon.name} {phase.name.toLocaleLowerCase('es')}
        </li>
      ))}
    </ul>
  )
}

/** El sol: salida y puesta, alba y anochecer y las horas de luz (o el día o la noche polar) */
export function SunLine({ sun, compact = false }: { sun: SunView; compact?: boolean }) {
  const { t } = useTranslation()
  if (sun.polar)
    return (
      <p className={styles.sunTimes}>{t(sun.polar === 'day' ? 'campaignTime.polarDay' : 'campaignTime.polarNight')}</p>
    )
  return (
    <>
      <p className={styles.sunTimes}>
        <span title={t('campaignTime.sunrise')}>
          <Sunrise aria-hidden="true" size={16} />
          <span className={styles.srOnly}>{t('campaignTime.sunrise')}</span>
          {clockText(sun.sunrise ?? 0)}
        </span>
        <span title={t('campaignTime.sunset')}>
          <Sunset aria-hidden="true" size={16} />
          <span className={styles.srOnly}>{t('campaignTime.sunset')}</span>
          {clockText(sun.sunset ?? 0)}
        </span>
        {compact && <span className={styles.daylight}>{daylightText(t, sun.daylight)}</span>}
      </p>
      {!compact && (
        <p className={styles.quiet}>
          {sun.dawn !== null && sun.dusk !== null
            ? `${t('campaignTime.twilight', { dawn: clockText(sun.dawn), dusk: clockText(sun.dusk) })} · `
            : ''}
          {daylightText(t, sun.daylight)}
        </p>
      )}
    </>
  )
}

/** El clima de hoy: su icono, la condición, los grados y el viento */
function WeatherNow({ day }: { day: WeatherDayView }) {
  const { t } = useTranslation()
  return (
    <>
      <span className={styles.nowIcon}>
        <WeatherIcon condition={day.condition} size={24} />
      </span>
      <span className={styles.nowText}>
        <b>{t(`campaignTime.conditions.${day.condition}`)}</b>
        <span className={styles.nowTemps}>{temperatureText(day)}</span>
        <span className={styles.quiet}>
          <Wind aria-hidden="true" size={13} />
          {windText(t, day)}
        </span>
      </span>
    </>
  )
}

/** El calendario del «hoy» (o el principal), cuando llega */
function useTodayCalendar(worldId: string, calendarId: string | null) {
  const calendars = useWorldCalendars(worldId)
  const list = calendars.data?.calendars ?? []
  return list.find((c) => c.id === calendarId) ?? list.find((c) => c.primary) ?? list[0] ?? null
}

/** «La fecha pasa a…» con «Deshacer», abajo en el centro, unos segundos */
function UndoToast({
  text,
  busy,
  onUndo,
  onGone
}: {
  text: string
  busy: boolean
  onUndo: () => void
  onGone: () => void
}) {
  const { t } = useTranslation()
  useEffect(() => {
    const timer = window.setTimeout(onGone, UNDO_MS)
    return () => window.clearTimeout(timer)
  }, [onGone])
  return (
    <div className={styles.toast} role="status">
      <CalendarDays aria-hidden="true" size={15} />
      <span>
        <Trans i18nKey="campaignTime.moved" values={{ date: text }} components={{ b: <b /> }} />
      </span>
      <button type="button" className={styles.link} disabled={busy} onClick={onUndo}>
        <Undo2 aria-hidden="true" size={14} />
        {t('campaignTime.undo')}
      </button>
    </div>
  )
}

/** El «hoy» grande del Inicio del máster */
export function MasterToday({ worldId, campaign }: { worldId: string; campaign: Campaign }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const data = useCampaignToday(campaign.id)
  const calendar = useTodayCalendar(worldId, data.data?.today?.calendarId ?? null)
  const setToday = useSetToday(campaign.id)
  const undo = useUndoToday(worldId, campaign.id, campaign.name)
  const [moved, setMoved] = useState<{ text: string; at: number } | null>(null)
  const [picking, setPicking] = useState(false)
  const pickButton = useRef<HTMLButtonElement>(null)
  const change = (input: Parameters<typeof setToday.mutate>[0]) =>
    setToday.mutate(input, {
      onSuccess: ({ today }) => {
        setPicking(false)
        // El aviso de «Deshacer» es una región viva: ya se anuncia
        setMoved({ text: today.text, at: Date.now() })
      }
    })
  const error = setToday.error ?? undo.error
  if (!data.data) return <div className={styles.todayPlaceholder} aria-hidden="true" />
  const { today, suggestion } = data.data
  const toast = moved && (
    <UndoToast
      key={moved.at}
      text={moved.text}
      busy={undo.isPending}
      onUndo={() => undo.mutate(undefined, { onSuccess: () => setMoved(null) })}
      onGone={() => setMoved(null)}
    />
  )
  const picker = picking && calendar && (
    <DayPicker
      anchor={pickButton}
      calendar={calendar}
      value={today?.date ?? suggestion?.date ?? null}
      busy={setToday.isPending}
      onPick={(form) => change({ date: form })}
      onClose={() => setPicking(false)}
    />
  )
  if (!today)
    return (
      <section
        className={`${styles.today} ${styles.noDate}`}
        aria-label={t('campaignTime.today')}
        data-tour="inicio-hoy"
      >
        <h2 className={styles.noDateTitle}>{t('campaignTime.noDate')}</h2>
        <div className={styles.noDateActions}>
          {suggestion && (
            <button
              type="button"
              className={styles.link}
              disabled={setToday.isPending}
              onClick={() => change({ date: suggestion.form })}
            >
              <Copy aria-hidden="true" size={14} />
              {t('campaignTime.copyFromOther', { date: suggestion.text })}
            </button>
          )}
          <button
            ref={pickButton}
            type="button"
            className={styles.primary}
            disabled={!calendar}
            aria-expanded={picking}
            onClick={() => setPicking(!picking)}
          >
            <CalendarDays aria-hidden="true" size={16} />
            {t('campaignTime.setDate')}
          </button>
        </div>
        <FormError message={error ? errorText(error) : null} />
        {picker}
        {toast}
      </section>
    )
  const definition = calendar?.id === today.calendarId ? calendar.definition : null
  const { main, year } = dateParts(definition, today)
  return (
    <section className={styles.today} aria-label={t('campaignTime.today')} data-tour="inicio-hoy">
      <div className={styles.todayHead}>
        <div className={styles.todayDate}>
          <h2 className={styles.date}>
            {main} {year && <small className={styles.year}>{year}</small>}
          </h2>
          <SeasonAndMoons definition={definition} today={today} />
        </div>
        <fieldset className={styles.dateButtons}>
          <legend className={styles.srOnly}>{t('campaignTime.dateButtons')}</legend>
          <span className={styles.pair}>
            <button type="button" disabled={setToday.isPending} onClick={() => change({ days: -1 })}>
              {t('campaignTime.minusDay')}
            </button>
            <button type="button" disabled={setToday.isPending} onClick={() => change({ days: 1 })}>
              {t('campaignTime.plusDay')}
            </button>
          </span>
          <button
            type="button"
            className={styles.plain}
            disabled={setToday.isPending}
            onClick={() => change({ weeks: 1 })}
          >
            {t('campaignTime.plusWeek')}
          </button>
          <button
            ref={pickButton}
            type="button"
            className={styles.plain}
            disabled={!calendar}
            aria-expanded={picking}
            onClick={() => setPicking(!picking)}
          >
            <CalendarDays aria-hidden="true" size={15} />
            {t('campaignTime.setDate')}
          </button>
        </fieldset>
      </div>
      <FormError message={error ? errorText(error) : null} />
      <div className={styles.nowRow}>
        {data.data.weather && <EditableWeather campaignId={campaign.id} day={data.data.weather} big />}
        {data.data.sun && (
          <div className={styles.cell}>
            <h3 className={styles.label}>{t('campaignTime.sun')}</h3>
            <SunLine sun={data.data.sun} />
          </div>
        )}
        <ZoneCell
          worldId={worldId}
          campaignId={campaign.id}
          zone={data.data.zone}
          latitude={data.data.latitude}
          today={definition ? { definition, date: today.date, day: today.day } : null}
        />
      </div>
      {data.data.forecast.length > 0 && (
        <div className={styles.forecast}>
          <h3 className={styles.label}>{t('campaignTime.forecast')}</h3>
          <ol>
            {data.data.forecast.map((day) => (
              <li key={day.day}>
                <ForecastDay campaignId={campaign.id} day={day} definition={definition} />
              </li>
            ))}
          </ol>
        </div>
      )}
      {picker}
      {toast}
    </section>
  )
}

/** El clima de hoy, que el máster pulsa para cambiarlo a mano */
function EditableWeather({ campaignId, day, big }: { campaignId: string; day: WeatherDayView; big?: boolean }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        ref={button}
        type="button"
        className={big ? `${styles.now} ${styles.cell}` : styles.now}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <WeatherNow day={day} />
        {day.manual && <span className={styles.manualMark}>{t('campaignTime.manual')}</span>}
        <span className={styles.srOnly}>. {t('campaignTime.editDay', { date: day.text })}</span>
        <Pencil aria-hidden="true" size={13} className={styles.editMark} />
      </button>
      {open && <WeatherDialog anchor={button} campaignId={campaignId} day={day} onClose={() => setOpen(false)} />}
    </>
  )
}

/** Un día de la previsión: su día de la semana y su número, el icono y los grados; pulsarlo lo cambia a mano */
function ForecastDay({
  campaignId,
  day,
  definition
}: {
  campaignId: string
  day: WeatherDayView
  definition: CalendarDefinition | null
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  let weekday = ''
  try {
    weekday = definition ? (weekdayName(definition, day.date as FullDate) ?? '') : ''
  } catch {
    weekday = ''
  }
  return (
    <>
      <button
        ref={button}
        type="button"
        className={styles.day}
        data-manual={day.manual || undefined}
        title={day.manual ? t('campaignTime.manual') : undefined}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className={styles.dayName}>{weekday.slice(0, 3)}</span>
        <span className={styles.dayNumber}>{day.date.day}</span>
        <WeatherIcon condition={day.condition} size={22} />
        <span className={styles.dayTemps}>
          <b>{day.high}°</b> {day.low}°
        </span>
        <span className={styles.srOnly}>
          {`. ${t(`campaignTime.conditions.${day.condition}`)}${day.manual ? ` (${t('campaignTime.manual').toLowerCase()})` : ''}. ${t('campaignTime.editDay', { date: day.text })}`}
        </span>
        <Pencil aria-hidden="true" size={12} className={styles.editMark} />
      </button>
      {open && <WeatherDialog anchor={button} campaignId={campaignId} day={day} onClose={() => setOpen(false)} />}
    </>
  )
}

/** La zona y la latitud, con «Cambiar» */
function ZoneCell(props: {
  worldId: string
  campaignId: string
  zone: Parameters<typeof ZoneDialog>[0]['zone']
  latitude: number
  today: Parameters<typeof ZoneDialog>[0]['today']
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  return (
    <div className={styles.cell}>
      <h3 className={styles.label}>{t('campaignTime.zone')}</h3>
      <p className={styles.zoneLine}>
        {t(`campaignTime.zones.${props.zone}`)} · {latitudeText(t, props.latitude)}
      </p>
      <button
        ref={button}
        type="button"
        className={styles.link}
        aria-expanded={open}
        aria-label={`${t('campaignTime.change')}: ${t('campaignTime.zone').toLowerCase()}`}
        onClick={() => setOpen(!open)}
      >
        {t('campaignTime.change')}
      </button>
      {open && <ZoneDialog anchor={button} {...props} onClose={() => setOpen(false)} />}
    </div>
  )
}

/** El «hoy» de quien juega (también en el móvil): la fecha, el clima de hoy y el sol, sin previsión */
export function PlayerToday({ worldId, campaign }: { worldId: string; campaign: Campaign }) {
  // Los calendarios, como los ve su campaña (sin las eras solo del máster)
  return (
    <ReadAsProvider value={{ campaignId: campaign.id }}>
      <PlayerTodayCard worldId={worldId} campaign={campaign} />
    </ReadAsProvider>
  )
}

function PlayerTodayCard({ worldId, campaign }: { worldId: string; campaign: Campaign }) {
  const { t } = useTranslation()
  const data = useCampaignToday(campaign.id)
  const calendar = useTodayCalendar(worldId, data.data?.today?.calendarId ?? null)
  const today = data.data?.today
  if (!data.data || !today) return null
  const definition = calendar?.id === today.calendarId ? calendar.definition : null
  const { main, year } = dateParts(definition, today)
  const weather = data.data.weather
  const sun = data.data.sun
  return (
    <section
      className={`${styles.today} ${styles.playerToday}`}
      aria-label={t('campaignTime.today')}
      data-tour="inicio-hoy"
    >
      <div className={styles.todayDate}>
        <h2 className={styles.date}>{main}</h2>
        <p className={styles.yearLine}>
          {year && <span>{year}</span>}
          <SeasonAndMoons definition={definition} today={today} />
        </p>
      </div>
      {weather && (
        <div className={styles.playerWeather}>
          <span className={styles.nowIcon}>
            <WeatherIcon condition={weather.condition} size={24} />
          </span>
          <span className={styles.nowText}>
            <b>{t(`campaignTime.conditions.${weather.condition}`)}</b>
            <span className={styles.quiet}>{windText(t, weather)}</span>
          </span>
          <span className={styles.playerTemps}>{temperatureText(weather)}</span>
        </div>
      )}
      {sun && (
        <div className={styles.playerSun}>
          <SunLine sun={sun} compact />
        </div>
      )}
    </section>
  )
}
