/**
 * Las fases del editor de un calendario (ajustes tras los módulos, bloque C): General, Semana (en qué día empieza y el
 * ancla «el 1 de {mes} del año {N} fue {día}»), Meses (cada uno, mes o festividad), Días señalados, Días de más (años
 * más largos, por reglas, sin dar ninguna por hecha), Estaciones, Lunas, Eras y la correspondencia con el principal. Cada una cambia el borrador con `change`; los problemas
 * los calcula el editor y aquí se marcan donde están
 */
import {
  CALENDAR_LIMITS,
  type CalendarDefinition,
  type CalendarProblem,
  type CalendarSection,
  DEFAULT_PHASES,
  dateFromDay,
  firstWeekdayFor,
  formatDate,
  monthNumber,
  newCalendarId,
  rotateWeek,
  weekdayOf,
  yearLength,
  yearStart
} from '@crisol/domain'
import { ChevronDown, ChevronUp, GripVertical, Plus, TriangleAlert, X } from 'lucide-react'
import { type DragEvent, type KeyboardEvent, type ReactNode, type Ref, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DateInput, IntegerInput, YEAR_DIGITS, YearInput } from './date-input.tsx'
import styles from './editor.module.css'
import { useProblemText } from './problems.ts'

/** Cambia el borrador: la función recibe una copia y la toca */
export type Change = (fn: (draft: CalendarDefinition) => void) => void

interface SectionProps {
  draft: CalendarDefinition
  change: Change
  problems: readonly CalendarProblem[]
}

/** Los ids que ya usa el calendario (para que uno nuevo no se repita) */
const takenIds = (draft: CalendarDefinition) => [
  ...draft.months.map((m) => m.id),
  ...draft.seasons.map((s) => s.id),
  ...draft.moons.map((m) => m.id),
  ...draft.eras.map((e) => e.id)
]

/** Si hay un problema en ese elemento de la sección */
const flagged = (problems: readonly CalendarProblem[], section: CalendarSection, index: number) =>
  problems.some((p) => p.section === section && p.index === index)

/** La fase abierta: su título con su icono, lo suyo y, al pie, sus problemas (los de esa fase) */
export function Section({
  id,
  icon,
  title,
  problems: own,
  headingRef,
  footer,
  children
}: {
  id: string
  icon: ReactNode
  title: string
  problems: readonly CalendarProblem[]
  headingRef?: Ref<HTMLHeadingElement>
  /** Lo que va al final, tras los problemas (la fase anterior y la siguiente) */
  footer?: ReactNode
  children: ReactNode
}) {
  const problemText = useProblemText()
  return (
    <section className={styles.section} id={`fase-${id}`} aria-labelledby={`titulo-${id}`} data-section={id}>
      <h2 id={`titulo-${id}`} ref={headingRef} tabIndex={-1} className={styles.sectionTitle}>
        <span aria-hidden="true">{icon}</span>
        {title}
      </h2>
      {children}
      {own.length > 0 && (
        <ul className={styles.problems} aria-label={title}>
          {own.map((problem) => (
            <li key={`${problem.code}-${problem.index ?? ''}-${problem.message}`}>
              <TriangleAlert size={16} aria-hidden="true" />
              {problemText(problem)}
            </li>
          ))}
        </ul>
      )}
      {footer}
    </section>
  )
}

/** «+ Mes»: añadir uno al final */
function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className={styles.add} onClick={onClick}>
      <Plus size={16} aria-hidden="true" />
      {label}
    </button>
  )
}

function RemoveButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className={styles.remove}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      <X size={16} aria-hidden="true" />
    </button>
  )
}

/** Mover un elemento de una lista de sitio (de `from` a `to`) */
function moved<T>(list: T[], from: number, to: number) {
  const [item] = list.splice(from, 1)
  if (item !== undefined) list.splice(Math.max(0, Math.min(to, list.length)), 0, item)
}

/** Cambia un extremo del rango de años (null: vacío, el tope general); sin ninguno, sin rango */
function setYearEnd(d: CalendarDefinition, end: 'min' | 'max', year: number | null) {
  const range = { ...d.yearRange }
  if (year === null) delete range[end]
  else range[end] = year
  if (typeof range.min !== 'number' && typeof range.max !== 'number') delete d.yearRange
  else d.yearRange = range
}

