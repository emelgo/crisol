/**
 * La pizarra para una jugadora (módulo 9, docs/specs/pizarra.md): en solo lectura (mover y acercar), con lo que le
 * proyecta el servidor (getBoard: sin lo oculto ni las tarjetas de lo que no conoce). No abre el documento de Yjs. Se
 * carga solo al abrir una pizarra (board-tab.tsx)
 */
import { CaptureUpdateAction, Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import type { Page, PageTabView } from '@crisol/contracts'
import type { ExcalidrawElement, ExcalidrawEmbeddableElement, NonDeleted } from '@excalidraw/excalidraw/element/types'
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../api/context.tsx'
import { PageLink, readAsInput, readAsKey, useOpenPage, useReadAs } from '../read-as.tsx'
import styles from './board.module.css'
import { BoardFrame, PageCard, pageIdOfLink, useBoardFiles, usePages } from './board-parts.tsx'
import { summarize } from './summary.ts'
import { mergeScene, whenReady } from './sync.ts'

;(window as { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = '/excalidraw/'

/** La página de una tarjeta (null si no lo es) */
const cardPage = (element: { link?: string | null; customData?: Record<string, unknown> } | null) =>
  element ? ((element.customData?.pageId as string | undefined) ?? pageIdOfLink(element.link)) : null

/** Lo más lejos que se ve al abrirla: más lejos, sus tarjetas no se leen */
const MIN_ZOOM = 0.6

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
      if (first) {
        excalidraw.scrollToContent(undefined, { fitToContent: true, animate: false })
        // Con mucho, el encuadre entero lo dejaría ilegible: no más lejos que esto, centrado en lo que hay
        if (excalidraw.getAppState().zoom.value < MIN_ZOOM) {
          excalidraw.updateScene({
            appState: { zoom: { value: MIN_ZOOM as AppState['zoom']['value'] } },
            captureUpdate: CaptureUpdateAction.NEVER
          })
          excalidraw.scrollToContent(undefined, { animate: false })
        }
      }
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

  const openPage = useOpenPage()
  const pages = usePages(page.worldId)
  const summary = useMemo(() => {
    const titles = new Map((pages.data?.pages ?? []).map((row) => [row.id, row.title]))
    return summarize(elements, (pageId) => titles.get(pageId))
  }, [elements, pages.data])

  return (
    <BoardFrame
      page={page}
      tab={tab}
      loading={board.isPending}
      onCanvasResize={() => excalidraw?.refresh()}
      summary={board.data ? <SummaryList worldId={page.worldId} summary={summary} /> : null}
    >
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
        // Pulsar una tarjeta (sin arrastrar) o su ↗ abre su página, la de la campaña
        onPointerUp={(_tool, state) => {
          const pageId = cardPage(state.hit.element)
          const moved = Math.hypot(state.lastCoords.x - state.origin.x, state.lastCoords.y - state.origin.y)
          if (pageId && moved < 4) openPage(page.worldId, pageId)
        }}
        onLinkOpen={(element, event) => {
          event.preventDefault()
          const pageId = cardPage(element)
          if (pageId) openPage(page.worldId, pageId)
        }}
      />
    </BoardFrame>
  )
}

/** La pizarra en palabras: sus páginas (se abren), sus notas y quién va con quién */
function SummaryList({ worldId, summary }: { worldId: string; summary: ReturnType<typeof summarize> }) {
  const { t } = useTranslation()
  if (summary.cards.length + summary.notes.length + summary.links.length === 0) {
    return <p className={styles.noMatch}>{t('board.nothing')}</p>
  }
  return (
    <>
      <ul className={styles.summaryList}>
        {summary.cards.map((card) => (
          <li key={card.id}>
            <PageLink worldId={worldId} pageId={card.pageId}>
              {card.title}
            </PageLink>
          </li>
        ))}
        {summary.notes.map((note) => (
          <li key={note.id}>{note.text}</li>
        ))}
      </ul>
      {summary.links.length > 0 && (
        <ul className={`${styles.summaryList} ${styles.summaryLinks}`} aria-label={t('board.links')}>
          {summary.links.map((link) => (
            <li key={link.id}>
              {link.label
                ? t('board.linkWith', { from: link.from, to: link.to, label: link.label })
                : t('board.link', { from: link.from, to: link.to })}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
