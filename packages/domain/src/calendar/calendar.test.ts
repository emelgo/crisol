import { describe, expect, it } from 'vitest'
import { convertDate, invertedCorrespondence, offsetToPrimary, type WorldCalendar } from './convert.ts'
import {
  addDays,
  addMonths,
  CalendarDateError,
  clampDate,
  compareDates,
  dateFromDay,
  dateSpan,
  dayNumber,
  dayOfYear,
  daysInMonth,
  eraOf,
  isValidDate,
  meanYearLength,
  monthGrid,
  moonEvent,
  moonPhases,
  occurrences,
  seasonOf,
  weekdayName,
  weekdayOf,
  yearLength
} from './dates.ts'
import { blankCalendar, type CalendarDefinition, copyCalendar, type FullDate, gregorianCalendar } from './definition.ts'
import { describeDate } from './describe.ts'
import { EANA, HARPTOS_LIKE, OUTSIDE_CONTINUOUS } from './fixtures.ts'
import {
  dateDistance,
  dateForm,
  formatDate,
  formatDistance,
  formatRange,
  formatYear,
  monthNumber,
  parseDate
} from './format.ts'

const GREGORIAN = gregorianCalendar()
const id = (def: CalendarDefinition, name: string) => {
  const found = def.months.find((m) => m.name === name)
  if (!found) throw new Error(`No existe el mes ${name}`)
  return found.id
}
/** Una fecha de Eana por el nombre del mes, como en la nota de su calendario */
const d = (day: number, month: string, year = 331): FullDate => ({ year, month: id(EANA, month), day })
const g = (year: number, month: number, day: number): FullDate => ({
  year,
  month: GREGORIAN.months[month - 1]?.id ?? '',
  day
})
const phase = (date: FullDate, moon: string) => moonPhases(EANA, date).find((p) => p.moon.name === moon)?.name

