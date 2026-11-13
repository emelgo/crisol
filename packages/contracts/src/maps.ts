/**
 * Las pestañas de una página de la wiki y su primer tipo, el mapa (ADR-0007): una imagen del mundo con pines que llevan
 * a páginas. «Texto» es el cuerpo de la página y no es una pestaña de estas
 */
import { z } from 'zod'
import { defineAction } from './action.ts'
import { readAs } from './read-as.ts'
import { worldColor } from './worlds.ts'

export const PAGE_TAB_KINDS = ['map', 'text', 'table', 'scene', 'board'] as const

const tabName = z.string().trim().min(1).max(60)

/** Lo más que mide de lado la imagen de un mapa, en píxeles */
export const MAX_MAP_SIDE = 65_535
/** Cuántas pestañas puede tener una página, y cuántos pines un mapa */
export const MAX_PAGE_TABS = 50
export const MAX_MAP_PINS = 2000
/** Cuántas capas y cuántos elementos dibujados puede tener un mapa, y cuántos puntos uno (módulo 9) */
export const MAX_MAP_LAYERS = 30
export const MAX_MAP_ELEMENTS = 1000
export const MAX_ELEMENT_POINTS = 2000
/**
 * Lo que se anda en un día si el mapa no dice otra cosa, en millas (las medidas, en las de D&D: docs/diseno.md): a pie
 * a paso normal, a caballo y en un barco de vela
 */
export const DEFAULT_SPEEDS = { foot: 24, horse: 30, ship: 48 } as const

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
  description:
    'Añade una pestaña a una página, al final: un mapa (vacío hasta que se le pone imagen con updateMap) o una escena de la mesa (con setSceneImage)',
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
  input: z.object({ tabId: z.uuid() }),
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

/** Un punto de un mapa: x e y de 0 a 1 sobre la imagen */
const point = z.tuple([coordinate, coordinate])
const line = z.array(point).min(2).max(MAX_ELEMENT_POINTS)
const ring = z.array(point).min(3).max(MAX_ELEMENT_POINTS)

/** Lo dibujado (módulo 9): una región (una o varias piezas: islas), una ruta (puede ir de un pin a otro) o un texto */
export const mapGeometry = z.union([
  z.object({ pieces: z.array(ring).min(1).max(50).describe('Sus piezas: cada una, sus vértices en orden') }),
  z.object({
    points: line.describe('Sus puntos en orden'),
    from: z.uuid().nullable().optional().describe('El pin donde empieza'),
    to: z.uuid().nullable().optional().describe('El pin donde acaba')
  }),
  z.object({
    at: point.describe('Su centro'),
    rotate: z.number().min(-180).max(180).optional().describe('Su giro, en grados'),
    arc: z.number().min(-1).max(1).optional().describe('Curvado en arco: 0 recto; hacia arriba (+) o abajo (−)')
  })
])

export type MapGeometry = z.infer<typeof mapGeometry>

/** Cómo se ve, en listas cerradas (sin pinceles): lo que no se diga, lo de serie */
export const mapStyle = z
  .object({
    color: worldColor.describe('Su color (el relleno de una región, el trazo de una ruta, el de un texto)'),
    fill: z.enum(['solid', 'hatch', 'none']).describe('El relleno de una región: liso, rayado o sin relleno'),
    opacity: z.number().min(0.05).max(1).describe('La opacidad del relleno'),
    stroke: z.enum(['solid', 'dashed', 'dotted']).describe('El borde o el trazo: liso, discontinuo o punteado'),
    width: z.number().int().min(1).max(12).describe('El grosor del trazo, en píxeles de pantalla'),
    size: z.number().int().min(10).max(96).describe('El tamaño de su nombre o del texto'),
    display: z.number().int().min(0).max(2).describe('Su nombre: 0 al pasar por encima, 1 siempre, 2 nunca')
  })
  .partial()

export type MapStyle = z.infer<typeof mapStyle>

export const MAP_ELEMENT_KINDS = ['region', 'path', 'label'] as const

