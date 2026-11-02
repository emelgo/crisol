import type { Page } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { type ReactNode, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { useCardList } from '../components/card-transition.ts'
import { FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import { failed, LoadError, SectionError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Tour } from '../components/tour.tsx'
import { LEAVE_WORLD, worldTransition } from '../components/world-transition.ts'
import { CollabSocket } from '../wiki/collab.tsx'
import { usePageTabs } from '../wiki/tabs/page-tabs.tsx'
import wiki from '../wiki/wiki.module.css'
import { EntryView, pageKey } from '../wiki/wiki.tsx'
import styles from './world-card.module.css'
import { CampaignCard, LookHeader, useWorldKind } from './world-card.tsx'

const route = getRouteApi('/mundos/$worldId')

/**
 * El Inicio de un mundo: su cabecera (en ella se convierte su tarjeta al entrar) y lo reciente: para quien lo dirige,
 * lo último de su wiki; para quien juega (aún sin wiki), sus campañas
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

  const header = (
    <LookHeader
      kind={kind}
      look={world}
      style={worldTransition(worldId)}
      // Borrado desde dentro: a Mis mundos, saliendo de él
      afterDelete={() => void navigate({ to: '/mundos', viewTransition: LEAVE_WORLD })}
    />
  )
  const tour = (
    <Tour
      id="mundo"
      // Un paso por cada botón de la barra (y lo que se añada a ella, también aquí)
      steps={[
        { target: '[data-tour="barra-inicio"]', text: t('tour.world.home'), placement: 'right' },
        ...(master
          ? ([
              { target: '[data-tour="barra-buscar"]', text: t('tour.world.search'), placement: 'right' },
              { target: '[data-tour="barra-marcadores"]', text: t('tour.world.bookmarks'), placement: 'right' },
              { target: '[data-tour="barra-wiki"]', text: t('tour.world.wiki'), placement: 'right' },
              { target: '[data-tour="barra-archivos-mundo"]', text: t('tour.world.files'), placement: 'right' },
              { target: '[data-tour="barra-historial"]', text: t('tour.world.history'), placement: 'right' },
              { target: '[data-tour="barra-papelera"]', text: t('tour.world.trash'), placement: 'right' },
              { target: '[data-tour="engranaje"]', text: t('tour.world.settings') }
            ] as const)
          : []),
        { target: '[data-tour="barra-llama"]', text: t('tour.world.back'), placement: 'right' },
        { target: '[data-tour="menu-movil"]', text: t('tour.menu') }
      ]}
    />
  )

  // Quien lo dirige: su página de portada, como en Everlore, con la cabecera del mundo en lugar de su portada
  if (master) {
    return (
      <div className={wiki.worldHome}>
        <WorldHome worldId={worldId} name={world.name} header={header} />
        {tour}
      </div>
    )
  }
  return (
    <div className={wiki.worldHome}>
      <section className={styles.page}>
        {header}
        <PlayerCampaigns worldId={worldId} />
        {tour}
      </section>
    </div>
  )
}

/**
 * La página de portada del mundo (la elegida o la primera del árbol) bajo su cabecera; sin páginas, el aviso y el botón
 * para crear la primera
 */
function WorldHome({ worldId, name, header }: { worldId: string; name: string; header: ReactNode }) {
  const { t } = useTranslation()
  const api = useApi()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const home = useQuery({
    queryKey: ['pages', worldId, 'home'],
    queryFn: () => api.call('getWorldHome', { worldId })
  })
  const pageId = home.data?.pageId ?? null
  const page = useQuery({
    queryKey: pageKey(worldId, pageId ?? ''),
    queryFn: () => api.call('getPage', { pageId: pageId ?? '' }),
    enabled: Boolean(pageId)
  })
  const create = useMutation({
    mutationFn: () => api.call('createPage', { worldId, title: t('wiki.untitled'), parentId: null }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['pages', worldId] })
      await navigate({
        to: '/mundos/$worldId/wiki/$pageId',
        params: { worldId, pageId: created.id },
        search: { nuevo: true }
      })
    }
  })
  if (home.data && pageId && page.data) {
    return (
      <CollabSocket>
        <HomeEntry page={page.data} world={name} header={header} />
      </CollabSocket>
    )
  }
  return (
    <>
      {header}
      {home.data && !pageId ? (
        <div className={wiki.worldEmpty}>
          <p>{t('wiki.worldEmpty')}</p>
          <BusyButton className={form.button} busy={create.isPending} onClick={() => create.mutate()}>
            <Plus aria-hidden="true" size={16} />
            {t('wiki.createFirst')}
          </BusyButton>
          <FormError message={create.error ? errorText(create.error) : null} />
        </div>
      ) : failed(home) || failed(page) ? (
        <SectionError error={home.error ?? page.error} onRetry={() => void (failed(home) ? home : page).refetch()} />
      ) : (
        <Loading />
      )}
    </>
  )
}

function HomeEntry({ page, world, header }: { page: Page; world: string; header: ReactNode }) {
  const tabs = usePageTabs(page)
  return <EntryView page={page} world={world} tabs={tabs.data ?? []} banner={header} />
}

/** Para quien juega: sus campañas de este mundo (las mismas tarjetas que en Campañas) */
function PlayerCampaigns({ worldId }: { worldId: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const titleId = useId()
  const campaigns = useQuery({
    queryKey: ['campaigns', worldId],
    queryFn: () => api.call('listCampaigns', { worldId })
  })
  const cards = useCardList(`campanas-${worldId}`, campaigns.data?.campaigns)
  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <h2 id={titleId}>{t('world.yourCampaigns')}</h2>
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