describe('el calendario de Eana', () => {
  it('mide 364 días: 12 meses de 28 y 4 semanas de fiestas', () => {
    expect(yearLength(EANA)).toBe(364)
    expect(yearLength(EANA, 1250)).toBe(364)
    expect(meanYearLength(EANA)).toBe(364)
  })

  it('escribe las fechas en español, con el artículo de las festividades', () => {
    expect(formatDate(EANA, d(18, 'Hojarasca'))).toBe('18 de Hojarasca de 331 RC')
    expect(formatDate(EANA, d(4, 'Semana del Yunque', 332))).toBe('4 de la Semana del Yunque de 332 RC')
    expect(formatDate(EANA, d(4, 'Alba Triste'))).toBe('4 del Alba Triste de 331 RC')
    expect(formatDate(EANA, d(2, 'Carnaval'), { noYear: true })).toBe('2 del Carnaval')
    expect(formatDate(EANA, d(1, 'Semana de las Hermanas'), { weekday: true })).toBe(
      'Herrero, 1 de la Semana de las Hermanas de 331 RC'
    )
    expect(formatDate(EANA, { year: 1250, month: id(EANA, 'Siega') })).toBe('Siega de 1250 RC')
    expect(formatDate(EANA, { year: -980 })).toBe('-980 RC')
  })

  it('cada mes y cada semana festiva empiezan en Herrero', () => {
    for (const month of EANA.months) expect(weekdayName(EANA, { year: 331, month: month.id, day: 1 })).toBe('Herrero')
    expect(weekdayName(EANA, d(7, 'Cierzo', -991))).toBe('Melancolía')
  })

  it('estaciones y eras', () => {
    expect(seasonOf(EANA, d(7, 'Alba Triste'))?.name).toBe('Invierno')
    expect(seasonOf(EANA, d(1, 'Carnaval'))?.name).toBe('Primavera')
    expect(seasonOf(EANA, d(18, 'Hojarasca'))?.name).toBe('Otoño')
    expect(eraOf(EANA, d(1, 'Siega'))?.name).toBe('Era de la República')
    expect(eraOf(EANA, d(1, 'Siega', -991))?.name).toBe('Era de los Reyes Predestinados')
    expect(eraOf(EANA, d(1, 'Siega', -980))?.name).toBe('Era de los Nuevos Reinos')
    expect(eraOf(EANA, d(1, 'Siega', -20000))).toBeNull()
  })

  it('las lunas coinciden con la nota «Calendario de Eana»', () => {
    expect(phase(d(4, 'Alba Triste'), 'Melancolía')).toBe('Nueva')
    expect(phase(d(4, 'Alba Triste'), 'Eternidad')).toBe('Llena')
    for (const date of [
      d(11, 'Cierzo'),
      d(4, 'Siembra'),
      d(4, 'Semana del Yunque'),
      d(25, 'Siega'),
      d(18, 'Hojarasca')
    ])
      expect(phase(date, 'Melancolía')).toBe('Llena')
    for (const date of [d(25, 'Escarcha'), d(18, 'Florida'), d(11, 'Trilla'), d(4, 'Brumas')])
      expect(phase(date, 'Melancolía')).toBe('Nueva')
    for (let day = 1; day <= 7; day++) expect(phase(d(day, 'Semana de las Hermanas'), 'Eternidad')).toBe('Llena')
    for (const month of ['Escarcha', 'Florida', 'Trilla', 'Brumas'])
      expect(phase(d(14, month), 'Eternidad')).toBe('Nueva')
  })

  it('los días de luna nueva y llena, en el centro de su fase', () => {
    const [melancolia, eternidad] = EANA.moons
    if (!melancolia || !eternidad) throw new Error('sin lunas')
    expect(moonEvent(melancolia, dayNumber(EANA, d(4, 'Alba Triste')))).toBe('new')
    expect(moonEvent(melancolia, dayNumber(EANA, d(5, 'Alba Triste')))).toBeNull()
    expect(moonEvent(melancolia, dayNumber(EANA, d(18, 'Hojarasca')))).toBe('full')
    expect(moonEvent(eternidad, dayNumber(EANA, d(4, 'Alba Triste')))).toBe('full')
  })

  it('describe 1250-Siega-18: día de la semana, estación, era y las dos lunas', () => {
    const parsed = parseDate(EANA, '1250-Siega-18')
    if (!parsed.ok) throw new Error(parsed.message)
    const described = describeDate(EANA, parsed.date)
    // Cada mes empieza en Herrero: el 18 es Frostelle (17 días después; 17 mod 7 = 3)
    expect(described.dayOfYear).toBe(7 * 3 + 28 * 6 + 18)
    expect(described.weekday).toBe('Frostelle')
    expect(described.text).toBe('Frostelle, 18 de Siega de 1250 RC')
    expect(described.form).toBe('1250-Siega-18')
    expect(described.season).toBe('Verano')
    expect(described.era).toEqual({ id: 'republica', name: 'Era de la República', abbreviation: 'ER' })
    expect(described.moons.map((m) => m.name)).toEqual(['Melancolía', 'Eternidad'])
    // Melancolía: llena el 25 de Siega (como en la nota); el 18, una semana antes, cuarto creciente
    expect(described.moons[0]?.phase).toBe(phase(d(18, 'Siega', 1250), 'Melancolía'))
    expect(phase(d(25, 'Siega', 1250), 'Melancolía')).toBe('Llena')
  })
})

describe('ida y vuelta', () => {
  const calendars: Array<[string, CalendarDefinition]> = [
    ['gregoriano (con bisiestos)', GREGORIAN],
    ['Eana (festividades, sin bisiestos)', EANA],
    ['fuera de la semana y semana que empieza cada mes', HARPTOS_LIKE]
  ]
  for (const [name, def] of calendars) {
    it(`fecha → día → fecha en ±100.000 años: ${name}`, () => {
      const years = [
        -100_000, -99_999, -12_000, -401, -400, -101, -100, -5, -4, -1, 0, 1, 3, 4, 100, 400, 2000, 99_999, 100_000
      ]
      for (const year of years)
        for (const month of def.months) {
          const length = daysInMonth(def, year, month.id)
          for (const day of [1, Math.ceil(length / 2), length]) {
            const date = { year, month: month.id, day }
            expect(dateFromDay(def, dayNumber(def, date))).toEqual(date)
          }
        }
    })

    it(`día → fecha → día, seguidos y sin huecos: ${name}`, () => {
      for (const start of [-36_500_000, -400_000, -1000, 0, 700_000, 36_500_000]) {
        let previous = dateFromDay(def, start - 1)
        for (let n = start; n < start + 1500; n++) {
          const date = dateFromDay(def, n)
          expect(dayNumber(def, date)).toBe(n)
          expect(compareDates(def, previous, date)).toBeLessThan(0)
          previous = date
        }
      }
    })
  }

  it('calcula 10.000 fechas en menos de 50 ms', () => {
    const round = () => {
      const started = performance.now()
      let sum = 0
      for (let i = 0; i < 10_000; i++) {
        const date = dateFromDay(GREGORIAN, i * 3_650 - 18_250_000)
        sum += dayNumber(GREGORIAN, date) + (weekdayOf(GREGORIAN, date) ?? 0)
      }
      expect(sum).not.toBe(0)
      return performance.now() - started
    }
    // La primera vuelta calienta el JIT; con la máquina cargada (todas las pruebas a la vez), cuenta la mejor de cinco
    round()
    expect(Math.min(...Array.from({ length: 5 }, round))).toBeLessThan(50)
  })
})

