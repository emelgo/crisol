/**
 * Las pestañas de una página de la wiki y su primer tipo, el mapa (ADR-0007): una imagen del mundo con pines que llevan
 * a páginas. «Texto» es el cuerpo de la página y no es una pestaña de estas
 */
import { z } from 'zod'
import { defineAction } from './action.ts'
import { readAs } from './read-as.ts'
import { worldColor } from './worlds.ts'

export const PAGE_TAB_KINDS = ['map', 'text', 'table'] as const

const tabName = z.string().trim().min(1).max(60)

/** Lo más que mide de lado la imagen de un mapa, en píxeles */
export const MAX_MAP_SIDE = 65_535
/** Cuántas pestañas puede tener una página, y cuántos pines un mapa */
export const MAX_PAGE_TABS = 50
export const MAX_MAP_PINS = 2000

export const pageTabView = z.object({
  id: z.uuid(),
  pageId: z.uuid(),
  kind: z.enum(PAGE_TAB_KINDS),
  name: z.string(),
  hidden: z.boolean().describe('Oculta a los jugadores'),
  /** Una pestaña de texto: su documento (de Yjs, como un secreto), que se edita en vivo */
  documentId: z.uuid().nullable(),
  /** Su color en la barra; null, sin color */
  color: worldColor.nullable()
})

export type PageTabView = z.infer<typeof pageTabView>

export const listPageTabs = defineAction({
  name: 'listPageTabs',
  kind: 'read',
  description: 'Las pestañas de una página además de su texto (mapas…), en orden',
  input: z.object({ pageId: z.uuid(), ...readAs }),
  output: z.object({ tabs: z.array(pageTabView) })
})

export const createPageTab = defineAction({
  name: 'createPageTab',
  kind: 'write',
  description: 'Añade una pestaña a una página, al final: un mapa (vacío hasta que se le pone imagen con updateMap)',
  input: z.object({ pageId: z.uuid(), kind: z.enum(PAGE_TAB_KINDS), name: tabName.optional() }),
  output: pageTabView
})

export const updatePageTab = defineAction({
  name: 'updatePageTab',
  kind: 'write',
  description:
    'Cambia una pestaña: su nombre, su color, si está oculta a los jugadores o su sitio (after: tras qué pestaña; null, la primera tras el texto)',
  input: z
    .object({
      tabId: z.uuid(),
      name: tabName.optional(),
      hidden: z.boolean().optional(),
      after: z.uuid().nullable().optional(),
      color: worldColor.nullable().optional()
    })
    .refine(
      (input) =>
        input.name !== undefined ||
        input.hidden !== undefined ||
        input.after !== undefined ||
        input.color !== undefined,
      { message: 'name, hidden, after o color' }
    ),
  output: pageTabView
})

export const deletePageTab = defineAction({
  name: 'deletePageTab',
  kind: 'delete',
  description:
    'Quita una pestaña de una página, con lo que tenga (un mapa, con sus pines). Se deshace desde el historial',
  input: z.object({ tabId: z.uuid(), ...readAs }),
  output: z.object({ id: z.uuid() })
})

/** Las coordenadas de un pin: de 0 a 1 sobre la imagen, desde arriba a la izquierda */
const coordinate = z.number().min(0).max(1)

export const PIN_SHAPES = 8

const pinFields = {
  label: z.string().trim().max(120).nullable().describe('Su nombre; sin él, el de la página enlazada'),
  pageId: z.uuid().nullable().describe('La página a la que lleva, del mismo mundo'),
  icon: z.string().trim().max(16).nullable().describe('Un emoji dentro del pin'),
  color: worldColor,
  shape: z
    .number()
    .int()
    .min(0)
    .max(PIN_SHAPES - 1)
    .describe('0 gota, 1 círculo, 2 rombo, 3 campana, 4 escudo, 5 bandera, 6 marcapáginas, 7 banderín'),
  variant: z.number().int().min(0).max(2).describe('0 grande, 1 pequeño, 2 solo el icono'),
  display: z.number().int().min(0).max(2).describe('Su nombre: 0 al pasar por encima, 1 siempre, 2 nunca'),
  hidden: z.boolean().describe('Oculto a los jugadores'),
  locked: z.boolean().describe('Bloqueado: no se mueve al arrastrar')
}

export const mapPinView = z.object({
  id: z.uuid(),
  x: z.number(),
  y: z.number(),
  ...pinFields,
  pageTitle: z.string().nullable().describe('El título de la página enlazada, si sigue fuera de la papelera')
})

export type MapPinView = z.infer<typeof mapPinView>

export const mapView = z.object({
  id: z.uuid(),
  tabId: z.uuid(),
  pageId: z.uuid(),
  image: z
    .object({ fileId: z.uuid(), name: z.string(), url: z.string(), width: z.number().int(), height: z.number().int() })
    .nullable()
    .describe('Sin imagen, el mapa está por empezar'),
  scale: z
    .object({
      length: z.number().positive().describe('Un tramo en píxeles de la imagen'),
      value: z.number().positive().describe('Lo que mide de verdad'),
      unit: z.string().trim().min(1).max(20)
    })
    .nullable(),
  pins: z.array(mapPinView)
})

export type MapView = z.infer<typeof mapView>

export const getMap = defineAction({
  name: 'getMap',
  kind: 'read',
  description: 'El mapa de una pestaña: su imagen, su escala y sus pines (coordenadas de 0 a 1 sobre la imagen)',
  input: z.object({ tabId: z.uuid() }),
  output: mapView
})

export const updateMap = defineAction({
  name: 'updateMap',
  kind: 'write',
  description:
    'Cambia un mapa: su imagen (un archivo de imagen del mundo o común, con su ancho y alto en píxeles) o su escala (null la quita)',
  input: z
    .object({
      mapId: z.uuid(),
      image: z
        .object({
          fileId: z.uuid(),
          width: z.number().int().positive().max(MAX_MAP_SIDE),
          height: z.number().int().positive().max(MAX_MAP_SIDE)
        })
        .optional(),
      scale: mapView.shape.scale.optional()
    })
    .refine((input) => input.image !== undefined || input.scale !== undefined, { message: 'image o scale' }),
  output: mapView
})

export const createMapPin = defineAction({
  name: 'createMapPin',
  kind: 'write',
  description: 'Pone un pin en un mapa, en x e y de 0 a 1, con su nombre o la página a la que lleva',
  input: z.object(pinFields).partial().extend({ mapId: z.uuid(), x: coordinate, y: coordinate }),
  output: mapPinView
})

export const updateMapPin = defineAction({
  name: 'updateMapPin',
  kind: 'write',
  description: 'Cambia un pin: dónde está, su nombre, la página a la que lleva o cómo se ve',
  input: z.object(pinFields).partial().extend({ pinId: z.uuid(), x: coordinate.optional(), y: coordinate.optional() }),
  output: mapPinView
})

export const deleteMapPin = defineAction({
  name: 'deleteMapPin',
  kind: 'delete',
  description: 'Quita un pin de un mapa. Se deshace desde el historial',
  input: z.object({ pinId: z.uuid() }),
  output: z.object({ id: z.uuid() })
})
