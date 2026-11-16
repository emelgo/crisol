/**
 * Los calendarios de un mundo (módulo 8, docs/specs/calendarios.md; ADR-0029): varios, uno principal, con su semana,
 * sus meses (por id estable), sus bisiestos, sus estaciones, sus lunas y sus eras, y la correspondencia con otro para
 * convertir fechas. La aritmética, en `@crisol/domain` (calendar/)
 */
import { z } from 'zod'
import { defineAction } from './action.ts'
import { readAs } from './read-as.ts'

/** Los límites de una definición (los mismos que CALENDAR_LIMITS del dominio) */
const LIMITS = {
  name: 60,
  suffix: 12,
  description: 500,
  weekdays: 20,
  months: 100,
  monthDays: 1000,
  leapRules: 10,
  leapDays: 10,
  leapEvery: 100_000,
  seasons: 12,
  moons: 20,
  phases: 32,
  eras: 100,
  eraDescription: 280,
  abbreviation: 12,
  year: 10_000_000
} as const

const calendarColor = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const elementId = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,40}$/)
  .describe('Corto y único en el calendario; no se enseña')
const label = z.string().trim().max(LIMITS.name)
const year = z.int().min(-LIMITS.year).max(LIMITS.year)

/** Una fecha de un calendario: el año (hay año 0 y negativos), el mes por su id y el día desde 1 */
export const worldDate = z
  .object({
    year,
    month: elementId.optional().describe('El mes, por su id; sin él, todo el año'),
    day: z.int().min(1).max(LIMITS.monthDays).optional().describe('Sin él, todo el mes')
  })
  .refine((date) => date.day === undefined || date.month !== undefined, { message: 'un día sin mes' })

export const fullDate = z.object({ year, month: elementId, day: z.int().min(1).max(LIMITS.monthDays) })

/**
 * El valor «fecha» (docs/specs/fechas.md): una fecha de un calendario del mundo con su precisión, un fin opcional (del
 * mismo calendario y precisión, no antes) y «cada año» (solo con mes). Que quepa en su calendario lo mira el servidor
 */
export const dateValue = z
  .object({
    calendarId: z.uuid().describe('El calendario, siempre explícito (al crearla, el principal)'),
    start: worldDate,
    end: worldDate.optional().describe('El fin, si es un periodo'),
    yearly: z.literal(true).optional().describe('Se repite cada año (fiestas, aniversarios): solo con mes')
  })
  .refine((value) => !value.yearly || value.start.month !== undefined, { message: 'cada año, solo con mes' })

export type DateValueInput = z.infer<typeof dateValue>

export const calendarMonth = z.object({
  id: elementId,
  name: label,
  days: z.int().min(1).max(LIMITS.monthDays),
  color: calendarColor.nullable().optional(),
  festival: z.boolean().optional().describe('Ocupa su sitio en el año, pero no cuenta al numerar los meses'),
  outsideWeek: z.boolean().optional().describe('Sus días no son de ningún día de la semana'),
  dayNames: z
    .array(z.string().trim().max(LIMITS.name))
    .max(LIMITS.monthDays + LIMITS.leapDays)
    .optional()
    .describe(
      'Días con nombre propio, por orden (los de bisiesto al final; vacío, sin nombre): «Shieldmeet» como 2.º día de Midsummer. Un mes de un día se lee por su nombre'
    )
})

export const leapRule = z.object({
  monthId: elementId,
  days: z.int().min(1).max(LIMITS.leapDays),
  every: z.int().min(1).max(LIMITS.leapEvery),
  unless: z.int().min(1).max(LIMITS.leapEvery).nullable().optional().describe('Salvo cada tantos (múltiplo de every)'),
  but: z.int().min(1).max(LIMITS.leapEvery).nullable().optional().describe('Pero sí cada tantos (múltiplo de unless)')
})

export const calendarSeason = z.object({
  id: elementId,
  name: label,
  startDay: z
    .int()
    .min(1)
    .max(LIMITS.monthDays * LIMITS.months),
  endDay: z
    .int()
    .min(1)
    .max(LIMITS.monthDays * LIMITS.months),
  color: calendarColor.nullable().optional()
})