describe('el gregoriano', () => {
  it('bisiestos cada 4 años, salvo cada 100, pero sí cada 400', () => {
    expect(yearLength(GREGORIAN, 2024)).toBe(366)
    expect(yearLength(GREGORIAN, 1900)).toBe(365)
    expect(yearLength(GREGORIAN, 2000)).toBe(366)
    expect(yearLength(GREGORIAN, -4)).toBe(366)
    expect(yearLength(GREGORIAN, -100)).toBe(365)
    expect(daysInMonth(GREGORIAN, 2024, 'feb')).toBe(29)
    expect(meanYearLength(GREGORIAN)).toBeCloseTo(365.2425, 6)
  })

  it('los días de la semana de verdad', () => {
    expect(weekdayName(GREGORIAN, g(2000, 1, 1))).toBe('Sábado')
    expect(weekdayName(GREGORIAN, g(2026, 11, 16))).toBe('Lunes')
    expect(weekdayName(GREGORIAN, g(1969, 7, 20))).toBe('Domingo')
    expect(weekdayName(GREGORIAN, g(0, 1, 1))).toBe('Sábado')
  })

  it('la luna nueva del 6 de enero de 2000 y la llena del 21 de enero', () => {
    const luna = GREGORIAN.moons[0]
    if (!luna) throw new Error('sin luna')
    expect(moonEvent(luna, dayNumber(GREGORIAN, g(2000, 1, 6)))).toBe('new')
    expect(moonEvent(luna, dayNumber(GREGORIAN, g(2000, 1, 21)))).toBe('full')
  })

  it('el invierno cruza el fin de año', () => {
    expect(seasonOf(GREGORIAN, g(2025, 1, 10))?.name).toBe('Invierno')
    expect(seasonOf(GREGORIAN, g(2025, 12, 25))?.name).toBe('Invierno')
    expect(seasonOf(GREGORIAN, g(2025, 7, 10))?.name).toBe('Verano')
  })

  it('sumar días y meses (recortando al último día)', () => {
    expect(addDays(GREGORIAN, g(2024, 2, 28), 2)).toEqual(g(2024, 3, 1))
    expect(addDays(GREGORIAN, g(2025, 1, 1), -1)).toEqual(g(2024, 12, 31))
    expect(addMonths(GREGORIAN, g(2025, 1, 31), 1)).toEqual(g(2025, 2, 28))
    expect(addMonths(GREGORIAN, g(2025, 1, 15), -1)).toEqual(g(2024, 12, 15))
  })
})

