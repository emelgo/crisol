/**
 * Las herramientas de la pizarra en la página del mundo (Enrique, 2026-11-16, como las del mapa): nuestra
 * propia píldora de cristal abajo en el centro con las de Excalidraw (se eligen con su API), el zoom abajo a la derecha
 * y deshacer y rehacer abajo a la izquierda. Pegadas abajo de lo que se ve, aunque el lienzo siga más abajo. La barra de
 * formas de Excalidraw, su menú y su pie se esconden (board.module.css); su panel de propiedades se queda
 */
import { CaptureUpdateAction, exportToBlob } from '@excalidraw/excalidraw'
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import {
  ArrowUpRight,
  Circle,
  Diamond,
  Ellipsis,
  Eraser,
  Hand,
  ImageDown,
  ImageIcon,
  type LucideIcon,
  Minus,
  MousePointer2,
  Pencil,
  Plus,
  Redo2,
  Slash,
  Square,
  Trash2,
  Type,
  Undo2
} from 'lucide-react'
import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Menu, MenuItem } from '../../components/menu.tsx'
import styles from './board.module.css'
import { zoomedAround } from './view.ts'

/** Las herramientas de Excalidraw que se ofrecen, con su atajo (el suyo) */
export const BOARD_TOOLS = [
  ['selection', MousePointer2, 'V'],
  ['hand', Hand, 'H'],
  ['rectangle', Square, 'R'],
  ['diamond', Diamond, 'D'],
  ['ellipse', Circle, 'O'],
  ['arrow', ArrowUpRight, 'A'],
  ['line', Slash, 'L'],
  ['freedraw', Pencil, 'P'],
  ['text', Type, 'T'],
  ['image', ImageIcon, '9'],
  ['eraser', Eraser, 'E']
] as const satisfies readonly (readonly [string, LucideIcon, string])[]

export type BoardTool = (typeof BOARD_TOOLS)[number][0]

export function BoardDock({
  excalidraw,
  canvas,
  active,
  zoom,
  name
}: {
  excalidraw: ExcalidrawImperativeAPI | null
  /** El lienzo (donde escucha Excalidraw sus atajos): deshacer y rehacer son los suyos */
  canvas: RefObject<HTMLElement | null>
  active: string
  zoom: number
  /** El nombre de la pestaña, para la imagen que se guarda */
  name: string
}) {
  const { t } = useTranslation()
  const choose = (tool: BoardTool) => excalidraw?.setActiveTool({ type: tool })
  const zoomTo = (value: number) => {
    if (!excalidraw) return
    const next = zoomedAround(excalidraw.getAppState(), value)
    excalidraw.updateScene({
      appState: {
        zoom: { value: next.zoom as AppState['zoom']['value'] },
        scrollX: next.scrollX,
        scrollY: next.scrollY
      },
      captureUpdate: CaptureUpdateAction.NEVER
    })
  }
  // Ctrl+Z y Ctrl+Mayús+Z, como si se pulsaran en el lienzo (su historial no se alcanza de otro modo)
  const history = (redo: boolean) => {
    const target = canvas.current?.querySelector('.excalidraw')
    for (const modifier of ['ctrlKey', 'metaKey'] as const) {
      target?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', [modifier]: true, shiftKey: redo, bubbles: true })
      )
    }
  }
  const saveImage = async () => {
    if (!excalidraw) return
    const blob = await exportToBlob({
      elements: excalidraw.getSceneElements(),
      appState: { ...excalidraw.getAppState(), exportBackground: false },
      files: excalidraw.getFiles(),
      mimeType: 'image/png'
    })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${name}.png`
    link.click()
    URL.revokeObjectURL(link.href)
  }
  const clear = () => {
    if (!excalidraw) return
    // Se deshace con Deshacer (va a su historial y al documento, como borrar a mano)
    excalidraw.updateScene({
      elements: excalidraw.getSceneElementsIncludingDeleted().map((element) =>
        element.isDeleted
          ? element
          : {
              ...element,
              isDeleted: true,
              version: element.version + 1,
              versionNonce: Math.floor(Math.random() * 2 ** 31),
              updated: Date.now()
            }
      ),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY
    })
  }
  return (
    <div className={styles.dock}>
      <div className={styles.pill} role="toolbar" aria-label={t('board.toolbar')}>
        <Menu label={t('board.more')} icon={<Ellipsis aria-hidden="true" size={18} />} className={styles.dockButton}>
          {(close) => (
            <>
              <MenuItem
                onClick={() => {
                  close()
                  void saveImage()
                }}
              >
                <ImageDown aria-hidden="true" size={15} />
                {t('board.saveImage')}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  close()
                  clear()
                }}
              >
                <Trash2 aria-hidden="true" size={15} />
                {t('board.clear')}
              </MenuItem>
            </>
          )}
        </Menu>
        <span className={styles.dockSep} aria-hidden="true" />
        {BOARD_TOOLS.map(([tool, Icon, key]) => {
          const label = t(`board.tools.${tool}`)
          return (
            <button
              key={tool}
              type="button"
              className={styles.dockButton}
              aria-pressed={active === tool}
              aria-label={label}
              aria-keyshortcuts={key}
              title={`${label} (${key})`}
              onClick={() => choose(tool)}
            >
              <Icon aria-hidden="true" size={18} />
            </button>
          )
        })}
      </div>
      <div className={`${styles.pill} ${styles.zoomTools}`} role="toolbar" aria-label={t('board.zoomTools')}>
        <button
          type="button"
          className={styles.dockButton}
          aria-label={t('board.zoomOut')}
          title={t('board.zoomOut')}
          onClick={() => zoomTo(zoom / 1.25)}
        >
          <Minus aria-hidden="true" size={18} />
        </button>
        <button
          type="button"
          className={`${styles.dockButton} ${styles.zoomValue}`}
          aria-label={t('board.zoomReset')}
          title={t('board.zoomReset')}
          onClick={() => zoomTo(1)}
        >
          {Math.round(zoom * 100)} %
        </button>
        <button
          type="button"
          className={styles.dockButton}
          aria-label={t('board.zoomIn')}
          title={t('board.zoomIn')}
          onClick={() => zoomTo(zoom * 1.25)}
        >
          <Plus aria-hidden="true" size={18} />
        </button>
      </div>
      <div className={`${styles.pill} ${styles.historyTools}`} role="toolbar" aria-label={t('board.history')}>
        <button
          type="button"
          className={styles.dockButton}
          aria-label={t('board.undo')}
          aria-keyshortcuts="Control+Z"
          title={`${t('board.undo')} (Ctrl+Z)`}
          onClick={() => history(false)}
        >
          <Undo2 aria-hidden="true" size={18} />
        </button>
        <button
          type="button"
          className={styles.dockButton}
          aria-label={t('board.redo')}
          aria-keyshortcuts="Control+Shift+Z"
          title={`${t('board.redo')} (Ctrl+Mayús+Z)`}
          onClick={() => history(true)}
        >
          <Redo2 aria-hidden="true" size={18} />
        </button>
      </div>
    </div>
  )
}