export function GeneralSection({
  draft,
  change,
  problems,
  name,
  onName
}: SectionProps & { name: string; onName: (name: string) => void }) {
  const { t } = useTranslation()
  const bound = CALENDAR_LIMITS.yearBound
  const min = draft.yearRange?.min ?? null
  const max = draft.yearRange?.max ?? null
  // Sin «desde», se propone el inicio de la primera era (no se impone)
  const firstEra = [...draft.eras].sort((a, b) => a.start.year - b.start.year)[0]
  const yearsWrong = problems.some((p) => p.code === 'yearOrder' || p.code === 'yearLimit')
  const yearsId = useId()
  return (
    <div className={styles.fields}>
      <label className={styles.field}>
        <span>{t('calendars.editor.name')}</span>
        <input
          value={name}
          maxLength={60}
          autoComplete="off"
          data-1p-ignore
          aria-invalid={name.trim() ? undefined : true}
          onChange={(event) => onName(event.target.value)}
        />
      </label>
      <div className={styles.pair}>
        <label className={styles.field}>
          <span>{t('calendars.editor.yearSuffix')}</span>
          <input
            value={draft.yearSuffix}
            maxLength={12}
            placeholder="RC"
            autoComplete="off"
            onChange={(event) =>
              change((d) => {
                d.yearSuffix = event.target.value
              })
            }
          />
        </label>
        <label className={styles.field}>
          <span>{t('calendars.editor.beforeZeroSuffix')}</span>
          <input
            value={draft.beforeZeroSuffix ?? ''}
            maxLength={12}
            placeholder="a. R."
            autoComplete="off"
            onChange={(event) =>
              change((d) => {
                if (event.target.value) d.beforeZeroSuffix = event.target.value
                else delete d.beforeZeroSuffix
              })
            }
          />
        </label>
      </div>
      <label className={styles.field}>
        <span>{t('calendars.editor.description')}</span>
        <textarea
          value={draft.description}
          maxLength={500}
          rows={3}
          onChange={(event) =>
            change((d) => {
              d.description = event.target.value
            })
          }
        />
        <small className={styles.counter} aria-live="off">
          {draft.description.length} / 500
        </small>
      </label>
      <fieldset className={styles.years}>
        <legend>{t('calendars.editor.years')}</legend>
        <label className={styles.inline} htmlFor={`${yearsId}-min`}>
          {t('calendars.editor.yearsFrom')}
        </label>
        <IntegerInput
          id={`${yearsId}-min`}
          className={styles.yearInput}
          digits={YEAR_DIGITS}
          value={min ?? Number.NaN}
          placeholder={String(firstEra?.start.year ?? -bound)}
          aria-invalid={yearsWrong || undefined}
          onValue={(year) => change((d) => setYearEnd(d, 'min', year))}
          onEmpty={() => change((d) => setYearEnd(d, 'min', null))}
        />
        <label className={styles.inline} htmlFor={`${yearsId}-max`}>
          {t('calendars.editor.yearsTo')}
        </label>
        <IntegerInput
          id={`${yearsId}-max`}
          className={styles.yearInput}
          digits={YEAR_DIGITS}
          value={max ?? Number.NaN}
          placeholder={String(bound)}
          aria-invalid={yearsWrong || undefined}
          onValue={(year) => change((d) => setYearEnd(d, 'max', year))}
          onEmpty={() => change((d) => setYearEnd(d, 'max', null))}
        />
        {min === null && firstEra && (
          <button
            type="button"
            className={styles.link}
            onClick={() => change((d) => setYearEnd(d, 'min', firstEra.start.year))}
          >
            {t('calendars.editor.yearsFromEra', { era: firstEra.name || '—', year: firstEra.start.year })}
          </button>
        )}
      </fieldset>
    </div>
  )
}

export function WeekSection({ draft, change, problems, valid }: SectionProps & { valid: boolean }) {
  const { t } = useTranslation()
  return (
    <>
      <ol className={`${styles.rows} ${styles.weekdays}`}>
        {draft.weekdays.map((day, i) => {
          const label = day || t('calendars.editor.weekday', { n: i + 1 })
          return (
            <li key={i} className={styles.row}>
              <span className={styles.index}>{i + 1}</span>
              <input
                className={styles.grow}
                value={day}
                maxLength={60}
                aria-label={t('calendars.editor.weekday', { n: i + 1 })}
                aria-invalid={flagged(problems, 'week', i) || undefined}
                onChange={(event) =>
                  change((d) => {
                    d.weekdays[i] = event.target.value
                  })
                }
              />
              <button
                type="button"
                className={styles.icon}
                aria-label={t('calendars.editor.up', { name: label })}
                disabled={i === 0}
                onClick={() => change((d) => moved(d.weekdays, i, i - 1))}
              >
                <ChevronUp size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.icon}
                aria-label={t('calendars.editor.down', { name: label })}
                disabled={i === draft.weekdays.length - 1}
                onClick={() => change((d) => moved(d.weekdays, i, i + 1))}
              >
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              <RemoveButton
                label={t('calendars.editor.remove', { name: label })}
                disabled={draft.weekdays.length <= 1}
                onClick={() =>
                  change((d) => {
                    d.weekdays.splice(i, 1)
                    if (d.firstWeekday >= d.weekdays.length) d.firstWeekday = 0
                  })
                }
              />
            </li>
          )
        })}
      </ol>
      {draft.weekdays.length < 20 && (
        <AddButton
          label={t('calendars.editor.addWeekday')}
          onClick={() =>
            change((d) => void d.weekdays.push(t('calendars.editor.newWeekday', { n: d.weekdays.length + 1 })))
          }
        />
      )}
      <div className={styles.pair}>
        <label className={styles.field}>
          <span>{t('calendars.editor.weekStartsOn')}</span>
          {/* Reordena la lista: el elegido pasa a ser el primero, sin cambiar el día de ninguna fecha */}
          <select
            value={0}
            onChange={(event) => {
              const start = Number(event.target.value)
              change((d) => Object.assign(d, rotateWeek(d, start)))
            }}
          >
            {draft.weekdays.map((day, i) => (
              <option key={i} value={i}>
                {day || t('calendars.editor.weekday', { n: i + 1 })}
              </option>
            ))}
          </select>
        </label>
        <fieldset className={styles.choice}>
          <legend>{t('calendars.editor.weekMode')}</legend>
          {(['continuous', 'reset'] as const).map((mode) => (
            <label key={mode}>
              <input
                type="radio"
                name="weekMode"
                checked={draft.weekMode === mode}
                onChange={() =>
                  change((d) => {
                    d.weekMode = mode
                  })
                }
              />
              {t(`calendars.editor.${mode}`)}
            </label>
          ))}
        </fieldset>
      </div>
      <WeekAnchor draft={draft} change={change} valid={valid} />
    </>
  )
}