describe('días fuera de la semana', () => {
  it('la fiesta no es de ningún día; la semana empieza cada mes', () => {
    expect(weekdayOf(HARPTOS_LIKE, { year: 10, month: 'fiesta', day: 2 })).toBeNull()
    expect(weekdayName(HARPTOS_LIKE, { year: 10, month: 'm1', day: 1 })).toBe('Tres')
    expect(weekdayName(HARPTOS_LIKE, { year: 10, month: 'm6', day: 1 })).toBe('Tres')
    expect(weekdayName(HARPTOS_LIKE, { year: 10, month: 'm6', day: 7 })).toBe('Tres')
  })

  it('con la semana seguida, la fiesta (y su día de más) no la avanza', () => {
    // 5 meses de 36 días = 180 días, múltiplo de 6: el día después de la fiesta sigue la semana como si no estuviera
    expect(weekdayName(OUTSIDE_CONTINUOUS, { year: 0, month: 'm6', day: 1 })).toBe('Uno')
    expect(weekdayName(OUTSIDE_CONTINUOUS, { year: 1, month: 'm1', day: 1 })).toBe('Uno')
    expect(weekdayName(OUTSIDE_CONTINUOUS, { year: 5, month: 'm1', day: 1 })).toBe('Uno')
    expect(weekdayName(OUTSIDE_CONTINUOUS, { year: -7, month: 'm3', day: 2 })).toBe('Dos')
  })

  it('la rejilla del mes: semanas con huecos, y la fiesta aparte', () => {
    const grid = monthGrid(HARPTOS_LIKE, 10, 'm1')
    expect(grid.weeks[0]?.slice(0, 3)).toEqual([null, null, expect.objectContaining({ day: 1, weekday: 2 })])
    expect(grid.weeks.flat().filter(Boolean)).toHaveLength(36)
    expect(grid.outside).toEqual([])
    const fiesta = monthGrid(HARPTOS_LIKE, 12, 'fiesta')
    expect(fiesta.weeks).toEqual([])
    expect(fiesta.outside.map((day) => day.day)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('el sufijo de antes del año 0', () => {
    expect(formatYear(HARPTOS_LIKE, -980)).toBe('980 a. V.')
    expect(formatYear(HARPTOS_LIKE, 0)).toBe('0 CV')
    expect(formatDate(HARPTOS_LIKE, { year: -3, month: 'fiesta', day: 2 })).toBe(
      '2 de la Fiesta del Medio Año de 3 a. V.'
    )
  })
})

describe('precisión, recortar y repetir', () => {
  it('lo que falta baja la precisión y la fecha abarca más', () => {
    const siega = id(EANA, 'Siega')
    expect(dateSpan(EANA, { year: 1250 })).toEqual([
      dayNumber(EANA, { year: 1250 }),
      dayNumber(EANA, { year: 1250 }) + 363
    ])
    const [from, to] = dateSpan(EANA, { year: 1250, month: siega })
    expect(to - from).toBe(27)
    expect(dayOfYear(EANA, { year: 1250 })).toBe(1)
  })

  it('un día que ya no cabe (el mes se acortó) se lee como el último', () => {
    const short = { ...EANA, months: EANA.months.map((m) => (m.id === 'siega' ? { ...m, days: 20 } : m)) }
    expect(clampDate(short, { year: 1, month: 'siega', day: 25 })).toEqual({ year: 1, month: 'siega', day: 20 })
    expect(isValidDate(short, { year: 1, month: 'siega', day: 25 })).toBe(false)
    expect(formatDate(short, { year: 1, month: 'siega', day: 25 })).toBe('20 de Siega de 1 RC')
  })

  it('un mes que no existe es un error', () => {
    expect(() => dayNumber(EANA, { year: 1, month: 'nada', day: 1 })).toThrow(CalendarDateError)
  })

  it('las repeticiones anuales dentro de un intervalo, recortando el día si ese año es más corto', () => {
    const feb29 = { start: g(2024, 2, 29), yearly: true }
    const from = dayNumber(GREGORIAN, g(2024, 1, 1))
    const to = dayNumber(GREGORIAN, g(2028, 12, 31))
    expect(occurrences(GREGORIAN, feb29, from, to).map((o) => o.start)).toEqual([
      g(2024, 2, 29),
      g(2025, 2, 28),
      g(2026, 2, 28),
      g(2027, 2, 28),
      g(2028, 2, 29)
    ])
    // Antes de su año no se repite; sin «cada año», solo la suya
    expect(occurrences(GREGORIAN, feb29, dayNumber(GREGORIAN, g(2020, 1, 1)), from)).toHaveLength(0)
    expect(occurrences(GREGORIAN, { start: g(2024, 3, 1) }, from, to)).toHaveLength(1)
    // Un periodo que cruza el año
    const winter = { start: g(2024, 12, 30), end: g(2025, 1, 2), yearly: true }
    expect(
      occurrences(GREGORIAN, winter, dayNumber(GREGORIAN, g(2026, 1, 1)), dayNumber(GREGORIAN, g(2026, 1, 1)))
    ).toEqual([{ start: g(2025, 12, 30), end: g(2026, 1, 2) }])
  })
})

describe('eras', () => {
  const regnal: CalendarDefinition = {
    ...EANA,
    eras: [
      ...EANA.eras,
      {
        id: 'reyes2',
        name: 'Era de los Reyes',
        abbreviation: 'ER',
        start: { year: 1216, month: 'siega', day: 1 },
        countsFromStart: true
      }
    ]
  }
  it('una era que cuenta desde su inicio numera sus años desde 1 con su abreviatura', () => {
    expect(formatDate(regnal, { year: 1249, month: 'siega', day: 3 })).toBe('3 de Siega de 34 ER')
    expect(formatDate(regnal, { year: 1216, month: 'pastos', day: 3 })).toBe('3 de Pastos de 1216 RC')
    expect(formatDate(regnal, { year: 1216, month: 'siega', day: 1 })).toBe('1 de Siega de 1 ER')
  })

  it('una era abierta sigue hasta el final', () => {
    expect(eraOf(EANA, { year: 100_000 })?.id).toBe('republica')
  })
})

describe('el texto y la forma de la IA', () => {
  const siega = id(EANA, 'Siega')
  it('lee el número (sin contar festividades), el nombre sin tildes y las festividades por su nombre', () => {
    expect(parseDate(EANA, '1250-Siega-18')).toEqual({ ok: true, date: { year: 1250, month: siega, day: 18 } })
    expect(parseDate(EANA, '1250-siega-18')).toEqual({ ok: true, date: { year: 1250, month: siega, day: 18 } })
    // Mes 7: Cierzo, Escarcha, Deshielo, Siembra, Florida, Pastos, Siega
    expect(parseDate(EANA, '1250-07-18')).toEqual({ ok: true, date: { year: 1250, month: siega, day: 18 } })
    expect(parseDate(EANA, '1250-07')).toEqual({ ok: true, date: { year: 1250, month: siega } })
    expect(parseDate(EANA, '1250')).toEqual({ ok: true, date: { year: 1250 } })
    expect(parseDate(EANA, '-980-01-01')).toEqual({ ok: true, date: { year: -980, month: 'cierzo', day: 1 } })
    expect(parseDate(EANA, '332-Semana-del-Yunque-4')).toEqual({
      ok: true,
      date: { year: 332, month: 'yunque', day: 4 }
    })
    expect(parseDate(EANA, '332-semana del yunque-4')).toEqual({
      ok: true,
      date: { year: 332, month: 'yunque', day: 4 }
    })
    expect(parseDate(EANA, '-12-Melancolia')).toMatchObject({ ok: false, reason: 'MONTH' })
    expect(parseDate(EANA, { year: 3, month: 'Nochelarga', day: 28 })).toEqual({
      ok: true,
      date: { year: 3, month: 'nochelarga', day: 28 }
    })
  })

  it('un mes con número en su nombre («Mes 3», de uno en blanco)', () => {
    const blank = blankCalendar()
    const third = blank.months[2]?.id
    expect(parseDate(blank, '5-Mes 3')).toEqual({ ok: true, date: { year: 5, month: third } })
    expect(parseDate(blank, '5-Mes-3-30')).toEqual({ ok: true, date: { year: 5, month: third, day: 30 } })
  })

  it('dice por qué no puede', () => {
    expect(parseDate(EANA, 'ayer')).toMatchObject({ ok: false, reason: 'FORMAT' })
    expect(parseDate(EANA, '1250-Siega-29')).toMatchObject({
      ok: false,
      reason: 'DAY',
      message: 'Siega de 1250 tiene 28 días'
    })
    expect(parseDate(EANA, '1250-17')).toMatchObject({ ok: false, reason: 'MONTH' })
  })

  it('la forma con el nombre del mes y su número', () => {
    expect(dateForm(EANA, { year: -980, month: siega, day: 3 })).toBe('-980-Siega-3')
    expect(dateForm(EANA, { year: 1250, month: siega })).toBe('1250-Siega')
    expect(monthNumber(EANA, siega)).toBe(7)
    expect(monthNumber(EANA, 'yunque')).toBeNull()
  })

  it('un periodo sin repetir lo que comparten', () => {
    expect(formatRange(EANA, d(12, 'Siega', 1250), d(18, 'Siega', 1250))).toBe('12–18 de Siega de 1250 RC')
    expect(formatRange(EANA, d(12, 'Siega', 1250), d(3, 'Trilla', 1250))).toBe('12 de Siega – 3 de Trilla de 1250 RC')
    expect(formatRange(EANA, { year: 1250 }, { year: 1262 })).toBe('1250 RC – 1262 RC')
    expect(formatRange(EANA, d(1, 'Siega'), null)).toBe('1 de Siega de 331 RC')
  })

  it('la distancia en la unidad natural más grande', () => {
    expect(formatDistance(dateDistance(EANA, d(1, 'Siega', 1247), d(1, 'Siega', 1250)))).toBe('3 años después')
    expect(formatDistance(dateDistance(EANA, d(1, 'Siega', 1250), d(1, 'Siega', 1050)))).toBe('2 siglos antes')
    expect(formatDistance(dateDistance(EANA, { year: -8000 }, { year: 0 }))).toBe('8 milenios después')
    expect(formatDistance(dateDistance(EANA, d(5, 'Siega', 1250), d(5, 'Brumas', 1250)))).toBe('4 meses después')
    expect(formatDistance(dateDistance(EANA, d(5, 'Siega', 1250), d(9, 'Siega', 1250)))).toBe('4 días después')
    expect(formatDistance(dateDistance(EANA, d(5, 'Siega', 1250), d(5, 'Siega', 1250)))).toBe('El mismo día')
    expect(formatDistance(dateDistance(EANA, d(1, 'Semana del Yunque', 1250), d(1, 'Siega', 1250)))).toBe(
      '7 días después'
    )
  })
})

describe('convertir entre calendarios', () => {
  // El calendario de los elfos: su año 0 empezó el 1 de Cierzo del -300 de Eana
  const elves: CalendarDefinition = {
    ...blankCalendar(),
    correspondence: { calendarId: 'eana', date: { year: -300, month: 'cierzo', day: 1 } }
  }
  const world: WorldCalendar[] = [
    { id: 'eana', primary: true, definition: EANA },
    { id: 'elfos', primary: false, definition: elves },
    { id: 'suelto', primary: false, definition: GREGORIAN }
  ]

  it('el desfase de cada uno respecto al principal', () => {
    expect(offsetToPrimary(world, 'eana')).toBe(0)
    expect(offsetToPrimary(world, 'elfos')).toBe(dayNumber(EANA, { year: -300, month: 'cierzo', day: 1 }))
    expect(offsetToPrimary(world, 'suelto')).toBeNull()
  })

  it('de uno a otro, por el principal; sin correspondencia, nada', () => {
    const first = elves.months[0]?.id ?? ''
    expect(convertDate(world, 'elfos', 'eana', { year: 0, month: first, day: 1 })).toEqual({
      start: { year: -300, month: 'cierzo', day: 1 },
      end: null
    })
    const back = convertDate(world, 'eana', 'elfos', { year: -300, month: 'cierzo', day: 1 })
    expect(back?.start).toEqual({ year: 0, month: first, day: 1 })
    // Un año entero: el día en que empieza y en el que acaba
    const year = convertDate(world, 'elfos', 'eana', { year: 0 })
    expect(year?.end).toEqual(dateFromDay(EANA, dayNumber(EANA, { year: -300, month: 'cierzo', day: 1 }) + 359))
    expect(convertDate(world, 'suelto', 'eana', { year: 1 })).toBeNull()
  })

  it('al cambiar de principal, el anterior recibe la inversa y lo convertido cuadra igual', () => {
    const before = convertDate(world, 'eana', 'elfos', d(18, 'Siega', 1250))
    const [eana, elfos] = world as [WorldCalendar, WorldCalendar, WorldCalendar]
    const inverse = invertedCorrespondence(eana, elfos)
    expect(inverse?.calendarId).toBe('elfos')
    const swapped: WorldCalendar[] = [
      { id: 'eana', primary: false, definition: { ...EANA, correspondence: inverse } },
      { id: 'elfos', primary: true, definition: copyCalendar(elves) }
    ]
    expect(convertDate(swapped, 'eana', 'elfos', d(18, 'Siega', 1250))).toEqual(before)
  })

  it('una cadena que da vueltas no se sigue', () => {
    const loop: WorldCalendar[] = [
      { id: 'a', primary: false, definition: { ...EANA, correspondence: { calendarId: 'b', date: d(1, 'Siega') } } },
      { id: 'b', primary: false, definition: { ...EANA, correspondence: { calendarId: 'a', date: d(1, 'Siega') } } }
    ]
    expect(offsetToPrimary(loop, 'a')).toBeNull()
  })
})
