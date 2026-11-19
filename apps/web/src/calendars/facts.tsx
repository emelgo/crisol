/**
 * Los datos de un calendario en pocas líneas (el resumen del editor, a la derecha): principal, lo que dura su año (y con
 * días de más, si tiene reglas), sus meses, su semana, sus lunas, sus estaciones y sus eras
 */
import type { CalendarView as Calendar } from '@crisol/contracts'
import { yearLength } from '@crisol/domain'
import { useTranslation } from 'react-i18next'
import styles from './facts.module.css'

export function CalendarFacts({ calendar }: { calendar: Calendar }) {
  const { t } = useTranslation()
  const { definition } = calendar
  const regular = definition.months.filter((m) => !m.festival).length
  const festivals = definition.months.length - regular
  const length = yearLength(definition)
  const extra = definition.leapRules.reduce((sum, rule) => sum + rule.days, 0)
  const list = (names: string[]) =>
    names.length <= 1
      ? (names[0] ?? '')
      : t('calendars.and', { first: names.slice(0, -1).join(', '), last: names.at(-1) ?? '' })
  const rows: Array<[string, string]> = [
    [
      t('calendars.view.yearLabel'),
      extra > 0
        ? `${t('calendars.days', { count: length })} · ${t('calendars.editor.leapDays', { days: length + extra })}`
        : t('calendars.days', { count: length })
    ],
    [
      t('calendars.view.monthsLabel'),
      festivals > 0
        ? t('calendars.monthsAndFestivals', {
            months: t('calendars.months', { count: regular }),
            festivals: t('calendars.festivals', { count: festivals })
          })
        : t('calendars.months', { count: regular })
    ],
    [
      t('calendars.view.weekLabel'),
      t('calendars.view.weekFacts', {
        count: definition.weekdays.length,
        first: definition.weekdays[0]?.trim() || t('calendars.editor.weekday', { n: 1 })
      })
    ],
    [
      t('calendars.view.moonsLabel'),
      definition.moons.length > 0 ? list(definition.moons.map((m) => m.name)) : t('calendars.view.none')
    ],
    [
      t('calendars.view.seasonsLabel'),
      definition.seasons.length > 0 ? list(definition.seasons.map((s) => s.name)) : t('calendars.view.none')
    ],
    [
      t('calendars.view.erasLabel'),
      definition.eras.length > 0 ? t('calendars.eras', { count: definition.eras.length }) : t('calendars.noEras')
    ]
  ]
  return (
    <>
      {calendar.primary && <p className={styles.badge}>{t('calendars.primary')}</p>}
      <dl className={styles.facts}>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {definition.description && <p className={styles.description}>{definition.description}</p>}
    </>
  )
}
