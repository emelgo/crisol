import type { Campaign } from '@crisol/contracts'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate, useParams, useSearch } from '@tanstack/react-router'
import { type ReactNode, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { CampaignBooks } from '../campaign/books.tsx'
import { CampaignHome, PlayerCampaignHome } from '../campaign/home.tsx'
import { Loading } from '../components/brand.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Screen } from '../components/screen.tsx'
import { useWindow } from '../components/window.tsx'

const route = getRouteApi('/mundos/$worldId/campanas/$campaignId')

/**
 * La campaña de la dirección, con su mundo: mientras llegan, la carga; si fallan, el error; si no existe, lo dice. Con
 * ella, lo que se pinte
 */
export function WithCampaign({
  children
}: {
  children: (found: { worldId: string; worldName: string; campaign: Campaign }) => ReactNode
}) {
  const { t } = useTranslation()
  const { worldId, campaignId } = useParams({ strict: false }) as { worldId: string; campaignId: string }
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
  if (!worlds.data)
    return failed(worlds) ? <LoadError error={worlds.error} onRetry={() => worlds.refetch()} /> : <Loading />
  if (world && !campaigns.data)
    return failed(campaigns) ? <LoadError error={campaigns.error} onRetry={() => campaigns.refetch()} /> : <Loading />
  if (!world || !campaign)
    return (
      <section>
        <PageTitle>{t('campaign.notFound')}</PageTitle>
        <Link to="/mundos">{t('worlds.title')}</Link>
      </section>
    )
  return children({ worldId, worldName: world.name, campaign })
}

/**
 * Una campaña abre en su Inicio, con su barra (ADR-0021). Lo de la Mesa en su dirección (los enlaces de antes:
 * ?panel=, ?pagina=, ?entrada=) lleva a la Mesa con eso
 */
export function CampaignPage() {
  const { worldId, campaignId } = route.useParams()
  const search = route.useSearch()
  // Los ajustes de la campaña ya no son una pestaña de la Mesa (Enrique, 2026-11-10): se abren encima, en su Inicio
  const settings = search.panel === 'ajustes' && !search.pagina && !search.entrada
  if (!settings && (search.panel || search.pagina || search.entrada))
    return (
      <Navigate
        to="/mundos/$worldId/campanas/$campaignId/mesa"
        params={{ worldId, campaignId }}
        search={search}
        replace
      />
    )
  return (
    <WithCampaign>
      {({ worldName, campaign }) =>
        campaign.role === 'master' ? (
          <>
            <CampaignHome key={campaign.id} worldId={worldId} worldName={worldName} campaign={campaign} />
            {settings && <OpenSettings />}
          </>
        ) : (
          <PlayerCampaignHome key={campaign.id} worldId={worldId} worldName={worldName} campaign={campaign} />
        )
      }
    </WithCampaign>
  )
}

/** Libros: los de la campaña, solo del máster (quien juega, a su Inicio) */
export function CampaignBooksScreen() {
  return (
    <WithCampaign>
      {({ worldId, worldName, campaign }) =>
        campaign.role === 'master' ? (
          <CampaignBooks key={campaign.id} worldId={worldId} worldName={worldName} campaign={campaign} />
        ) : (
          <Navigate to="/mundos/$worldId/campanas/$campaignId" params={{ worldId, campaignId: campaign.id }} replace />
        )
      }
    </WithCampaign>
  )
}

/** Aventuras: su pantalla llega con su propio lienzo */
export function AdventuresScreen() {
  const { t } = useTranslation()
  return (
    <WithCampaign>
      {() => (
        <Screen title={t('adventures.title')}>
          <p>{t('adventures.soon')}</p>
        </Screen>
      )}
    </WithCampaign>
  )
}

/**
 * Las vistas sueltas de antes que el máster tiene en las pestañas de su Mesa (en juego, biblioteca): su dirección le
 * lleva a ella con la que toca; quien juega sigue viéndolas
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
  const search = useSearch({ strict: false }) as { como?: string; ver?: string }
  const viewingAs = Boolean(search.como)
  // Hasta saber quién es, nada (ni la vista vieja ni sus consultas)
  if (!campaigns.data && !failed(campaigns)) return null
  if (role === 'master' && !viewingAs)
    return (
      <Navigate
        to="/mundos/$worldId/campanas/$campaignId/mesa"
        params={{ worldId, campaignId }}
        search={{ panel, ...(pageId ? { pagina: pageId } : {}), ...(search.ver ? { entrada: search.ver } : {}) }}
        replace
      />
    )
  return children
}

/** Con ?panel=ajustes (los enlaces de antes a la pestaña de la Mesa), abre los ajustes de la campaña encima */
function OpenSettings() {
  const windows = useWindow()
  const open = windows?.open
  useEffect(() => {
    open?.('campana')
  }, [open])
  return null
}
