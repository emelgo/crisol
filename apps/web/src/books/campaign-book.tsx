/**
 * Un libro de la campaña, para leer sus capítulos (ADR-0025): el máster y quien juega, también en el móvil (sin los
 * secretos, a quien no dirige). «Entradas» lleva al compendio de la campaña con ese libro; «← Compendio», arriba, vuelve
 */
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { Loading } from '../components/brand.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { SECTION } from '../components/world-transition.ts'
import { WithCampaign } from '../routes/campaign.tsx'
import systemStyles from '../systems/system.module.css'
import { BookTabs } from './book-tabs.tsx'
import { BookReader } from './reader.tsx'

const route = getRouteApi('/mundos/$worldId/campanas/$campaignId/libros/$bookKey')

export function CampaignBookScreen() {
  return (
    <WithCampaign>
      {({ worldId, campaign }) => <CampaignBook worldId={worldId} campaignId={campaign.id} />}
    </WithCampaign>
  )
}

function CampaignBook({ worldId, campaignId }: { worldId: string; campaignId: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const { bookKey } = route.useParams()
  const { capitulo } = route.useSearch()
  const navigate = route.useNavigate()
  // Sus libros, los de su compendio (lo que quien juega puede leer)
  const compendium = useQuery({
    queryKey: ['compendium', campaignId],
    queryFn: () => api.call('getCampaignCompendium', { campaignId })
  })
  if (!compendium.data) {
    return failed(compendium) ? (
      <LoadError error={compendium.error} onRetry={() => compendium.refetch()} />
    ) : (
      <Loading />
    )
  }
  const book = compendium.data.sources.find((s) => s.key === bookKey)
  const system = compendium.data.system
  const params = { worldId, campaignId }
  if (!book || !system) {
    return (
      <section className={systemStyles.bookPage}>
        <PageTitle>{t('compendium.title')}</PageTitle>
        <p>{t('chapters.empty')}</p>
      </section>
    )
  }
  return (
    <div className={systemStyles.bookPage}>
      <Link
        to="/mundos/$worldId/campanas/$campaignId/compendio"
        params={params}
        className={systemStyles.back}
        viewTransition={SECTION}
      >
        <ArrowLeft aria-hidden="true" size={16} />
        {t('chapters.backToCompendium')}
      </Link>
      <BookReader
        key={bookKey}
        systemId={system.id}
        source={bookKey}
        campaignId={campaignId}
        worldId={worldId}
        chapterId={capitulo ?? null}
        onChapter={(id) => void navigate({ search: { ...(id ? { capitulo: id } : {}) } })}
        chapterHref={(id) => `/mundos/${worldId}/campanas/${campaignId}/libros/${bookKey}?capitulo=${id}`}
        head={
          <>
            <PageTitle>{book.name}</PageTitle>
            <BookTabs
              current="capitulos"
              chapters={{ to: '/mundos/$worldId/campanas/$campaignId/libros/$bookKey', params: { ...params, bookKey } }}
              entries={{
                to: '/mundos/$worldId/campanas/$campaignId/compendio',
                params,
                search: { libro: bookKey }
              }}
            />
          </>
        }
      />
    </div>
  )
}
