/**
 * Las cronologías de un mundo (módulo 8, capacidad `cronologias`; ADR-0031 y ADR-0032): cada una es una pestaña de una
 * página, como en LegendKeeper, con su calendario, sus eventos y sus grupos (cada evento es de una cronología, como en
 * Everlore; no van en el árbol) y, si se pide, las páginas con fecha de su filtro. Un jugador ve las de las pestañas que
 * ve (su página y su pestaña, ADR-0017) y, dentro, lo que sabe su campaña
 */
import { z } from 'zod'
import { defineAction } from './action.ts'
import { calendarView, dateValue } from './calendars.ts'
import { pageIcon, templateRef } from './pages.ts'
import { readAs } from './read-as.ts'
import { worldColor } from './worlds.ts'

/** Cuántas cronologías puede tener un mundo, cuántos grupos una cronología y cuántos eventos un mundo */
export const CHRONOLOGY_LIMITS = { chronologies: 50, groups: 30, events: 5000, batch: 100 } as const

const chronologyName = z.string().trim().min(1).max(60)

export const chronologyFilter = z.object({
  pages: z.boolean().describe('Si salen también las páginas con fecha del mundo (por defecto, no: solo sus eventos)'),
  templates: z.array(templateRef).max(20).describe('Con pages: solo las páginas de estas plantillas (vacío: todas)'),
  tags: z
    .array(z.string().trim().min(1).max(100))
    .max(20)
    .describe('Con pages: solo las que llevan alguna de estas etiquetas')
})

export type ChronologyFilterValue = z.infer<typeof chronologyFilter>

export const chronologyView = z.object({
  id: z.uuid(),
  worldId: z.uuid(),
  name: z.string().describe('El de su página (y el de su pestaña, si no es «Cronología»)'),
  tabId: z.uuid().describe('Su pestaña'),
  pageId: z.uuid().describe('La página en la que está'),
  calendarId: z.uuid().nullable().describe('Su calendario; null, el principal del mundo'),
  filter: chronologyFilter,
  version: z.int()
})

export type ChronologyView = z.infer<typeof chronologyView>

export const timelineGroupView = z.object({
  id: z.uuid(),
  chronologyId: z.uuid().describe('La cronología de la que es'),
  name: z.string(),
  color: worldColor.nullable(),
  version: z.int()
})

export type TimelineGroupView = z.infer<typeof timelineGroupView>

/** La imagen de un evento: un archivo del mundo y su punto de encuadre (en %) */
export const eventImage = z.object({
  fileId: z.uuid(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100)
})

export const timelineEventView = z.object({
  id: z.uuid(),
  worldId: z.uuid(),
  chronologyId: z.uuid().describe('La cronología de la que es'),
  title: z.string().describe('El suyo; vacío, el de su página'),
  date: dateValue,
  color: worldColor.nullable(),
  image: eventImage.nullable(),
  icon: z.string().nullable(),
  description: z.string(),
  groupId: z.uuid().nullable(),
  pageId: z.uuid().nullable().describe('Su página enlazada (a un jugador, solo si la conoce)'),
  hidden: z.boolean().describe('Oculto para los jugadores'),
  version: z.int()
})

export type TimelineEventView = z.infer<typeof timelineEventView>

/** Una fecha de una entrada, ya comprobada por el servidor (sin repetir la comprobación: son miles) */
const entryDate = z.object({ year: z.number(), month: z.string().optional(), day: z.number().optional() })

/**
 * Una entrada de una cronología: un evento o una fecha de una página, en el calendario de la cronología. Lo que no
 * tiene (sin fin, sin imagen, sin grupo…) no viene, y su forma se comprueba lo justo: son miles, ya comprobadas al
 * escribirlas
 */
export const chronologyEntry = z.object({
  key: z.string(),
  kind: z.enum(['event', 'page']),
  eventId: z.string().optional(),
  chronologyId: z.string().optional().describe('En un evento, su cronología'),
  pageId: z.string().optional().describe('La página de la fecha o la enlazada al evento'),
  title: z.string(),
  untitled: z.literal(true).optional().describe('Un evento sin título propio: lleva el de su página'),
  field: z.string().optional().describe('El nombre del campo, si la página tiene más de una fecha'),
  property: z.string().optional().describe('En una página con fecha, el nombre de su propiedad'),
  start: entryDate,
  end: entryDate.optional(),
  yearly: z.literal(true).optional(),
  startDay: z.int().describe('El día absoluto en que empieza (en el calendario de la cronología)'),
  endDay: z.int(),
  text: z.string().describe('«18 de Siega de 1250 RC»'),
  form: z.string().describe('La forma de la IA: 1250-Siega-18'),
  converted: z
    .object({ calendarId: z.string(), name: z.string(), text: z.string(), date: dateValue })
    .optional()
    .describe('Si viene de otro calendario: cuál, cómo se lee allí y la fecha tal como se guardó'),
  color: z.string().optional(),
  image: z.object({ fileId: z.string(), x: z.number(), y: z.number() }).optional(),
  cover: z.object({ fileId: z.string(), x: z.number(), y: z.number(), zoom: z.number().optional() }).optional(),
  icon: z.string().optional(),
  description: z.string().optional(),
  groupId: z.string().optional(),
  page: z
    .object({ id: z.string(), title: z.string(), icon: z.string().nullable() })
    .optional()
    .describe('La página enlazada a un evento'),
  hidden: z.literal(true).optional()
})

