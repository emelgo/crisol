/**
 * El recuadro de medir (módulo 9, lienzo «Mapas con capas»): por dónde se mide (en línea recta o a lo largo de una
 * ruta), la distancia con la escala del mapa y los días a pie, a caballo y en barco. Sin escala, lo dice (y al máster,
 * dónde se pone)
 */
import type { MapView } from '@crisol/contracts'
import { Ruler, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
          <p className={styles.measureDistance} aria-live="polite">
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
        </>
      )}
    </section>
  )
}
