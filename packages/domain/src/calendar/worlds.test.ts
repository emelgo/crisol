/**
 * Que la herramienta replica los calendarios de los mundos de rol conocidos (Enrique, 2026-11-16: «debe ser capaz de
 * replicar el calendario de Eana del Crisol antiguo y el de Faerûn, Greyhawk, etc.»). Los datos (nombres de meses, días
 * y lunas) son de las guías de cada mundo; solo sirven de prueba
 */
import { describe, expect, it } from 'vitest'
import { dateFromDay, dayNumber, isLeapYear, monthGrid, weekdayName, yearLength } from './dates.ts'
import { type CalendarDefinition, type CalendarMonth, DEFAULT_PHASES } from './definition.ts'
import { describeDate } from './describe.ts'
import { EANA } from './fixtures.ts'
import { formatDate, formatRange, parseDate } from './format.ts'
import { normalizeCalendar } from './normalize.ts'
import { validateCalendar } from './validate.ts'

const key = (name: string) => name.toLowerCase().replace(/[^a-z]/g, '')
const m = (name: string, days: number, extra: Partial<CalendarMonth> = {}): CalendarMonth => ({
  id: key(name),
  name,
  days,
  ...extra
})
const moon = (name: string, cycleDays: number, offsetDays = 0) => ({
  id: `luna-${key(name)}`,
  name,
  cycleDays,
  offsetDays,
  color: '#cccccc',
  phases: [...DEFAULT_PHASES]
})
const base = { description: '', firstWeekday: 0, seasons: [], eras: [], leapRules: [], moons: [] }

/** Faerûn: el calendario de Harptos. 12 meses de 30 días en tres decanas que empiezan cada mes; 5 fiestas de un día fuera de los meses y de la semana; Escudo Encontrado tras Pleno Verano cada 4 años */
const HARPTOS: CalendarDefinition = {
  ...base,
  yearSuffix: 'DR',
  weekdays: ['Primero', 'Segundo', 'Tercero', 'Cuarto', 'Quinto', 'Sexto', 'Séptimo', 'Octavo', 'Noveno', 'Décimo'],
  weekMode: 'reset',
  months: [
    m('Hammer', 30),
    m('Midwinter', 1, { festival: true, outsideWeek: true }),
    m('Alturiak', 30),
    m('Ches', 30),
    m('Tarsakh', 30),
    m('Greengrass', 1, { festival: true, outsideWeek: true }),
    m('Mirtul', 30),
    m('Kythorn', 30),
    m('Flamerule', 30),
    m('Midsummer', 1, { festival: true, outsideWeek: true, dayNames: ['Midsummer', 'Shieldmeet'] }),
    m('Eleasis', 30),
    m('Eleint', 30),
    m('Highharvestide', 1, { festival: true, outsideWeek: true }),
    m('Marpenoth', 30),
    m('Uktar', 30),
    m('Feast of the Moon', 1, { festival: true, outsideWeek: true }),
    m('Nightal', 30)
  ],
  leapRules: [{ monthId: 'midsummer', days: 1, every: 4 }],
  moons: [moon('Selûne', 30.4375)]
}

/** Greyhawk: el Año Común. 12 meses de 28 días y 4 semanas de fiesta dentro de la semana (364 días); Luna y Celene */
const GREYHAWK: CalendarDefinition = {
  ...base,
  yearSuffix: 'CY',
  weekdays: ['Starday', 'Sunday', 'Moonday', 'Godsday', 'Waterday', 'Earthday', 'Freeday'],
  weekMode: 'continuous',
  months: [
    m('Needfest', 7, { festival: true }),
    m('Fireseek', 28),
    m('Readying', 28),
    m('Coldeven', 28),
    m('Growfest', 7, { festival: true }),
    m('Planting', 28),
    m('Flocktime', 28),
    m('Wealsun', 28),
    m('Richfest', 7, { festival: true }),
    m('Reaping', 28),
    m('Goodmonth', 28),
    m('Harvester', 28),
    m('Brewfest', 7, { festival: true }),
    m('Patchwall', 28),
    m("Ready'reat", 28),
    m('Sunsebb', 28)
  ],
  moons: [moon('Luna', 28), moon('Celene', 91)]
}