export const calendarMoon = z.object({
  id: elementId,
  name: label,
  cycleDays: z.number().positive().max(1_000_000),
  offsetDays: z.number().min(-1_000_000).max(1_000_000),
  color: calendarColor,
  phases: z.array(label).min(2).max(LIMITS.phases)
})

export const calendarEra = z.object({
  id: elementId,
  name: label,
  abbreviation: z.string().trim().max(LIMITS.abbreviation).optional(),
  description: z.string().max(LIMITS.eraDescription).optional(),
  start: worldDate,
  end: worldDate.nullable().optional(),
  countsFromStart: z.boolean().optional().describe('Los años se cuentan desde su inicio (su primer año es el 1)'),
  hidden: z.boolean().optional().describe('Solo del máster: no le llega a ningún jugador')
})

export const calendarCorrespondence = z.object({
  calendarId: z.uuid().describe('El calendario con el que se corresponde (el principal)'),
  date: fullDate.describe('El día de aquel en que cae el 1 del primer mes del año 0 de este')
})

/** La definición de un calendario tal como se guarda (los problemas que no son de forma los dice describeCalendar) */
export const calendarDefinition = z.object({
  yearSuffix: z.string().trim().max(LIMITS.suffix).describe('«RC»: «1250 RC»'),
  beforeZeroSuffix: z.string().trim().max(LIMITS.suffix).optional().describe('«a. R.»: «980 a. R.»; sin él, «-980 RC»'),
  description: z.string().max(LIMITS.description),
  weekdays: z.array(label).min(1).max(LIMITS.weekdays),
  firstWeekday: z
    .int()
    .min(0)
    .max(LIMITS.weekdays - 1)
    .describe('El día de la semana del 1 del primer mes del año 0'),
  weekMode: z
    .enum(['continuous', 'reset'])
    .describe('continuous: la semana sigue de un mes a otro; reset: empieza cada mes'),
  months: z.array(calendarMonth).min(1).max(LIMITS.months),
  leapRules: z.array(leapRule).max(LIMITS.leapRules),
  seasons: z.array(calendarSeason).max(LIMITS.seasons),
  moons: z.array(calendarMoon).max(LIMITS.moons),
  eras: z.array(calendarEra).max(LIMITS.eras),
  correspondence: calendarCorrespondence.nullable().optional()
})

export type CalendarDefinitionValue = z.infer<typeof calendarDefinition>

/**
 * Lo que se escribe al crear o cambiar uno (la IA, de una vez): como la definición, pero sin los ids (se ponen solos),
 * los meses de los bisiestos y de las fechas por su id o su nombre, las fechas también como texto (`1250-Siega-18`) y
 * lo que falte, con lo de por defecto (semana seguida, 8 fases)
 */
const looseDate = z.union([worldDate, z.string().trim().min(1).max(80)])
const looseMonthRef = z.string().trim().min(1).max(LIMITS.name)
export const calendarDefinitionInput = z.object({
  yearSuffix: z.string().trim().max(LIMITS.suffix).optional(),
  beforeZeroSuffix: z.string().trim().max(LIMITS.suffix).optional(),
  description: z.string().max(LIMITS.description).optional(),
  weekdays: z.array(label).min(1).max(LIMITS.weekdays),
  firstWeekday: z
    .int()
    .min(0)
    .max(LIMITS.weekdays - 1)
    .optional(),
  weekMode: z.enum(['continuous', 'reset']).optional(),
  months: z
    .array(calendarMonth.extend({ id: elementId.optional() }))
    .min(1)
    .max(LIMITS.months),
  leapRules: z
    .array(leapRule.extend({ monthId: looseMonthRef.describe('El mes, por su id o su nombre') }))
    .max(LIMITS.leapRules)
    .optional(),
  seasons: z
    .array(calendarSeason.extend({ id: elementId.optional() }))
    .max(LIMITS.seasons)
    .optional(),
  moons: z
    .array(
      calendarMoon.extend({
        id: elementId.optional(),
        color: calendarColor.optional(),
        offsetDays: calendarMoon.shape.offsetDays.optional(),
        phases: calendarMoon.shape.phases.optional().describe('Sin ellas, las 8 de siempre (Nueva… Menguante)')
      })
    )
    .max(LIMITS.moons)
    .optional(),
  eras: z
    .array(
      calendarEra.extend({
        id: elementId.optional(),
        start: looseDate.describe('Su comienzo: 1250-Siega-1, -980 o { year, month, day }'),
        end: looseDate.nullable().optional()
      })
    )
    .max(LIMITS.eras)
    .optional(),
  correspondence: z
    .object({
      calendarId: z.uuid().optional().describe('Sin él, el principal del mundo'),
      date: looseDate.describe('El día de aquel en que cae el 1 del primer mes del año 0 de este (1250-Siega-18)')
    })
    .nullable()
    .optional()
})

