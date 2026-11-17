/**
 * El «hoy» en la Mesa (lienzo, pantallas 3, 3b, 3c y 4c; decisiones 7, 16 y 29): un chip bajo el de la escena con el
 * día, su icono y los grados; su menú lleva la fecha entera con su clima y su sol, −1 día, +1 día, +1 semana y «Poner
 * fecha», «Viaje…» con la distancia escrita, la capa de clima (como hoy, a mano o ninguna) y «Escena interior». Y las
 * cronologías del mundo, que se abren en una ventana con la línea «Hoy»
 */
import type { CampaignTableView, WeatherLayerSettingView } from '@crisol/contracts'
import { WEATHER_LAYER_KINDS } from '@crisol/contracts'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronDown, CloudSun, Flame, Home, Route } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useDismiss } from '../components/dismiss.ts'
import { FormError } from '../components/field.tsx'
import { useWindows } from '../components/windows.tsx'
import { Switch } from '../tabletop/vision-panel.tsx'
import { useWorldCalendars } from '../wiki/date-field.tsx'
import chipStyles from './chip.module.css'
import { DayPicker } from './day-picker.tsx'
import { Popover } from './popover.tsx'
import { useCampaignToday, useSetToday } from './queries.ts'
import styles from './time.module.css'
import { dateParts, SeasonAndMoons, SunLine } from './today.tsx'
import { chronologyWindow } from './today-chronology.tsx'
import { TravelForm } from './travel.tsx'
import { WeatherIcon } from './weather-icon.tsx'
import { chipDate, temperatureText, windText } from './words.ts'

type Layer = WeatherLayerSettingView
type Manual = Extract<Layer, { mode: 'manual' }>

