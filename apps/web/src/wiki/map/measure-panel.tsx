/**
 * El recuadro de medir (módulo 9, lienzo «Mapas con capas»): por dónde se mide (en línea recta o a lo largo de una
 * ruta), la distancia con la escala del mapa y los días a pie, a caballo y en barco. Sin escala, lo dice (y al máster,
 * dónde se pone)
 */
import type { MapView } from '@crisol/contracts'
import { Route, Ruler, X } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWorldTodays } from '../../campaign-time/today-mark.tsx'
import { TravelForm } from '../../campaign-time/travel.tsx'
import { chipDate } from '../../campaign-time/words.ts'
import type { Point } from './edit.ts'
import type { Size } from './geometry.ts'
import styles from './map.module.css'
import { distanceOf, roundDays, roundDistance, travelDays } from './measure.ts'

const SPEEDS = ['foot', 'horse', 'ship'] as const

export function MeasurePanel({
  map,
  image,
  points,
  route,
  routeId = null,
  worldId,
  travel = false,
  canCalibrate,
  onClear,
  onCalibrate
}: {
  map: MapView
  image: Size
  /** Los puntos medidos (con el del cursor, si se sigue midiendo) */
  points: readonly Point[]
  /** La ruta a lo largo de la que se mide, si es eso */
  route: string | null
  /** La ruta dibujada que se mide (su elemento), para el viaje */
  routeId?: string | null
  worldId?: string
  /** Si se puede hacer un viaje con lo medido (el máster, en el mapa del mundo) */
  travel?: boolean
  canCalibrate: boolean
  onClear: () => void
  onCalibrate: () => void
}) {
  const { t, i18n } = useTranslation()
  const distance = distanceOf(points, image, map.scale)
  const days = distance === null ? null : travelDays(distance, map.speeds)
  const number = (value: number) => value.toLocaleString(i18n.language)
  return (
    <section className={styles.measure} aria-label={t('map.measure.title')}>
      <header className={styles.measureHead}>
        <Ruler aria-hidden="true" size={15} />
        <h2>{t('map.measure.title')}</h2>
        <button type="button" className={styles.close} aria-label={t('map.measure.close')} onClick={onClear}>
          <X aria-hidden="true" size={16} />
        </button>
      </header>
      {!map.scale ? (
        <p className={styles.measureHint}>
          {t('map.measure.noScale')}{' '}
          {canCalibrate && (
            <button type="button" className={styles.linkButton} onClick={onCalibrate}>
              {t('map.measure.calibrate')}
            </button>
          )}
        </p>
      ) : points.length < 2 || distance === null || !days ? (
        <p className={styles.measureHint}>{t('map.measure.hint')}</p>
      ) : (
        <>
          <p className={styles.measureWhat}>
            {route ? t('map.measure.along', { name: route }) : t('map.measure.straight')}
          </p>
          <p className={styles.measureDistance}>
            {number(roundDistance(distance))}
            <small>{map.scale.unit}</small>
          </p>
          <ul className={styles.days}>
            {SPEEDS.map((speed) => {
              const rounded = roundDays(days[speed])
              return (
                <li key={speed}>
                  <small>{t(`map.measure.speeds.${speed}`)}</small>
                  <b>
                    {rounded.lessThanOne
                      ? t('map.measure.lessThanDay')
                      : t('map.measure.days', { count: rounded.days })}
                  </b>
                </li>
              )
            })}
          </ul>
          {travel && worldId && <MeasureTravel worldId={worldId} tabId={map.tabId} points={points} routeId={routeId} />}
        </>
      )}
    </section>
  )
}

/**
 * El viaje desde lo medido (lienzo, pantalla 4; decisión 17): la campaña (las del mundo que llevas, con su «hoy»), el
 * medio, el ritmo y el descanso; «Avanzar hoy» con la zona de destino
 */
function MeasureTravel({
  worldId,
  tabId,
  points,
  routeId
}: {
  worldId: string
  tabId: string
  points: readonly Point[]
  routeId: string | null
}) {
  const { t } = useTranslation()
  const id = useId()
  const campaigns = useWorldTodays(worldId)
  const [chosen, setChosen] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const current = campaigns.find((c) => c.campaign.id === chosen) ?? campaigns[0]
  if (!current) return null
  return (
    <div className={styles.travel}>
      <div className={styles.travelHead}>
        <Route aria-hidden="true" size={14} />
        <h3>{t('campaignTime.travel')}</h3>
        <label className={styles.srOnly} htmlFor={id}>
          {t('campaignTime.campaign')}
        </label>
        <select
          id={id}
          className={styles.travelCampaign}
          value={current.campaign.id}
          onChange={(event) => {
            setChosen(event.target.value)
            setDone(null)
          }}
        >
          {campaigns.map(({ campaign, today }) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name} · {chipDate(today.text)}
            </option>
          ))}
        </select>
      </div>
      {done ? (
        <p className={styles.measureHint} role="status">
          {t('campaignTime.movedText', { date: done })}
        </p>
      ) : (
        <TravelForm
          key={current.campaign.id}
          campaignId={current.campaign.id}
          source={{ kind: 'map', tabId, points, elementId: routeId }}
          initialZone={current.zone}
          onDone={(plan) => setDone(plan.arrival?.text ?? '')}
        />
      )}
    </div>
  )
}
