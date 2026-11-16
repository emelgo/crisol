/**
 * El editor de la pizarra (módulo 9, docs/specs/pizarra.md): Excalidraw (MIT, 0.18.1; docs/terceros.md) dentro de la
 * pestaña, en español y oscuro, guardado en vivo en el documento de Yjs de la pestaña por el Hocuspocus de la wiki
 * (sync.ts). Las tarjetas son elementos embebidos con su página en `customData`; las imágenes, archivos del mundo (al
 * pegarlas se suben, y su `fileId` es el del archivo). Se carga solo al abrir una pizarra (board-tab.tsx)
 */
import { CaptureUpdateAction, Excalidraw, MainMenu, restoreElements } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import type { Page, PageTabView } from '@crisol/contracts'
import type { ExcalidrawElement, ExcalidrawEmbeddableElement, NonDeleted } from '@excalidraw/excalidraw/element/types'
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type * as Y from 'yjs'
import { useApi } from '../../api/context.tsx'
import { useCollabDocument } from '../collab.tsx'
import { useWorldShell } from '../shell/context.ts'
import { BoardDock } from './board-dock.tsx'
import { BoardFrame, PAGE_DRAG, PageCard, pageIdOfLink, pageLink, useBoardFiles } from './board-parts.tsx'
import { boardMap, mergeScene, sceneChanged, whenReady, writeScene } from './sync.ts'

