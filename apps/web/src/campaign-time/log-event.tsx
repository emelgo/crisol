/**
 * Las entradas del sistema en el registro de la partida (lienzo, pantallas 3, 3b y 4b; decisión 9): el cambio de fecha
 * con su icono (y «vuelve a…» al deshacer), el viaje como una tarjeta con su resumen y el clima de cada día, y el clima
 * cambiado a mano (solo lo ve el máster: «Solo tú»)
 */
import type { LogEvent } from '@crisol/contracts'
import { CalendarDays, CloudSun, Lock, Route } from 'lucide-react'
import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import log from '../dice/log.module.css'
import styles from './log-event.module.css'
import { WeatherIcon } from './weather-icon.tsx'

/** «Lunden, 7 de Brumas de 1247 RV» → «Lunden, 7 de Brumas» */
export const withoutYear = (text: string) => text.replace(/ de -?\d[\d.]*(\s.*)?$/, '')

const number = (value: number) => (Math.round(value * 10) / 10).toLocaleString('es')

export function LogEventEntry({ entry, time, remove }: { entry: LogEvent; time: ReactNode; remove: ReactNode }) {
  const { t } = useTranslation()
  const event = entry.event
  const ai = entry.ai && <span className={styles.ai}>{t('campaignTime.log.ai')}</span>
  if (event.type === 'travel') {
    const line = t('campaignTime.log.travelLine', {
      count: event.days - event.restDays,
      distance: number(event.distance),
      unit: event.unit ?? t('campaignTime.unit'),
      medium: t(`campaignTime.log.mediums.${event.medium}`),
      pace: t(`campaignTime.log.paces.${event.pace}`)
    })
    return (
      <li className={`${log.entry} ${styles.travelEntry}`}>
        <article className={styles.travel}>
          <header className={styles.travelHead}>
            <Route aria-hidden="true" size={15} />
            <b>
              {event.route ? t('campaignTime.log.travelRoute', { route: event.route }) : t('campaignTime.log.travel')}
            </b>
            {ai}
            <span className={styles.time}>{time}</span>
            {remove}
          </header>
          <p className={styles.travelLine}>
            {event.restDays > 0 ? t('campaignTime.log.travelRest', { count: event.restDays, line }) : line}
          </p>
          {event.weather.length > 0 && (
            <ol className={styles.days}>
              {event.weather.map((day) => (
                <li key={day.date.text}>
                  <span className={styles.dayDate}>{withoutYear(day.date.text)}</span>
                  <WeatherIcon condition={day.condition} size={15} />
                  <span className={styles.dayCondition}>
                    {t(`campaignTime.conditions.${day.condition as 'rain'}`, { defaultValue: day.condition })}
                    {day.rest && <b className={styles.rest}> · {t('campaignTime.restDay')}</b>}
                  </span>
                  <span className={styles.dayTemps}>
                    {day.low}° / {day.high}°
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className={styles.arrival}>
            <CalendarDays aria-hidden="true" size={13} />
            <span>
              <Trans i18nKey="campaignTime.log.travelTo" values={{ to: event.to.text }} components={{ b: <b /> }} />
              {event.zone && (
                <>
                  {' · '}
                  <Trans
                    i18nKey="campaignTime.log.travelZone"
                    values={{ zone: t(`campaignTime.zones.${event.zone as 'coast'}`, { defaultValue: event.zone }) }}
                    components={{ b: <b /> }}
                  />
                </>
              )}
            </span>
          </p>
        </article>
      </li>
    )
  }
  let icon = <CalendarDays aria-hidden="true" size={15} />
  let text: ReactNode
  if (event.type === 'weather') {
    icon = <CloudSun aria-hidden="true" size={15} />
    text = event.weather ? (
      <Trans
        i18nKey="campaignTime.log.weather"
        values={{
          date: withoutYear(event.date.text),
          condition: t(`campaignTime.conditions.${event.weather.condition as 'rain'}`, {
            defaultValue: event.weather.condition
          }),
          temperature: `${event.weather.low}° / ${event.weather.high}°`
        }}
        components={{ b: <b /> }}
      />
    ) : (
      t('campaignTime.log.weatherCleared', { date: withoutYear(event.date.text) })
    )
  } else if (!event.to) {
    text = t('campaignTime.log.dateCleared')
  } else {
    text = (
      <Trans
        i18nKey={event.undo ? 'campaignTime.log.dateUndo' : 'campaignTime.log.date'}
        values={{ to: event.to.text }}
        components={{ b: <b /> }}
      />
    )
  }
  return (
    <li className={`${log.entry} ${styles.system}`}>
      <span className={styles.icon}>{icon}</span>
      <p className={styles.text}>
        {text}
        {ai}
        {entry.whisper && (
          <span className={styles.onlyYou}>
            <Lock aria-hidden="true" size={11} />
            {t('campaignTime.log.onlyYou')}
          </span>
        )}
      </p>
      <span className={styles.time}>
        {time}
        {remove}
      </span>
    </li>
  )
}
