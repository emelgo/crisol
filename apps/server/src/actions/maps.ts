/**
 * Las pestañas de las páginas y sus mapas con pines (ADR-0007). Quien puede leer o escribir la página puede leer o
 * escribir sus pestañas; la imagen de un mapa es un archivo del mundo o uno común de su organización, y un pin lleva a
 * una página del mismo mundo
 */
import {
  createMapPin,
  createPageTab,
  deleteMapPin,
  deletePageTab,
  getMap,
  listPageTabs,
  MAX_MAP_PINS,
  MAX_PAGE_TABS,
  type MapPinView,
  type MapView,
  type PageTabView,
  updateMap,
  updateMapPin,
  updatePageTab
} from '@crisol/contracts'
import { documentsRepo, filesRepo, mapsRepo } from '@crisol/db'
import { type Capability, keyBetween, NotFoundError } from '@crisol/domain'
import * as Y from 'yjs'
import { pagesChanged } from '../realtime/events.ts'
import { viewedPage } from '../wiki/projection.ts'
import type { WikiView } from '../wiki/reader.ts'
import { authorizedPage, type WikiTarget } from './access.ts'
import { type ActionContext, historyContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'

const tabView = (row: mapsRepo.PageTabRow): PageTabView => ({
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

async function mapView(ctx: ActionContext, tabId: string, pageId: string, view?: WikiView): Promise<MapView> {
  const map = await mapsRepo.mapOfTab(ctx.db, tabId)
  if (!map) throw new NotFoundError('map')
  const all = await mapsRepo.listPins(ctx.db, map.id)
  // Un jugador (ADR-0017): los pines que ve; uno a una página que no ve, con su etiqueta y sin ella
  const pins =
    !view || view.full
      ? all
      : all
          .filter((pin) => view.seesMapItem({ kind: 'pin', id: pin.id, pageId, hidden: pin.hidden }))
          .map((pin) => (pin.pageId && !view.seesPage(pin.pageId) ? { ...pin, pageId: null, pageTitle: null } : pin))
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
    pins: pins.map(pinView)
  }
}

/** La página de un pin: del mismo mundo y fuera de la papelera */
async function checkPinPage(ctx: ActionContext, wiki: WikiTarget, pageId: string | null | undefined) {
  if (!pageId) return
  const [found] = await mapsRepo.pagesInWorld(ctx.db, wiki.worldId, [pageId])
  if (!found) throw new InvalidRequestError('BAD_PIN_PAGE')
}

/** El nombre de un pin para el historial */
const pinName = (pin: { label: string | null; pageTitle?: string | null }) => pin.label ?? pin.pageTitle ?? null

export const mapActions = [
  implement(listPageTabs, async (ctx, { pageId, ...as }) => {
    const { view } = await viewedPage(ctx, pageId, as)
    const tabs = (await mapsRepo.listTabs(ctx.db, pageId)).filter(
      // Un jugador (ADR-0017): las que ve; las tablas aleatorias de la wiki siguen siendo del máster
      (tab) => view.full || (tab.kind !== 'table' && view.seesTab({ id: tab.id, pageId, hidden: tab.hidden }))
    )
    return { tabs: tabs.map(tabView) }
  }),

  implement(createPageTab, async (ctx, { pageId, kind, name }) => {
    const { page, wiki } = await authorizedPage(ctx, 'page.write', pageId)
    const tabs = await mapsRepo.listTabs(ctx.db, pageId)
    if (tabs.length >= MAX_PAGE_TABS) throw new InvalidRequestError('TOO_MANY_TABS', `como mucho ${MAX_PAGE_TABS}`)
    const base = kind === 'text' ? 'Texto' : kind === 'table' ? 'Tabla' : 'Mapa'
    const same = tabs.filter((tab) => tab.kind === kind).length
    // La de texto cuenta con la principal («Texto»): la primera añadida es «Texto 2»; el segundo mapa, «Mapa 2»
    const named = name ?? (kind === 'text' ? `${base} ${same + 2}` : same > 0 ? `${base} ${same + 1}` : base)
    // Una de texto lleva su documento, como un secreto (vacío al nacer; no va al historial: lo cuenta su edición)
    const documentId =
      kind === 'text'
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

  implement(updateMap, async (ctx, { mapId, image, scale }) => {
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
      ...(scale !== undefined ? { scale: scale !== null } : {})
    }
    await mapsRepo.updateMap(ctx.db, historyContext(ctx, 'updateMap', details, wiki), mapId, {
      ...(image ? { fileId: image.fileId, width: image.width, height: image.height } : {}),
      ...(scale !== undefined
        ? { scaleLength: scale?.length ?? null, scaleValue: scale?.value ?? null, scaleUnit: scale?.unit ?? null }
        : {})
    })
    ctx.realtime.publish(pagesChanged(wiki))
    return mapView(ctx, tab.id, tab.pageId)
  }),

  implement(createMapPin, async (ctx, { mapId, ...input }) => {
    const { tab, page, wiki } = await authorizedMap(ctx, 'page.write', mapId)
    if ((await mapsRepo.countPins(ctx.db, mapId)) >= MAX_MAP_PINS) {
      throw new InvalidRequestError('TOO_MANY_PINS', `como mucho ${MAX_MAP_PINS}`)
    }
    await checkPinPage(ctx, wiki, input.pageId)
    const pin = await mapsRepo.createPin(
      ctx.db,
      historyContext(ctx, 'createMapPin', { title: page.title, map: tab.name, pin: input.label ?? null }, wiki),
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
  })
]