export const mapLayerView = z.object({
  id: z.uuid(),
  name: z.string(),
  hidden: z.boolean().describe('Solo del máster: nada de ella llega a ningún jugador')
})

export type MapLayerView = z.infer<typeof mapLayerView>

export const mapElementView = z.object({
  id: z.uuid(),
  layerId: z.uuid().nullable().describe('Su capa; null, la primera'),
  kind: z.enum(MAP_ELEMENT_KINDS),
  geometry: mapGeometry,
  label: z.string().nullable().describe('Su nombre; sin él, el de la página enlazada'),
  pageId: z.uuid().nullable().describe('La página a la que lleva, del mismo mundo'),
  pageTitle: z.string().nullable(),
  style: mapStyle,
  hidden: z.boolean().describe('Oculto a los jugadores (hasta que se les revele)')
})

export type MapElementView = z.infer<typeof mapElementView>

const speeds = z.object({
  foot: z.number().positive().max(10_000),
  horse: z.number().positive().max(10_000),
  ship: z.number().positive().max(10_000)
})

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
  speeds: speeds.describe('Cuánto se anda en un día, en la unidad de la escala (a pie, a caballo, en barco)'),
  pins: z.array(mapPinView),
  layers: z.array(mapLayerView).describe('Sus capas, de abajo arriba'),
  elements: z.array(mapElementView).describe('Lo dibujado: regiones, rutas y textos, de abajo arriba')
})

export type MapView = z.infer<typeof mapView>

export const getMap = defineAction({
  name: 'getMap',
  kind: 'read',
  description:
    'El mapa de una pestaña: su imagen, su escala y lo que se anda en un día, sus pines y, por capas, sus regiones, rutas y textos (coordenadas de 0 a 1 sobre la imagen)',
  input: z.object({ tabId: z.uuid(), ...readAs }),
  output: mapView
})

export const updateMap = defineAction({
  name: 'updateMap',
  kind: 'write',
  description:
    'Cambia un mapa: su imagen (un archivo de imagen del mundo o común, con su ancho y alto en píxeles), su escala (null la quita) o lo que se anda en un día (null, lo de serie)',
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
      scale: mapView.shape.scale.optional(),
      speeds: speeds.nullable().optional()
    })
    .refine((input) => input.image !== undefined || input.scale !== undefined || input.speeds !== undefined, {
      message: 'image, scale o speeds'
    }),
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

const layerName = z.string().trim().min(1).max(60)
const snapField = z
  .boolean()
  .optional()
  .describe(
    'Pegar sus vértices a los de lo demás que estén muy cerca (fronteras sin huecos) y los extremos de una ruta a los pines'
  )
const elementFields = {
  label: z.string().trim().max(120).nullable().describe('Su nombre; sin él, el de la página enlazada'),
  pageId: z.uuid().nullable().describe('La página a la que lleva, del mismo mundo'),
  style: mapStyle,
  hidden: z.boolean().describe('Oculto a los jugadores')
}

export const createMapLayer = defineAction({
  name: 'createMapLayer',
  kind: 'write',
  description: 'Añade una capa a un mapa, encima de las demás (o tras la que se diga). Se deshace',
  input: z.object({
    mapId: z.uuid(),
    name: layerName,
    hidden: z.boolean().optional().describe('Solo del máster'),
    after: z.uuid().nullable().optional().describe('Tras esta capa; null, la primera (abajo del todo)')
  }),
  output: mapLayerView
})

export const updateMapLayer = defineAction({
  name: 'updateMapLayer',
  kind: 'write',
  description:
    'Cambia una capa: su nombre, si es solo del máster o su sitio (tras otra; null, abajo del todo). Se deshace',
  input: z.object({
    layerId: z.uuid(),
    name: layerName.optional(),
    hidden: z.boolean().optional(),
    after: z.uuid().nullable().optional()
  }),
  output: mapLayerView
})

