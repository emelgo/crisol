/**
 * Lo de la pizarra que no es Excalidraw (módulo 9, docs/specs/pizarra.md): el marco con su barra («Página…», «Oculto
 * para los jugadores», ampliar), la tarjeta de una página y las imágenes de los archivos del mundo. Solo tipos de
 * Excalidraw: el árbol importa de aquí lo que arrastra sin cargar el editor
 */

import type { Page, PageTabView } from '@crisol/contracts'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { useQuery } from '@tanstack/react-query'
import { Expand, EyeOff, FilePlus2, Shrink } from 'lucide-react'
import {
  type DragEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../api/context.tsx'
import { Icon } from '../../components/icon.tsx'
import { PageLink, readAsInput, readAsKey, useReadAs } from '../read-as.tsx'
import { TabToolsSlot } from '../shell/context.ts'
import { tabRegionLabel } from '../tabs/kinds.tsx'
import styles from './board.module.css'
import { PAGE_DRAG } from './drag.ts'

export { PAGE_DRAG }

/** El enlace de una tarjeta: la página en la wiki del mundo */
export const pageLink = (worldId: string, pageId: string) => `/mundos/${worldId}/wiki/${pageId}`

const PAGE_LINK = /\/mundos\/[0-9a-f-]{36}\/wiki\/([0-9a-f-]{36})$/i

/** La página de un enlace de tarjeta (o null si no es de una página) */
export const pageIdOfLink = (link: string | null | undefined) => (link ? (PAGE_LINK.exec(link)?.[1] ?? null) : null)

/** Las páginas que se ven del mundo (las del máster, todas; las de una jugadora, las que conoce), por su id */
export function usePages(worldId: string) {
  const api = useApi()
  const readAs = useReadAs()
  return useQuery({
    queryKey: ['pages', worldId, 'tree', 32, ...readAsKey(readAs)],
    queryFn: () => api.call('listPageTree', { worldId, levels: 32, ...readAsInput(readAs) })
  })
}

/**
 * Una tarjeta: el icono y el título de su página (lo sigue si cambia); pulsarla la abre. Si la página ya no está (a la
 * papelera), «Sin página»
 */
export function PageCard({
  worldId,
  pageId,
  title,
  hidden = false
}: {
  worldId: string
  pageId: string
  title?: unknown
  /** Oculta a los jugadores: además de apagada, su marca (el apagado solo se confunde con lo tenue) */
  hidden?: boolean
}) {
  const { t } = useTranslation()
  const pages = usePages(worldId)
  const found = pages.data?.pages.find((row) => row.id === pageId)
  if (pages.data && !found) {
    return (
      <div className={styles.card} data-missing="">
        <span className={styles.cardTitle}>{typeof title === 'string' && title ? title : t('board.noPage')}</span>
        <span className={styles.cardNote}>{t('board.noPage')}</span>
      </div>
    )
  }
  const name = found?.title ?? (typeof title === 'string' ? title : '')
  return (
    <div className={styles.card} data-hidden={hidden || undefined}>
      {found?.icon && <Icon value={found.icon} size={22} className={styles.cardIcon} />}
      <PageLink worldId={worldId} pageId={pageId} className={styles.cardTitle}>
        {name}
      </PageLink>
      {hidden && (
        <span className={styles.cardHidden} title={t('board.hidden')}>
          <EyeOff aria-hidden="true" size={14} />
          <span className={styles.visuallyHidden}>{t('board.hidden')}</span>
        </span>
      )}
    </div>
  )
}

/**
 * Las imágenes de la escena que aún no tiene Excalidraw: se piden a los archivos del mundo y se le dan (cada una una
 * vez). Devuelve con qué pedirlas para unos elementos
 */
export function useBoardFiles(excalidraw: ExcalidrawImperativeAPI | null) {
  const asked = useRef(new Set<string>())
  useEffect(() => {
    if (excalidraw) asked.current.clear()
  }, [excalidraw])
  return useCallback(
    (elements: readonly ExcalidrawElement[]) => {
      if (!excalidraw) return
      const have = excalidraw.getFiles()
      for (const element of elements) {
        if (element.type !== 'image' || element.isDeleted || !element.fileId) continue
        const id = element.fileId
        if (have[id] || asked.current.has(id)) continue
        asked.current.add(id)
        void fetch(`/api/files/${id}`, { credentials: 'same-origin' })
          .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(String(response.status)))))
          .then(
            (blob) =>
              new Promise<{ dataURL: string; mimeType: string }>((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve({ dataURL: String(reader.result), mimeType: blob.type })
                reader.onerror = () => reject(reader.error)
                reader.readAsDataURL(blob)
              })
          )
          .then(({ dataURL, mimeType }) =>
            excalidraw.addFiles([
              { id, dataURL, mimeType: mimeType as 'image/png', created: Date.now() } as Parameters<
                ExcalidrawImperativeAPI['addFiles']
              >[0][number]
            ])
          )
          .catch(() => asked.current.delete(id))
      }
    },
    [excalidraw]
  )
}

/** Cuántas páginas sugiere «Página…» a la vez */
const SUGGESTED = 8