/** Eberron: 12 meses de 28 días, semana de 7 y doce lunas (trece con Crya) */
const EBERRON: CalendarDefinition = {
  ...base,
  yearSuffix: 'YK',
  weekdays: ['Sul', 'Mol', 'Zol', 'Wir', 'Zor', 'Far', 'Sar'],
  weekMode: 'continuous',
  months: [
    'Zarantyr',
    'Olarune',
    'Therendor',
    'Eyre',
    'Dravago',
    'Nymm',
    'Lharvion',
    'Barrakas',
    'Rhaan',
    'Sypheros',
    'Aryth',
    'Vult'
  ].map((name) => m(name, 28)),
  moons: [
    ['Zarantyr', 28],
    ['Olarune', 35],
    ['Therendor', 42],
    ['Eyre', 49],
    ['Dravago', 56],
    ['Nymm', 63],
    ['Lharvion', 70],
    ['Barrakas', 77],
    ['Rhaan', 84],
    ['Sypheros', 91],
    ['Aryth', 98],
    ['Vult', 105],
    ['Crya', 112]
  ].map(([name, cycle]) => moon(`${name}`, Number(cycle)))
}

/** Golarion: como el gregoriano, con Calistril bisiesto cada 8 años */
const GOLARION: CalendarDefinition = {
  ...base,
  yearSuffix: 'AR',
  weekdays: ['Moonday', 'Toilday', 'Wealday', 'Oathday', 'Fireday', 'Starday', 'Sunday'],
  weekMode: 'continuous',
  months: [
    m('Abadius', 31),
    m('Calistril', 28),
    m('Pharast', 31),
    m('Gozran', 30),
    m('Desnus', 31),
    m('Sarenith', 30),
    m('Erastus', 31),
    m('Arodus', 31),
    m('Rova', 30),
    m('Lamashan', 31),
    m('Neth', 30),
    m('Kuthona', 31)
  ],
  leapRules: [{ monthId: 'calistril', days: 1, every: 8 }],
  moons: [moon('Somal', 29.5)]
}

/** Exandria: 11 meses de largo distinto (328 días), semana de 7, Catha y Ruidus */
const EXANDRIA: CalendarDefinition = {
  ...base,
  yearSuffix: 'P.D.',
  weekdays: ['Miresen', 'Grissen', 'Whelsen', 'Conthsen', 'Folsen', 'Yulisen', "Da'leysen"],
  weekMode: 'continuous',
  months: [
    m('Horisal', 29),
    m('Misuthar', 30),
    m('Dualahei', 30),
    m('Thunsheer', 31),
    m('Unndilar', 28),
    m('Brussendar', 31),
    m('Sydenstar', 32),
    m('Fessuran', 29),
    m("Quen'pillar", 27),
    m('Cuersaar', 29),
    m('Duscar', 32)
  ],
  moons: [moon('Catha', 33), moon('Ruidus', 328)]
}

/** Krynn: 12 meses de 28 días, semana de 7 y tres lunas */
const KRYNN: CalendarDefinition = {
  ...base,
  yearSuffix: 'AC',
  beforeZeroSuffix: 'PC',
  weekdays: ['Linaras', 'Palast', 'Majetag', 'Kirinor', 'Misham', 'Bakukal', 'Bracha'],
  weekMode: 'continuous',
  months: [
    'Winter Night',
    'Winter Deep',
    'Spring Dawning',
    'Spring Rain',
    'Spring Blossom',
    'Summer Home',
    'Summer Run',
    'Summer End',
    'Autumn Harvest',
    'Autumn Twilight',
    'Autumn Dark',
    'Winter Come'
  ].map((name) => m(name, 28)),
  moons: [moon('Solinari', 36), moon('Lunitari', 28), moon('Nuitari', 8)]
}