export const deleteMapLayer = defineAction({
  name: 'deleteMapLayer',
  kind: 'delete',
  description: 'Quita una capa con todo lo dibujado en ella. Se deshace desde el historial',
  input: z.object({ layerId: z.uuid() }),
  output: z.object({ id: z.uuid() })
})

export const createMapElement = defineAction({
  name: 'createMapElement',
  kind: 'write',
  description:
    'Dibuja en un mapa una región (pieces: una o varias piezas de vértices), una ruta (points; from y to, los pines donde empieza y acaba) o un texto (at, con su giro y su arco), con coordenadas de 0 a 1 sobre la imagen, en una capa (sin ella, la de más arriba que no es solo del máster; sin capas, una «General» nueva). Se deshace',
  input: z
    .object(elementFields)
    .partial()
    .extend({
      mapId: z.uuid(),
      layerId: z.uuid().optional(),
      kind: z.enum(MAP_ELEMENT_KINDS),
      geometry: mapGeometry,
      snap: snapField
    }),
  output: mapElementView
})

export const updateMapElement = defineAction({
  name: 'updateMapElement',
  kind: 'write',
  description:
    'Cambia una región, ruta o texto de un mapa: su forma (geometry entera), su nombre, su página, su estilo, su capa o si está oculto. Se deshace',
  input: z
    .object(elementFields)
    .partial()
    .extend({ elementId: z.uuid(), layerId: z.uuid().optional(), geometry: mapGeometry.optional(), snap: snapField }),
  output: mapElementView
})

export const deleteMapElement = defineAction({
  name: 'deleteMapElement',
  kind: 'delete',
  description: 'Quita una región, ruta o texto de un mapa. Se deshace desde el historial',
  input: z.object({ elementId: z.uuid() }),
  output: z.object({ id: z.uuid() })
})

export const getBoard = defineAction({
  name: 'getBoard',
  kind: 'read',
  description:
    'La pizarra de una pestaña: sus elementos de Excalidraw (las tarjetas de páginas llevan customData.pageId; las imágenes, customData.fileId). Un jugador recibe solo lo que puede ver',
  input: z.object({ tabId: z.uuid(), ...readAs }),
  output: z.object({ elements: z.array(z.record(z.string(), z.unknown())) })
})

export const getMapImage = defineAction({
  name: 'getMapImage',
  kind: 'read',
  description:
    'La imagen de un mapa, para verla antes de dibujar en él: sus medidas en píxeles y la imagen (o su SVG, si es un dibujo). Lo que se dibuje encima puede ir en esos píxeles (con view: su ancho y su alto), sin pasarlo a 0–1',
  input: z.object({ tabId: z.uuid(), ...readAs }),
  output: z.object({
    width: z.number().int(),
    height: z.number().int(),
    mimeType: z.string(),
    image: z
      .object({ mimeType: z.string(), data: z.string().optional() })
      .nullable()
      .describe('La imagen (para verla); null si es demasiado grande o de un tipo que no se puede enseñar'),
    svg: z.string().nullable().describe('Si el mapa es un SVG, su texto'),
    note: z.string()
  })
})

const measurePoint = z.tuple([coordinate, coordinate])

export const measureMap = defineAction({
  name: 'measureMap',
  kind: 'read',
  description:
    'Mide en un mapa con su escala: entre unos puntos (de 0 a 1), entre dos pines o a lo largo de una ruta dibujada (elementId), y cuántos días se tarda a pie, a caballo y en barco',
  input: z
    .object({
      tabId: z.uuid(),
      points: z.array(measurePoint).min(2).max(200).optional(),
      pins: z.tuple([z.uuid(), z.uuid()]).optional(),
      elementId: z.uuid().optional().describe('Una ruta: se mide entera'),
      ...readAs
    })
    .refine((input) => input.points || input.pins || input.elementId, { message: 'points, pins o elementId' }),
  output: z.object({
    distance: z.number().nullable().describe('null si el mapa no tiene escala'),
    unit: z.string().nullable(),
    days: z.object({ foot: z.number(), horse: z.number(), ship: z.number() }).nullable(),
    pixels: z.number()
  })
})
