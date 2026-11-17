/**
 * Un viaje (lienzo, pantallas 4 y 4c; decisiones 3, 17, 18 y 30): de una ruta medida en un mapa o de la distancia
 * escrita, el medio (a pie, a caballo, en barco), el ritmo y los días de descanso dan los días que pasan y el clima de
 * cada uno (los de descanso, repartidos por el camino); «Avanzar hoy» suma esos días en una sola operación, cambia la
 * zona si se elige la de destino y deja el resumen en el registro
 */
import { TRAVEL_MEDIUMS, TRAVEL_PACES, type TravelPlanView, WEATHER_ZONES } from '@crisol/contracts'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, MapPin } from 'lucide-react'
import { useId, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { FormError } from '../components/field.tsx'
import { todayKey } from './queries.ts'
import styles from './time.module.css'
import travelStyles from './travel.module.css'
import { Stepper } from './weather-dialog.tsx'
import { WeatherIcon } from './weather-icon.tsx'
import { temperatureText, withoutYear } from './words.ts'

type Medium = (typeof TRAVEL_MEDIUMS)[number]
type Pace = (typeof TRAVEL_PACES)[number]
type Zone = (typeof WEATHER_ZONES)[number]

/** De dónde sale la distancia: escrita, o medida en un mapa (unos puntos o una ruta dibujada) */
export type TravelSource =
  | { kind: 'written' }
  | { kind: 'map'; tabId: string; points: ReadonlyArray<readonly [number, number]>; elementId: string | null }

const number = (value: number) => (Math.round(value * 10) / 10).toLocaleString('es')

/** Una fila de opciones de las que se elige una */
function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
  text
}: {
  label: string
  options: readonly T[]
  value: T
  onChange: (value: T) => void
  text: (value: T) => string
}) {
  const name = useId()
  return (
    <div className={travelStyles.row}>
      <span className={travelStyles.rowLabel} id={`${name}-label`}>
        {label}
      </span>
      <fieldset className={styles.segmented} aria-labelledby={`${name}-label`}>
        {options.map((option) => (
          <label key={option} data-on={value === option || undefined}>
            <input type="radio" name={name} checked={value === option} onChange={() => onChange(option)} />
            {text(option)}
          </label>
        ))}
      </fieldset>
    </div>
  )
}