/**
 * «Página…»: un desplegable que flota bajo la barra (no la mueve), con el nombre que se escribe y las páginas del
 * mundo que lo contienen; Intro pone la primera (o la que se llama así), las flechas eligen
 */
function AddPage({ worldId, onAdd }: { worldId: string; onAdd: (pageId: string, title: string) => void }) {
  const { t } = useTranslation()
  const pages = usePages(worldId)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [active, setActive] = useState(0)
  const id = useId()
  const button = useRef<HTMLButtonElement>(null)
  const close = () => {
    setOpen(false)
    setName('')
    setActive(0)
    button.current?.focus()
  }
  const wanted = name.trim().toLocaleLowerCase('es')
  const all = pages.data?.pages ?? []
  const exact = all.find((row) => row.title.toLocaleLowerCase('es') === wanted)
  const matches = wanted
    ? [
        ...(exact ? [exact] : []),
        ...all.filter((row) => row !== exact && row.title.toLocaleLowerCase('es').includes(wanted))
      ].slice(0, SUGGESTED)
    : all.slice(0, SUGGESTED)
  const chosen = matches[Math.min(active, matches.length - 1)]
  const put = (row: { id: string; title: string }) => {
    onAdd(row.id, row.title)
    close()
  }
  return (
    <div className={styles.addPage}>
      <button
        ref={button}
        type="button"
        className={styles.barButton}
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <FilePlus2 aria-hidden="true" size={16} />
        {t('board.addPage')}
      </button>
      {open && (
        <form
          id={`${id}-panel`}
          className={styles.addPanel}
          aria-label={t('board.addPageTitle')}
          onSubmit={(event) => {
            event.preventDefault()
            if (chosen) put(chosen)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              close()
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              const step = event.key === 'ArrowDown' ? 1 : -1
              setActive((current) => (current + step + matches.length) % Math.max(matches.length, 1))
            }
          }}
        >
          <div className={styles.addRow}>
            <label htmlFor={`${id}-name`}>{t('board.pageName')}</label>
            <input
              id={`${id}-name`}
              value={name}
              autoComplete="off"
              role="combobox"
              aria-expanded={matches.length > 0}
              aria-controls={`${id}-pages`}
              aria-activedescendant={chosen ? `${id}-${chosen.id}` : undefined}
              // biome-ignore lint/a11y/noAutofocus: se abre para escribir el nombre
              autoFocus
              onChange={(event) => {
                setName(event.target.value)
                setActive(0)
              }}
            />
            <button type="submit" className={styles.barButton} disabled={!chosen}>
              {t('board.put')}
            </button>
          </div>
          {matches.length > 0 ? (
            <div id={`${id}-pages`} role="listbox" aria-label={t('board.suggestions')} className={styles.suggestions}>
              {matches.map((row) => (
                <div
                  key={row.id}
                  id={`${id}-${row.id}`}
                  role="option"
                  aria-selected={row === chosen}
                  tabIndex={-1}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    put(row)
                  }}
                >
                  {row.title}
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.noMatch}>{t('board.noMatch')}</p>
          )}
        </form>
      )}
    </div>
  )
}

/**
 * El marco de la pizarra: su barra encima (lo de Crisol) y el lienzo debajo, hasta el final de la ventana; ampliada,
 * todo lo de al lado de la barra de la app (como el mapa), con la página de detrás inalcanzable
 */