export type ChronologyEntryView = z.infer<typeof chronologyEntry>

/** Una fecha como la escribe la IA (1250-Siega-18, un periodo 1250-Siega-12/1250-Trilla-3, «(cada año)»), o el valor */
const looseDate = z.union([
  dateValue,
  z
    .string()
    .trim()
    .min(1)
    .max(120)
    .describe(
      '1250-Siega-18, 1250-Siega o 1250 (el mes por su nombre o su número sin festividades); un periodo, 1250-Siega-12/1250-Trilla-3; «(cada año)» al final si se repite'
    )
])

const eventFields = {
  title: z.string().trim().max(200).describe('Opcional si lleva página: sin él, el de la página'),
  date: looseDate,
  calendar: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .optional()
    .describe('El calendario de una fecha escrita (sin él, el principal)'),
  color: worldColor.nullable(),
  image: eventImage.nullable(),
  icon: pageIcon.nullable(),
  description: z.string().max(1000),
  groupId: z.uuid().nullable().describe('Un grupo de su cronología'),
  group: z.string().trim().min(1).max(60).describe('El grupo por su nombre, en su cronología (si no existe, se crea)'),
  pageId: z.uuid().nullable().describe('Enlazarlo a esta página del mundo'),
  newPage: z
    .object({ title: z.string().trim().min(1).max(200), parentId: z.uuid().nullable().optional() })
    .describe('Crear una página nueva (dónde: parentId) y enlazarlo a ella'),
  hidden: z.boolean()
}

const newEvent = z
  .object({
    ...eventFields,
    title: eventFields.title.optional(),
    color: eventFields.color.optional(),
    image: eventFields.image.optional(),
    icon: eventFields.icon.optional(),
    description: eventFields.description.optional(),
    groupId: eventFields.groupId.optional(),
    group: eventFields.group.optional(),
    pageId: eventFields.pageId.optional(),
    newPage: eventFields.newPage.optional(),
    hidden: eventFields.hidden.optional()
  })
  .refine((e) => (e.title ?? '').trim() !== '' || e.pageId || e.newPage, {
    message: 'un título, o una página enlazada'
  })

export const listChronologies = defineAction({
  name: 'listChronologies',
  kind: 'read',
  description:
    'Las cronologías de un mundo (cada una, una pestaña de una página), por su página: con su calendario, su filtro, cuántas entradas tienen y sus grupos de eventos. Un jugador, solo las de las pestañas que ve',
  input: z.object({ worldId: z.uuid(), ...readAs }),
  output: z.object({
    chronologies: z.array(
      chronologyView.extend({
        calendarName: z.string().nullable(),
        entries: z.int(),
        span: z.object({ from: z.string(), to: z.string() }).nullable().describe('De cuándo a cuándo va'),
        groups: z.array(timelineGroupView)
      })
    )
  })
})

export const getChronology = defineAction({
  name: 'getChronology',
  kind: 'read',
  description:
    'Una cronología (por su id o por el de su pestaña): sus eventos (y, si su filtro las pide, las páginas con fecha) en orden, con sus fechas en texto y en la forma 1250-Siega-18 (lo de otros calendarios, convertido; outside dice cuántas fechas quedan fuera por no tener correspondencia). Con from y to (fechas), solo lo que cae entre ellas; con text, solo lo que lo lleva en su título o su descripción',
  input: z.object({
    chronologyId: z.uuid().optional(),
    tabId: z.uuid().optional().describe('En lugar de chronologyId: la pestaña de la cronología'),
    from: z.string().trim().min(1).max(80).optional(),
    to: z.string().trim().min(1).max(80).optional(),
    text: z.string().trim().min(1).max(100).optional(),
    ...readAs
  }),
  output: z.object({
    chronology: chronologyView,
    calendar: calendarView,
    groups: z.array(timelineGroupView),
    entries: z.array(chronologyEntry),
    outside: z.int().describe('Fechas de otros calendarios sin correspondencia (o que ya no caben): no salen')
  })
})

export const createChronology = defineAction({
  name: 'createChronology',
  kind: 'write',
  description:
    'Crea una cronología, que es una pestaña de una página: con pageId, la añade a esa página (name es el de la pestaña); sin él, crea una página con ese nombre (dentro de parentId, o en el primer nivel) con su pestaña «Cronología». Nace sin eventos (se le añaden con createTimelineEvents), con su calendario (sin él, el principal) y su filtro (por defecto, sin las páginas con fecha). Se deshace',
  input: z.object({
    worldId: z.uuid(),
    name: chronologyName,
    pageId: z.uuid().optional().describe('La página a la que se añade como pestaña; sin ella, una página nueva'),
    parentId: z.uuid().nullable().optional().describe('Sin pageId: dentro de qué página va la nueva'),
    calendarId: z.uuid().nullable().optional(),
    filter: chronologyFilter.partial().optional()
  }),
  output: chronologyView
})

