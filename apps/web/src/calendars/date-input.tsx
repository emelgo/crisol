/**
 * Una fecha de un calendario en el editor: el año (con año 0 y negativos), el mes (por su id; «Todo el año», si se
 * admite) y el día («Todo el mes», si se admite). Los días, los de ese mes ese año
 */
import { type CalendarDefinition, daysInMonth, type WorldDate } from '@crisol/domain'
import { type ComponentProps, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './editor.module.css'

export function DateInput({
  definition,
  value,
  onChange,
  label,
  full = false,
  invalid = false
}: {
  definition: CalendarDefinition
  value: WorldDate
  onChange: (date: WorldDate) => void
  /** Lo que es (Inicio de «Era…»): cada parte dice «Año de …» */
  label: string
  /** Solo días enteros (la correspondencia) */
  full?: boolean
  invalid?: boolean
}) {
  const { t } = useTranslation()
  const id = useId()
  const monthExists = value.month !== undefined && definition.months.some((m) => m.id === value.month)
  let days = 0
  try {
    days = monthExists && value.month ? daysInMonth(definition, value.year, value.month) : 0
  } catch {
    // Un mes que ya no está: sin días que elegir hasta que se elija otro
    days = 0
  }
  return (
    <fieldset className={styles.date} aria-label={label} data-invalid={invalid || undefined}>
      <IntegerInput
        id={`${id}-y`}
        className={styles.yearInput}
        aria-label={`${t('calendars.editor.year')} · ${label}`}
        value={value.year}
        onValue={(year) => onChange({ ...value, year })}
      />
      <select
        aria-label={`${t('calendars.editor.month')} · ${label}`}
        value={monthExists ? value.month : ''}
        onChange={(event) => {
          const month = event.target.value
          if (!month) onChange({ year: value.year })
          else
            onChange({
              year: value.year,
              month,
              ...(full || value.day !== undefined ? { day: Math.max(1, value.day ?? 1) } : {})
            })
        }}
      >
        {(!full || !monthExists) && <option value="">{full ? '—' : t('calendars.editor.wholeYear')}</option>}
        {definition.months.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name || '—'}
          </option>
        ))}
      </select>
      <select
        aria-label={`${t('calendars.editor.day')} · ${label}`}
        value={value.day ?? ''}
        disabled={!monthExists}
        onChange={(event) => {
          const day = Number(event.target.value)
          if (!value.month) return
          onChange(day ? { year: value.year, month: value.month, day } : { year: value.year, month: value.month })
        }}
      >
        {!full && <option value="">{t('calendars.editor.wholeMonth')}</option>}
        {Array.from({ length: Math.max(days, value.day ?? 0) }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            {i + 1}
          </option>
        ))}
      </select>
    </fieldset>
  )
}

/**
 * Un número entero que se escribe a gusto (también «-» antes de los negativos, o vacío un momento): solo se da por
 * bueno cuando lo escrito es un entero; al salir, vuelve a lo que vale
 */
export function IntegerInput({
  value,
  onValue,
  decimal = false,
  ...props
}: Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: number
  onValue: (value: number) => void
  /** Admite decimales (el ciclo de una luna); con coma o con punto */
  decimal?: boolean
}) {
  const shown = Number.isFinite(value) ? (decimal ? String(value).replace('.', ',') : String(value)) : ''
  const [text, setText] = useState<string | null>(null)
  const pattern = decimal ? /^-?\d+([.,]\d*)?$/ : /^-?\d+$/
  return (
    <input
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      {...props}
      value={text ?? shown}
      onChange={(event) => {
        const next = event.target.value
        setText(next)
        if (pattern.test(next.trim())) onValue(Number(next.trim().replace(',', '.')))
      }}
      onBlur={(event) => {
        setText(null)
        props.onBlur?.(event)
      }}
    />
  )
}