/**
 * El ancla de la semana: «El 1 de {mes} del año {N} fue {día}». El mes y el año son de aquí (no se guardan): al
 * cambiarlos, la frase dice qué día fue; al elegir el día, se corre el día de la semana de todo el calendario
 */
function WeekAnchor({ draft, change, valid }: Pick<SectionProps, 'draft' | 'change'> & { valid: boolean }) {
  const { t } = useTranslation()
  const inWeek = draft.months.filter((m) => !m.outsideWeek)
  const [monthId, setMonthId] = useState(() => inWeek[0]?.id ?? draft.months[0]?.id ?? '')
  const [year, setYear] = useState(0)
  const month = draft.months.find((m) => m.id === monthId) ?? inWeek[0]
  const date = month ? { year, month: month.id, day: 1 } : null
  const weekday = valid && date && !month?.outsideWeek ? weekdayOf(draft, date) : null
  return (
    <fieldset className={styles.anchor}>
      <legend className={styles.srOnly}>{t('calendars.editor.anchor')}</legend>
      <span>{t('calendars.editor.anchorDay')}</span>
      <select
        value={month?.id ?? ''}
        aria-label={t('calendars.editor.anchorMonth')}
        onChange={(event) => setMonthId(event.target.value)}
      >
        {inWeek.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name || '—'}
          </option>
        ))}
      </select>
      <span>{t('calendars.editor.anchorYear')}</span>
      <YearInput
        className={styles.yearInput}
        definition={draft}
        value={year}
        aria-label={t('calendars.editor.anchorYearLabel')}
        onValue={setYear}
      />
      <span>{t('calendars.editor.anchorWas')}</span>
      <select
        value={weekday ?? ''}
        disabled={weekday === null}
        aria-label={t('calendars.editor.anchorWeekday')}
        onChange={(event) => {
          if (!date) return
          const target = Number(event.target.value)
          change((d) => {
            const first = firstWeekdayFor(d, date, target)
            if (first !== null) d.firstWeekday = first
          })
        }}
      >
        {weekday === null && <option value="">—</option>}
        {draft.weekdays.map((day, i) => (
          <option key={i} value={i}>
            {day || t('calendars.editor.weekday', { n: i + 1 })}
          </option>
        ))}
      </select>
    </fieldset>
  )
}

/** Arrastrar las filas de una tabla para ordenarlas, o con Alt y las flechas en su asa */
function useRowDrag(onMove: (from: number, to: number) => void) {
  const [dragging, setDragging] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  return {
    dragging,
    over,
    handle: (index: number, count: number) => ({
      draggable: true,
      onDragStart: (event: DragEvent) => {
        setDragging(index)
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', String(index))
      },
      onDragEnd: () => {
        setDragging(null)
        setOver(null)
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
        event.preventDefault()
        const to = event.key === 'ArrowUp' ? index - 1 : index + 1
        if (to < 0 || to >= count) return
        onMove(index, to)
        const handle = event.currentTarget
        requestAnimationFrame(() => {
          const rows = handle.closest('tbody')?.querySelectorAll<HTMLElement>('[data-handle]')
          rows?.[to]?.focus()
        })
      }
    }),
    row: (index: number) => ({
      onDragOver: (event: DragEvent) => {
        if (dragging === null) return
        event.preventDefault()
        setOver(index)
      },
      onDrop: (event: DragEvent) => {
        event.preventDefault()
        if (dragging !== null && dragging !== index) onMove(dragging, index)
        setDragging(null)
        setOver(null)
      }
    })
  }
}