export function BoardFrame({
  page,
  tab,
  offline = false,
  loading = false,
  saved = false,
  empty = false,
  notice = null,
  summary = null,
  hidden = null,
  onHidden,
  onAddPage,
  onDropPage,
  onCanvasResize,
  canvasRef,
  dock,
  children
}: {
  page: Page
  tab: PageTabView
  offline?: boolean
  loading?: boolean
  /** Ya se ha guardado algo: «Guardado» */
  saved?: boolean
  /** Sin nada: una línea en el centro con cómo empezar */
  empty?: boolean
  /** Un aviso (una imagen que no se pudo subir) */
  notice?: string | null
  /** Lo que hay, en una lista legible: en lo estrecho va en vez del lienzo (que sale al ampliar) */
  summary?: ReactNode
  /** Lo elegido: si va oculto a los jugadores (null: nada elegido o no se puede) */
  hidden?: boolean | null
  onHidden?: (hidden: boolean) => void
  onAddPage?: (pageId: string, title: string) => void
  /** Una página soltada encima: true si la ha puesto */
  onDropPage?: (event: DragEvent<HTMLDivElement>) => boolean
  /** El lienzo ha cambiado de tamaño o de sitio (la barra de encima crece al llegar el título): Excalidraw, al día */
  onCanvasResize?: () => void
  /** El lienzo, para quien lo necesite fuera (las herramientas de abajo) */
  canvasRef?: RefObject<HTMLDivElement | null>
  /**
   * En el mundo a pantalla completa, las herramientas pegadas abajo de lo que se ve (board-dock.tsx); sin «Ampliar»:
   * la pizarra ya va a sangre (Enrique, 2026-11-16, como en Everlore)
   */
  dock?: ReactNode
  children: ReactNode
}) {
  const { t } = useTranslation()
  const [wide, setWide] = useState(false)
  // Al ampliar o volver, el botón se monta en otro sitio (el portal): el foco vuelve a él
  const wideButton = useRef<HTMLButtonElement>(null)
  const wideToggled = useRef(false)
  useEffect(() => {
    if (!wideToggled.current) return
    wideToggled.current = false
    wideButton.current?.focus()
  }, [wide])
  const toggleWide = (next: boolean) => {
    wideToggled.current = true
    setWide(next)
  }
  const wrapper = useRef<HTMLDivElement>(null)
  // En el mundo a pantalla completa, sus herramientas van en la tira de la página (a la derecha de sus pestañas, como
  // las de cualquier pestaña); ampliada, en su propia barra
  const slot = useContext(TabToolsSlot)
  // Si el lienzo cambia de tamaño o baja (la barra crece), Excalidraw recalcula dónde está: si no, sus tarjetas, que
  // solo pinta a la vista, no salían hasta mover algo
  const ownCanvas = useRef<HTMLDivElement>(null)
  const canvas = canvasRef ?? ownCanvas
  const resized = useRef(onCanvasResize)
  resized.current = onCanvasResize
  // El botón de su menú no lleva nombre: se le pone (y si Excalidraw lo vuelve a pintar, otra vez)
  const menuName = t('board.menu')
  useEffect(() => {
    const element = canvas.current
    if (!element || typeof MutationObserver === 'undefined') return
    const name = () => {
      for (const button of element.querySelectorAll('.main-menu-trigger:not([aria-label])')) {
        button.setAttribute('aria-label', menuName)
        button.setAttribute('title', menuName)
      }
    }
    name()
    const observer = new MutationObserver(name)
    observer.observe(element, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [menuName])
  useEffect(() => {
    const element = canvas.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => resized.current?.())
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Hasta el final de la ventana desde donde empieza
  useEffect(() => {
    const element = wrapper.current
    if (!element || wide) return
    const place = () => {
      const top = element.getBoundingClientRect().top + window.scrollY
      element.style.setProperty('--board-top', `${Math.max(0, top)}px`)
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [wide])

  // Ampliada, lo de detrás no se alcanza
  useEffect(() => {
    const root = document.getElementById('root')
    if (!wide || !root) return
    root.setAttribute('inert', '')
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !(event.target instanceof Element && event.target.closest('.excalidraw'))) {
        toggleWide(false)
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => {
      root.removeAttribute('inert')
      window.removeEventListener('keydown', onEscape)
    }
  }, [wide])

  const tools = (
    <>
      {onAddPage && <AddPage worldId={page.worldId} onAdd={onAddPage} />}
      {/* Siempre en su sitio (sin nada elegido, apagado): si apareciera al elegir, la barra saltaría */}
      {onHidden && (
        <button
          type="button"
          className={`${styles.barButton} ${styles.hiddenToggle}`}
          aria-pressed={hidden === true}
          disabled={hidden === null}
          aria-label={t('board.hidden')}
          title={t('board.hidden')}
          onClick={() => hidden !== null && onHidden(!hidden)}
        >
          <EyeOff aria-hidden="true" size={16} />
        </button>
      )}
      <span className={styles.status} role="status" data-alert={notice ? '' : undefined}>
        {loading
          ? t('board.loading')
          : offline
            ? t('board.offline')
            : (notice ?? (saved && onAddPage ? t('board.saved') : ''))}
      </span>
      {!dock && (
        <button
          ref={wideButton}
          type="button"
          className={styles.barButton}
          aria-pressed={wide}
          aria-label={t(wide ? 'board.shrink' : 'board.expand')}
          title={t(wide ? 'board.shrink' : 'board.expand')}
          onClick={() => toggleWide(!wide)}
        >
          {wide ? <Shrink aria-hidden="true" size={16} /> : <Expand aria-hidden="true" size={16} />}
        </button>
      )}
    </>
  )
  const inSlot = Boolean(slot) && !wide
  const content = (
    <section
      ref={wrapper}
      className={styles.wrapper}
      data-wide={wide || undefined}
      aria-label={tabRegionLabel(t, 'board', tab.name)}
    >
      {inSlot && slot ? (
        createPortal(<div className={styles.slotTools}>{tools}</div>, slot)
      ) : (
        <div className={styles.bar}>{tools}</div>
      )}
      {summary && !wide && <div className={styles.summary}>{summary}</div>}
      <div
        ref={canvas}
        className={styles.canvas}
        data-readonly={onAddPage ? undefined : ''}
        data-docked={dock ? '' : undefined}
        data-has-summary={summary && !wide ? '' : undefined}
        onDragOverCapture={(event) => {
          if (onDropPage && event.dataTransfer.types.includes(PAGE_DRAG)) {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
          }
        }}
        onDropCapture={(event) => {
          if (onDropPage && event.dataTransfer.types.includes(PAGE_DRAG) && onDropPage(event)) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
      >
        {children}
        {empty && <p className={styles.empty}>{t('board.empty')}</p>}
      </div>
      {dock}
    </section>
  )
  return wide ? createPortal(content, document.body) : content
}
