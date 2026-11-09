import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate, useParams, useSearch } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { PlayerHome } from '../campaign/player-home.tsx'
import { Loading } from '../components/brand.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Mesa } from '../tabletop/mesa.tsx'

const route = getRouteApi('/mundos/$worldId/campanas/$campaignId')

/** Una campaña: el máster, en su Mesa; quien juega, en la ficha de su personaje */
export function CampaignPage() {
  const { t } = useTranslation()
  const { worldId, campaignId } = route.useParams()
  const api = useApi()
  const { account, pending } = useAccounts().useAccount()
  const worlds = useQuery({
    queryKey: ['worlds'],
    queryFn: () => api.call('listWorlds', {}),
    enabled: Boolean(account)
  })
  const world = worlds.data?.worlds.find((w) => w.id === worldId)
  const campaigns = useQuery({
    queryKey: ['campaigns', worldId],
    queryFn: () => api.call('listCampaigns', { worldId }),
    enabled: Boolean(world)
  })
  const campaign = campaigns.data?.campaigns.find((c) => c.id === campaignId)

  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  // Sin las listas no se sabe si existe: mientras llegan, la carga; si fallan, el error (no «no existe»)
  if (!worlds.data)
    return failed(worlds) ? <LoadError error={worlds.error} onRetry={() => worlds.refetch()} /> : <Loading />
  if (world && !campaigns.data) {
    return failed(campaigns) ? <LoadError error={campaigns.error} onRetry={() => campaigns.refetch()} /> : <Loading />
  }
  if (!world || !campaign) {
    return (
      <section>
        <PageTitle>{t('campaign.notFound')}</PageTitle>
        <Link to="/mundos">{t('worlds.title')}</Link>
      </section>
    )
  }

  // El máster abre la campaña en la Mesa, como en Foundry VTT (docs/diseno.md)
  if (campaign.role === 'master')
    return <Mesa key={campaign.id} worldId={worldId} worldName={world.name} campaign={campaign} />

  // Quien juega, en su ficha (la Mesa, a un clic)
  return <PlayerHome worldId={worldId} campaign={campaign} />
}

/**
 * Las vistas sueltas de antes (compendio, biblioteca, en juego, páginas): el máster las tiene en las pestañas de su
 * Mesa, así que su dirección le lleva a ella con la que toca; quien juega sigue viéndolas (hasta su Mesa)
 */
export function ToMesaIfMaster({ panel, children }: { panel: string; children: ReactNode }) {
  const { worldId, campaignId, pageId } = useParams({ strict: false }) as {
    worldId: string
    campaignId: string
    pageId?: string
  }
  const api = useApi()
  const campaigns = useQuery({
    queryKey: ['campaigns', worldId],
    queryFn: () => api.call('listCampaigns', { worldId })
  })
  const role = campaigns.data?.campaigns.find((c) => c.id === campaignId)?.role
  // «Ver como» un personaje (?como=) sigue siendo una vista del máster
  const viewingAs = Boolean((useSearch({ strict: false }) as { como?: string }).como)
  // Hasta saber quién es, nada (ni la vista vieja ni sus consultas)
  if (!campaigns.data && !failed(campaigns)) return null
  if (role === 'master' && !viewingAs)
    return (
      <Navigate
        to="/mundos/$worldId/campanas/$campaignId"
        params={{ worldId, campaignId }}
        // Una página: se abre en su ventana sobre la Mesa
        search={{ panel, ...(pageId ? { pagina: pageId } : {}) }}
        replace
      />
    )
  return children
}