describe('los calendarios de los mundos de rol', () => {
  it.each([
    ['Eana', EANA],
    ['Harptos', HARPTOS],
    ['Greyhawk', GREYHAWK],
    ['Eberron', EBERRON],
    ['Golarion', GOLARION],
    ['Exandria', EXANDRIA],
    ['Krynn', KRYNN]
  ])('%s es un calendario válido que va y vuelve sin perder un día', (_, def) => {
    expect(validateCalendar(def)).toEqual([])
    for (let day = -50_000; day < 50_000; day += 997) expect(dayNumber(def, dateFromDay(def, day))).toBe(day)
  })

  it('Eana: 364 días, cada mes y cada semana de fiesta empiezan en Herrero, y las fiestas no cuentan como mes', () => {
    expect(yearLength(EANA, 331)).toBe(364)
    expect(weekdayName(EANA, { year: 331, month: 'carnaval', day: 1 })).toBe('Herrero')
    expect(weekdayName(EANA, { year: 331, month: 'siega', day: 1 })).toBe('Herrero')
    expect(formatDate(EANA, { year: 331, month: 'alba', day: 4 })).toBe('4 del Alba Triste del año 331 RC')
  })

  it('Harptos: las fiestas de un día se leen por su nombre, Escudo Encontrado sale cada 4 años y la decana empieza cada mes', () => {
    expect(yearLength(HARPTOS, 1371)).toBe(365)
    expect(isLeapYear(HARPTOS, 1372)).toBe(true)
    expect(yearLength(HARPTOS, 1372)).toBe(366)
    expect(formatDate(HARPTOS, { year: 1372, month: 'midwinter', day: 1 })).toBe('Midwinter del año 1372 DR')
    expect(formatDate(HARPTOS, { year: 1372, month: 'midsummer', day: 2 })).toBe('Shieldmeet del año 1372 DR')
    expect(parseDate(HARPTOS, '1372-Shieldmeet')).toEqual({
      ok: true,
      date: { year: 1372, month: 'midsummer', day: 2 }
    })
    expect(parseDate(HARPTOS, '1371-Shieldmeet').ok).toBe(false)
    expect(weekdayName(HARPTOS, { year: 1372, month: 'midwinter', day: 1 })).toBeNull()
    expect(weekdayName(HARPTOS, { year: 1372, month: 'alturiak', day: 1 })).toBe('Primero')
    expect(weekdayName(HARPTOS, { year: 1372, month: 'alturiak', day: 11 })).toBe('Primero')
    expect(monthGrid(HARPTOS, 1372, 'ches').weeks).toHaveLength(3)
    expect(describeDate(HARPTOS, { year: 1372, month: 'midsummer', day: 2 }).text).toBe('Shieldmeet del año 1372 DR')
  })

  it('la IA lo escribe sin ids (los meses de los bisiestos, por nombre) y conserva los días con nombre', () => {
    const { definition, problems } = normalizeCalendar({
      yearSuffix: 'DR',
      weekdays: HARPTOS.weekdays,
      weekMode: 'reset',
      months: HARPTOS.months.map(({ id: _, ...month }) => month),
      leapRules: [{ monthId: 'Midsummer', days: 1, every: 4 }]
    })
    expect(problems).toEqual([])
    expect(formatDate(definition, { year: 1372, month: definition.months[9]?.id, day: 2 })).toBe(
      'Shieldmeet del año 1372 DR'
    )
  })

  it('Greyhawk: 364 días, las semanas de fiesta son de la semana y no cuentan como mes', () => {
    expect(yearLength(GREYHAWK, 576)).toBe(364)
    expect(weekdayName(GREYHAWK, { year: 576, month: 'needfest', day: 1 })).toBe('Starday')
    expect(weekdayName(GREYHAWK, { year: 577, month: 'needfest', day: 1 })).toBe('Starday')
    expect(weekdayName(GREYHAWK, { year: 576, month: 'growfest', day: 4 })).toBe('Godsday')
    expect(describeDate(GREYHAWK, { year: 576, month: 'needfest', day: 4 }).moons).toHaveLength(2)
  })

  it('Eberron: trece lunas caben', () => {
    expect(describeDate(EBERRON, { year: 998, month: 'olarune', day: 3 }).moons).toHaveLength(13)
  })

  it('Golarion y Exandria: meses de largo distinto y bisiestos cada 8 años', () => {
    expect(yearLength(GOLARION, 4720)).toBe(366)
    expect(yearLength(GOLARION, 4721)).toBe(365)
    expect(yearLength(EXANDRIA, 836)).toBe(328)
    expect(formatDate(EXANDRIA, { year: 836, month: 'quenpillar', day: 27 })).toBe("27 de Quen'pillar del año 836 P.D.")
  })

  it('Krynn: los años antes del 0 con su sufijo', () => {
    expect(formatDate(KRYNN, { year: -1, month: 'springdawning', day: 3 })).toBe('3 de Spring Dawning del año 1 PC')
    expect(formatDate(KRYNN, { year: -3 })).toBe('Año 3 PC')
    expect(formatRange(KRYNN, { year: -3 }, { year: 2 })).toBe('Años 3 PC – 2 AC')
    expect(formatRange(KRYNN, { year: 2 }, { year: 5 })).toBe('Años 2–5 AC')
  })
})