/** Sus fuentes, servidas por Crisol (no por su CDN): apps/web/public/excalidraw/fonts */
;(window as { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = '/excalidraw/'

/** El origen de lo que escribe esta pestaña en el documento (lo de otros se pinta; lo suyo, no) */
const LOCAL = Symbol('pizarra')
/** Cada cuánto, como mucho, va lo que se hace al documento mientras se arrastra */
const WRITE_EVERY = 80

/** Lo nuevo, con trazo limpio («arquitecto») y letra normal (Nunito), no a mano; cada uno lo cambia si quiere */
const CLEAN = { currentItemRoughness: 0, currentItemFontFamily: 6 } as const

/** Dónde se miraba la pizarra (encuadre y zoom), para volver a lo mismo: solo en este navegador */
type View = { scrollX: number; scrollY: number; zoom: number }
const viewKey = (tabId: string) => `crisol:pizarra:${tabId}`
function readView(tabId: string): View | null {
  try {
    const value = JSON.parse(localStorage.getItem(viewKey(tabId)) ?? 'null') as View | null
    return value && [value.scrollX, value.scrollY, value.zoom].every(Number.isFinite) ? value : null
  } catch {
    return null
  }
}
function saveView(tabId: string, state: AppState) {
  try {
    const view: View = { scrollX: state.scrollX, scrollY: state.scrollY, zoom: state.zoom.value }
    localStorage.setItem(viewKey(tabId), JSON.stringify(view))
  } catch {
    // Sin almacenamiento (ventana privada): se encuadra lo que haya al volver
  }
}

export default function BoardEditor({ page, tab }: { page: Page; tab: PageTabView }) {
  const { t } = useTranslation()
  const api = useApi()
  const navigate = useNavigate()
  const { session, synced, offline } = useCollabDocument(tab.documentId ? `doc:${tab.documentId}` : null)
  const [excalidraw, setExcalidraw] = useState<ExcalidrawImperativeAPI | null>(null)
  const [selected, setSelected] = useState<readonly ExcalidrawElement[]>([])
  // En el mundo a pantalla completa, sus herramientas en nuestra píldora (board-dock.tsx): la elegida y el zoom
  const docked = Boolean(useWorldShell())
  const [activeTool, setActiveTool] = useState('selection')
  const [zoom, setZoom] = useState(1)
  const canvas = useRef<HTMLDivElement>(null)
  const loadFiles = useBoardFiles(excalidraw)
  const doc = session?.document ?? null

  // Lo del documento, a la escena: al abrirla y cada vez que otro cambia algo
  useEffect(() => {
    if (!excalidraw || !doc || !synced) return
    const map = boardMap<ExcalidrawElement>(doc)
    let frame = 0
    const pull = (first: boolean) => {
      const local = excalidraw.getSceneElementsIncludingDeleted()
      const merged = mergeScene(local, map.values())
      if (first || sceneChanged(local, merged)) {
        excalidraw.updateScene({ elements: merged, captureUpdate: CaptureUpdateAction.NEVER })
      }
      loadFiles(merged)
      if (!first) return
      // Al volver, donde se estaba; la primera vez, todo a la vista
      const saved = readView(tab.id)
      if (saved) {
        excalidraw.updateScene({
          appState: {
            scrollX: saved.scrollX,
            scrollY: saved.scrollY,
            zoom: { value: saved.zoom as AppState['zoom']['value'] }
          },
          captureUpdate: CaptureUpdateAction.NEVER
        })
      } else excalidraw.scrollToContent(undefined, { fitToContent: true, animate: false })
    }
    const onChange = (_event: Y.YMapEvent<ExcalidrawElement>, transaction: Y.Transaction) => {
      if (transaction.origin === LOCAL) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => pull(false))
    }
    // Cuando Excalidraw acabe de arrancar: su carga pisaría la escena y el encuadre
    return whenReady(excalidraw, () => {
      pull(true)
      map.observe(onChange)
      return () => {
        cancelAnimationFrame(frame)
        map.unobserve(onChange)
      }
    })
  }, [excalidraw, doc, synced, loadFiles, tab.id])

  // Lo de la escena, al documento (sin pasarse mientras se arrastra)
  const pending = useRef<readonly ExcalidrawElement[] | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const view = useRef<AppState | null>(null)
  // «Guardado» en la barra, tras lo primero que se escribe (como el texto de la página)
  const [saved, setSaved] = useState(false)
  const [empty, setEmpty] = useState(false)
  const [uploadFailed, setUploadFailed] = useState(false)
  const flush = useCallback(() => {
    timer.current = null
    if (doc && pending.current && writeScene(doc, pending.current, LOCAL) > 0) setSaved(true)
    pending.current = null
    if (view.current) saveView(tab.id, view.current)
  }, [doc, tab.id])
  // Al salir, lo pendiente va antes de que se cierre el documento: la limpieza de un efecto de diseño corre antes que
  // las de los efectos normales (la de useCollabDocument lo destruye)
  useLayoutEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      flush()
    },
    [flush]
  )
  const onChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState) => {
      setActiveTool(appState.activeTool.type)
      setZoom(appState.zoom.value)
      const ids = appState.selectedElementIds
      setSelected((current) => {
        const next = elements.filter((element) => ids[element.id] && !element.isDeleted)
        return next.length === current.length && next.every((e, i) => e === current[i]) ? current : next
      })
      // Mientras arranca, su escena aún no es la del documento (ni su encuadre, el guardado)
      if (!doc || !synced || appState.isLoading) return
      setEmpty(!elements.some((element) => !element.isDeleted))
      pending.current = elements
      view.current = appState
      if (!timer.current) timer.current = setTimeout(flush, WRITE_EVERY)
    },
    [doc, synced, flush]
  )

  /** Pone la tarjeta de una página donde se diga (en coordenadas de la escena), elegida */
  const addCard = useCallback(
    (pageId: string, title: string, at?: { x: number; y: number }) => {
      if (!excalidraw) return
      const state = excalidraw.getAppState()
      const zoom = state.zoom.value
      const center = at ?? {
        x: -state.scrollX + state.width / 2 / zoom,
        y: -state.scrollY + state.height / 2 / zoom
      }
      const [card] = restoreElements(
        [
          {
            type: 'embeddable',
            id: crypto.randomUUID(),
            x: center.x - 120,
            y: center.y - 36,
            width: 240,
            height: 72,
            link: pageLink(page.worldId, pageId),
            customData: { pageId, title },
            strokeColor: 'transparent',
            backgroundColor: 'transparent',
            roughness: 0,
            roundness: { type: 3 }
          } as unknown as ExcalidrawElement
        ],
        null
      )
      if (!card) return
      excalidraw.updateScene({
        elements: [...excalidraw.getSceneElementsIncludingDeleted(), card],
        appState: { selectedElementIds: { [card.id]: true } },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY
      })
    },
    [excalidraw, page.worldId]
  )

  /** «Oculto para los jugadores» de lo elegido: marca y apagado (vuelve a como estaba al quitarlo) */
  const setHidden = useCallback(
    (hidden: boolean) => {
      if (!excalidraw) return
      const ids = new Set(selected.map((element) => element.id))
      const elements = excalidraw.getSceneElementsIncludingDeleted().map((element) => {
        if (!ids.has(element.id) || Boolean(element.customData?.hidden) === hidden) return element
        const { hidden: _, shownOpacity, ...rest } = element.customData ?? {}
        return {
          ...element,
          customData: hidden ? { ...rest, hidden: true, shownOpacity: element.opacity } : rest,
          opacity: hidden ? Math.min(element.opacity, 40) : typeof shownOpacity === 'number' ? shownOpacity : 100,
          version: element.version + 1,
          versionNonce: Math.floor(Math.random() * 2 ** 31),
          updated: Date.now()
        } as ExcalidrawElement
      })
      excalidraw.updateScene({ elements, captureUpdate: CaptureUpdateAction.IMMEDIATELY })
    },
    [excalidraw, selected]
  )

  const renderEmbeddable = useCallback(
    (element: NonDeleted<ExcalidrawEmbeddableElement>) => {
      const pageId = (element.customData?.pageId as string | undefined) ?? pageIdOfLink(element.link)
      return pageId ? (
        <PageCard
          worldId={page.worldId}
          pageId={pageId}
          title={element.customData?.title}
          hidden={Boolean(element.customData?.hidden)}
        />
      ) : null
    },
    [page.worldId]
  )

  // A sangre en la página del mundo, sin fondo propio: se ve el de la página (como en Everlore)
  const initialData = useMemo(
    () => ({ appState: docked ? { ...CLEAN, viewBackgroundColor: 'transparent' } : CLEAN }),
    [docked]
  )
  const uiOptions = useMemo(
    () => ({
      canvasActions: {
        export: false as const,
        loadScene: false,
        saveToActiveFile: false,
        toggleTheme: null,
        saveAsImage: true,
        clearCanvas: true,
        changeViewBackgroundColor: true
      },
      tools: { image: true }
    }),
    []
  )

  return (
    <BoardFrame
      page={page}
      tab={tab}
      offline={offline}
      loading={!synced}
      saved={saved}
      empty={synced && empty}
      notice={uploadFailed ? t('board.uploadFailed') : null}
      onAddPage={addCard}
      hidden={selected.length > 0 ? selected.every((element) => element.customData?.hidden) : null}
      onHidden={setHidden}
      onCanvasResize={() => excalidraw?.refresh()}
      canvasRef={canvas}
      dock={
        docked ? (
          <BoardDock excalidraw={excalidraw} canvas={canvas} active={activeTool} zoom={zoom} name={tab.name} />
        ) : undefined
      }
      onDropPage={(event) => {
        const pageId = event.dataTransfer.getData(PAGE_DRAG)
        if (!pageId || !excalidraw) return false
        const state = excalidraw.getAppState()
        const zoom = state.zoom.value
        const at = {
          x: (event.clientX - state.offsetLeft) / zoom - state.scrollX,
          y: (event.clientY - state.offsetTop) / zoom - state.scrollY
        }
        addCard(pageId, event.dataTransfer.getData('text/plain'), at)
        return true
      }}
    >
      <Excalidraw
        excalidrawAPI={setExcalidraw}
        initialData={initialData}
        langCode="es-ES"
        theme="dark"
        name={tab.name}
        UIOptions={uiOptions}
        onChange={onChange}
        viewModeEnabled={!synced}
        validateEmbeddable={(link) => (pageIdOfLink(link) ? true : undefined)}
        renderEmbeddable={renderEmbeddable}
        onLinkOpen={(element, event) => {
          const pageId = (element.customData?.pageId as string | undefined) ?? pageIdOfLink(element.link)
          if (!pageId) return
          event.preventDefault()
          void navigate({ to: '/mundos/$worldId/wiki/$pageId', params: { worldId: page.worldId, pageId } })
        }}
        generateIdForFile={async (file: File) => {
          // Lo pegado o arrastrado va a los archivos del mundo: el id del archivo es el de la imagen
          setUploadFailed(false)
          try {
            const stored = await api.uploadFile({ worldId: page.worldId, name: file.name || t('board.image') }, file)
            return stored.id
          } catch (error) {
            setUploadFailed(true)
            throw error
          }
        }}
      >
        <MainMenu>
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>
      </Excalidraw>
    </BoardFrame>
  )
}
