/**
 * Los ajustes de un mapa (módulo 9): su escala (se dibuja una raya sobre algo conocido y se dice cuánto mide) y cuánto se
 * anda en un día a pie, a caballo y en barco (con lo de serie para volver). Cada cambio se guarda al momento
 */
import { DEFAULT_SPEEDS, type MapView, type Page } from '@crisol/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings2, X } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../api/context.tsx'
import { useErrorText } from '../../api/errors.ts'
import { FormError } from '../../components/field.tsx'
import { focusOnMount } from '../../components/focus.ts'
import list from '../../components/list.module.css'
import type { Point } from './edit.ts'
import type { Size } from './geometry.ts'
import { mapKey } from './keys.ts'
import styles from './map.module.css'
import { scaleFrom } from './measure.ts'

const UNITS = ['km', 'mi', 'leguas', 'm', 'pies'] as const
const SPEEDS = ['foot', 'horse', 'ship'] as const

export function MapSettings({
  page,
  map,
  image,
  line,
  drawing,
  onDrawLine,
  onLineDone,
  onClose
}: {
  page: Page
  map: MapView
  image: Size
  /** La raya que se acaba de dibujar para calibrar (dos puntos), si la hay */
  line: [Point, Point] | null
  /** Si se está dibujando la raya */
  drawing: boolean
  onDrawLine: () => void
  onLineDone: () => void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const id = useId()
  const [value, setValue] = useState(String(map.scale?.value ?? 100))
  const [unit, setUnit] = useState(map.scale?.unit ?? 'km')
  const save = useMutation({
    mutationFn: (patch: { scale?: MapView['scale']; speeds?: MapView['speeds'] | null }) =>
      api.call('updateMap', { mapId: map.id, ...patch }),
    onSuccess: (next) => queryClient.setQueryData(mapKey(page.worldId, map.tabId), next)
  })
  const saveLine = () => {
    if (!line) return
    const scale = scaleFrom(line[0], line[1], image, Number(value.replace(',', '.')), unit)
    if (scale) save.mutate({ scale }, { onSuccess: onLineDone })
  }
  const speedUnit = map.scale?.unit ?? 'km'
  return (
    <section className={styles.panel} aria-label={t('map.settings.title')}>
      <header className={styles.panelHead}>
        <h2 className={styles.layersTitle}>
          <Settings2 aria-hidden="true" size={15} />
          {t('map.settings.title')}
        </h2>
        <button type="button" className={styles.close} aria-label={t('map.settings.close')} onClick={onClose}>
          <X aria-hidden="true" size={16} />
        </button>
      </header>
      <div className={styles.fields}>
        <h3 className={styles.settingsHead}>{t('map.settings.scale')}</h3>
        {line ? (
          <>
            <p className={styles.settingsHint}>{t('map.settings.howLong')}</p>
            <div className={styles.twoFields}>
              <input
                ref={focusOnMount}
                aria-label={t('map.settings.length')}
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') saveLine()
                }}
              />
              <select
                aria-label={t('map.settings.unit')}
                value={unit}
                onChange={(event) => setUnit(event.currentTarget.value)}
              >
                {UNITS.map((option) => (
                  <option key={option} value={option}>
                    {t(`map.settings.units.${option}`)}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className={styles.primary} onClick={saveLine}>
              {t('map.settings.saveScale')}
            </button>
          </>
        ) : drawing ? (
          <p className={styles.settingsHint} role="status">
            {t('map.settings.drawHint')}
          </p>
        ) : (
          <>
            <p className={styles.settingsHint}>
              {map.scale
                ? t('map.settings.current', {
                    value: map.scale.value.toLocaleString(i18n.language),
                    unit: map.scale.unit
                  })
                : t('map.settings.none')}
            </p>
            <button type="button" className={list.secondary} onClick={onDrawLine}>
              {t(map.scale ? 'map.settings.redraw' : 'map.settings.draw')}
            </button>
          </>
        )}

        <h3 className={styles.settingsHead}>{t('map.settings.speeds')}</h3>
        {SPEEDS.map((speed) => (
          <div key={speed} className={styles.speedRow}>
            <label htmlFor={`${id}-${speed}`}>{t(`map.measure.speeds.${speed}`)}</label>
            <input
              id={`${id}-${speed}`}
              key={`${speed}-${map.speeds[speed]}`}
              type="number"
              min={1}
              defaultValue={map.speeds[speed]}
              onBlur={(event) => {
                const next = Number(event.currentTarget.value)
                if (next > 0 && next !== map.speeds[speed]) save.mutate({ speeds: { ...map.speeds, [speed]: next } })
              }}
            />
            <span className={styles.speedUnit}>{t('map.settings.perDay', { unit: speedUnit })}</span>
          </div>
        ))}
        {SPEEDS.some((speed) => map.speeds[speed] !== DEFAULT_SPEEDS[speed]) && (
          <button type="button" className={styles.linkButton} onClick={() => save.mutate({ speeds: null })}>
            {t('map.settings.defaultSpeeds')}
          </button>
        )}
      </div>
      <FormError message={save.error ? errorText(save.error) : null} />
    </section>
  )
}
