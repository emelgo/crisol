/**
 * El título de la vista del calendario en grande, que lleva a otra fecha (Enrique, 2026-11-20: en vez de la barra «Ir a»,
 * el propio título se pulsa): abre un recuadro pequeño con lo que tiene sentido en esa vista. Semana: el año, el mes y
 * el día, que lleva a su semana; Mes: el año y el mes; Año: solo el año. Intro aplica el año escrito; Esc o pulsar fuera
 * lo cierran y el foco vuelve al título
 */
import { type CalendarDefinition, daysInMonth, type FullDate } from '@crisol/domain'
import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Floating } from '../components/floating.tsx'
import { YearInput } from './date-input.tsx'
import styles from './view.module.css'

export type JumpMode = 'week' | 'month' | 'year'

export function JumpTitle({
  text,
  mode,
  definition,
  at,
  onGo
}: {
  /** El título de la vista («Enero del año 1») */
  text: string
  mode: JumpMode
  definition: CalendarDefinition
  /** La fecha que guía lo que se ve (de ella parte el recuadro) */
  at: FullDate
  onGo: (date: FullDate) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()
  const back = () => {
    setOpen(false)
    trigger.current?.focus()
  }
  // Abierto, pulsar fuera lo cierra
  useEffect(() => {
    if (!open) return
    const outside = (event: Event) => {
      const target = event.target as Node
      if (panel.current?.contains(target) || trigger.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  const hint = t(`calendars.view.jump.${mode}`)
  return (
    <>
      <button
        type="button"
        ref={trigger}
        className={styles.titleButton}
        title={hint}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        data-calendar-jump=""
        onClick={() => setOpen((value) => !value)}
      >
        {text}
        <ChevronDown size={18} aria-hidden="true" className={styles.titleChevron} />
      </button>
      {open && (
        <Floating
          anchor={trigger}
          boxRef={panel}
          id={id}
          role="dialog"
          aria-label={hint}
          className={styles.jumpPanel}
          data-mode={mode}
          data-calendar-jump=""
          // Esc lo cierra (y no quita el día fijado)
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            event.stopPropagation()
            back()
          }}
          // Si el foco se va a otra parte (con el tabulador), también
          onBlur={(event) => {
            const next = event.relatedTarget as Node | null
            if (next && !panel.current?.contains(next) && !trigger.current?.contains(next)) setOpen(false)
          }}
        >
          <JumpForm
            mode={mode}
            definition={definition}
            at={at}
            onGo={(date) => {
              onGo(date)
              back()
            }}
          />
        </Floating>
      )}
    </>
  )
}

/** Lo de dentro del recuadro: parte de la fecha que se ve; lo último que se elige (el mes o el día) ya lleva */
function JumpForm({
  mode,
  definition,
  at,
  onGo
}: {
  mode: JumpMode
  definition: CalendarDefinition
  at: FullDate
  onGo: (date: FullDate) => void
}) {
  const { t } = useTranslation()
  const yearId = useId()
  const year = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(at)
  // Al abrir, el año, listo para escribir otro
  useLayoutEffect(() => {
    year.current?.focus()
    year.current?.select()
  }, [])
  const firstMonth = definition.months[0]?.id ?? draft.month
  const days = (y: number, month: string) => {
    try {
      return daysInMonth(definition, y, month)
    } catch {
      return 0
    }
  }
  // El día, dentro de los del mes ese año
  const fit = (date: FullDate): FullDate => ({
    ...date,
    day: Math.max(1, Math.min(date.day, days(date.year, date.month)))
  })
  const go = (date: FullDate) => onGo(mode === 'year' ? { year: date.year, month: firstMonth, day: 1 } : fit(date))
  const count = mode === 'week' ? days(draft.year, draft.month) : 0
  return (
    <form
      className={styles.jumpForm}
      onSubmit={(event) => {
        event.preventDefault()
        go(draft)
      }}
    >
      <div className={styles.jumpYear}>
        <label htmlFor={yearId}>{t('calendars.view.yearLabel')}</label>
        <YearInput
          id={yearId}
          ref={year}
          className={styles.jumpField}
          definition={definition}
          value={draft.year}
          onValue={(value) => setDraft((d) => fit({ ...d, year: value }))}
        />
        <button type="submit" className={styles.jumpGo}>
          {t('calendars.view.jump.go')}
        </button>
      </div>
      {mode !== 'year' && (
        <fieldset className={styles.jumpGrid} aria-label={t('calendars.view.jump.monthLabel')}>
          {definition.months.map((m) => (
            <button
              key={m.id}
              type="button"
              className={styles.jumpCell}
              aria-pressed={m.id === draft.month}
              title={m.name}
              onClick={() => {
                const next = fit({ ...draft, month: m.id })
                if (mode === 'month') go(next)
                else setDraft(next)
              }}
            >
              {m.name || '—'}
            </button>
          ))}
        </fieldset>
      )}
      {mode === 'week' && count > 0 && (
        <fieldset className={`${styles.jumpGrid} ${styles.jumpDays}`} aria-label={t('calendars.view.jump.dayLabel')}>
          {Array.from({ length: count }, (_, i) => i + 1).map((day) => (
            <button
              key={day}
              type="button"
              className={styles.jumpCell}
              aria-pressed={day === draft.day}
              onClick={() => go({ ...draft, day })}
            >
              {day}
            </button>
          ))}
        </fieldset>
      )}
    </form>
  )
}