export const updateChronology = defineAction({
  name: 'updateChronology',
  kind: 'write',
  description:
    'Cambia una cronología: el nombre de su pestaña, su calendario (null: el principal) o su filtro (lo que se dé de él). Su sitio es el de su pestaña (cambiar_pestana). Se deshace',
  input: z.object({
    chronologyId: z.uuid(),
    name: chronologyName.optional().describe('El de su pestaña'),
    calendarId: z.uuid().nullable().optional(),
    filter: chronologyFilter.partial().optional()
  }),
  output: chronologyView
})

export const deleteChronology = defineAction({
  name: 'deleteChronology',
  kind: 'delete',
  description:
    'Borra una cronología con su pestaña, sus eventos y sus grupos (su página se queda). Se deshace desde el historial',
  input: z.object({ chronologyId: z.uuid() }),
  output: z.object({ id: z.uuid() })
})

export const updateTimelineGroups = defineAction({
  name: 'updateTimelineGroups',
  kind: 'write',
  description:
    'Los grupos de los eventos de una cronología (los carriles de la vista de meses), la lista entera en su orden: con id, se cambia; sin id, se crea; el que falta, se quita y sus eventos se quedan sin grupo. Se deshace',
  input: z.object({
    chronologyId: z.uuid(),
    groups: z
      .array(
        z.object({ id: z.uuid().optional(), name: z.string().trim().min(1).max(60), color: worldColor.nullable() })
      )
      .max(CHRONOLOGY_LIMITS.groups)
  }),
  output: z.object({ groups: z.array(timelineGroupView) })
})

export const createTimelineEvents = defineAction({
  name: 'createTimelineEvents',
  kind: 'write',
  description:
    'Crea eventos en una cronología (hasta 100 de una vez, para pasar una entera): su título, su fecha (1250-Siega-18, un periodo 1250-Siega-12/1250-Trilla-3, «(cada año)»), su color o su imagen, su icono, su descripción, su grupo (de esa cronología) y si va oculto para los jugadores; enlazados a una página (pageId) o a una nueva (newPage). Solo salen en esa cronología (y en la vista grande de los calendarios); no van en el árbol. Si una fecha no vale, dice cuál (con su número) y no se crea ninguno. Se deshace',
  input: z.object({
    chronologyId: z
      .uuid()
      .describe('La cronología a la que van (listChronologies; o la de una pestaña: getChronology)'),
    events: z.array(newEvent).min(1).max(CHRONOLOGY_LIMITS.batch)
  }),
  output: z.object({ events: z.array(timelineEventView) })
})

export const updateTimelineEvent = defineAction({
  name: 'updateTimelineEvent',
  kind: 'write',
  description:
    'Cambia un evento: lo que se dé (su fecha, en la forma 1250-Siega-18 o como valor; pageId null lo desenlaza; newPage crea una página y lo enlaza; chronologyId lo pasa a otra cronología del mundo, sin grupo salvo que se dé uno de allí). Se deshace',
  input: z.object({
    eventId: z.uuid(),
    chronologyId: z.uuid().optional().describe('Pasarlo a otra cronología del mundo'),
    title: eventFields.title.optional(),
    date: eventFields.date.optional(),
    calendar: eventFields.calendar,
    color: eventFields.color.optional(),
    image: eventFields.image.optional(),
    icon: eventFields.icon.optional(),
    description: eventFields.description.optional(),
    groupId: eventFields.groupId.optional(),
    group: eventFields.group.optional(),
    pageId: eventFields.pageId.optional(),
    newPage: eventFields.newPage.optional(),
    hidden: eventFields.hidden.optional()
  }),
  output: timelineEventView
})

export const deleteTimelineEvent = defineAction({
  name: 'deleteTimelineEvent',
  kind: 'delete',
  description: 'Borra un evento. Se deshace desde el historial',
  input: z.object({ eventId: z.uuid() }),
  output: z.object({ id: z.uuid() })
})

export const convertEventToPage = defineAction({
  name: 'convertEventToPage',
  kind: 'write',
  description:
    'Convierte un evento en página: la crea donde se diga (parentId; null, en el primer nivel) con su título, su icono, su imagen como portada y su descripción como texto, y el evento queda enlazado a ella (sin título propio: el de la página), con su fecha, su color y su grupo. Se deshace',
  input: z.object({
    eventId: z.uuid(),
    parentId: z.uuid().nullable(),
    title: z.string().trim().min(1).max(200).optional().describe('Sin él, el del evento')
  }),
  output: z.object({ pageId: z.uuid(), event: timelineEventView })
})
