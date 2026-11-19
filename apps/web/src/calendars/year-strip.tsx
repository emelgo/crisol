/**
 * El año de un calendario dibujado (lienzo «Calendarios del mundo», aprobado: «las fichas con el año dibujado, bien»):
 * una tira con un tramo por mes, del ancho de sus días (las festividades, con su color), y debajo las estaciones. En la
 * vista grande, el mes que se ve, marcado
 */
import { type CalendarDefinition, yearLength } from '@crisol/domain'
import styles from './calendars.module.css'

export function YearStrip({
  definition,
  label,
  current = null
}: {
  definition: CalendarDefinition
  label: string
  /** El mes que se ve (la vista grande) */
  current?: string | null
}) {
  const total = Math.max(1, yearLength(definition))
  const seasons = seasonBands(definition, total)
  return (
    <div className={styles.strip} role="img" aria-label={label}>
      <div className={styles.months}>
        {definition.months.map((month) => (
          <span
            key={month.id}
            className={styles.month}
            data-festival={month.festival || undefined}
            data-current={month.id === current || undefined}
            style={{
              flexGrow: Math.max(1, month.days),
              ...(month.color ? { ['--month-color' as string]: month.color } : {})
            }}
          />
        ))}
      </div>
      {seasons.length > 0 && (
        <div className={styles.seasons}>
          {seasons.map((band) => (
            <span
              key={band.key}
              className={styles.season}
              style={{
                insetInlineStart: `${(band.from / total) * 100}%`,
                inlineSize: `${(band.length / total) * 100}%`,
                ...(band.color ? { ['--season-color' as string]: band.color } : {})
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** Los tramos de las estaciones en el año (dos si una cruza el fin de año), por días desde el principio */
function seasonBands(definition: CalendarDefinition, total: number) {
  const bands: Array<{ key: string; from: number; length: number; color: string | null }> = []
  for (const season of definition.seasons) {
    const start = Math.min(Math.max(1, season.startDay), total)
    const end = Math.min(Math.max(1, season.endDay), total)
    const color = season.color ?? null
    if (start <= end) bands.push({ key: season.id, from: start - 1, length: end - start + 1, color })
    else {
      bands.push({ key: `${season.id}-a`, from: start - 1, length: total - start + 1, color })
      bands.push({ key: `${season.id}-b`, from: 0, length: end, color })
    }
  }
  return bands
}