export function TravelForm({
  campaignId,
  source,
  initialZone,
  onDone,
  onCancel
}: {
  campaignId: string
  source: TravelSource
  /** La zona de ahora (para «Al llegar») */
  initialZone: Zone | null
  onDone: (plan: TravelPlanView) => void
  onCancel?: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const ids = useId()
  const [distance, setDistance] = useState(source.kind === 'written' ? '60' : '')
  const [medium, setMedium] = useState<Medium>('horse')
  const [pace, setPace] = useState<Pace>('normal')
  const [restDays, setRestDays] = useState(0)
  const [zone, setZone] = useState<Zone | ''>('')
  const written = Number(distance.replace(',', '.'))
  const ready = source.kind === 'map' ? source.points.length >= 2 || source.elementId !== null : written > 0
  const input = {
    campaignId,
    medium,
    pace,
    restDays,
    ...(source.kind === 'written'
      ? { distance: written, unit: t('campaignTime.unit') }
      : source.elementId
        ? { tabId: source.tabId, elementId: source.elementId }
        : { tabId: source.tabId, points: source.points.map(([x, y]) => [x, y] as [number, number]) })
  }
  const plan = useQuery({
    queryKey: ['travelPlan', input],
    queryFn: () => api.call('planTravel', input),
    enabled: ready,
    placeholderData: keepPreviousData
  })
  const go = useMutation({
    mutationFn: () => api.call('travel', { ...input, ...(zone ? { zone } : {}) }),
    onSuccess: ({ plan: done }) => {
      void client.invalidateQueries({ queryKey: todayKey(campaignId) })
      void client.invalidateQueries({ queryKey: ['log', campaignId] })
      onDone(done)
    }
  })
  const data = ready ? plan.data : undefined
  const travelling = data ? data.days - data.restDays : 0
  const arrivalWeather = data?.weather.at(-1)
  return (
    <form
      className={travelStyles.form}
      onSubmit={(event) => {
        event.preventDefault()
        if (data?.arrival) go.mutate()
      }}
    >
      {source.kind === 'written' && (
        <div className={travelStyles.row}>
          <label className={travelStyles.rowLabel} htmlFor={`${ids}-distance`}>
            {t('campaignTime.distance')}
          </label>
          <span className={travelStyles.distance}>
            <input
              id={`${ids}-distance`}
              inputMode="decimal"
              value={distance}
              data-autofocus=""
              onChange={(event) => setDistance(event.target.value)}
            />
            <span aria-hidden="true">{t('campaignTime.unit')}</span>
          </span>
        </div>
      )}
      <Choice
        label={t('campaignTime.medium')}
        options={TRAVEL_MEDIUMS}
        value={medium}
        onChange={setMedium}
        text={(m) => t(`campaignTime.mediums.${m}`)}
      />
      <Choice
        label={t('campaignTime.pace')}
        options={TRAVEL_PACES}
        value={pace}
        onChange={setPace}
        text={(p) => t(`campaignTime.paces.${p}`)}
      />
      <div className={travelStyles.row}>
        <span className={travelStyles.rowLabel}>{t('campaignTime.rest')}</span>
        <span className={travelStyles.rest}>
          <Stepper label={t('campaignTime.rest')} value={restDays} min={0} max={365} unit="" onChange={setRestDays} />
          <span className={styles.quiet}>{t('campaignTime.restDays', { count: restDays })}</span>
        </span>
      </div>
      {data && (
        <>
          <p className={travelStyles.total}>
            <b>{t('campaignTime.travelDays', { count: data.days })}</b>
            <span>
              {data.restDays > 0
                ? t('campaignTime.travelSummaryRest', {
                    count: data.restDays,
                    travel: t('campaignTime.travelDays', { count: travelling }),
                    speed: number(data.speed * { slow: 0.67, normal: 1, fast: 1.33 }[data.pace]),
                    unit: data.unit ?? t('campaignTime.unit')
                  })
                : t('campaignTime.travelSummary', {
                    travel: t('campaignTime.travelDays', { count: travelling }),
                    speed: number(data.speed * { slow: 0.67, normal: 1, fast: 1.33 }[data.pace]),
                    unit: data.unit ?? t('campaignTime.unit')
                  })}
            </span>
          </p>
          {data.weather.length > 0 && (
            <ol className={travelStyles.days} aria-label={t('campaignTime.forecast')}>
              {data.weather.map((day, index) => (
                <li key={day.day}>
                  <span className={travelStyles.dayDate}>{withoutYear(day.text)}</span>
                  <WeatherIcon condition={day.condition} size={15} />
                  <span className={travelStyles.dayCondition}>
                    {t(`campaignTime.conditions.${day.condition}`)}
                    {data.schedule[index] === 'rest' && <b> · {t('campaignTime.restDay')}</b>}
                  </span>
                  <span className={travelStyles.dayTemps}>{temperatureText(day)}</span>
                </li>
              ))}
            </ol>
          )}
          {!data.from && <p className={styles.quiet}>{t('campaignTime.noCampaignToday')}</p>}
          <div className={travelStyles.row}>
            <label className={travelStyles.rowLabel} htmlFor={`${ids}-zone`}>
              {t('campaignTime.arriveZone')}
            </label>
            <select
              id={`${ids}-zone`}
              className={styles.select}
              value={zone}
              onChange={(event) => setZone(event.target.value as Zone | '')}
            >
              <option value="">
                {t('campaignTime.sameZone')}
                {initialZone ? ` (${t(`campaignTime.zones.${initialZone}`)})` : ''}
              </option>
              {WEATHER_ZONES.filter((each) => each !== initialZone).map((each) => (
                <option key={each} value={each}>
                  {t(`campaignTime.zones.${each}`)}
                </option>
              ))}
            </select>
          </div>
          {data.arrival && (
            <p className={travelStyles.arrival}>
              <MapPin aria-hidden="true" size={14} />
              <span>
                <Trans
                  i18nKey="campaignTime.arrival"
                  values={{
                    date: withoutYear(data.arrival.text),
                    weather: arrivalWeather
                      ? `${t(`campaignTime.conditions.${arrivalWeather.condition}`).toLocaleLowerCase('es')}, ${temperatureText(arrivalWeather)}`
                      : ''
                  }}
                  components={{ b: <b /> }}
                />
              </span>
            </p>
          )}
        </>
      )}
      <FormError message={plan.error ? errorText(plan.error) : go.error ? errorText(go.error) : null} />
      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={!data?.arrival || go.isPending}>
          <CalendarDays aria-hidden="true" size={15} />
          {t('campaignTime.advance', { count: data?.days ?? 0 })}
        </button>
        {onCancel && (
          <button type="button" className={styles.secondary} onClick={onCancel}>
            {t('campaignTime.cancel')}
          </button>
        )}
      </div>
    </form>
  )
}
