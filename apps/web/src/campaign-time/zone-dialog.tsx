/**
 * La zona de clima de la campaña y su latitud (lienzo, pantalla 2b): las siete zonas, cada una con el clima que haría
 * hoy en ella (sale del mismo generador con semilla que el servidor), y la latitud con norte o sur y las horas de luz
 * que daría. Cambia con el viaje si se elige la de destino
 */
import { WEATHER_ZONES } from '@crisol/contracts'
import { type CalendarDefinition, type FullDate, sunTimes, weatherOn } from '@crisol/domain'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type RefObject, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { FormError } from '../components/field.tsx'
import { Popover } from './popover.tsx'
import { todayKey } from './queries.ts'
import styles from './time.module.css'
import { Stepper } from './weather-dialog.tsx'
import { WeatherIcon } from './weather-icon.tsx'
import { daylightText, temperatureText } from './words.ts'

type Zone = (typeof WEATHER_ZONES)[number]

export function ZoneDialog({
  anchor,
  worldId,
  campaignId,
  zone,
  latitude,
  today,
  onClose
}: {
  anchor: RefObject<HTMLElement | null>
  worldId: string
  campaignId: string
  zone: Zone
  latitude: number
  /** El día de hoy, para enseñar el clima de cada zona y la luz (null sin fecha) */
  today: { definition: CalendarDefinition; date: FullDate; day: number } | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const name = useId()
  const [chosen, setChosen] = useState<Zone>(zone)
  const [degrees, setDegrees] = useState(Math.round(Math.abs(latitude)))
  const [south, setSouth] = useState(latitude < 0)
  const save = useMutation({
    mutationFn: () =>
      api.call('setCampaignClimate', { campaignId, zone: chosen, latitude: south ? -degrees : degrees }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: todayKey(campaignId) })
      onClose()
      anchor.current?.focus()
    }
  })
  const preview = (each: Zone) => (today ? weatherOn(today.definition, { worldId, zone: each }, today.day) : null)
  const light = today ? sunTimes(today.definition, today.date, south ? -degrees : degrees) : null
  return (
    <Popover anchor={anchor} title={t('campaignTime.zoneTitle')} onClose={onClose} placement="bottom-end">
      <form
        className={styles.zoneForm}
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate()
        }}
      >
        <fieldset className={styles.zones}>
          <legend className={styles.srOnly}>{t('campaignTime.zone')}</legend>
          {WEATHER_ZONES.map((each) => {
            const day = preview(each)
            return (
              <label key={each} data-on={chosen === each || undefined}>
                <input type="radio" name={name} checked={chosen === each} onChange={() => setChosen(each)} />
                <span className={styles.zoneName}>{t(`campaignTime.zones.${each}`)}</span>
                {day && (
                  <span className={styles.zoneWeather}>
                    <WeatherIcon condition={day.condition} size={14} />
                    {temperatureText(day)}
                  </span>
                )}
              </label>
            )
          })}
        </fieldset>
        <div className={styles.latitude}>
          <Stepper label={t('campaignTime.latitude')} value={degrees} min={0} max={90} unit="°" onChange={setDegrees} />
          <fieldset className={styles.segmented}>
            <legend className={styles.srOnly}>{t('campaignTime.latitude')}</legend>
            {([false, true] as const).map((isSouth) => (
              <label key={String(isSouth)} data-on={south === isSouth || undefined}>
                <input
                  type="radio"
                  name={`${name}-ns`}
                  checked={south === isSouth}
                  onChange={() => setSouth(isSouth)}
                />
                {t(isSouth ? 'campaignTime.southButton' : 'campaignTime.northButton')}
              </label>
            ))}
          </fieldset>
        </div>
        {light && (
          <p className={styles.quiet}>
            {light.polar
              ? t(light.polar === 'day' ? 'campaignTime.polarDay' : 'campaignTime.polarNight')
              : daylightText(t, light.daylight)}
          </p>
        )}
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
        </div>
      </form>
    </Popover>
  )
}
