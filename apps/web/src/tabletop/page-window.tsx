/**
 * Las páginas del mundo en ventanas sobre la Mesa (docs/diseno.md: «sin cambiar de vista»): la página entera, con su
 * cabecera, sus pestañas y su panel, la misma que en la wiki. Los enlaces de dentro abren otra ventana
 */
import type { Page } from '@crisol/contracts'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { CollabSocket } from '../wiki/collab.tsx'
import { usePageTabs } from '../wiki/tabs/page-tabs.tsx'
import { EntryView, pageKey } from '../wiki/wiki.tsx'
import styles from './page-window.module.css'
import { type LinkHandler, useWindows, type WindowSpec } from './windows.tsx'

/** Una página del mundo, en su ventana (una por página) */
export function pageWindow(worldId: string, pageId: string, title: string): WindowSpec {
  return {
    id: `page:${pageId}`,
    title,
    // Ancha: el texto de la hoja se escala a su columna, como al imprimir
    width: 980,
    height: 680,
    render: () => <PageWindow worldId={worldId} pageId={pageId} />
  }
}

const PAGE_PATH = /^\/mundos\/([0-9a-f-]{36})\/wiki\/([0-9a-f-]{36})\/?$/

/** Un enlace a una página del mundo, dentro de una ventana: a otra ventana */
export const openPageLinks: LinkHandler = (url, text, open) => {
  const match = PAGE_PATH.exec(url.pathname)
  if (!match?.[1] || !match[2]) return false
  open(pageWindow(match[1], match[2], text || '…'))
  return true
}

function PageWindow({ worldId, pageId }: { worldId: string; pageId: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const page = useQuery({ queryKey: pageKey(worldId, pageId), queryFn: () => api.call('getPage', { pageId }) })
  if (page.error instanceof ApiError && page.error.status === 404)
    return <p className={styles.missing}>{t('wiki.pageNotFound')}</p>
  if (!page.data) return failed(page) ? <LoadError error={page.error} onRetry={() => page.refetch()} /> : null
  return <Opened page={page.data} />
}

function Opened({ page }: { page: Page }) {
  const tabs = usePageTabs(page)
  return (
    <div className={styles.page} data-in-window="">
      <EntryView key={page.id} page={page} tabs={tabs.data ?? []} />
    </div>
  )
}

/** El WebSocket de la edición en vivo, mientras haya alguna página abierta en ventana (uno para todas) */
export function PageWindowsSocket({ children }: { children: ReactNode }) {
  const pages = useWindows()?.windows.some((w) => w.id.startsWith('page:')) ?? false
  return pages ? <CollabSocket>{children}</CollabSocket> : children
}
