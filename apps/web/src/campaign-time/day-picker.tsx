/**
 * «Poner fecha» (lienzo, pantalla 1c): el mes del calendario principal con su semana, el año escrito a mano, la lectura
 * larga de lo elegido y «Poner fecha» o «Cancelar». Las piezas son las del selector de fechas del módulo 8
 */
import type { CalendarView } from '@crisol/contracts'
import { dateForm, formatDate, type WorldDate } from '@crisol/domain'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { type KeyboardEvent, type RefObject, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IntegerInput } from '../calendars/date-input.tsx'
import { pagesOf } from '../calendars/preview.tsx'
import pickerStyles from '../wiki/date-field.module.css'
import { MonthDays, moveFocus, type View, viewOf } from '../wiki/date-field.tsx'
import { Popover } from './popover.tsx'
import styles from './time.module.css'

type DayDate = { year: number; month: string; day: number }

export function DayPicker({
  anchor,
  calendar,
  value,
  busy,
  onPick,
  onClose
}: {
  anchor: RefObject<HTMLElement | null>
  calendar: CalendarView
  /** Lo que hay (el «hoy» o la fecha propuesta) */
  value: DayDate | null
  busy: boolean
  /** La fecha elegida, en su forma escrita (1250-Siega-18) */
  onPick: (form: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const definition = calendar.definition
  const [chosen, setChosen] = useState<DayDate | null>(value)
  const [view, setView] = useState<View>(() => viewOf(definition, value))
  const pages = pagesOf(definition)
  const page = pages[Math.min(view.page, pages.length - 1)] ?? pages[0]
  const step = (by: -1 | 1) => {
    let next = view.page + by
    let year = view.year
    if (next < 0) {
      next = pages.length - 1
      year--
    } else if (next >= pages.length) {
      next = 0
      year++
    }
    setView({ year, page: next })
  }
  const keys = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      step(event.key === 'PageUp' ? -1 : 1)
      return
    }
    moveFocus(event)
  }
  const pick = (date: WorldDate) => {
    if (date.month !== undefined && date.day !== undefined)
      setChosen({ year: date.year, month: date.month, day: date.day })
  }
  const shown = chosen ? { calendarId: calendar.id, start: chosen } : null
  return (
    <Popover anchor={anchor} title={t('campaignTime.pickerTitle')} onClose={onClose} placement="bottom-end">
      <div className={styles.picker}>
        <div className={pickerStyles.nav}>
          <button type="button" aria-label={t('campaignTime.previousMonth')} onClick={() => step(-1)}>
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <select
            className={pickerStyles.month}
            aria-label={t('campaignTime.pickerMonth')}
            value={view.page}
            onChange={(event) => setView({ ...view, page: Number(event.target.value) })}
          >
            {pages.map((p, i) => (
              <option key={p.month} value={i}>
                {definition.months.find((m) => m.id === p.month)?.name}
              </option>
            ))}
          </select>
          <span className={pickerStyles.year}>
            <IntegerInput
              aria-label={t('campaignTime.pickerYear')}
              value={view.year}
              onValue={(year) => setView({ ...view, year })}
            />
            {definition.yearSuffix && <span aria-hidden="true">{definition.yearSuffix}</span>}
          </span>
          <button type="button" aria-label={t('campaignTime.nextMonth')} onClick={() => step(1)}>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
        <fieldset className={pickerStyles.choices} onKeyDown={keys}>
          <legend className={pickerStyles.srOnly}>{t('campaignTime.pickerTitle')}</legend>
          {page && (
            <MonthDays
              definition={definition}
              year={view.year}
              page={page}
              value={shown}
              target={chosen}
              editingEnd={false}
              pick={pick}
            />
          )}
        </fieldset>
        <p className={pickerStyles.readout} aria-live="polite">
          {chosen ? formatDate(definition, chosen, { weekday: true }) : ''}
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            disabled={!chosen || busy}
            onClick={() => chosen && onPick(dateForm(definition, chosen))}
          >
            {t('campaignTime.setDate')}
          </button>
          <button type="button" className={styles.secondary} onClick={onClose}>
            {t('campaignTime.cancel')}
          </button>
        </div>
      </div>
    </Popover>
  )
}
