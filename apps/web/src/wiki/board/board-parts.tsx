/**
 * Lo de la pizarra que no es Excalidraw (módulo 9, docs/specs/pizarra.md): el marco con su barra («Página…», «Oculto
 * para los jugadores», ampliar), la tarjeta de una página y las imágenes de los archivos del mundo. Solo tipos de
 * Excalidraw: el árbol importa de aquí lo que arrastra sin cargar el editor
 */

import type { Page, PageTabView } from '@crisol/contracts'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { useQuery } from '@tanstack/react-query'
import { Expand, FilePlus2, Shrink } from 'lucide-react'
import { type DragEvent, type ReactNode, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../api/context.tsx'
import { Icon } from '../../components/icon.tsx'
import { PageLink, readAsInput, readAsKey, useReadAs } from '../read-as.tsx'
import { BoardHeadContext } from '../shell/context.ts'
import styles from './board.module.css'
import { PAGE_DRAG } from './drag.ts'

export { PAGE_DRAG }

/** El enlace de una tarjeta: la página en la wiki del mundo */
export const pageLink = (worldId: string, pageId: string) => `/mundos/${worldId}/wiki/${pageId}`

const PAGE_LINK = /\/mundos\/[0-9a-f-]{36}\/wiki\/([0-9a-f-]{36})$/i

/** La página de un enlace de tarjeta (o null si no es de una página) */
export const pageIdOfLink = (link: string | null | undefined) => (link ? (PAGE_LINK.exec(link)?.[1] ?? null) : null)

/** Las páginas que se ven del mundo (las del máster, todas; las de una jugadora, las que conoce), por su id */
function usePages(worldId: string) {
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
export function PageCard({ worldId, pageId, title }: { worldId: string; pageId: string; title?: unknown }) {
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
    <div className={styles.card}>
      {found?.icon && <Icon value={found.icon} size={22} className={styles.cardIcon} />}
      <PageLink worldId={worldId} pageId={pageId} className={styles.cardTitle}>
        {name}
      </PageLink>
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

/** «Página…»: el nombre de una del mundo (con sus sugerencias) y «Poner» */
function AddPage({ worldId, onAdd }: { worldId: string; onAdd: (pageId: string, title: string) => void }) {
  const { t } = useTranslation()
  const pages = usePages(worldId)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const id = useId()
  const button = useRef<HTMLButtonElement>(null)
  const close = () => {
    setOpen(false)
    setName('')
    button.current?.focus()
  }
  const found = pages.data?.pages.find(
    (row) => row.title.toLocaleLowerCase('es') === name.trim().toLocaleLowerCase('es')
  )
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
            if (!found) return
            onAdd(found.id, found.title)
            close()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              close()
            }
          }}
        >
          <label htmlFor={`${id}-name`}>{t('board.pageName')}</label>
          <input
            id={`${id}-name`}
            list={`${id}-pages`}
            value={name}
            autoComplete="off"
            // biome-ignore lint/a11y/noAutofocus: se abre para escribir el nombre
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
          <datalist id={`${id}-pages`}>
            {pages.data?.pages.map((row) => (
              <option key={row.id} value={row.title} />
            ))}
          </datalist>
          <button type="submit" className={styles.barButton} disabled={!found}>
            {t('board.put')}
          </button>
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
  hidden = null,
  onHidden,
  onAddPage,
  onDropPage,
  children
}: {
  page: Page
  tab: PageTabView
  offline?: boolean
  loading?: boolean
  /** Lo elegido: si va oculto a los jugadores (null: nada elegido o no se puede) */
  hidden?: boolean | null
  onHidden?: (hidden: boolean) => void
  onAddPage?: (pageId: string, title: string) => void
  /** Una página soltada encima: true si la ha puesto */
  onDropPage?: (event: DragEvent<HTMLDivElement>) => boolean
  children: ReactNode
}) {
  const { t } = useTranslation()
  const [wide, setWide] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const hiddenId = useId()
  // En el mundo a pantalla completa, el título y las pestañas de la página van en esta barra (ADR-0027)
  const head = useContext(BoardHeadContext)

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
        setWide(false)
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => {
      root.removeAttribute('inert')
      window.removeEventListener('keydown', onEscape)
    }
  }, [wide])

  const content = (
    <section
      ref={wrapper}
      className={styles.wrapper}
      data-wide={wide || undefined}
      aria-label={t('board.label', { name: tab.name })}
    >
      <div className={styles.bar}>
        {head}
        {onAddPage && <AddPage worldId={page.worldId} onAdd={onAddPage} />}
        {onHidden && hidden !== null && (
          <label className={styles.hiddenToggle} htmlFor={hiddenId}>
            <input
              id={hiddenId}
              type="checkbox"
              checked={hidden}
              onChange={(event) => onHidden(event.target.checked)}
            />
            {t('board.hidden')}
          </label>
        )}
        <span className={styles.status} role="status">
          {loading ? t('board.loading') : offline ? t('board.offline') : ''}
        </span>
        <button
          type="button"
          className={styles.barButton}
          aria-pressed={wide}
          aria-label={t(wide ? 'board.shrink' : 'board.expand')}
          title={t(wide ? 'board.shrink' : 'board.expand')}
          onClick={() => setWide(!wide)}
        >
          {wide ? <Shrink aria-hidden="true" size={16} /> : <Expand aria-hidden="true" size={16} />}
        </button>
      </div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: soltar una página del árbol (con el teclado, «Página…») */}
      <div
        className={styles.canvas}
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
      </div>
    </section>
  )
  return wide ? createPortal(content, document.body) : content
}
