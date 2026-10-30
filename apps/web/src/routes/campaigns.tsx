import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate } from '@tanstack/react-router'
import { Swords } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { Loading } from '../components/brand.tsx'
import { useCardList } from '../components/card-transition.ts'
import { FormError } from '../components/field.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Tour } from '../components/tour.tsx'
import styles from './world-card.module.css'
import { CampaignCard, NewLook, useCampaignKind } from './world-card.tsx'

const route = getRouteApi('/mundos/$worldId/campanas')

/**
 * Las campañas de un mundo, en tarjetas como las de Mis mundos (todas para su máster; las suyas para un jugador), y
 * tras la última, «Nueva campaña»
 */
export function CampaignsPage() {
  const { t } = useTranslation()
  const { worldId } = route.useParams()
  const api = useApi()
  const errorText = useErrorText()
  const kind = useCampaignKind(worldId)
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
  const cards = useCardList(kind.list, campaigns.data?.campaigns)

  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  if (!worlds.data)
    return failed(worlds) ? <LoadError error={worlds.error} onRetry={() => worlds.refetch()} /> : <Loading />
  if (!world) {
    return (
      <section>
        <PageTitle>{t('world.notFound')}</PageTitle>
        <Link to="/mundos">{t('worlds.title')}</Link>
      </section>
    )
  }
  const master = world.role === 'master'

  return (
    <section className={styles.page}>
      <div className={styles.top}>
        <PageTitle>{t('campaigns.title')}</PageTitle>
      </div>
      <FormError message={failed(campaigns) ? errorText(campaigns.error) : null} />
      {!campaigns.data && !failed(campaigns) && <Loading />}
      {campaigns.data &&
        (cards.length === 0 ? (
          // Sin campañas: qué es una y el botón grande para crear la primera
          <div className={styles.empty}>
            <Swords aria-hidden="true" size={44} strokeWidth={1.25} />
            <h2>{t('campaigns.empty')}</h2>
            {master && (
              <>
                <p>{t('campaigns.emptyHint')}</p>
                <NewLook kind={kind} big tour="nueva-campana" />
              </>
            )}
          </div>
        ) : (
          <ul className={styles.list} aria-label={t('campaigns.listLabel')} data-card-list>
            {cards.map(({ item, fresh, burning, burnt }) => (
              <CampaignCard
                key={item.id}
                worldId={worldId}
                campaign={item}
                fresh={fresh}
                burning={burning}
                onBurnt={burnt}
              />
            ))}
            {/* Tras la última, el recuadro vacío para crear otra */}
            {master && <NewLook kind={kind} tour="nueva-campana" />}
          </ul>
        ))}
      {master && campaigns.data && (
        <Tour id="campanas" steps={[{ target: '[data-tour="nueva-campana"]', text: t('tour.campaigns.create') }]} />
      )}
    </section>
  )
}