export type CalendarDefinitionInput = z.infer<typeof calendarDefinitionInput>

/** Un problema de la definición: en qué sección del editor y qué pasa (en español, para la IA) */
export const calendarProblem = z.object({
  section: z.enum(['general', 'week', 'months', 'leap', 'seasons', 'moons', 'eras', 'correspondence']),
  index: z.int().optional(),
  code: z.string(),
  params: z.record(z.string(), z.union([z.string(), z.number()])),
  message: z.string()
})

export type CalendarProblemValue = z.infer<typeof calendarProblem>

export const calendarView = z.object({
  id: z.uuid(),
  worldId: z.uuid(),
  name: z.string(),
  primary: z.boolean().describe('El principal: el de las fechas por defecto'),
  definition: calendarDefinition.describe('A un jugador, sin las eras solo del máster'),
  version: z.int()
})

export type CalendarView = z.infer<typeof calendarView>

/** Un mes, como lo lee la IA: su número (sin contar festividades) y sus días */
const monthSummary = z.object({
  id: z.string(),
  name: z.string(),
  number: z.int().nullable().describe('Sin contar las festividades; null, una festividad (se escribe por su nombre)'),
  days: z.int(),
  festival: z.boolean(),
  outsideWeek: z.boolean()
})

const calendarName = z.string().trim().min(1).max(LIMITS.name)

export const listCalendars = defineAction({
  name: 'listCalendars',
  kind: 'read',
  description:
    'Los calendarios de un mundo, en su orden, y cuál es el principal (el de las fechas por defecto), con su definición entera',
  input: z.object({ worldId: z.uuid(), ...readAs }),
  output: z.object({ calendars: z.array(calendarView) })
})

export const getCalendar = defineAction({
  name: 'getCalendar',
  kind: 'read',
  description:
    'Un calendario: su semana, sus meses numerados con sus días (las festividades, por su nombre), sus bisiestos, eras, lunas y estaciones, y lo que dura su año',
  input: z.object({ calendarId: z.uuid(), ...readAs }),
  output: z.object({
    calendar: calendarView,
    months: z.array(monthSummary),
    yearLength: z.int().describe('Días de un año normal'),
    leapYearLength: z.int().nullable().describe('Días de un año bisiesto (con todas sus reglas); null, sin bisiestos'),
    /** El desfase con el principal, si se puede convertir: el día absoluto del principal en que cae su día 0 */
    convertible: z.boolean().describe('Si sus fechas se pueden convertir al principal (es él, o tiene correspondencia)')
  })
})

export const createCalendar = defineAction({
  name: 'createCalendar',
  kind: 'write',
  description:
    'Crea un calendario en un mundo, al final: en blanco (12 meses de 30 días, semana de 7), como el gregoriano (gregorian, de ejemplo), copia de otro del mundo ({ copyOf }) o con su definición entera ({ definition }: semana, meses, bisiestos, estaciones, lunas y eras de una vez). El primero del mundo nace principal. Si la definición tiene problemas, dice cuáles y no se crea. Se deshace',
  input: z.object({
    worldId: z.uuid(),
    name: calendarName,
    from: z
      .union([
        z.enum(['blank', 'gregorian']),
        z.object({ copyOf: z.uuid() }),
        z.object({ definition: calendarDefinitionInput })
      ])
      .default('blank')
  }),
  output: calendarView
})

