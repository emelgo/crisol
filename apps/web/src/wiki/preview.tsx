/**
 * La vista previa de un enlace: el título, la ruta, el resumen o el principio (o la sección a la que va), con «Abrir».
 * Junto al enlace (con el ratón tras 300 ms, o con el teclado al elegirlo; Tab entra y Escape la cierra) o, en el
 * móvil, en una hoja abajo. Sale de la API, en caché hasta que el canal avise de un cambio
 */
import type { PageCover } from '@crisol/contracts'
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom'
import { useQuery } from '@tanstack/react-query'
import type { JSONContent } from '@tiptap/core'
import { type KeyboardEvent, type Ref, useEffect, useId, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { ContentView } from './content.tsx'
import { coverStyle } from './cover-look.ts'
import styles from './preview.module.css'
import { PageLink, readAsInput, readAsKey, useReadAs } from './read-as.tsx'

/** La consulta de lo de dentro de una página (cuelga de ['pages', mundo, 'content', página]: la vacía el canal) */
export const contentKey = (worldId: string, pageId: string, anchor: string | null, preview: boolean) => [
  'pages',
  worldId,
  'content',
  pageId,
  anchor,
  preview
]

export function usePageContent(
  worldId: string,
  pageId: string | null,
  anchor: string | null,
  preview: boolean,
  tabId?: string
) {
  const api = useApi()
  const readAs = useReadAs()
  return useQuery({
    queryKey: [...contentKey(worldId, pageId ?? '', anchor, preview), tabId ?? null, ...readAsKey(readAs)],
    queryFn: () =>
      api.call('getPageContent', {
        pageId: pageId ?? '',
        anchor,
        preview,
        ...(tabId ? { tabId } : {}),
        ...readAsInput(readAs)
      }),
    enabled: Boolean(pageId)
  })
}

interface PreviewProps {
  worldId: string
  pageId: string
  anchor: string | null
  /** Junto a qué va (no en el móvil) */
  anchorElement: HTMLElement | null
  sheet: boolean
  onClose: (returnFocus: boolean) => void
  /** El ratón entra o sale (para no cerrarla mientras se lee) */
  onHover?: (inside: boolean) => void
  ref?: Ref<HTMLDivElement>
}

export function LinkPreview({ worldId, pageId, anchor, anchorElement, sheet, onClose, onHover, ref }: PreviewProps) {
  const { t } = useTranslation()
  const id = useId()
  const box = useRef<HTMLDivElement | null>(null)
  const content = usePageContent(worldId, pageId, anchor, true)

  // Junto al enlace, y que no se salga de la pantalla
  useLayoutEffect(() => {
    const element = box.current
    if (sheet || !element || !anchorElement) return
    return autoUpdate(anchorElement, element, () => {
      void computePosition(anchorElement, element, {
        strategy: 'fixed',
        placement: 'bottom-start',
        middleware: [offset(6), flip(), shift({ padding: 8 })]
      }).then(({ x, y }) => Object.assign(element.style, { left: `${x}px`, top: `${y}px` }))
    })
  }, [anchorElement, sheet])

  // En el móvil, la hoja recibe el foco al abrirse
  useEffect(() => {
    if (sheet) box.current?.querySelector<HTMLElement>('a, button')?.focus()
  }, [sheet])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    onClose(true)
  }

  const page = content.data?.page
  const title = page?.title ?? ''
  const where =
    page && page.path.length > 1
      ? page.path
          .slice(0, -1)
          .map((p) => p.title)
          .join(' / ')
      : null
  const blocks = (content.data?.blocks ?? []) as JSONContent[]
  return createPortal(
    <div
      ref={(element) => {
        box.current = element
        if (typeof ref === 'function') ref(element)
        else if (ref) ref.current = element
      }}
      role="dialog"
      aria-labelledby={`${id}-title`}
      className={sheet ? styles.sheet : styles.popover}
      onKeyDown={onKeyDown}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      {page?.cover && <PreviewCover cover={page.cover} worldId={worldId} />}
      <div className={styles.header}>
        <p id={`${id}-title`} className={styles.title}>
          {page?.icon ? `${page.icon} ` : ''}
          {title || t('embed.loading')}
        </p>
        {where && <p className={styles.path}>{where}</p>}
      </div>
      {page?.summary && !anchor ? (
        <p className={styles.summary}>{page.summary}</p>
      ) : (
        <div className={styles.body}>
          <ContentView blocks={blocks} worldId={worldId} compact />
          {content.data?.truncated && <p className={styles.more}>{t('preview.more')}</p>}
        </div>
      )}
      <div className={styles.actions}>
        <PageLink worldId={worldId} pageId={pageId} className={styles.open} onClick={() => onClose(false)}>
          {t(sheet ? 'preview.openPage' : 'preview.open')}
        </PageLink>
        {sheet && (
          <button type="button" className={styles.close} onClick={() => onClose(true)}>
            {t('preview.close')}
          </button>
        )}
      </div>
    </div>,
    document.body
  )
}

/** La portada pequeña de la vista previa (si su archivo sigue en el mundo) */
function PreviewCover({ cover, worldId }: { cover: PageCover; worldId: string }) {
  const api = useApi()
  const files = useQuery({ queryKey: ['files', worldId], queryFn: () => api.call('listFiles', { worldId }) })
  const file = files.data?.files.find((f) => f.id === cover.fileId)
  if (!file) return null
  return (
    <div className={styles.coverFrame}>
      <img src={file.url} alt="" className={styles.cover} style={coverStyle(cover)} />
    </div>
  )
}
