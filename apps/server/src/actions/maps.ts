/**
 * Las pestañas de las páginas y sus mapas con pines (ADR-0007). Quien puede leer o escribir la página puede leer o
 * escribir sus pestañas; la imagen de un mapa es un archivo del mundo o uno común de su organización, y un pin lleva a
 * una página del mismo mundo
 */
import {
  createMapElement,
  createMapLayer,
  createMapPin,
  createPageTab,
  DEFAULT_SPEEDS,
  deleteMapElement,
  deleteMapLayer,
  deleteMapPin,
  deletePageTab,
  getBoard,
  getMap,
  getMapImage,
  listPageTabs,
  MAX_MAP_ELEMENTS,
  MAX_MAP_LAYERS,
  MAX_MAP_PINS,
  MAX_PAGE_TABS,
  type MapElementView,
  type MapGeometry,
  type MapLayerView,
  type MapPinView,
  type MapStyle,
  type MapView,
  measureMap,
  type PageTabView,
  updateMap,
  updateMapElement,
  updateMapLayer,
  updateMapPin,
  updatePageTab
} from '@crisol/contracts'
import { documentsRepo, filesRepo, mapsRepo } from '@crisol/db'
import { type Capability, keyBetween, NotFoundError } from '@crisol/domain'
import * as Y from 'yjs'
import { pagesChanged } from '../realtime/events.ts'
import { boardElements, boardForPlayer } from '../wiki/board.ts'
import { viewedPage } from '../wiki/projection.ts'
import type { WikiView } from '../wiki/reader.ts'
import { authorizedPage, type WikiTarget } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { snapGeometry, verticesOf } from './map-snap.ts'
import { implement } from './registry.ts'

/** Lo más que se le enseña a la IA de una imagen (su API no admite más) y los tipos que admite */
const MAX_IMAGE_BYTES = 4_500_000
const SHOWN_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const MAX_SVG_CHARS = 400_000

