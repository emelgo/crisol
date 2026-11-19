/**
 * El clima de un día, a mano (lienzo, pantalla 2): la condición, la mínima y la máxima en °C y el viento (su rumbo en
 * una rosa y su fuerza). No cambia los días siguientes; «Volver al generado» lo deshace. Solo el máster
 */
import { COMPASS_POINTS, WEATHER_CONDITIONS, type WeatherDayView, WIND_FORCES } from '@crisol/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Minus, Plus } from 'lucide-react'
import { type RefObject, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { FormError } from '../components/field.tsx'
import { Popover } from './popover.tsx'
import { todayKey } from './queries.ts'
import styles from './time.module.css'
import { WeatherIcon } from './weather-icon.tsx'
import { temperatureText, windText, withoutYear } from './words.ts'

/** Los ocho rumbos de la rosa (los dieciséis del clima, en la del medio más cercana) */
const ROSE = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const
const roseOf = (direction: string) => {
  const index = COMPASS_POINTS.indexOf(direction as (typeof COMPASS_POINTS)[number])
  return ROSE[Math.round(Math.max(0, index) / 2) % 8] ?? 'N'
}

type Draft = Pick<WeatherDayView, 'condition' | 'low' | 'high' | 'wind' | 'windDirection'>

export function WeatherDialog({
  anchor,
  campaignId,
  day,
  onClose
}: {
  anchor: RefObject<HTMLElement | null>
  campaignId: string
  day: WeatherDayView
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const ids = useId()
  const [draft, setDraft] = useState<Draft>({
    condition: day.condition,
    low: day.low,
    high: day.high,
    wind: day.wind,
    windDirection: day.windDirection
  })
  const save = useMutation({
    mutationFn: (weather: Draft | null) => api.call('setDayWeather', { campaignId, date: day.form, weather }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: todayKey(campaignId) })
      void client.invalidateQueries({ queryKey: ['log', campaignId] })
      onClose()
      anchor.current?.focus()
    }
  })
  const set = (patch: Partial<Draft>) =>
    setDraft((current) => {
      const next = { ...current, ...patch }
      // La mínima no pasa de la máxima: la otra la sigue
      if (patch.low !== undefined && next.low > next.high) next.high = next.low
      if (patch.high !== undefined && next.high < next.low) next.low = next.high
      return next
    })
  const shortDate = withoutYear(day.text)
  return (
    <Popover
      anchor={anchor}
      title={t('campaignTime.weatherTitle', { date: shortDate })}
      aside={day.manual ? t('campaignTime.manual') : t('campaignTime.generated')}
      onClose={onClose}
      width="wide"
    >
      <form
        className={styles.weatherForm}
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate(draft)
        }}
      >
        <fieldset className={styles.conditions}>
          <legend>{t('campaignTime.condition')}</legend>
          {WEATHER_CONDITIONS.map((condition) => (
            <button
              key={condition}
              type="button"
              aria-pressed={draft.condition === condition}
              onClick={() => set({ condition })}
            >
              <WeatherIcon condition={condition} size={16} />
              {t(`campaignTime.conditions.${condition}`)}
            </button>
          ))}
        </fieldset>
        <div className={styles.temps}>
          <Stepper label={t('campaignTime.low')} value={draft.low} onChange={(low) => set({ low })} />
          <Stepper label={t('campaignTime.high')} value={draft.high} onChange={(high) => set({ high })} />
        </div>
        <fieldset className={styles.windRow}>
          <legend>{t('campaignTime.windLabel')}</legend>
          <fieldset className={styles.rose}>
            <legend className={styles.srOnly}>{t('campaignTime.windDirection')}</legend>
            {ROSE.map((point, index) => (
              <label
                key={point}
                data-on={roseOf(draft.windDirection) === point || undefined}
                style={{ ['--angle' as string]: `${index * 45}deg` }}
              >
                <input
                  type="radio"
                  name={`${ids}-rose`}
                  checked={roseOf(draft.windDirection) === point}
                  onChange={() => set({ windDirection: point })}
                />
                <span aria-hidden="true">{t(`campaignTime.compassShort.${point}`)}</span>
                <span className={styles.srOnly}>{t(`campaignTime.compass.${point}`)}</span>
              </label>
            ))}
            <span
              className={styles.needle}
              aria-hidden="true"
              style={{ ['--angle' as string]: `${ROSE.indexOf(roseOf(draft.windDirection)) * 45}deg` }}
            />
          </fieldset>
          <div className={styles.windForce}>
            <label className={styles.srOnly} htmlFor={`${ids}-force`}>
              {t('campaignTime.windForce')}
            </label>
            <select
              id={`${ids}-force`}
              className={styles.select}
              value={draft.wind}
              onChange={(event) => set({ wind: event.target.value as Draft['wind'] })}
            >
              {WIND_FORCES.map((force) => (
                <option key={force} value={force}>
                  {t(`campaignTime.wind.${force}`)}
                </option>
              ))}
            </select>
            <span className={styles.quiet}>{windText(t, draft)}</span>
          </div>
        </fieldset>
        <FormError message={save.error ? errorText(save.error) : null} />
        <div className={styles.actions}>
          <button type="submit" className={styles.primary} disabled={save.isPending}>
            {t('campaignTime.save')}
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              onClose()
              anchor.current?.focus()
            }}
          >
            {t('campaignTime.cancel')}
          </button>
          {day.manual && (
            <button type="button" className={styles.link} disabled={save.isPending} onClick={() => save.mutate(null)}>
              {t('campaignTime.backToGenerated')}
            </button>
          )}
          <span className={styles.summary}>
            {t(`campaignTime.conditions.${draft.condition}`)} · {temperatureText(draft)}
          </span>
        </div>
      </form>
    </Popover>
  )
}

/** Un número con − y + a los lados, en grados */
export function Stepper({
  label,
  value,
  onChange,
  min = -90,
  max = 70,
  unit = '°C'
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  unit?: string
}) {
  const { t } = useTranslation()
  const id = useId()
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  return (
    <div className={styles.stepperField}>
      <label htmlFor={id}>{label}</label>
      <span className={styles.stepper}>
        <button
          type="button"
          aria-label={`${t('campaignTime.less')} · ${label}`}
          onClick={() => onChange(clamp(value - 1))}
        >
          <Minus aria-hidden="true" size={14} />
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          onChange={(event) => {
            const next = Number(event.target.value)
            if (Number.isFinite(next) && event.target.value !== '') onChange(clamp(Math.round(next)))
          }}
        />
        <span aria-hidden="true" className={styles.unit}>
          {unit}
        </span>
        <button
          type="button"
          aria-label={`${t('campaignTime.more')} · ${label}`}
          onClick={() => onChange(clamp(value + 1))}
        >
          <Plus aria-hidden="true" size={14} />
        </button>
      </span>
    </div>
  )
}
