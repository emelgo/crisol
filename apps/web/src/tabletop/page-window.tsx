/**
 * Las páginas del mundo en ventanas sobre la Mesa (docs/diseno.md: «sin cambiar de vista»): la página entera, con su
 * cabecera, sus pestañas y su panel, la misma que en la wiki. Los enlaces de dentro abren otra ventana
 */
import type { Page } from '@crisol/contracts'
import { useMutation, useQuery } from '@tanstack/react-query'
import { type ReactNode, useLayoutEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useCurrentCampaign } from '../campaign/current-campaign.ts'
import { failed, LoadError } from '../components/load-error.tsx'
import { type LinkHandler, useWindows, type WindowSpec } from '../components/windows.tsx'
import { CollabSocket } from '../wiki/collab.tsx'
import { usePageTabs } from '../wiki/tabs/page-tabs.tsx'
import { EntryView, pageKey } from '../wiki/wiki.tsx'
import styles from './page-window.module.css'
import { ShowMenu, type ShowTarget } from './show-menu.tsx'

/** Una página del mundo, en su ventana (una por página); con tabId, en esa pestaña (sin él, en su texto) */
export function pageWindow(worldId: string, pageId: string, title: string, tabId: string | null = null): WindowSpec {
  return {
    id: `page:${pageId}`,
    title,
    // Ancha: el texto de la hoja se escala a su columna, como al imprimir
    width: 980,
    height: 680,
    render: () => <PageWindow worldId={worldId} pageId={pageId} tabId={tabId} />,
    actions: () => <ShowToPlayers worldId={worldId} pageId={pageId} />
  }
}

const PAGE_PATH = /^\/mundos\/([0-9a-f-]{36})\/wiki\/([0-9a-f-]{36})\/?$/

/**
 * Un enlace a una página del mundo, dentro de una ventana: a otra ventana. Con ?pestana=, en esa pestaña: las de la
 * propia página se cambian así, dentro de su ventana
 */
export const openPageLinks: LinkHandler = (url, text, open) => {
  const match = PAGE_PATH.exec(url.pathname)
  if (!match?.[1] || !match[2]) return false
  open(pageWindow(match[1], match[2], text || '…', url.searchParams.get('pestana')))
  return true
}

function PageWindow({ worldId, pageId, tabId }: { worldId: string; pageId: string; tabId: string | null }) {
  const { t } = useTranslation()
  const api = useApi()
  const page = useQuery({ queryKey: pageKey(worldId, pageId), queryFn: () => api.call('getPage', { pageId }) })
  if (page.error instanceof ApiError && page.error.status === 404)
    return <p className={styles.missing}>{t('wiki.pageNotFound')}</p>
  if (!page.data) return failed(page) ? <LoadError error={page.error} onRetry={() => page.refetch()} /> : null
  return <Opened page={page.data} tabId={tabId} />
}

function Opened({ page, tabId }: { page: Page; tabId: string | null }) {
  const tabs = usePageTabs(page)
  // Una pestaña que ya no está: su texto
  const active = (tabId && tabs.data?.find((tab) => tab.id === tabId)) || null
  // El título de la ventana, el de la página (abierta por su id, renombrada o desde una pestaña, que trae su nombre)
  const windows = useWindows()
  const rename = windows?.rename
  const shown = windows?.windows.find((w) => w.id === `page:${page.id}`)?.title
  useLayoutEffect(() => {
    if (shown !== page.title) rename?.(`page:${page.id}`, page.title)
  }, [rename, page.id, page.title, shown])
  return (
    <div className={styles.page} data-in-window="">
      <EntryView key={page.id} page={page} tabs={tabs.data ?? []} active={active} />
    </div>
  )
}

/** El WebSocket de la edición en vivo, mientras haya alguna página abierta en ventana (uno para todas) */
export function PageWindowsSocket({ children }: { children: ReactNode }) {
  const pages = useWindows()?.windows.some((w) => w.id.startsWith('page:')) ?? false
  // Siempre el mismo árbol: cambiarlo volvería a montar todas las ventanas (y perderían lo que tenían)
  return <CollabSocket enabled={pages}>{children}</CollabSocket>
}

/**
 * «Enseñar a los jugadores» (como el diario en la mesa): se la abre a los de la campaña que estén conectados y la
 * conozcan. Si alguno no la conoce, lo dice y deja revelársela y enseñarla. Solo el máster, desde su Mesa
 */
function ShowToPlayers({ worldId, pageId }: { worldId: string; pageId: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const campaignId = useCurrentCampaign()
  const campaigns = useQuery({
    queryKey: ['campaigns', worldId],
    queryFn: () => api.call('listCampaigns', { worldId }),
    enabled: Boolean(campaignId)
  })
  const master = campaigns.data?.campaigns.find((c) => c.id === campaignId)?.role === 'master'
  const [result, setResult] = useState<{ shown: number; unknown: number } | null>(null)
  const [target, setTarget] = useState<ShowTarget>({})
  const show = useMutation({
    mutationFn: async ({ alsoReveal, to }: { alsoReveal: boolean; to: ShowTarget }) => {
      if (!campaignId) throw new Error('sin campaña')
      if (alsoReveal) await api.call('reveal', { worldId, campaignId, kind: 'page', targetId: pageId })
      setTarget(to)
      return api.call('showPage', { campaignId, pageId, ...to })
    },
    onSuccess: setResult
  })
  if (!campaignId || !master) return null
  const error = show.error ? errorText(show.error) : null
  return (
    <span className={styles.show}>
      {result && result.shown > 0 ? (
        <button
          type="button"
          className={styles.showing}
          data-showing=""
          title={t('pageWindow.showAgain')}
          disabled={show.isPending}
          onClick={() => show.mutate({ alsoReveal: false, to: target })}
        >
          <i aria-hidden="true" />
          {t('pageWindow.showing', { count: result.shown })}
        </button>
      ) : (
        <ShowMenu
          campaignId={campaignId}
          busy={show.isPending}
          className={styles.showButton}
          label={t('pageWindow.show')}
          onShow={(to) => show.mutate({ alsoReveal: false, to })}
        />
      )}
      {result && result.unknown > 0 && (
        <button
          type="button"
          className={styles.revealToo}
          disabled={show.isPending}
          onClick={() => show.mutate({ alsoReveal: true, to: target })}
        >
          {t('pageWindow.revealToo', { count: result.unknown })}
        </button>
      )}
      {error && (
        <span role="alert" className={styles.error}>
          {error}
        </span>
      )}
    </span>
  )
}