export function TodayChip({
  worldId,
  campaignId,
  table
}: {
  worldId: string
  campaignId: string
  table: CampaignTableView | null
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const [open, setOpen] = useState(false)
  const [panel, setPanel] = useState<'menu' | 'pick' | 'travel'>('menu')
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const data = useCampaignToday(campaignId)
  const calendars = useWorldCalendars(worldId)
  const list = calendars.data?.calendars ?? []
  const today = data.data?.today ?? null
  const calendar = list.find((c) => c.id === today?.calendarId) ?? list.find((c) => c.primary) ?? list[0] ?? null
  const definition = calendar && today && calendar.id === today.calendarId ? calendar.definition : null
  const setToday = useSetToday(campaignId)
  const close = () => {
    setOpen(false)
    setPanel('menu')
  }
  useDismiss(open && panel === 'menu', close, root, trigger)
  const scene = table?.open ?? null
  const setting: Layer = table?.weather?.setting ?? { mode: 'today' }
  const effective = table?.weather?.effective ?? null
  const interior = scene?.interior ?? false

  // La capa de clima: se ve al momento y se guarda (los deslizadores, al soltarlos o al poco de moverlos)
  const [layer, setLayer] = useState<Layer>(setting)
  // Lo que manda el servidor (otra pestaña, deshacer) se sigue
  const settingKey = JSON.stringify(setting)
  const [seenKey, setSeenKey] = useState(settingKey)
  if (seenKey !== settingKey) {
    setSeenKey(settingKey)
    setLayer(setting)
  }
  const saveLayer = useMutation({
    mutationFn: (next: Layer) => api.call('setWeatherLayer', { campaignId, layer: next })
  })
  const timer = useRef<number | null>(null)
  const changeLayer = (next: Layer, wait = 0) => {
    setLayer(next)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => saveLayer.mutate(next), wait)
  }
  useEffect(() => () => (timer.current ? window.clearTimeout(timer.current) : undefined), [])
  const setInterior = useMutation({
    mutationFn: (value: boolean) => api.call('updateScene', { sceneId: scene?.id ?? '', interior: value })
  })
  const chronologies = useQuery({
    queryKey: ['chronologies', worldId],
    queryFn: () => api.call('listChronologies', { worldId }),
    enabled: open
  })
  const windows = useWindows()

  if (!scene || !data.data) return null
  const weather = data.data.weather
  const label = today ? t('campaignTime.chip', { date: today.text }) : t('campaignTime.noDate')
  const manual: Manual =
    layer.mode === 'manual'
      ? layer
      : {
          mode: 'manual',
          kind: effective?.kind ?? 'rain',
          intensity: effective?.intensity ?? 0.6,
          wind: effective?.wind ?? 0.3
        }
  const error = setToday.error ?? saveLayer.error ?? setInterior.error
  return (
    <div ref={root} className={chipStyles.root}>
      <button
        ref={trigger}
        type="button"
        className={chipStyles.chip}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className={styles.srOnly}>{t('campaignTime.chipPrefix')} </span>
        {weather ? (
          <WeatherIcon condition={weather.condition} size={16} />
        ) : (
          <CalendarDays aria-hidden="true" size={15} />
        )}
        <b>{today ? chipDate(today.text) : t('campaignTime.noDate')}</b>
        {weather && <span className={chipStyles.temps}>{temperatureText(weather)}</span>}
        {interior ? (
          <span className={chipStyles.flag}>
            <Home aria-hidden="true" size={12} />
            {t('campaignTime.interiorChip')}
          </span>
        ) : (
          setting.mode !== 'today' && (
            <span className={chipStyles.flag}>
              <CloudSun aria-hidden="true" size={12} />
              {t(`campaignTime.layerModes.${setting.mode}`)}
            </span>
          )
        )}
        <ChevronDown aria-hidden="true" size={14} />
      </button>
      {open && panel === 'menu' && (
        <section id={menuId} className={chipStyles.menu} aria-label={label}>
          {today ? (
            <div className={chipStyles.head}>
              <h2 className={chipStyles.date}>{dateParts(definition, today).main}</h2>
              <p className={chipStyles.facts}>
                {dateParts(definition, today).year && <span>{dateParts(definition, today).year}</span>}
                <SeasonAndMoons definition={definition} today={today} />
              </p>
              {weather && (
                <p className={chipStyles.line}>
                  <WeatherIcon condition={weather.condition} size={15} />
                  <span>
                    <b>{t(`campaignTime.conditions.${weather.condition}`)}</b> · {temperatureText(weather)} ·{' '}
                    {windText(t, weather)}
                  </span>
                </p>
              )}
              {data.data.sun && (
                <div className={chipStyles.sun}>
                  <SunLine sun={data.data.sun} compact />
                </div>
              )}
            </div>
          ) : (
            <div className={chipStyles.head}>
              <h2 className={chipStyles.date}>{t('campaignTime.noDate')}</h2>
            </div>
          )}
          <div className={chipStyles.section}>
            <div className={styles.dateButtons}>
              {today && (
                <>
                  <span className={styles.pair}>
                    <button type="button" disabled={setToday.isPending} onClick={() => setToday.mutate({ days: -1 })}>
                      {t('campaignTime.minusDay')}
                    </button>
                    <button type="button" disabled={setToday.isPending} onClick={() => setToday.mutate({ days: 1 })}>
                      {t('campaignTime.plusDay')}
                    </button>
                  </span>
                  <button
                    type="button"
                    className={styles.plain}
                    disabled={setToday.isPending}
                    onClick={() => setToday.mutate({ weeks: 1 })}
                  >
                    {t('campaignTime.plusWeek')}
                  </button>
                </>
              )}
              <button type="button" className={styles.plain} disabled={!calendar} onClick={() => setPanel('pick')}>
                <CalendarDays aria-hidden="true" size={15} />
                {t('campaignTime.setDate')}
              </button>
            </div>
            {today && (
              <button
                type="button"
                className={chipStyles.row}
                title={t('campaignTime.travelHint')}
                onClick={() => setPanel('travel')}
              >
                <Route aria-hidden="true" size={15} />
                <span>{t('campaignTime.travelMenu')}</span>
              </button>
            )}
          </div>
          <div className={chipStyles.section}>
            <h3 className={styles.label}>{t('campaignTime.layer')}</h3>
            {/* Interior manda sobre lo demás: va primero y, encendido, la capa se apaga */}
            <Switch checked={interior} onChange={(value) => setInterior.mutate(value)}>
              <span className={chipStyles.switchLabel}>
                <Home aria-hidden="true" size={14} />
                {t('campaignTime.interior')}
              </span>
            </Switch>
            {interior ? (
              <p className={styles.quiet}>{t('campaignTime.interiorNoWeather')}</p>
            ) : (
              <>
                <LayerModes
                  value={layer.mode}
                  onChange={(mode) => changeLayer(mode === 'manual' ? manual : { mode })}
                />
                {layer.mode === 'today' && (
                  <p className={styles.quiet}>
                    {effective || weather
                      ? weather &&
                        t('campaignTime.layerToday', { condition: t(`campaignTime.conditions.${weather.condition}`) })
                      : t('campaignTime.layerTodayNone')}
                  </p>
                )}
                {layer.mode === 'manual' && <ManualLayer value={manual} onChange={changeLayer} />}
              </>
            )}
          </div>
          {windows && (chronologies.data?.chronologies.length ?? 0) > 0 && (
            <div className={chipStyles.section}>
              <h3 className={styles.label}>{t('campaignTime.chronologies')}</h3>
              <ul className={chipStyles.list}>
                {(chronologies.data?.chronologies ?? []).map((chronology) => (
                  <li key={chronology.id}>
                    <button
                      type="button"
                      onClick={() => {
                        close()
                        windows.open(chronologyWindow(worldId, campaignId, chronology.id, chronology.name))
                      }}
                    >
                      {chronology.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <FormError message={error ? errorText(error) : null} />
        </section>
      )}
      {open && panel === 'pick' && calendar && (
        <DayPicker
          anchor={trigger}
          calendar={calendar}
          value={today?.date ?? null}
          busy={setToday.isPending}
          onPick={(form) => setToday.mutate({ date: form }, { onSuccess: close })}
          onClose={close}
        />
      )}
      {open && panel === 'travel' && (
        <Popover anchor={trigger} title={t('campaignTime.travelTitle')} onClose={close} width="wide">
          <TravelForm
            campaignId={campaignId}
            source={{ kind: 'written' }}
            initialZone={data.data.zone}
            onDone={close}
            onCancel={close}
          />
        </Popover>
      )}
    </div>
  )
}

/** «Interior: sin clima», sobre el mapa (lienzo, pantalla 3c) */
export function InteriorPill() {
  const { t } = useTranslation()
  return (
    <span className={chipStyles.interior}>
      <Home aria-hidden="true" size={13} />
      {t('campaignTime.interiorNoWeather')}
    </span>
  )
}

function LayerModes({ value, onChange }: { value: Layer['mode']; onChange: (mode: Layer['mode']) => void }) {
  const { t } = useTranslation()
  const name = useId()
  return (
    <fieldset className={`${styles.segmented} ${chipStyles.modes}`}>
      <legend className={styles.srOnly}>{t('campaignTime.layer')}</legend>
      {(['today', 'manual', 'none'] as const).map((mode) => (
        <label key={mode} data-on={value === mode || undefined}>
          <input type="radio" name={name} checked={value === mode} onChange={() => onChange(mode)} />
          {t(`campaignTime.layerModes.${mode}`)}
        </label>
      ))}
    </fieldset>
  )
}

const LAYER_ICONS = { rain: 'rain', snow: 'snow', fog: 'fog' } as const

/** La capa a mano: lluvia, nieve, niebla o ceniza, su intensidad y su viento */
function ManualLayer({ value, onChange }: { value: Manual; onChange: (next: Layer, wait?: number) => void }) {
  const { t } = useTranslation()
  const name = useId()
  return (
    <>
      <fieldset className={chipStyles.kinds}>
        <legend className={styles.srOnly}>{t('campaignTime.layer')}</legend>
        {WEATHER_LAYER_KINDS.map((kind) => (
          <label key={kind} data-on={value.kind === kind || undefined}>
            <input
              type="radio"
              name={name}
              checked={value.kind === kind}
              onChange={() => onChange({ ...value, kind })}
            />
            {kind === 'ash' ? (
              <Flame aria-hidden="true" size={16} className={chipStyles.ash} />
            ) : (
              <WeatherIcon condition={LAYER_ICONS[kind]} size={16} />
            )}
            {t(`campaignTime.layerKinds.${kind}`)}
          </label>
        ))}
      </fieldset>
      <Slider
        label={t('campaignTime.intensity')}
        value={value.intensity}
        text={`${Math.round(value.intensity * 100)} %`}
        onChange={(intensity) => onChange({ ...value, intensity }, 350)}
      />
      <Slider
        label={t('campaignTime.layerWind')}
        value={value.wind}
        text={`→ ${Math.round(value.wind * 100)}`}
        onChange={(wind) => onChange({ ...value, wind }, 350)}
      />
    </>
  )
}

function Slider({
  label,
  value,
  text,
  onChange
}: {
  label: string
  value: number
  text: string
  onChange: (value: number) => void
}) {
  const id = useId()
  return (
    <div className={chipStyles.slider}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        aria-valuetext={text}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
      />
      <span aria-hidden="true">{text}</span>
    </div>
  )
}
