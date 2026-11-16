/**
 * Calendarios de las pruebas. El de Eana sale del fixture del Crisol antiguo (`eana-rc.calendar.json`, del vault de
 * Enrique; `~/CrisolVTT/crisol`, commit 3f68f11), pasado a nuestra definición
 */
import { type CalendarDefinition, DEFAULT_PHASES } from './definition.ts'

const fest = (id: string, name: string) => ({ id, name, days: 7, festival: true, color: '#c9a227' })
const month = (id: string, name: string) => ({ id, name, days: 28 })

/** 12 meses de 28 días y 4 semanas de fiestas (364 días), semana de 7, dos lunas y cinco eras */
export const EANA: CalendarDefinition = {
  yearSuffix: 'RC',
  description: 'El calendario de la República',
  weekdays: ['Herrero', 'Hacedor', 'Muerte', 'Frostelle', 'Flora', 'Eternidad', 'Melancolía'],
  firstWeekday: 0,
  weekMode: 'continuous',
  months: [
    fest('alba', 'Alba Triste'),
    month('cierzo', 'Cierzo'),
    month('escarcha', 'Escarcha'),
    month('deshielo', 'Deshielo'),
    fest('carnaval', 'Carnaval'),
    month('siembra', 'Siembra'),
    month('florida', 'Florida'),
    month('pastos', 'Pastos'),
    fest('yunque', 'Semana del Yunque'),
    month('siega', 'Siega'),
    month('trilla', 'Trilla'),
    month('vendimia', 'Vendimia'),
    fest('hermanas', 'Semana de las Hermanas'),
    month('hojarasca', 'Hojarasca'),
    month('brumas', 'Brumas'),
    month('nochelarga', 'Nochelarga')
  ],
  leapRules: [],
  seasons: [
    { id: 'invierno', name: 'Invierno', startDay: 1, endDay: 91 },
    { id: 'primavera', name: 'Primavera', startDay: 92, endDay: 182 },
    { id: 'verano', name: 'Verano', startDay: 183, endDay: 273 },
    { id: 'otono', name: 'Otoño', startDay: 274, endDay: 364 }
  ],
  moons: [
    {
      id: 'melancolia',
      name: 'Melancolía',
      cycleDays: 28,
      offsetDays: -1.25,
      color: '#4f7fd1',
      phases: [...DEFAULT_PHASES]
    },
    {
      id: 'eternidad',
      name: 'Eternidad',
      cycleDays: 91,
      offsetDays: 48.1875,
      color: '#b07a3a',
      phases: [...DEFAULT_PHASES]
    }
  ],
  eras: [
    { id: 'viajeros', name: 'Era de los Viajeros', start: { year: -12000 }, end: { year: -8001 } },
    { id: 'renovacion', name: 'Era de la Renovación', start: { year: -8000 }, end: { year: -5001 } },
    { id: 'reyes', name: 'Era de los Reyes Predestinados', start: { year: -5000 }, end: { year: -981 } },
    { id: 'nuevos', name: 'Era de los Nuevos Reinos', start: { year: -980 }, end: { year: -1 }, hidden: true },
    { id: 'republica', name: 'Era de la República', abbreviation: 'ER', start: { year: 0 } }
  ]
}

/**
 * Uno con días fuera de la semana y la semana que empieza cada mes: 10 meses de 36 días, una fiesta de 5 días que no
 * es de ningún día de la semana (y que crece cada 4 años), semana de 6
 */
export const HARPTOS_LIKE: CalendarDefinition = {
  yearSuffix: 'CV',
  beforeZeroSuffix: 'a. V.',
  description: '',
  weekdays: ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis'],
  firstWeekday: 2,
  weekMode: 'reset',
  months: [
    ...Array.from({ length: 5 }, (_, i) => ({ id: `m${i + 1}`, name: `Luna ${i + 1}`, days: 36 })),
    { id: 'fiesta', name: 'Fiesta del Medio Año', days: 5, festival: true, outsideWeek: true },
    ...Array.from({ length: 5 }, (_, i) => ({ id: `m${i + 6}`, name: `Luna ${i + 6}`, days: 36 }))
  ],
  leapRules: [{ monthId: 'fiesta', days: 1, every: 4 }],
  seasons: [],
  moons: [],
  eras: []
}

/** El mismo, con la semana seguida (la fiesta no avanza la semana) */
export const OUTSIDE_CONTINUOUS: CalendarDefinition = { ...HARPTOS_LIKE, weekMode: 'continuous', firstWeekday: 0 }
