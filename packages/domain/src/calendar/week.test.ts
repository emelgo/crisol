import { describe, expect, it } from 'vitest'
import { weekdayName, weekdayOf } from './dates.ts'
import { blankCalendar, type CalendarDefinition, gregorianCalendar } from './definition.ts'
import { OUTSIDE_CONTINUOUS } from './fixtures.ts'
import { firstWeekdayFor, rotateWeek } from './week.ts'

const greg = gregorianCalendar()

describe('el ancla de la semana: «el 1 de {mes} del año {N} fue {día}»', () => {
  it('con lo que ya dice el calendario, el mismo firstWeekday (el 1 de enero de 2026 fue jueves)', () => {
    const date = { year: 2026, month: 'ene', day: 1 }
    expect(weekdayName(greg, date)).toBe('Jueves')
    expect(firstWeekdayFor(greg, date, 3)).toBe(greg.firstWeekday)
  })

  it('otro día de la semana mueve el firstWeekday para que la fecha caiga en él', () => {
    const date = { year: 2026, month: 'ene', day: 1 }
    const first = firstWeekdayFor(greg, date, 4)
    expect(first).toBe(6)
    const moved: CalendarDefinition = { ...greg, firstWeekday: first ?? 0 }
    expect(weekdayName(moved, date)).toBe('Viernes')
    // Y lo demás, corrido igual: el 2 de enero, sábado
    expect(weekdayName(moved, { year: 2026, month: 'ene', day: 2 })).toBe('Sábado')
  })

  it('con años negativos y la semana que empieza cada mes', () => {
    const reset: CalendarDefinition = { ...blankCalendar(), weekMode: 'reset' }
    const month = reset.months[4]?.id ?? ''
    const date = { year: -980, month, day: 1 }
    const first = firstWeekdayFor(reset, date, 2) ?? -1
    expect(weekdayOf({ ...reset, firstWeekday: first }, date)).toBe(2)
    const back = firstWeekdayFor(greg, { year: -12000, month: 'mar', day: 1 }, 0) ?? -1
    expect(weekdayOf({ ...greg, firstWeekday: back }, { year: -12000, month: 'mar', day: 1 })).toBe(0)
  })

  it('sin ancla posible: un mes fuera de la semana, un día que no es de la semana o un mes que no existe', () => {
    const outside = OUTSIDE_CONTINUOUS.months.find((m) => m.outsideWeek)?.id ?? ''
    expect(firstWeekdayFor(OUTSIDE_CONTINUOUS, { year: 1, month: outside, day: 1 }, 0)).toBeNull()
    expect(firstWeekdayFor(greg, { year: 1, month: 'ene', day: 1 }, 7)).toBeNull()
    expect(firstWeekdayFor(greg, { year: 1, month: 'no', day: 1 }, 0)).toBeNull()
  })
})

describe('«La semana empieza en»: reordena los días sin cambiar el de ninguna fecha', () => {
  it('el domingo primero: la lista empieza en él y cada fecha sigue en su día', () => {
    const sunday = rotateWeek(greg, 6)
    expect(sunday.weekdays).toEqual(['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'])
    const def = { ...greg, ...sunday }
    for (const day of [1, 2, 3, 4, 5, 6, 7])
      expect(weekdayName(def, { year: 2026, month: 'ene', day })).toBe(
        weekdayName(greg, { year: 2026, month: 'ene', day })
      )
    // El 1 de enero de 2026, jueves: la quinta columna
    expect(weekdayOf(def, { year: 2026, month: 'ene', day: 1 })).toBe(4)
  })

  it('el que ya es el primero no cambia nada; con días fuera de la semana, también cuadra', () => {
    expect(rotateWeek(greg, 0)).toEqual({ weekdays: greg.weekdays, firstWeekday: greg.firstWeekday })
    const def = { ...OUTSIDE_CONTINUOUS, ...rotateWeek(OUTSIDE_CONTINUOUS, 2) }
    // Tras la fiesta que va fuera de la semana
    const month = 'm6'
    for (const year of [-3, 0, 7])
      expect(weekdayName(def, { year, month, day: 3 })).toBe(weekdayName(OUTSIDE_CONTINUOUS, { year, month, day: 3 }))
  })
})