export const updateCalendar = defineAction({
  name: 'updateCalendar',
  kind: 'write',
  description:
    'Cambia un calendario: su nombre, hacerlo principal (primary true; si tenía correspondencia con el anterior, el anterior recibe la inversa), su sitio (after: tras otro; null, el primero) o su definición entera (mira antes getCalendar). No reescribe ninguna fecha; no deja quitar un mes con fechas. Con la versión que se leyó, si alguien lo cambió entre medias, no se guarda. Se deshace',
  input: z.object({
    calendarId: z.uuid(),
    version: z.int().min(1).optional().describe('La que se leyó: si ya no es esa, no se guarda (CALENDAR_CHANGED)'),
    name: calendarName.optional(),
    primary: z.literal(true).optional(),
    after: z.uuid().nullable().optional(),
    definition: calendarDefinitionInput.optional()
  }),
  output: calendarView.extend({
    clipped: z
      .int()
      .optional()
      .describe('Cuántas fechas tienen un día que ya no cabe en su mes (se acortó): se leen en su último día')
  })
})

export const deleteCalendar = defineAction({
  name: 'deleteCalendar',
  kind: 'delete',
  description:
    'Borra un calendario sin fechas (si tiene, dice cuántas). El principal no se borra mientras haya otros: antes, haz principal a otro. Se deshace desde el historial',
  input: z.object({ calendarId: z.uuid() }),
  output: z.object({ id: z.uuid() })
})

const dateInput = z
  .union([
    z.string().trim().min(1).max(80),
    z.object({ year, month: z.union([z.string().max(LIMITS.name), z.int()]).optional(), day: z.int().optional() })
  ])
  .describe('1250-Siega-18 (o 1250-03-18, el mes por su número sin contar festividades; 1250-03; 1250; -980-01-01)')

const describedDate = z.object({
  text: z.string().describe('«Flora, 18 de Siega de 1250 RC»'),
  form: z.string().describe('La forma con el nombre del mes: 1250-Siega-18'),
  precision: z.enum(['year', 'month', 'day']),
  weekday: z.string().nullable(),
  season: z.string().nullable(),
  era: z.object({ id: z.string(), name: z.string(), abbreviation: z.string().nullable() }).nullable(),
  moons: z.array(
    z.object({ id: z.string(), name: z.string(), phase: z.string(), illumination: z.number(), color: z.string() })
  ),
  dayOfYear: z.int(),
  yearLength: z.int(),
  span: z.object({ from: z.string(), to: z.string() }).nullable().describe('Sin día: el primero y el último que abarca')
})

const equivalence = z.object({
  calendarId: z.uuid(),
  name: z.string(),
  text: z.string().describe('La fecha en aquel calendario (si abarca varios días, del primero al último)'),
  form: z.string()
})

export const describeDate = defineAction({
  name: 'describeDate',
  kind: 'read',
  description:
    'Describe una fecha de un calendario (sin calendarId, el principal del mundo): su texto, su día de la semana, su estación, su era, la fase de cada luna y su día del año; si no es del principal y tiene correspondencia, su equivalencia en el principal. Con addDays, también la de N días después (o antes, en negativo); con until, cuántos días faltan hasta esa otra',
  input: z
    .object({
      calendarId: z.uuid().optional(),
      worldId: z.uuid().optional().describe('Sin calendarId: el mundo, para usar su principal'),
      date: dateInput,
      addDays: z.int().min(-100_000_000).max(100_000_000).optional(),
      until: dateInput.optional(),
      ...readAs
    })
    .refine((input) => input.calendarId || input.worldId, { message: 'calendarId o worldId' }),
  output: z.object({
    calendarId: z.uuid(),
    calendar: z.string(),
    date: describedDate,
    primary: equivalence.nullable().describe('Su equivalencia en el principal (null: es el principal o no se puede)'),
    added: describedDate.nullable(),
    daysUntil: z.int().nullable()
  })
})

export const convertDate = defineAction({
  name: 'convertDate',
  kind: 'read',
  description:
    'Pasa una fecha de un calendario del mundo a otro, por la correspondencia de cada uno con el principal. Una fecha sin día da el día en que empieza y el último que abarca',
  input: z.object({ calendarId: z.uuid(), to: z.uuid(), date: dateInput, ...readAs }),
  output: z.object({ from: z.string(), to: equivalence })
})