async function readAll(stream: AsyncIterable<unknown>) {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

/** Lo dibujado, pegado a lo que ya hay en su mapa (menos él mismo) si se pide */
async function snapped(ctx: ActionContext, mapId: string, geometry: MapGeometry, except: string | null) {
  const map = await mapsRepo.findMap(ctx.db, mapId)
  const others = (await mapsRepo.listElements(ctx.db, mapId)).filter((element) => element.id !== except)
  const pins = await mapsRepo.listPins(ctx.db, mapId)
  return snapGeometry(
    geometry,
    { vertices: verticesOf(others.map((element) => element.geometry as MapGeometry)), pins },
    { width: map?.width ?? 1000, height: map?.height ?? 1000 }
  )
}

export const tabView = (row: mapsRepo.PageTabRow): PageTabView => ({
  id: row.id,
  pageId: row.pageId,
  kind: row.kind,
  name: row.name,
  hidden: row.hidden,
  documentId: row.documentId ?? null,
  color: (row.color as PageTabView['color']) ?? null
})

type PinRow = mapsRepo.MapPinRow & { pageTitle: string | null }

const pinView = (row: PinRow): MapPinView => ({
  id: row.id,
  x: row.x,
  y: row.y,
  label: row.label,
  pageId: row.pageId,
  pageTitle: row.pageTitle,
  icon: row.icon,
  color: row.color,
  shape: row.shape,
  variant: row.variant,
  display: row.display,
  hidden: row.hidden,
  locked: row.locked
})

const layerView = (row: mapsRepo.MapLayerRow): MapLayerView => ({ id: row.id, name: row.name, hidden: row.hidden })

type ElementRow = mapsRepo.MapElementRow & { pageTitle: string | null }
const elementView = (row: ElementRow): MapElementView => ({
  id: row.id,
  layerId: row.layerId,
  kind: row.kind,
  geometry: row.geometry as MapGeometry,
  label: row.label,
  pageId: row.pageId,
  pageTitle: row.pageTitle,
  style: row.style as MapStyle,
  hidden: row.hidden
})

/** Una pestaña y su página, si la cuenta puede hacer eso en ella; si no existe, 404 */
export async function authorizedTab(ctx: ActionContext, capability: Capability, tabId: string) {
  const tab = await mapsRepo.findTab(ctx.db, tabId)
  const { page, wiki } = await authorizedPage(ctx, capability, tab?.pageId ?? '')
  if (!tab) throw new NotFoundError('tab')
  return { tab, page, wiki }
}

/** Un mapa por su id, con su pestaña y su página */
async function authorizedMap(ctx: ActionContext, capability: Capability, mapId: string) {
  const map = await mapsRepo.findMap(ctx.db, mapId)
  const found = await authorizedTab(ctx, capability, map?.tabId ?? '')
  if (!map) throw new NotFoundError('map')
  return { ...found, map }
}

async function authorizedPin(ctx: ActionContext, capability: Capability, pinId: string) {
  const pin = await mapsRepo.findPin(ctx.db, pinId)
  const found = await authorizedMap(ctx, capability, pin?.mapId ?? '')
  if (!pin) throw new NotFoundError('pin')
  return { ...found, pin }
}

async function authorizedLayer(ctx: ActionContext, capability: Capability, layerId: string) {
  const layer = await mapsRepo.findLayer(ctx.db, layerId)
  const found = await authorizedMap(ctx, capability, layer?.mapId ?? '')
  if (!layer) throw new NotFoundError('layer')
  return { ...found, layer }
}

async function authorizedElement(ctx: ActionContext, capability: Capability, elementId: string) {
  const element = await mapsRepo.findElement(ctx.db, elementId)
  const found = await authorizedMap(ctx, capability, element?.mapId ?? '')
  if (!element) throw new NotFoundError('element')
  return { ...found, element }
}

async function mapView(ctx: ActionContext, tabId: string, pageId: string, view?: WikiView): Promise<MapView> {
  const map = await mapsRepo.mapOfTab(ctx.db, tabId)
  if (!map) throw new NotFoundError('map')
  const full = !view || view.full
  const allLayers = await mapsRepo.listLayers(ctx.db, map.id)
  // Un jugador: ni las capas solo del máster ni nada de ellas; lo dibujado sigue a su página como los pines (oculto,
  // hasta que se le revele), y lo que lleva a una página que no conoce, sin nombre ni enlace
  const hiddenLayers = new Set(allLayers.filter((layer) => layer.hidden).map((layer) => layer.id))
  const layers = full ? allLayers : allLayers.filter((layer) => !layer.hidden)
  const allElements = await mapsRepo.listElements(ctx.db, map.id)
  const elements = full
    ? allElements
    : allElements
        // Lo de antes de las capas (sin capa) cuenta como de la primera, como lo pinta la web
        .filter((element) => {
          const layer = element.layerId ?? allLayers[0]?.id
          return !(layer && hiddenLayers.has(layer))
        })
        .filter((element) => view.seesMapItem({ kind: 'element', id: element.id, pageId, hidden: element.hidden }))
        .map((element) => ({
          ...element,
          hidden: false,
          // A una página que no conoce: sin enlace y sin su nombre (un texto conserva el suyo, que es lo que se lee)
          ...(element.pageId && !view.seesPage(element.pageId)
            ? { pageId: null, pageTitle: null, ...(element.kind === 'label' ? {} : { label: null }) }
            : {})
        }))
  const all = await mapsRepo.listPins(ctx.db, map.id)
  // Un jugador (ADR-0017): los pines que ve; uno a una página que no ve, con su etiqueta y sin ella
  const pins =
    !view || view.full
      ? all
      : all
          .filter((pin) => view.seesMapItem({ kind: 'pin', id: pin.id, pageId, hidden: pin.hidden }))
          .map((pin) => ({
            ...pin,
            hidden: false,
            ...(pin.pageId && !view.seesPage(pin.pageId) ? { pageId: null, pageTitle: null } : {})
          }))
  const hasImage = map.fileId && map.fileName && map.width && map.height
  return {
    id: map.id,
    tabId,
    pageId,
    image: hasImage
      ? {
          fileId: map.fileId as string,
          name: map.fileName as string,
          url: `/api/files/${map.fileId}?v=${map.fileVersion}`,
          width: map.width as number,
          height: map.height as number
        }
      : null,
    scale:
      map.scaleLength && map.scaleValue && map.scaleUnit
        ? { length: map.scaleLength, value: map.scaleValue, unit: map.scaleUnit }
        : null,
    speeds: map.speeds ?? { ...DEFAULT_SPEEDS },
    pins: pins.map(pinView),
    layers: layers.map(layerView),
    elements: elements.map(elementView)
  }
}

/** Que la forma sea la de su clase (una región, piezas; una ruta, puntos; un texto, su sitio) y sus pines, del mapa */
async function checkGeometry(ctx: ActionContext, mapId: string, kind: MapElementView['kind'], geometry: MapGeometry) {
  const fits = kind === 'region' ? 'pieces' in geometry : kind === 'path' ? 'points' in geometry : 'at' in geometry
  if (!fits) throw new InvalidRequestError('BAD_MAP_GEOMETRY', `la forma no es la de un ${kind}`)
  if (!('points' in geometry)) return
  const ends = [geometry.from, geometry.to].filter((id): id is string => typeof id === 'string')
  for (const id of ends) {
    const pin = await mapsRepo.findPin(ctx.db, id)
    if (pin?.mapId !== mapId) throw new InvalidRequestError('BAD_MAP_GEOMETRY', 'el pin no es de este mapa')
  }
}

/**
 * La capa de un elemento: la que se diga (de este mapa), la de más arriba que ven las campañas (lo dibujado sin
 * pensarlo no se esconde a nadie), la de más arriba si todas son del máster o, sin ninguna, una «General» nueva
 */
async function layerFor(
  ctx: ActionContext,
  wiki: WikiTarget,
  mapId: string,
  layerId: string | undefined,
  page: string
) {
  if (layerId) {
    const layer = await mapsRepo.findLayer(ctx.db, layerId)
    if (layer?.mapId !== mapId) throw new InvalidRequestError('BAD_MAP_LAYER')
    return layer.id
  }
  const layers = await mapsRepo.listLayers(ctx.db, mapId)
  const top = layers.findLast((layer) => !layer.hidden) ?? layers.at(-1)
  if (top) return top.id
  const created = await mapsRepo.createLayer(
    ctx.db,
    historyContext(ctx, 'createMapLayer', { title: page, layer: 'General' }, wiki),
    { worldId: wiki.worldId, mapId, name: 'General', position: keyBetween(null, null) }
  )
  return created.id
}

/** La clave de una capa tras otra (null, abajo del todo) */
function layerPlace(layers: readonly mapsRepo.MapLayerRow[], after: string | null) {
  const index = after === null ? -1 : layers.findIndex((layer) => layer.id === after)
  if (after !== null && index === -1) throw new InvalidRequestError('BAD_MAP_LAYER')
  return keyBetween(layers[index]?.position ?? null, layers[index + 1]?.position ?? null)
}

/** El nombre de lo dibujado para el historial */
const elementName = (element: { label: string | null; pageTitle?: string | null }) =>
  element.label ?? element.pageTitle ?? null

/** La página de un pin: del mismo mundo y fuera de la papelera */
/** La página de un pin, si lleva a una: del mismo mundo (si no, BAD_PIN_PAGE); su título, para el historial */
async function checkPinPage(ctx: ActionContext, wiki: WikiTarget, pageId: string | null | undefined) {
  if (!pageId) return null
  const [found] = await mapsRepo.pagesInWorld(ctx.db, wiki.worldId, [pageId])
  if (!found) throw new InvalidRequestError('BAD_PIN_PAGE')
  return found.title
}

/** El nombre de un pin para el historial */
const pinName = (pin: { label: string | null; pageTitle?: string | null }) => pin.label ?? pin.pageTitle ?? null

export const mapActions = [
  implement(listPageTabs, async (ctx, { pageId, ...as }) => {
    const { view } = await viewedPage(ctx, pageId, as)
    const tabs = (await mapsRepo.listTabs(ctx.db, pageId)).filter(
      // Un jugador (ADR-0017): las que ve; las tablas aleatorias de la wiki siguen siendo del máster, y las escenas
      // también: un jugador solo ve una escena en la mesa, proyectada (docs/specs/escenas.md, decisión 1)
      (tab) =>
        view.full ||
        (tab.kind !== 'table' && tab.kind !== 'scene' && view.seesTab({ id: tab.id, pageId, hidden: tab.hidden }))
    )
    // Lo que se le reveló, para él no está oculto
    return { tabs: tabs.map((tab) => (view.full ? tabView(tab) : { ...tabView(tab), hidden: false })) }
  }),

  implement(createPageTab, async (ctx, { pageId, kind, name }) => {
    const { page, wiki } = await authorizedPage(ctx, 'page.write', pageId)
    const tabs = await mapsRepo.listTabs(ctx.db, pageId)
    if (tabs.length >= MAX_PAGE_TABS) throw new InvalidRequestError('TOO_MANY_TABS', `como mucho ${MAX_PAGE_TABS}`)
    const base =
      kind === 'text'
        ? 'Texto'
        : kind === 'table'
          ? 'Tabla'
          : kind === 'scene'
            ? 'Escena'
            : kind === 'board'
              ? 'Pizarra'
              : 'Mapa'
    const same = tabs.filter((tab) => tab.kind === kind).length
    // La de texto cuenta con la principal («Texto»): la primera añadida es «Texto 2»; el segundo mapa, «Mapa 2»
    const named = name ?? (kind === 'text' ? `${base} ${same + 2}` : same > 0 ? `${base} ${same + 1}` : base)
    // Una de texto (y una pizarra) lleva su documento, como un secreto (vacío al nacer; no va al historial: lo cuenta su
    // edición)
    const documentId =
      kind === 'text' || kind === 'board'
        ? await documentsRepo.createSeparate(ctx.db, {
            pageId,
            worldId: wiki.worldId,
            kind: 'tab',
            state: Y.encodeStateAsUpdate(new Y.Doc()),
            userId: ctx.actor.userId
          })
        : null
    const tab = await mapsRepo.createTab(
      ctx.db,
      historyContext(ctx, 'createPageTab', { title: page.title, kind, name: named }, wiki),
      {
        worldId: wiki.worldId,
        pageId,
        kind,
        name: named,
        documentId,
        position: keyBetween(tabs.at(-1)?.position ?? null, null)
      }
    )
    ctx.realtime.publish(pagesChanged(wiki))
    return tabView(tab)
  }),

  implement(updatePageTab, async (ctx, { tabId, name, hidden, after, color }) => {
    const { tab, page, wiki } = await authorizedTab(ctx, 'page.write', tabId)
    let position: string | undefined
    if (after !== undefined) {
      const others = (await mapsRepo.listTabs(ctx.db, tab.pageId)).filter((other) => other.id !== tabId)
      const index = after === null ? -1 : others.findIndex((other) => other.id === after)
      if (after !== null && index === -1) throw new InvalidRequestError('BAD_TAB_PLACE')
      position = keyBetween(others[index]?.position ?? null, others[index + 1]?.position ?? null)
    }
    const details = {
      title: page.title,
      ...(name !== undefined ? { from: tab.name, to: name } : { name: tab.name }),
      ...(hidden !== undefined ? { hidden } : {}),
      ...(position !== undefined ? { moved: true } : {}),
      ...(color !== undefined ? { color } : {})
    }
    const updated = await mapsRepo.updateTab(ctx.db, historyContext(ctx, 'updatePageTab', details, wiki), tabId, {
      ...(name !== undefined ? { name } : {}),
      ...(hidden !== undefined ? { hidden } : {}),
      ...(position !== undefined ? { position } : {}),
      ...(color !== undefined ? { color } : {})
    })
    ctx.realtime.publish(pagesChanged(wiki))
    return tabView(updated)
  }),

  implement(deletePageTab, async (ctx, { tabId }) => {
    const { tab, page, wiki } = await authorizedTab(ctx, 'page.write', tabId)
    await mapsRepo.deleteTab(
      ctx.db,
      historyContext(ctx, 'deletePageTab', { title: page.title, name: tab.name }, wiki),
      tabId
    )
    // Quien la tenga abierta deja de escribir en ella (su documento queda, para deshacer)
    if (tab.documentId) ctx.collab?.closeDocument(tab.documentId)
    ctx.realtime.publish(pagesChanged(wiki))
    return { id: tabId }
  }),

  implement(getMap, async (ctx, { tabId, ...as }) => {
    const tab = await mapsRepo.findTab(ctx.db, tabId)
    const { view } = await viewedPage(ctx, tab?.pageId ?? '', as)
    if (!tab || !view.seesTab({ id: tab.id, pageId: tab.pageId, hidden: tab.hidden })) throw new NotFoundError('tab')
    return mapView(ctx, tabId, tab.pageId, view)
  }),

  implement(updateMap, async (ctx, { mapId, image, scale, speeds }) => {
    const { tab, page, wiki } = await authorizedMap(ctx, 'page.write', mapId)
    if (image) {
      // Una imagen de este mundo o una común de su organización
      const file = await filesRepo.findFile(ctx.db, image.fileId)
      const usable =
        file && (file.worldId ? file.worldId === wiki.worldId : file.organizationId === wiki.organizationId)
      if (!file || !usable || file.kind !== 'image') throw new InvalidRequestError('BAD_MAP_IMAGE')
    }
    const details = {
      title: page.title,
      name: tab.name,
      ...(image ? { image: true } : {}),
      ...(scale !== undefined ? { scale: scale !== null } : {}),
      ...(speeds !== undefined ? { speeds: true } : {})
    }
    await mapsRepo.updateMap(ctx.db, historyContext(ctx, 'updateMap', details, wiki), mapId, {
      ...(image ? { fileId: image.fileId, width: image.width, height: image.height } : {}),
      ...(scale !== undefined
        ? { scaleLength: scale?.length ?? null, scaleValue: scale?.value ?? null, scaleUnit: scale?.unit ?? null }
        : {}),
      ...(speeds !== undefined ? { speeds } : {})
    })
    ctx.realtime.publish(pagesChanged(wiki))
    return mapView(ctx, tab.id, tab.pageId)
  }),

  implement(createMapPin, async (ctx, { mapId, ...input }) => {
    const { tab, page, wiki } = await authorizedMap(ctx, 'page.write', mapId)
    if ((await mapsRepo.countPins(ctx.db, mapId)) >= MAX_MAP_PINS) {
      throw new InvalidRequestError('TOO_MANY_PINS', `como mucho ${MAX_MAP_PINS}`)
    }
    const pageTitle = await checkPinPage(ctx, wiki, input.pageId)
    const pin = await mapsRepo.createPin(
      ctx.db,
      // Sin nombre propio, el de su página: «puso el pin «Puerto Gris»…», no «Pin sin nombre»
      historyContext(
        ctx,
        'createMapPin',
        { title: page.title, map: tab.name, pin: input.label ?? pageTitle ?? null },
        wiki
      ),
      { worldId: wiki.worldId, mapId, ...input }
    )
    ctx.realtime.publish(pagesChanged(wiki))
    return pinView((await mapsRepo.findPin(ctx.db, pin.id)) as PinRow)
  }),

  implement(updateMapPin, async (ctx, { pinId, ...patch }) => {
    const { tab, page, pin, wiki } = await authorizedPin(ctx, 'page.write', pinId)
    await checkPinPage(ctx, wiki, patch.pageId)
    const moved = patch.x !== undefined || patch.y !== undefined
    const details = { title: page.title, map: tab.name, pin: pinName(pin), ...(moved ? { moved: true } : {}) }
    await mapsRepo.updatePin(ctx.db, historyContext(ctx, 'updateMapPin', details, wiki), pinId, patch)
    ctx.realtime.publish(pagesChanged(wiki))
    return pinView((await mapsRepo.findPin(ctx.db, pinId)) as PinRow)
  }),

  implement(deleteMapPin, async (ctx, { pinId }) => {
    const { tab, page, pin, wiki } = await authorizedPin(ctx, 'page.write', pinId)
    await mapsRepo.deletePin(
      ctx.db,
      historyContext(ctx, 'deleteMapPin', { title: page.title, map: tab.name, pin: pinName(pin) }, wiki),
      pinId
    )
    ctx.realtime.publish(pagesChanged(wiki))
    return { id: pinId }
  }),
  implement(createMapLayer, async (ctx, { mapId, name, hidden, after }) => {
    const { tab, page, wiki } = await authorizedMap(ctx, 'page.write', mapId)
    const layers = await mapsRepo.listLayers(ctx.db, mapId)
    if (layers.length >= MAX_MAP_LAYERS)
      throw new InvalidRequestError('TOO_MANY_LAYERS', `como mucho ${MAX_MAP_LAYERS}`)
    const position = after === undefined ? keyBetween(layers.at(-1)?.position ?? null, null) : layerPlace(layers, after)
    const layer = await mapsRepo.createLayer(
      ctx.db,
      historyContext(ctx, 'createMapLayer', { title: page.title, map: tab.name, layer: name }, wiki),
      { worldId: wiki.worldId, mapId, name, position, ...(hidden !== undefined ? { hidden } : {}) }
    )
    ctx.realtime.publish(pagesChanged(wiki))
    return layerView(layer)
  }),
  implement(updateMapLayer, async (ctx, { layerId, name, hidden, after }) => {
    const { tab, page, layer, wiki } = await authorizedLayer(ctx, 'page.write', layerId)
    const position =
      after === undefined
        ? undefined
        : layerPlace(
            (await mapsRepo.listLayers(ctx.db, layer.mapId)).filter((other) => other.id !== layerId),
            after
          )
    const details = {
      title: page.title,
      map: tab.name,
      ...(name !== undefined ? { from: layer.name, to: name } : { layer: layer.name }),
      ...(hidden !== undefined ? { hidden } : {}),
      ...(position !== undefined ? { moved: true } : {})
    }
    const updated = await mapsRepo.updateLayer(ctx.db, historyContext(ctx, 'updateMapLayer', details, wiki), layerId, {
      ...(name !== undefined ? { name } : {}),
      ...(hidden !== undefined ? { hidden } : {}),
      ...(position !== undefined ? { position } : {})
    })
    ctx.realtime.publish(pagesChanged(wiki))
    return layerView(updated)
  }),
  implement(deleteMapLayer, async (ctx, { layerId }) => {
    const { tab, page, layer, wiki } = await authorizedLayer(ctx, 'page.write', layerId)
    await mapsRepo.deleteLayer(
      ctx.db,
      historyContext(ctx, 'deleteMapLayer', { title: page.title, map: tab.name, layer: layer.name }, wiki),
      layerId
    )
    ctx.realtime.publish(pagesChanged(wiki))
    return { id: layerId }
  }),
  implement(createMapElement, async (ctx, { mapId, layerId, kind, geometry: drawn, snap, ...input }) => {
    const { tab, page, wiki } = await authorizedMap(ctx, 'page.write', mapId)
    const stats = await mapsRepo.elementStats(ctx.db, mapId)
    if (stats.count >= MAX_MAP_ELEMENTS)
      throw new InvalidRequestError('TOO_MANY_ELEMENTS', `como mucho ${MAX_MAP_ELEMENTS}`)
    const geometry = snap ? await snapped(ctx, mapId, drawn, null) : drawn
    await checkGeometry(ctx, mapId, kind, geometry)
    const pageTitle = await checkPinPage(ctx, wiki, input.pageId)
    const layer = await layerFor(ctx, wiki, mapId, layerId, page.title)
    const element = await mapsRepo.createElement(
      ctx.db,
      historyContext(
        ctx,
        'createMapElement',
        { title: page.title, map: tab.name, kind, element: input.label ?? pageTitle ?? null },
        wiki
      ),
      {
        worldId: wiki.worldId,
        mapId,
        layerId: layer,
        kind,
        geometry,
        position: keyBetween(stats.last, null),
        label: input.label ?? null,
        pageId: input.pageId ?? null,
        style: input.style ?? {},
        hidden: input.hidden ?? false
      }
    )
    ctx.realtime.publish(pagesChanged(wiki))
    return elementView((await mapsRepo.findElement(ctx.db, element.id)) as ElementRow)
  }),
  implement(updateMapElement, async (ctx, { elementId, layerId, geometry: drawn, snap, ...patch }) => {
    const { tab, page, element, wiki } = await authorizedElement(ctx, 'page.write', elementId)
    const geometry = drawn && snap ? await snapped(ctx, element.mapId, drawn, elementId) : drawn
    if (geometry) await checkGeometry(ctx, element.mapId, element.kind, geometry)
    await checkPinPage(ctx, wiki, patch.pageId)
    if (layerId) {
      const layer = await mapsRepo.findLayer(ctx.db, layerId)
      if (layer?.mapId !== element.mapId) throw new InvalidRequestError('BAD_MAP_LAYER')
    }
    const details = {
      title: page.title,
      map: tab.name,
      kind: element.kind,
      element: elementName(element),
      ...(geometry ? { reshaped: true } : {})
    }
    await mapsRepo.updateElement(ctx.db, historyContext(ctx, 'updateMapElement', details, wiki), elementId, {
      ...patch,
      ...(geometry ? { geometry } : {}),
      ...(layerId ? { layerId } : {})
    })
    ctx.realtime.publish(pagesChanged(wiki))
    return elementView((await mapsRepo.findElement(ctx.db, elementId)) as ElementRow)
  }),
  implement(deleteMapElement, async (ctx, { elementId }) => {
    const { tab, page, element, wiki } = await authorizedElement(ctx, 'page.write', elementId)
    await mapsRepo.deleteElement(
      ctx.db,
      historyContext(
        ctx,
        'deleteMapElement',
        { title: page.title, map: tab.name, kind: element.kind, element: elementName(element) },
        wiki
      ),
      elementId
    )
    ctx.realtime.publish(pagesChanged(wiki))
    return { id: elementId }
  }),
  implement(getMapImage, async (ctx, { tabId, ...as }) => {
    const tab = await mapsRepo.findTab(ctx.db, tabId)
    const { view } = await viewedPage(ctx, tab?.pageId ?? '', as)
    if (!tab || !view.seesTab({ id: tab.id, pageId: tab.pageId, hidden: tab.hidden })) throw new NotFoundError('tab')
    const map = await mapsRepo.mapOfTab(ctx.db, tabId)
    const file = map?.fileId ? await filesRepo.findFile(ctx.db, map.fileId) : null
    const storage = ctx.storage
    if (!map || !file || file.deletedAt || !map.width || !map.height || !storage)
      throw new InvalidRequestError('NO_MAP_IMAGE')
    const base = { width: map.width, height: map.height, mimeType: file.mime }
    const sizes = `Mide ${map.width} × ${map.height} píxeles`
    if (file.mime === 'image/svg+xml' && file.size <= MAX_SVG_CHARS) {
      const svg = (await readAll(storage.read(file.storageKey))).toString('utf8')
      return { ...base, image: null, svg, note: `${sizes}. Es un dibujo: su SVG va en svg` }
    }
    if (!SHOWN_TYPES.has(file.mime) || file.size > MAX_IMAGE_BYTES) {
      return { ...base, image: null, svg: null, note: `${sizes}. No se puede enseñar (tipo o tamaño): mira ver_mapa` }
    }
    const data = (await readAll(storage.read(file.storageKey))).toString('base64')
    return {
      ...base,
      image: { mimeType: file.mime, data },
      svg: null,
      note: `${sizes}. Para dibujar sobre ella, da los puntos en esos píxeles con view { width: ${map.width}, height: ${map.height} }`
    }
  }),
  implement(measureMap, async (ctx, { tabId, points, pins, elementId, ...as }) => {
    const tab = await mapsRepo.findTab(ctx.db, tabId)
    const { view } = await viewedPage(ctx, tab?.pageId ?? '', as)
    if (!tab || !view.seesTab({ id: tab.id, pageId: tab.pageId, hidden: tab.hidden })) throw new NotFoundError('tab')
    // Con lo que ve quien mide: un jugador no mide hasta lo que no se le ha revelado
    const map = await mapView(ctx, tabId, tab.pageId, view)
    if (!map.image) throw new InvalidRequestError('NO_MAP_IMAGE')
    let line: [number, number][] = points ?? []
    if (pins) {
      const ends = pins.map((id) => map.pins.find((pin) => pin.id === id))
      if (ends.some((pin) => !pin)) throw new NotFoundError('pin')
      line = ends.map((pin) => [pin?.x ?? 0, pin?.y ?? 0])
    }
    if (elementId) {
      const route = map.elements.find((element) => element.id === elementId)
      if (!route || !('points' in route.geometry)) throw new NotFoundError('element')
      line = route.geometry.points
    }
    const { width, height } = map.image
    let pixels = 0
    for (let i = 1; i < line.length; i++) {
      const [a, b] = [line[i - 1], line[i]]
      if (a && b) pixels += Math.hypot((b[0] - a[0]) * width, (b[1] - a[1]) * height)
    }
    const distance = map.scale ? (pixels * map.scale.value) / map.scale.length : null
    const round = (value: number) => Math.round(value * 100) / 100
    return {
      distance: distance === null ? null : round(distance),
      unit: map.scale?.unit ?? null,
      days:
        distance === null
          ? null
          : {
              foot: round(distance / map.speeds.foot),
              horse: round(distance / map.speeds.horse),
              ship: round(distance / map.speeds.ship)
            },
      pixels: round(pixels)
    }
  }),
  implement(getBoard, async (ctx, { tabId, ...as }) => {
    const tab = await mapsRepo.findTab(ctx.db, tabId)
    const { view } = await viewedPage(ctx, tab?.pageId ?? '', as)
    if (tab?.kind !== 'board' || !view.seesTab({ id: tab.id, pageId: tab.pageId, hidden: tab.hidden }))
      throw new NotFoundError('tab')
    const stored = tab.documentId ? await documentsRepo.findSeparate(ctx.db, tab.documentId) : null
    const doc = new Y.Doc()
    if (stored) Y.applyUpdate(doc, stored.state)
    const elements = boardElements(doc)
    // Un jugador, lo que ve (la escena la proyecta el servidor, como el texto de una página)
    return { elements: view.full ? elements : boardForPlayer(elements, (pageId) => view.seesPage(pageId)) }
  })
]
