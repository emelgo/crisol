import type { Campaign, World } from '@crisol/contracts'
import { TRASH_DAYS } from '@crisol/domain'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Navigate } from '@tanstack/react-router'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { prepareAmbient, useAmbient } from '../components/ambient.tsx'
import { Loading } from '../components/brand.tsx'
import { useCardList } from '../components/card-transition.ts'
import { EmptyState, TitleEmblem } from '../components/empty-state.tsx'
import { FormError } from '../components/field.tsx'
import { failed } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Tour } from '../components/tour.tsx'
import styles from './world-card.module.css'
import {
  CampaignCard,
  CampaignDetail,
  NewLook,
  NewWorld,
  useAllCampaignsKind,
  WorldCard,
  WorldDetail
} from './world-card.tsx'

/** Lo que se enseña en el panel de la izquierda: un mundo o una campaña */
type Shown = { kind: 'world' | 'campaign'; id: string }

export function Worlds() {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const { account, pending } = useAccounts().useAccount()
  const organizations = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.call('listOrganizations', {}),
    enabled: Boolean(account)
  })
  const worlds = useQuery({
    queryKey: ['worlds'],
    queryFn: () => api.call('listWorlds', {}),
    enabled: Boolean(account)
  })
  const cards = useCardList('mundos', worlds.data?.worlds)
  // El mundo o la campaña sobre el que está el ratón (o el foco), para el panel de la izquierda; al irse, nada
  const [shown, setShown] = useState<Shown | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const preview = shown?.kind === 'world' ? worlds.data?.worlds.find((w) => w.id === shown.id) : undefined
  const previewCampaign = shown?.kind === 'campaign' ? campaigns.find((c) => c.id === shown.id) : undefined
  const previewOf = (kind: Shown['kind'], id: string) => (on: boolean) =>
    setShown((current) => (on ? { kind, id } : current?.id === id ? null : current))
  // Detrás, la portada de lo que uno señala (un momento: pasar por encima no mueve el fondo); al irse de la tarjeta,
  // también un momento después (de una tarjeta a otra no vuelve a la de ambiente), la de ambiente
  const [ambientCover, setAmbientCover] = useState<string | null>(null)
  const shownCover = (preview ?? previewCampaign)?.cover?.fileId ?? null
  useEffect(() => {
    const timer = window.setTimeout(() => setAmbientCover(shownCover), 300)
    return () => window.clearTimeout(timer)
  }, [shownCover])
  useAmbient(ambientCover ? `/api/files/${ambientCover}` : null)
  // Los fondos de los mundos con portada, ya preparados: al entrar en uno, el suyo llega con la transición (sin carga)
  useEffect(() => {
    for (const world of worlds.data?.worlds ?? []) if (world.cover) prepareAmbient(`/api/files/${world.cover.fileId}`)
  }, [worlds.data])

  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  const canCreate = organizations.data?.organizations.some((o) => o.role === 'owner') ?? false

  const empty = cards.length === 0

  return (
    <section className={styles.layout}>
      <aside className={styles.detail} aria-label={t('worlds.detail')} data-vista-previa>
        {preview && <WorldDetail key={preview.id} world={preview} />}
        {previewCampaign && (
          <CampaignDetail
            key={previewCampaign.id}
            campaign={previewCampaign}
            place={worlds.data?.worlds.find((w) => w.id === previewCampaign.worldId)?.name}
          />
        )}
      </aside>
      <div className={styles.center}>
        <div className={styles.top}>
          <TitleEmblem kind="mundos" show={Boolean(worlds.data) && !empty}>
            <PageTitle>{t('worlds.title')}</PageTitle>
          </TitleEmblem>
        </div>
        <FormError message={failed(worlds) ? errorText(worlds.error) : null} />
        {!worlds.data && !failed(worlds) && <Loading />}
        {worlds.data &&
          (empty ? (
            // Sin mundos: qué es un mundo y el botón grande para crear el primero
            <EmptyState kind="mundos" action={canCreate ? <NewWorld big /> : undefined}>
              <h2>{t('worlds.empty')}</h2>
              {!canCreate && <p>{t('worlds.emptyPlayer')}</p>}
            </EmptyState>
          ) : (
            <ul className={styles.list} aria-label={t('worlds.listLabel')} data-card-list>
              {cards.map(({ item, fresh, burning, burnt }) => (
                <WorldCard
                  key={item.id}
                  world={item}
                  fresh={fresh}
                  burning={burning}
                  onBurnt={burnt}
                  onPreview={previewOf('world', item.id)}
                />
              ))}
              {/* Tras el último, el recuadro vacío para crear otro */}
              {canCreate && <NewWorld />}
            </ul>
          ))}
        {worlds.data && !empty && (
          <AllCampaigns
            worlds={worlds.data.worlds}
            onList={setCampaigns}
            onPreview={(id) => previewOf('campaign', id)}
          />
        )}
      </div>
      <Tour
        id="mundos"
        steps={[
          {
            target: '[data-tour="nuevo-mundo"]',
            text: t('tour.worlds.create'),
            also: [{ target: '[data-tour="barra-mundos"]', text: t('tour.worlds.ribbon') }]
          },
          { target: '[data-tour="nueva-campana"]', text: t('tour.worlds.campaigns') },
          // La barra, de arriba abajo, en su orden
          { target: '[data-tour="barra-plantillas"]', text: t('tour.worlds.templates'), placement: 'right' },
          { target: '[data-tour="barra-etiquetas"]', text: t('tour.worlds.tags'), placement: 'right' },
          { target: '[data-tour="barra-sistemas"]', text: t('tour.worlds.systems'), placement: 'right' },
          { target: '[data-tour="barra-archivos"]', text: t('tour.worlds.files'), placement: 'right' },
          { target: '[data-tour="barra-historial"]', text: t('tour.worlds.history'), placement: 'right' },
          {
            target: '[data-tour="barra-papelera"]',
            text: t('tour.worlds.trash', { days: TRASH_DAYS }),
            placement: 'right'
          },
          { target: '[data-tour="cuenta"]', text: t('tour.worlds.account'), placement: 'right' },
          // En el móvil, todo va en el menú de la llama
          { target: '[data-tour="menu-movil"]', text: t('tour.menu') }
        ]}
      />
    </section>
  )
}

