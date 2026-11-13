/**
 * La pizarra para una jugadora (módulo 9, docs/specs/pizarra.md): en solo lectura (mover y acercar), con lo que le
 * proyecta el servidor (getBoard: sin lo oculto ni las tarjetas de lo que no conoce). No abre el documento de Yjs. Se
 * carga solo al abrir una pizarra (board-tab.tsx)
 */
import { CaptureUpdateAction, Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import type { Page, PageTabView } from '@crisol/contracts'
import type { ExcalidrawElement, ExcalidrawEmbeddableElement, NonDeleted } from '@excalidraw/excalidraw/element/types'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApi } from '../../api/context.tsx'
import { readAsInput, readAsKey, useReadAs } from '../read-as.tsx'
import { BoardFrame, PageCard, pageIdOfLink, useBoardFiles } from './board-parts.tsx'
import { mergeScene, whenReady } from './sync.ts'

;(window as { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = '/excalidraw/'

export default function BoardView({ page, tab }: { page: Page; tab: PageTabView }) {
  const api = useApi()
  const readAs = useReadAs()
  const board = useQuery({
    queryKey: ['pages', page.worldId, 'board', tab.id, ...readAsKey(readAs)],
    queryFn: () => api.call('getBoard', { tabId: tab.id, ...readAsInput(readAs) }),
    // Lo que el máster va cambiando le llega al volver a la pestaña y, abierta, cada poco
    refetchInterval: 15_000
  })
  const [excalidraw, setExcalidraw] = useState<ExcalidrawImperativeAPI | null>(null)
  const loadFiles = useBoardFiles(excalidraw)
  const elements = useMemo(
    () => mergeScene([], (board.data?.elements ?? []) as unknown as ExcalidrawElement[]),
    [board.data]
  )

  useEffect(() => {
    if (!excalidraw || !board.data) return
    // Cuando Excalidraw acabe de arrancar: su carga pisaría la escena y el encuadre
    return whenReady(excalidraw, () => {
      const first = excalidraw.getSceneElementsIncludingDeleted().length === 0
      excalidraw.updateScene({ elements, captureUpdate: CaptureUpdateAction.NEVER })
      loadFiles(elements)
      if (first) excalidraw.scrollToContent(undefined, { fitToContent: true, animate: false })
      return undefined
    })
  }, [excalidraw, board.data, elements, loadFiles])

  const renderEmbeddable = useCallback(
    (element: NonDeleted<ExcalidrawEmbeddableElement>) => {
      const pageId = (element.customData?.pageId as string | undefined) ?? pageIdOfLink(element.link)
      return pageId ? <PageCard worldId={page.worldId} pageId={pageId} title={element.customData?.title} /> : null
    },
    [page.worldId]
  )

  return (
    <BoardFrame page={page} tab={tab} loading={board.isPending} onCanvasResize={() => excalidraw?.refresh()}>
      <Excalidraw
        excalidrawAPI={setExcalidraw}
        langCode="es-ES"
        theme="dark"
        name={tab.name}
        viewModeEnabled
        UIOptions={{
          canvasActions: {
            export: false,
            loadScene: false,
            saveToActiveFile: false,
            toggleTheme: null,
            saveAsImage: false,
            clearCanvas: false,
            changeViewBackgroundColor: false
          }
        }}
        validateEmbeddable={(link) => (pageIdOfLink(link) ? true : undefined)}
        renderEmbeddable={renderEmbeddable}
        onLinkOpen={(_element, event) => event.preventDefault()}
      />
    </BoardFrame>
  )
}
