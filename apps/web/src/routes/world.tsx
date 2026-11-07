import type { Page } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate, useNavigate } from '@tanstack/react-router'
import { type ReactNode, useEffect, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { Loading } from '../components/brand.tsx'
import { useCardList } from '../components/card-transition.ts'
import { failed, LoadError, SectionError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Tour } from '../components/tour.tsx'
import { LEAVE_WORLD, worldTransition } from '../components/world-transition.ts'
import { usePageTabs } from '../wiki/tabs/page-tabs.tsx'
import wiki from '../wiki/wiki.module.css'
import { EntryView, pageKey, WikiLayout } from '../wiki/wiki.tsx'
import styles from './world-card.module.css'
import { CampaignCard, LookHeader, useCampaignKind, useWorldKind, WorldBanner } from './world-card.tsx'

const route = getRouteApi('/mundos/$worldId')

/**
 * El Inicio de un mundo, su panel: su cabecera (en ella se convierte su tarjeta al entrar) y, para quien lo dirige,
 * los accesos rápidos, sus campañas y las últimas páginas, con el árbol al lado; para quien juega, sus campañas
 */
export function WorldPage() {
  const { t } = useTranslation()
  const { worldId } = route.useParams()
  const api = useApi()
  const navigate = useNavigate()
  const kind = useWorldKind()
  const { account, pending } = useAccounts().useAccount()
  const worlds = useQuery({
    queryKey: ['worlds'],
    queryFn: () => api.call('listWorlds', {}),
    enabled: Boolean(account)
  })
  const world = worlds.data?.worlds.find((w) => w.id === worldId)
  // En la pestaña del navegador, el mundo (su portada pone el suyo solo si se abre como página)
  useEffect(() => {
    if (world) document.title = t('app.pageTitle', { page: world.name })
  }, [world, t])

  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  // Sin la lista no se sabe si existe: mientras llega, la carga; si falla, el error (no «no existe»)
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

  const headerProps = {
    kind,
    look: world,
    style: worldTransition(worldId),
    // Borrado desde dentro: a Mis mundos, saliendo de él
    afterDelete: () => void navigate({ to: '/mundos', viewTransition: LEAVE_WORLD })
  }
  const header = <LookHeader {...headerProps} />
  const tour = (
    <Tour
      id="mundo"
      // Un paso por cada botón de la barra (y lo que se añada a ella, también aquí)
      steps={[
        ...(master
          ? ([
              { target: '[data-tour="barra-wiki"]', text: t('tour.world.wiki'), placement: 'right' },
              { target: '[data-tour="buscador"]', text: t('tour.world.search'), placement: 'right' },
              { target: '[data-tour="panel-bloques"]', text: t('tour.world.panel'), placement: 'left' },
              { target: '[data-tour="quien-la-conoce"]', text: t('tour.world.whoKnows'), placement: 'bottom' },
              { target: '[data-tour="barra-archivos-mundo"]', text: t('tour.world.files'), placement: 'right' },
              { target: '[data-tour="barra-dados"]', text: t('tour.world.dice'), placement: 'right' },
              { target: '[data-tour="barra-historial"]', text: t('tour.world.history'), placement: 'right' },
              { target: '[data-tour="barra-papelera"]', text: t('tour.world.trash'), placement: 'right' },
              { target: '[data-tour="engranaje"]', text: t('tour.world.settings') }
            ] as const)
          : []),
        ...(master
          ? []
          : ([
              { target: '[data-tour="barra-inicio"]', text: t('tour.world.home'), placement: 'right' },
              { target: '[data-tour="barra-dados"]', text: t('tour.world.dice'), placement: 'right' }
            ] as const)),
        { target: '[data-tour="barra-llama"]', text: t('tour.world.back'), placement: 'right' },
        { target: '[data-tour="menu-movil"]', text: t('tour.menu') }
      ]}
    />
  )

  // Quien lo dirige: su página de portada, como en Everlore (la cabecera del mundo hace de portada)
  if (master) {
    return (
      <>
        <WorldHome worldId={worldId} banner={<WorldBanner world={world} />} />
        {tour}
      </>
    )
  }
  return (
    <div className={wiki.worldHome}>
      <section className={styles.page}>
        {header}
        <WorldCampaigns worldId={worldId} master={false} />
        {tour}
      </section>
    </div>
  )
}

/**
 * La página de portada del mundo (si aún no tiene, se crea), como cualquier página: con el árbol al lado y la cabecera
 * del mundo como su portada
 */
function WorldHome({ worldId, banner }: { worldId: string; banner: ReactNode }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const home = useQuery({
    queryKey: ['pages', worldId, 'home'],
    queryFn: () => api.call('getWorldHome', { worldId })
  })
  const ensure = useMutation({
    mutationFn: () => api.call('ensureWorldHome', { worldId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pages', worldId] })
  })
  const missing = home.data && !home.data.pageId
  useEffect(() => {
    if (missing && ensure.isIdle) ensure.mutate()
  }, [missing, ensure])
  const pageId = home.data?.pageId ?? null
  const page = useQuery({
    queryKey: pageKey(worldId, pageId ?? ''),
    queryFn: () => api.call('getPage', { pageId: pageId ?? '' }),
    enabled: Boolean(pageId)
  })
  const current = page.data
  const error = home.error ?? ensure.error ?? page.error
  return (
    <WikiLayout worldId={worldId} current={current}>
      {() =>
        current ? (
          <HomeEntry page={current} banner={banner} />
        ) : (
          <>
            {banner}
            {error ? (
              <SectionError
                error={error}
                onRetry={() => {
                  if (ensure.isError) ensure.mutate()
                  void home.refetch()
                  if (pageId) void page.refetch()
                }}
              />
            ) : null}
          </>
        )
      }
    </WikiLayout>
  )
}

function HomeEntry({ page, banner }: { page: Page; banner: ReactNode }) {
  const tabs = usePageTabs(page)
  return <EntryView page={page} tabs={tabs.data ?? []} banner={banner} home />
}

/** Las campañas de este mundo, en tarjetas: para su máster, todas y «Nueva campaña»; para quien juega, las suyas */
function WorldCampaigns({ worldId, master }: { worldId: string; master: boolean }) {
  const { t } = useTranslation()
  const api = useApi()
  const titleId = useId()
  const campaigns = useQuery({
    queryKey: ['campaigns', worldId],
    queryFn: () => api.call('listCampaigns', { worldId })
  })
  const kind = useCampaignKind(worldId)
  const cards = useCardList(kind.list, campaigns.data?.campaigns)
  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <h2 id={titleId}>{t(master ? 'campaigns.title' : 'world.yourCampaigns')}</h2>
      {failed(campaigns) && <SectionError error={campaigns.error} onRetry={() => campaigns.refetch()} />}
      <ul className={styles.list} aria-labelledby={titleId}>
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
      </ul>
    </section>
  )
}
