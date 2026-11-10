/**
 * Las páginas del mundo en ventanas sobre la Mesa (docs/diseno.md: «sin cambiar de vista»): la página entera, con su
 * cabecera, sus pestañas y su panel, la misma que en la wiki. Los enlaces de dentro abren otra ventana
 */
import type { Page } from '@crisol/contracts'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Eye } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useCurrentCampaign } from '../campaign/current-campaign.ts'
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
    render: () => <PageWindow worldId={worldId} pageId={pageId} />,
    actions: () => <ShowToPlayers worldId={worldId} pageId={pageId} />
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
  // El título de la ventana, el de la página (abierta por su id, o renombrada)
  const rename = useWindows()?.rename
  useEffect(() => rename?.(`page:${page.id}`, page.title), [rename, page.id, page.title])
  return (
    <div className={styles.page} data-in-window="">
      <EntryView key={page.id} page={page} tabs={tabs.data ?? []} />
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
  const show = useMutation({
    mutationFn: async (alsoReveal: boolean) => {
      if (!campaignId) throw new Error('sin campaña')
      if (alsoReveal) await api.call('reveal', { worldId, campaignId, kind: 'page', targetId: pageId })
      return api.call('showPage', { campaignId, pageId })
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
          onClick={() => show.mutate(false)}
        >
          <i aria-hidden="true" />
          {t('pageWindow.showing', { count: result.shown })}
        </button>
      ) : (
        <button
          type="button"
          className={styles.showButton}
          disabled={show.isPending}
          onClick={() => show.mutate(false)}
        >
          <Eye aria-hidden="true" size={15} />
          {t('pageWindow.show')}
        </button>
      )}
      {result && result.unknown > 0 && (
        <button type="button" className={styles.revealToo} disabled={show.isPending} onClick={() => show.mutate(true)}>
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
