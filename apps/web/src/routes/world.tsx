import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { CreateForm } from '../components/create-form.tsx'
import styles from '../components/list.module.css'
import { RenamableItem } from '../components/renamable-item.tsx'

const route = getRouteApi('/mundos/$worldId')

/** Un mundo: sus campañas (todas para su máster; las suyas para un jugador) */
export function WorldPage() {
  const { t } = useTranslation()
  const { worldId } = route.useParams()
  const api = useApi()
  const queryClient = useQueryClient()
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
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['campaigns', worldId] })

  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  if (worlds.isPending) return null
  if (!world) {
    return (
      <section>
        <h1>{t('world.notFound')}</h1>
        <Link to="/mundos">{t('worlds.title')}</Link>
      </section>
    )
  }

  return (
    <section>
      <p>
        <Link to="/mundos">{t('worlds.title')}</Link>
      </p>
      <h1>{world.name}</h1>
      {world.role === 'master' && (
        <p>
          <Link to="/mundos/$worldId/historial" params={{ worldId }}>
            {t('history.title')}
          </Link>
          {' · '}
          <Link to="/mundos/$worldId/papelera" params={{ worldId }}>
            {t('trash.title')}
          </Link>
        </p>
      )}
      <h2>{t('campaigns.title')}</h2>
      {campaigns.data &&
        (campaigns.data.campaigns.length === 0 ? (
          <p>{t('campaigns.empty')}</p>
        ) : (
          <ul className={styles.list} aria-label={t('campaigns.listLabel')}>
            {campaigns.data.campaigns.map((campaign) => (
              <RenamableItem
                key={campaign.id}
                name={campaign.name}
                role={t(`roles.${campaign.role}`)}
                link={{ to: '/mundos/$worldId/campanas/$campaignId', params: { worldId, campaignId: campaign.id } }}
                {...(campaign.role === 'master'
                  ? {
                      onRename: (name: string) =>
                        api.call('renameCampaign', { campaignId: campaign.id, name }).then(refresh),
                      onDelete: () => api.call('deleteCampaign', { campaignId: campaign.id }).then(refresh)
                    }
                  : {})}
              />
            ))}
          </ul>
        ))}
      {world.role === 'master' && (
        <CreateForm
          title={t('campaigns.newTitle')}
          label={t('campaigns.name')}
          submit={t('campaigns.create')}
          onCreate={(name) => api.call('createCampaign', { worldId, name }).then(refresh)}
        />
      )}
    </section>
  )
}
