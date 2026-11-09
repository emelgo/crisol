import type { Campaign } from '@crisol/contracts'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate, useParams, useSearch } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { MembersPanel } from '../campaign/settings.tsx'
import { Loading } from '../components/brand.tsx'
import styles from '../components/list.module.css'
import { failed, LoadError, SectionError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import screen from '../components/screen.module.css'
import { Screen } from '../components/screen.tsx'
import { Tour } from '../components/tour.tsx'
import { worldTransition } from '../components/world-transition.ts'
import { Mesa } from '../tabletop/mesa.tsx'
import { coverStyle } from '../wiki/cover-look.ts'

const route = getRouteApi('/mundos/$worldId/campanas/$campaignId')

/** Una campaña: el máster, en su Mesa; quien juega, quién está en ella (hasta que abra en su ficha) */
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

  return (
    <Screen title={campaign.name}>
      {/* Su portada (la de su tarjeta), como franja bajo el título: el título no se mueve */}
      {campaign.cover && (
        <div className={screen.cover} style={worldTransition(campaign.id)}>
          <img src={`/api/files/${campaign.cover.fileId}`} alt="" style={coverStyle(campaign.cover)} />
        </div>
      )}
      <CharactersPanel campaign={campaign} />
      <MembersPanel campaign={campaign} />
      <Tour
        id="campana"
        // Un paso por cada botón de la barra de la campaña
        steps={[
          // En el móvil no hay barra: el paso señala la campaña en la página
          {
            target: '[data-tour="barra-campana"], [data-tour="campana-miembros"]',
            text: t('tour.campaign.home'),
            placement: 'right'
          },
          { target: '[data-tour="barra-paginas"]', text: t('tour.campaign.pages'), placement: 'right' },
          { target: '[data-tour="barra-personajes"]', text: t('tour.campaign.characters'), placement: 'right' },
          { target: '[data-tour="barra-compendio"]', text: t('tour.campaign.compendium'), placement: 'right' },
          { target: '[data-tour="barra-grupo"]', text: t('tour.campaign.party'), placement: 'right' },
          { target: '[data-tour="dados"]', text: t('tour.world.dice'), placement: 'top' },
          { target: '[data-tour="barra-llama"]', text: t('tour.world.back'), placement: 'right' },
          { target: '[data-tour="menu-movil"]', text: t('tour.menu') }
        ]}
      />
    </Screen>
  )
}

/**
 * Los personajes de la campaña: los tuyos (o todos, el máster), que se abren, y los de tus aliados, que se ven pero no
 * se abren (Enrique, 2026-11-08: «puede ver a sus aliados aunque no pueda entrar en ellos»)
 */
function CharactersPanel({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation()
  const api = useApi()
  const characters = useQuery({
    queryKey: ['characters', campaign.id],
    queryFn: () => api.call('listCharacters', { campaignId: campaign.id }),
    enabled: Boolean(campaign.system)
  })
  if (!campaign.system) return null
  if (!characters.data)
    return failed(characters) ? <SectionError error={characters.error} onRetry={() => characters.refetch()} /> : null
  const own = characters.data.characters
  const allies = characters.data.allies ?? []
  if (own.length === 0 && allies.length === 0) return null
  const who = (owner: { name: string } | null, line?: string) => [line, owner?.name].filter(Boolean).join(' · ')
  return (
    <section aria-labelledby="personajes-campana">
      <h2 id="personajes-campana">{t('characters.title')}</h2>
      <ul className={styles.list} aria-labelledby="personajes-campana">
        {own.map((character) => (
          <li key={character.id} className={styles.item}>
            <Link
              to="/mundos/$worldId/campanas/$campaignId/personajes/$characterId"
              params={{ worldId: campaign.worldId, campaignId: campaign.id, characterId: character.id }}
              className={`${styles.name} ${styles.entity} ${styles.opens}`}
            >
              {character.name}
            </Link>
            <span className={styles.role}>{who(character.owner, character.summary.line)}</span>
          </li>
        ))}
        {allies.map((ally) => (
          <li key={ally.id} className={styles.item}>
            <span className={`${styles.name} ${styles.entity}`}>{ally.name}</span>
            <span className={styles.role}>{who(ally.owner, ally.line)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Las vistas sueltas de antes (compendio, biblioteca, en juego, páginas): el máster las tiene en las pestañas de su
 * Mesa, así que su dirección le lleva a ella con la que toca; quien juega sigue viéndolas (hasta su Mesa)
 */
export function ToMesaIfMaster({ panel, children }: { panel: string; children: ReactNode }) {
  const { worldId, campaignId } = useParams({ strict: false }) as { worldId: string; campaignId: string }
  const api = useApi()
  const campaigns = useQuery({
    queryKey: ['campaigns', worldId],
    queryFn: () => api.call('listCampaigns', { worldId })
  })
  const role = campaigns.data?.campaigns.find((c) => c.id === campaignId)?.role
  // «Ver como» un personaje (?como=) sigue siendo una vista del máster
  const viewingAs = Boolean((useSearch({ strict: false }) as { como?: string }).como)
  if (role === 'master' && !viewingAs)
    return (
      <Navigate
        to="/mundos/$worldId/campanas/$campaignId"
        params={{ worldId, campaignId }}
        search={{ panel }}
        replace
      />
    )
  return children
}