export function MonthsSection({ draft, change, problems }: SectionProps) {
  const { t } = useTranslation()
  const drag = useRowDrag((from, to) => change((d) => moved(d.months, from, to)))
  return (
    <>
      <p className={styles.lead}>{t('calendars.editor.monthsLead')}</p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">
              <span className={styles.srOnly}>{t('calendars.editor.order')}</span>
            </th>
            <th scope="col" className={styles.center}>
              {t('calendars.editor.number')}
            </th>
            <th scope="col">
              <span className={styles.srOnly}>{t('calendars.editor.color')}</span>
            </th>
            <th scope="col">{t('calendars.editor.monthName')}</th>
            <th scope="col" className={styles.center}>
              {t('calendars.editor.days')}
            </th>
            <th scope="col">{t('calendars.editor.type')}</th>
            <th scope="col">
              <span className={styles.srOnly}>{t('calendars.editor.removeColumn')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {draft.months.map((month, i) => {
            const label = month.name || t('calendars.editor.newMonth', { n: i + 1 })
            const n = monthNumber(draft, month.id)
            return (
              <tr
                key={month.id}
                data-festival={month.festival || undefined}
                data-drop={drag.over === i || undefined}
                data-dragging={drag.dragging === i || undefined}
                {...drag.row(i)}
              >
                <td>
                  <button
                    type="button"
                    className={styles.handle}
                    data-handle
                    aria-label={t('calendars.editor.dragRow', { name: label })}
                    {...drag.handle(i, draft.months.length)}
                  >
                    <GripVertical size={16} aria-hidden="true" />
                  </button>
                </td>
                <td className={`${styles.number} ${styles.center}`}>{n ?? '—'}</td>
                <td>
                  <input
                    type="color"
                    className={styles.swatch}
                    data-empty={month.color ? undefined : true}
                    value={month.color ?? '#808080'}
                    aria-label={t('calendars.editor.colorOf', { name: label })}
                    onChange={(event) =>
                      change((d) => {
                        const target = d.months[i]
                        if (target) target.color = event.target.value
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    className={styles.grow}
                    value={month.name}
                    maxLength={60}
                    aria-label={t('calendars.editor.monthNameOf', { n: i + 1 })}
                    aria-invalid={flagged(problems, 'months', i) || undefined}
                    onChange={(event) =>
                      change((d) => {
                        const target = d.months[i]
                        if (target) target.name = event.target.value
                      })
                    }
                  />
                </td>
                <td className={styles.center}>
                  <IntegerInput
                    className={styles.small}
                    value={month.days}
                    aria-label={t('calendars.editor.daysOf', { name: label })}
                    aria-invalid={flagged(problems, 'months', i) || undefined}
                    onValue={(days) =>
                      change((d) => {
                        const target = d.months[i]
                        if (target) target.days = days
                      })
                    }
                  />
                </td>
                <td>
                  {/* Mes o festividad; una festividad puede ir fuera de la semana (sus días no son de ningún día) */}
                  <div className={styles.type}>
                    <select
                      value={month.festival ? 'festival' : 'month'}
                      aria-label={t('calendars.editor.typeOf', { name: label })}
                      onChange={(event) =>
                        change((d) => {
                          const target = d.months[i]
                          if (!target) return
                          if (event.target.value === 'festival') target.festival = true
                          else {
                            delete target.festival
                            delete target.outsideWeek
                          }
                        })
                      }
                    >
                      <option value="month">{t('calendars.editor.typeMonth')}</option>
                      <option value="festival">{t('calendars.editor.typeFestival')}</option>
                    </select>
                    {(month.festival || month.outsideWeek) && (
                      <label className={styles.inline}>
                        <input
                          type="checkbox"
                          checked={!!month.outsideWeek}
                          onChange={(event) =>
                            change((d) => {
                              const target = d.months[i]
                              if (!target) return
                              if (event.target.checked) target.outsideWeek = true
                              else delete target.outsideWeek
                            })
                          }
                        />
                        {t('calendars.editor.outsideWeek')}
                        <span className={styles.srOnly}> · {label}</span>
                      </label>
                    )}
                  </div>
                </td>
                <td>
                  <RemoveButton
                    label={t('calendars.editor.remove', { name: label })}
                    disabled={draft.months.length <= 1}
                    onClick={() =>
                      change((d) => {
                        d.months.splice(i, 1)
                        d.leapRules = d.leapRules.filter((r) => r.monthId !== month.id)
                      })
                    }
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {draft.months.length < 100 && (
        <AddButton
          label={t('calendars.editor.addMonth')}
          onClick={() =>
            change(
              (d) =>
                void d.months.push({
                  id: newCalendarId(takenIds(d)),
                  name: t('calendars.editor.newMonth', { n: d.months.length + 1 }),
                  days: d.months.at(-1)?.days ?? 30
                })
            )
          }
        />
      )}
    </>
  )
}

/** Pone (o quita, con el nombre vacío) el nombre propio del día `day` de un mes */
function setDayName(month: CalendarDefinition['months'][number], day: number, name: string) {
  const names = [...(month.dayNames ?? [])]
  while (names.length < day) names.push('')
  names[day - 1] = name
  while (names.length > 0 && !names.at(-1)?.trim()) names.pop()
  if (names.length > 0) month.dayNames = names
  else delete month.dayNames
}

/** Los días señalados (Shieldmeet, Año Nuevo…): días con nombre propio, que se leen por él en las fechas. Las filas
 * llevan una clave propia (cambiar el mes o el día no las monta de nuevo) y una recién añadida, o vaciada, se queda sin
 * nombre */
export function NamedDaysSection({ draft, change }: Pick<SectionProps, 'draft' | 'change'>) {
  const { t } = useTranslation()
  type Row = { key: string; monthId: string; day: number }
  const named = draft.months.flatMap((month) =>
    (month.dayNames ?? []).flatMap((name, i) => (name.trim() ? [{ monthId: month.id, day: i + 1 }] : []))
  )
  const nameAt = (monthId: string, day: number) => draft.months.find((m) => m.id === monthId)?.dayNames?.[day - 1] ?? ''
  const [rows, setRows] = useState<Row[]>(() => named.map((n) => ({ key: newCalendarId(), ...n })))
  // Si el borrador cambia por fuera (Cancelar, otra pestaña), las filas lo siguen
  const signature = named.map((n) => `${n.monthId}:${n.day}`).join(',')
  useEffect(() => {
    setRows((list) => {
      const kept = list.filter(
        (r) => !nameAt(r.monthId, r.day).trim() || named.some((n) => n.monthId === r.monthId && n.day === r.day)
      )
      const missing = named.filter((n) => !kept.some((r) => r.monthId === n.monthId && r.day === n.day))
      return missing.length === 0 && kept.length === list.length
        ? list
        : [...kept, ...missing.map((n) => ({ key: newCalendarId(), ...n }))]
    })
  }, [signature])
  // Los días de un mes, con los de más que le dan sus reglas (los nombres de esos van al final)
  const maxDay = (monthId: string) =>
    (draft.months.find((m) => m.id === monthId)?.days ?? 1) +
    draft.leapRules.filter((r) => r.monthId === monthId).reduce((sum, r) => sum + r.days, 0)
  const place = (row: Row, monthId: string, day: number) => {
    const name = nameAt(row.monthId, row.day)
    if (name.trim())
      change((d) => {
        const old = d.months.find((m) => m.id === row.monthId)
        const target = d.months.find((m) => m.id === monthId)
        if (!old || !target) return
        setDayName(old, row.day, '')
        setDayName(target, day, name)
      })
    setRows((list) => list.map((r) => (r.key === row.key ? { ...r, monthId, day } : r)))
  }
  const rename = (row: Row, name: string) =>
    change((d) => {
      const target = d.months.find((m) => m.id === row.monthId)
      if (target) setDayName(target, row.day, name)
    })
  const remove = (row: Row) => {
    setRows((list) => list.filter((r) => r.key !== row.key))
    if (nameAt(row.monthId, row.day))
      change((d) => {
        const target = d.months.find((m) => m.id === row.monthId)
        if (target) setDayName(target, row.day, '')
      })
  }
  const add = () => {
    const taken = (monthId: string, day: number) => rows.some((r) => r.monthId === monthId && r.day === day)
    for (const month of draft.months) {
      const day = Array.from({ length: month.days }, (_, i) => i + 1).find((n) => !taken(month.id, n))
      if (day) return setRows((list) => [...list, { key: newCalendarId(), monthId: month.id, day }])
    }
  }
  return (
    <>
      <p className={styles.lead}>{t('calendars.editor.namedDaysLead')}</p>
      {rows.length > 0 && (
        <ol className={styles.rows}>
          {rows.map((row, n) => {
            const name = nameAt(row.monthId, row.day)
            return (
              <li key={row.key} className={`${styles.leap} ${styles.namedDay}`}>
                {/* «El [1] de [mes] se llama [nombre]»: el día cabe en su mes (con sus días de más) */}
                <span>{t('calendars.editor.namedDayThe')}</span>
                <IntegerInput
                  className={styles.tiny}
                  value={row.day}
                  aria-label={t('calendars.editor.namedDayNumber', { n: n + 1 })}
                  onValue={(day) => {
                    if (day >= 1 && day <= maxDay(row.monthId)) place(row, row.monthId, day)
                  }}
                />
                <span>{t('calendars.editor.namedDayOfMonth')}</span>
                <select
                  value={row.monthId}
                  aria-label={t('calendars.editor.namedDayMonth', { n: n + 1 })}
                  onChange={(event) => place(row, event.target.value, Math.min(row.day, maxDay(event.target.value)))}
                >
                  {draft.months.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || '—'}
                    </option>
                  ))}
                </select>
                <span>{t('calendars.editor.namedDayCalled')}</span>
                <input
                  className={styles.grow}
                  value={name}
                  maxLength={60}
                  placeholder={t('calendars.editor.namedDayExample')}
                  aria-label={t('calendars.editor.namedDayName', { n: n + 1 })}
                  onChange={(event) => rename(row, event.target.value)}
                />
                <RemoveButton
                  label={t('calendars.editor.remove', { name: name.trim() || t('calendars.editor.namedDayOf') })}
                  onClick={() => remove(row)}
                />
              </li>
            )
          })}
        </ol>
      )}
      <AddButton label={t('calendars.editor.addNamedDay')} onClick={add} />
    </>
  )
}

/**
 * Días de más: algunos años, un mes tiene más días. Cada regla se lee como una frase: «Cada [4] años, [mes] tiene [1]
 * día más, salvo cada [100] pero sí cada [400]». No hay ninguna de serie: el calendario no da por hecho cómo es el año
 */
export function LeapSection({ draft, change, problems }: SectionProps) {
  const { t } = useTranslation()
  const set = (i: number, fn: (rule: CalendarDefinition['leapRules'][number]) => void) =>
    change((d) => {
      const target = d.leapRules[i]
      if (target) fn(target)
    })
  return (
    <>
      <p className={styles.lead}>{t('calendars.editor.leapLead')}</p>
      {draft.leapRules.length === 0 ? (
        <p className={styles.muted}>{t('calendars.editor.noLeap')}</p>
      ) : (
        <ol className={styles.rows}>
          {draft.leapRules.map((rule, i) => (
            <li key={i} className={styles.leap} data-invalid={flagged(problems, 'leap', i) || undefined}>
              <span>{t('calendars.editor.leapEach')}</span>
              <IntegerInput
                className={styles.tiny}
                value={rule.every}
                aria-label={t('calendars.editor.leapEvery', { n: i + 1 })}
                onValue={(every) =>
                  set(i, (target) => {
                    target.every = every
                  })
                }
              />
              <span>{t('calendars.editor.leapYears')}</span>
              <select
                value={rule.monthId}
                aria-label={t('calendars.editor.leapMonth', { n: i + 1 })}
                onChange={(event) =>
                  set(i, (target) => {
                    target.monthId = event.target.value
                  })
                }
              >
                {draft.months.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || '—'}
                  </option>
                ))}
              </select>
              <span>{t('calendars.editor.leapHas')}</span>
              <IntegerInput
                className={styles.tiny}
                value={rule.days}
                aria-label={t('calendars.editor.leapDaysLabel', { n: i + 1 })}
                onValue={(days) =>
                  set(i, (target) => {
                    target.days = days
                  })
                }
              />
              <span>{t('calendars.editor.leapMore', { count: rule.days })}</span>
              <span>{t('calendars.editor.leapUnless')}</span>
              <IntegerInput
                className={styles.tiny}
                value={rule.unless ?? Number.NaN}
                placeholder="—"
                aria-label={t('calendars.editor.leapUnlessLabel', { n: i + 1 })}
                onValue={(unless) =>
                  set(i, (target) => {
                    if (unless > 0) target.unless = unless
                    else {
                      delete target.unless
                      delete target.but
                    }
                  })
                }
              />
              {/* «Pero sí cada…» solo tiene sentido con un «salvo» */}
              {rule.unless ? (
                <>
                  <span>{t('calendars.editor.leapBut')}</span>
                  <IntegerInput
                    className={styles.tiny}
                    value={rule.but ?? Number.NaN}
                    placeholder="—"
                    aria-label={t('calendars.editor.leapButLabel', { n: i + 1 })}
                    onValue={(but) =>
                      set(i, (target) => {
                        if (but > 0) target.but = but
                        else delete target.but
                      })
                    }
                  />
                </>
              ) : null}
              <RemoveButton
                label={t('calendars.editor.removeLeap', { n: i + 1 })}
                onClick={() => change((d) => void d.leapRules.splice(i, 1))}
              />
            </li>
          ))}
        </ol>
      )}
      {draft.leapRules.length < 10 && draft.months.length > 0 && (
        <AddButton
          label={t('calendars.editor.addLeap')}
          onClick={() =>
            change(
              (d) =>
                void d.leapRules.push({
                  monthId: d.months.find((m) => !m.festival)?.id ?? d.months[0]?.id ?? '',
                  days: 1,
                  every: 2
                })
            )
          }
        />
      )}
    </>
  )
}

/** El día del año escrito como fecha («1 de Brotes») */
function dayText(draft: CalendarDefinition, day: number, valid: boolean) {
  if (!valid || !Number.isInteger(day) || day < 1 || day > yearLength(draft)) return ''
  return formatDate(draft, dateFromDay(draft, yearStart(draft, 1) + day - 1), { noYear: true })
}

export function SeasonsSection({
  draft,
  change,
  problems,
  valid,
  reference
}: SectionProps & { valid: boolean; reference: CalendarDefinition }) {
  const { t } = useTranslation()
  const drag = useRowDrag((from, to) => change((d) => moved(d.seasons, from, to)))
  const max = yearLength(draft)
  return (
    <>
      {draft.seasons.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">
                <span className={styles.srOnly}>{t('calendars.editor.order')}</span>
              </th>
              <th scope="col">
                <span className={styles.srOnly}>{t('calendars.editor.color')}</span>
              </th>
              <th scope="col">{t('calendars.editor.monthName')}</th>
              <th scope="col" className={styles.center}>
                {t('calendars.editor.fromDay')}
              </th>
              <th scope="col" className={styles.center}>
                {t('calendars.editor.toDay')}
              </th>
              <th scope="col">
                <span className={styles.srOnly}>{t('calendars.editor.inMonths')}</span>
              </th>
              <th scope="col">
                <span className={styles.srOnly}>{t('calendars.editor.removeColumn')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {draft.seasons.map((season, i) => {
              const label = season.name || t('calendars.editor.newSeason', { n: i + 1 })
              const bad = flagged(problems, 'seasons', i)
              return (
                <tr
                  key={season.id}
                  data-drop={drag.over === i || undefined}
                  data-dragging={drag.dragging === i || undefined}
                  {...drag.row(i)}
                >
                  <td>
                    <button
                      type="button"
                      className={styles.handle}
                      data-handle
                      aria-label={t('calendars.editor.dragRow', { name: label })}
                      {...drag.handle(i, draft.seasons.length)}
                    >
                      <GripVertical size={16} aria-hidden="true" />
                    </button>
                  </td>
                  <td>
                    <input
                      type="color"
                      className={styles.swatch}
                      data-empty={season.color ? undefined : true}
                      value={season.color ?? '#808080'}
                      aria-label={t('calendars.editor.colorOf', { name: label })}
                      onChange={(event) =>
                        change((d) => {
                          const target = d.seasons[i]
                          if (target) target.color = event.target.value
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className={styles.grow}
                      value={season.name}
                      maxLength={60}
                      aria-label={t('calendars.editor.seasonName', { n: i + 1 })}
                      aria-invalid={bad || undefined}
                      onChange={(event) =>
                        change((d) => {
                          const target = d.seasons[i]
                          if (target) target.name = event.target.value
                        })
                      }
                    />
                  </td>
                  <td className={styles.center}>
                    <IntegerInput
                      className={styles.small}
                      value={season.startDay}
                      aria-label={t('calendars.editor.seasonFrom', { name: label })}
                      aria-invalid={bad || undefined}
                      onValue={(day) =>
                        change((d) => {
                          const target = d.seasons[i]
                          if (target) target.startDay = day
                        })
                      }
                    />
                  </td>
                  <td className={styles.center}>
                    <IntegerInput
                      className={styles.small}
                      value={season.endDay}
                      aria-label={t('calendars.editor.seasonTo', { name: label })}
                      aria-invalid={bad || undefined}
                      onValue={(day) =>
                        change((d) => {
                          const target = d.seasons[i]
                          if (target) target.endDay = day
                        })
                      }
                    />
                  </td>
                  <td className={`${styles.muted} ${styles.seasonText}`}>
                    {t('calendars.editor.seasonRange', {
                      from: dayText(reference, season.startDay, valid),
                      to: dayText(reference, season.endDay, valid)
                    })}
                  </td>
                  <td>
                    <RemoveButton
                      label={t('calendars.editor.remove', { name: label })}
                      onClick={() => change((d) => void d.seasons.splice(i, 1))}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {draft.seasons.length < 12 && (
        <AddButton
          label={t('calendars.editor.addSeason')}
          onClick={() =>
            change((d) => {
              const end = d.seasons.reduce((last, s) => Math.max(last, s.endDay), 0)
              const startDay = Math.min(max, end + 1)
              d.seasons.push({
                id: newCalendarId(takenIds(d)),
                name: t('calendars.editor.newSeason', { n: d.seasons.length + 1 }),
                startDay,
                endDay: max
              })
            })
          }
        />
      )}
    </>
  )
}

export function MoonsSection({ draft, change, problems }: SectionProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState<string | null>(null)
  return (
    <>
      <ol className={styles.cards}>
        {draft.moons.map((moon, i) => {
          const label = moon.name || t('calendars.editor.newMoon', { n: i + 1 })
          const bad = flagged(problems, 'moons', i)
          return (
            <li key={moon.id} className={styles.moon}>
              <span className={styles.moonFace} style={{ ['--moon-color' as string]: moon.color }} aria-hidden="true" />
              <div className={styles.moonFields}>
                <label className={styles.field}>
                  <span>{t('calendars.editor.moonName')}</span>
                  <span className={styles.withSwatch}>
                    <input
                      type="color"
                      className={styles.swatch}
                      value={moon.color}
                      aria-label={t('calendars.editor.colorOf', { name: label })}
                      onChange={(event) =>
                        change((d) => {
                          const target = d.moons[i]
                          if (target) target.color = event.target.value
                        })
                      }
                    />
                    <input
                      value={moon.name}
                      maxLength={60}
                      aria-invalid={bad || undefined}
                      onChange={(event) =>
                        change((d) => {
                          const target = d.moons[i]
                          if (target) target.name = event.target.value
                        })
                      }
                    />
                  </span>
                </label>
                <div className={styles.field}>
                  <span aria-hidden="true">{t('calendars.editor.cycle')}</span>
                  <IntegerInput
                    decimal
                    aria-label={`${t('calendars.editor.cycle')} · ${label}`}
                    value={moon.cycleDays}
                    aria-invalid={bad || undefined}
                    onValue={(days) =>
                      change((d) => {
                        const target = d.moons[i]
                        if (target) target.cycleDays = days
                      })
                    }
                  />
                </div>
                <div className={styles.field}>
                  <span aria-hidden="true">{t('calendars.editor.offset')}</span>
                  <IntegerInput
                    decimal
                    aria-label={`${t('calendars.editor.offset')} · ${label}`}
                    value={moon.offsetDays}
                    onValue={(days) =>
                      change((d) => {
                        const target = d.moons[i]
                        if (target) target.offsetDays = days
                      })
                    }
                  />
                </div>
                <div className={styles.phases}>
                  <span className={styles.muted}>
                    {t('calendars.editor.phasesCount', { count: moon.phases.length })}
                  </span>
                  {editing === moon.id ? (
                    <>
                      <IntegerInput
                        aria-label={t('calendars.editor.phaseCountLabel', { name: label })}
                        className={styles.tiny}
                        value={moon.phases.length}
                        onValue={(count) =>
                          change((d) => {
                            const target = d.moons[i]
                            if (!target || count < 2 || count > 32) return
                            target.phases =
                              count === 8
                                ? [...DEFAULT_PHASES]
                                : Array.from({ length: count }, (_, p) => target.phases[p] ?? `Fase ${p + 1}`)
                          })
                        }
                      />
                      {moon.phases.map((phase, p) => (
                        <input
                          key={p}
                          className={styles.phaseInput}
                          value={phase}
                          maxLength={60}
                          aria-label={t('calendars.editor.phaseName', { n: p + 1, name: label })}
                          onChange={(event) =>
                            change((d) => {
                              const target = d.moons[i]
                              if (target) target.phases[p] = event.target.value
                            })
                          }
                        />
                      ))}
                      <button type="button" className={styles.link} onClick={() => setEditing(null)}>
                        {t('calendars.editor.donePhases')}
                      </button>
                    </>
                  ) : (
                    <>
                      {moon.phases.map((phase, p) => (
                        <span key={p} className={styles.chip}>
                          {phase}
                        </span>
                      ))}
                      <button type="button" className={styles.link} onClick={() => setEditing(moon.id)}>
                        {t('calendars.editor.changePhases')}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <RemoveButton
                label={t('calendars.editor.remove', { name: label })}
                onClick={() => change((d) => void d.moons.splice(i, 1))}
              />
            </li>
          )
        })}
      </ol>
      {draft.moons.length < 10 && (
        <AddButton
          label={t('calendars.editor.addMoon')}
          onClick={() =>
            change(
              (d) =>
                void d.moons.push({
                  id: newCalendarId(takenIds(d)),
                  name: t('calendars.editor.newMoon', { n: d.moons.length + 1 }),
                  cycleDays: 28,
                  offsetDays: 0,
                  color: '#d8dce4',
                  phases: [...DEFAULT_PHASES]
                })
            )
          }
        />
      )}
    </>
  )
}

export function ErasSection({ draft, change, problems }: SectionProps) {
  const { t } = useTranslation()
  return (
    <>
      <ol className={styles.cards}>
        {draft.eras.map((era, i) => {
          const label = era.name || t('calendars.editor.newEra', { n: i + 1 })
          const bad = flagged(problems, 'eras', i)
          return (
            <li key={era.id} className={styles.era} data-invalid={bad || undefined}>
              <div className={styles.pair}>
                <label className={styles.field}>
                  <span>{t('calendars.editor.eraName')}</span>
                  <input
                    value={era.name}
                    maxLength={60}
                    aria-invalid={bad || undefined}
                    onChange={(event) =>
                      change((d) => {
                        const target = d.eras[i]
                        if (target) target.name = event.target.value
                      })
                    }
                  />
                </label>
                <label className={`${styles.field} ${styles.short}`}>
                  <span>{t('calendars.editor.abbreviation')}</span>
                  <input
                    value={era.abbreviation ?? ''}
                    maxLength={12}
                    onChange={(event) =>
                      change((d) => {
                        const target = d.eras[i]
                        if (!target) return
                        if (event.target.value) target.abbreviation = event.target.value
                        else delete target.abbreviation
                      })
                    }
                  />
                </label>
              </div>
              <div className={styles.dates}>
                <div className={styles.field}>
                  <span aria-hidden="true">{t('calendars.editor.start')}</span>
                  <DateInput
                    definition={draft}
                    value={era.start}
                    label={`${t('calendars.editor.start')} · ${label}`}
                    invalid={bad}
                    onChange={(date) =>
                      change((d) => {
                        const target = d.eras[i]
                        if (target) target.start = date
                      })
                    }
                  />
                </div>
                <div className={styles.field}>
                  <span aria-hidden="true">{t('calendars.editor.end')}</span>
                  <div className={styles.endRow}>
                    {era.end ? (
                      <DateInput
                        definition={draft}
                        value={era.end}
                        label={`${t('calendars.editor.end')} · ${label}`}
                        invalid={bad}
                        onChange={(date) =>
                          change((d) => {
                            const target = d.eras[i]
                            if (target) target.end = date
                          })
                        }
                      />
                    ) : null}
                    <label className={styles.inline}>
                      <input
                        type="checkbox"
                        checked={!era.end}
                        onChange={(event) =>
                          change((d) => {
                            const target = d.eras[i]
                            if (!target) return
                            if (event.target.checked) delete target.end
                            else target.end = { year: target.start.year + 100 }
                          })
                        }
                      />
                      {t('calendars.editor.openEnd')}
                      <span className={styles.srOnly}> · {label}</span>
                    </label>
                  </div>
                </div>
              </div>
              <label className={styles.field}>
                <span>{t('calendars.editor.eraDescription')}</span>
                <input
                  value={era.description ?? ''}
                  maxLength={280}
                  onChange={(event) =>
                    change((d) => {
                      const target = d.eras[i]
                      if (!target) return
                      if (event.target.value) target.description = event.target.value
                      else delete target.description
                    })
                  }
                />
              </label>
              <div className={styles.flags}>
                <label className={styles.inline}>
                  <input
                    type="checkbox"
                    checked={!!era.countsFromStart}
                    onChange={(event) =>
                      change((d) => {
                        const target = d.eras[i]
                        if (!target) return
                        if (event.target.checked) target.countsFromStart = true
                        else delete target.countsFromStart
                      })
                    }
                  />
                  {t('calendars.editor.countsFromStart')}
                </label>
                <label className={styles.inline}>
                  <input
                    type="checkbox"
                    checked={!!era.hidden}
                    onChange={(event) =>
                      change((d) => {
                        const target = d.eras[i]
                        if (!target) return
                        if (event.target.checked) target.hidden = true
                        else delete target.hidden
                      })
                    }
                  />
                  {t('calendars.editor.hidden')}
                </label>
              </div>
              <RemoveButton
                label={t('calendars.editor.remove', { name: label })}
                onClick={() => change((d) => void d.eras.splice(i, 1))}
              />
            </li>
          )
        })}
      </ol>
      {draft.eras.length < 100 && (
        <AddButton
          label={t('calendars.editor.addEra')}
          onClick={() =>
            change(
              (d) =>
                void d.eras.push({
                  id: newCalendarId(takenIds(d)),
                  name: t('calendars.editor.newEra', { n: d.eras.length + 1 }),
                  start: { year: (d.eras.at(-1)?.start.year ?? -100) + 100 }
                })
            )
          }
        />
      )}
    </>
  )
}

export function CorrespondenceSection({
  draft,
  change,
  primary
}: SectionProps & { primary: { id: string; name: string; definition: CalendarDefinition } }) {
  const { t } = useTranslation()
  const anchor = draft.correspondence
  const firstMonth = draft.months[0]?.name ?? ''
  if (!anchor)
    return (
      <AddButton
        label={t('calendars.editor.addCorrespondence')}
        onClick={() =>
          change((d) => {
            const month = primary.definition.months[0]?.id
            if (month) d.correspondence = { calendarId: primary.id, date: { year: 0, month, day: 1 } }
          })
        }
      />
    )
  return (
    <div className={styles.correspondence}>
      <span>{t('calendars.editor.correspondenceIntro', { month: firstMonth })}</span>
      <DateInput
        definition={primary.definition}
        value={anchor.date}
        full
        label={t('calendars.editor.correspondenceTitle')}
        onChange={(date) =>
          change((d) => {
            if (date.month !== undefined && date.day !== undefined)
              d.correspondence = { calendarId: primary.id, date: { year: date.year, month: date.month, day: date.day } }
          })
        }
      />
      <span>{t('calendars.editor.correspondenceIn', { name: primary.name })}</span>
      <button
        type="button"
        className={styles.link}
        onClick={() =>
          change((d) => {
            d.correspondence = null
          })
        }
      >
        {t('calendars.editor.removeCorrespondence')}
      </button>
    </div>
  )
}