/** Las campañas de todas las listas, cuando han llegado todas (fuera del componente: así no cambia en cada pintado) */
function joinCampaigns(lists: { data?: { campaigns: Campaign[] } | undefined }[]) {
  return lists.every((list) => list.data) ? lists.flatMap((list) => list.data?.campaigns ?? []) : undefined
}

/**
 * Las campañas de todos los mundos de la cuenta (las que ve: el máster, todas; un jugador, las suyas), con el mundo de
 * cada una, y tras la última, «Nueva campaña», que pide el mundo (de los que dirige)
 */
function AllCampaigns({
  worlds,
  onList,
  onPreview
}: {
  worlds: World[]
  /** Las que hay, para el panel de la izquierda */
  onList: (campaigns: Campaign[]) => void
  onPreview: (id: string) => (shown: boolean) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const headingId = useId()
  // En el orden de sus mundos, y en cada uno, en el que se crearon; la misma lista mientras no cambie (combine)
  const all = useQueries({
    queries: worlds.map((world) => ({
      queryKey: ['campaigns', world.id],
      queryFn: () => api.call('listCampaigns', { worldId: world.id })
    })),
    combine: joinCampaigns
  })
  const names = new Map(worlds.map((world) => [world.id, world.name]))
  const places = worlds.filter((world) => world.role === 'master').map(({ id, name }) => ({ id, name }))
  const kind = useAllCampaignsKind(places)
  const cards = useCardList(kind.list, all)
  useEffect(() => {
    if (all) onList(all)
  }, [all, onList])
  if (!all) return null
  if (cards.length === 0 && places.length === 0) return null
  return (
    <div className={styles.campaigns}>
      <h2 id={headingId} className={styles.sectionTitle}>
        {t('campaigns.title')}
      </h2>
      {cards.length === 0 && <p className={styles.sectionHint}>{t('campaigns.allEmpty')}</p>}
      <ul className={styles.list} aria-labelledby={headingId} data-card-list>
        {cards.map(({ item, fresh, burning, burnt }) => (
          <CampaignCard
            key={item.id}
            worldId={item.worldId}
            campaign={item}
            kind={kind}
            place={names.get(item.worldId)}
            fresh={fresh}
            burning={burning}
            onBurnt={burnt}
            onPreview={onPreview(item.id)}
          />
        ))}
        {places.length > 0 && <NewLook kind={kind} tour="nueva-campana" />}
      </ul>
    </div>
  )
}
