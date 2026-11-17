/** Un calendario de las pruebas de las cronologías: el de Eana (12 meses de 28 días y 4 semanas de fiestas) */
import { type CalendarDefinition, DEFAULT_PHASES } from '@crisol/domain'

const fest = (id: string, name: string) => ({ id, name, days: 7, festival: true, color: '#c9a227' })
const month = (id: string, name: string) => ({ id, name, days: 28 })

export const EANA: CalendarDefinition = {
  yearSuffix: 'RC',
  description: '',
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
  eras: [{ id: 'republica', name: 'Era de la República', abbreviation: 'ER', start: { year: 0 } }]
}
