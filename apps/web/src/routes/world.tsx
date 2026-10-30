import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate, useNavigate } from '@tanstack/react-router'
import { FileText } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { Loading } from '../components/brand.tsx'
import { useCardList } from '../components/card-transition.ts'
import { failed, LoadError, SectionError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Tour } from '../components/tour.tsx'
import { LEAVE_WORLD, SECTION, worldTransition } from '../components/world-transition.ts'
import { coverStyle, useWorldFiles } from '../wiki/cover.tsx'
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

  return (
    <section className={styles.page}>
      <LookHeader
        kind={kind}
        look={world}
        style={worldTransition(worldId)}
        // Borrado desde dentro: a Mis mundos, saliendo de él
        afterDelete={() => void navigate({ to: '/mundos', viewTransition: LEAVE_WORLD })}
      />
      {master ? <RecentPages worldId={worldId} /> : <PlayerCampaigns worldId={worldId} />}
      <Tour
        id="mundo"
        // Un paso por cada botón de la barra (y lo que se añada a ella, también aquí)
        steps={[
          { target: '[data-tour="barra-inicio"]', text: t('tour.world.home'), placement: 'right' },
          { target: '[data-tour="barra-campanas"]', text: t('tour.world.campaigns'), placement: 'right' },
          ...(master
            ? ([
                { target: '[data-tour="barra-pages"]', text: t('tour.world.pages'), placement: 'right' },
                { target: '[data-tour="barra-search"]', text: t('tour.world.search'), placement: 'right' },
                { target: '[data-tour="barra-bookmarks"]', text: t('tour.world.bookmarks'), placement: 'right' },
                { target: '[data-tour="barra-etiquetas"]', text: t('tour.world.tags'), placement: 'right' },
                { target: '[data-tour="barra-archivos-mundo"]', text: t('tour.world.files'), placement: 'right' },
                { target: '[data-tour="barra-historial"]', text: t('tour.world.history'), placement: 'right' },
                { target: '[data-tour="barra-papelera"]', text: t('tour.world.trash'), placement: 'right' },
                { target: '[data-tour="engranaje"]', text: t('tour.world.settings') }
              ] as const)
            : []),
          { target: '[data-tour="barra-llama"]', text: t('tour.world.back'), placement: 'right' }
        ]}
      />
    </section>
  )
}

/** Cuánto hace: «hace 5 minutos», «ayer»…; pasado un mes, la fecha */
function useAgo() {
  const { i18n } = useTranslation()
  const relative = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' })
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })
  return (iso: string) => {
    const seconds = (new Date(iso).getTime() - Date.now()) / 1000
    const steps: [number, Intl.RelativeTimeFormatUnit][] = [
      [60, 'second'],
      [60, 'minute'],
      [24, 'hour'],
      [30, 'day']
    ]
    let value = seconds
    for (const [size, unit] of steps) {
      if (Math.abs(value) < size)
        return unit === 'second' ? relative.format(0, 'second') : relative.format(Math.round(value), unit)
      value /= size
    }
    return date.format(new Date(iso))
  }
}

/** Los últimos artículos: las páginas de la wiki cambiadas hace poco, para seguir donde se dejó */
function RecentPages({ worldId }: { worldId: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const titleId = useId()
  const ago = useAgo()
  const recent = useQuery({
    queryKey: ['pages', worldId, 'recent'],
    queryFn: () => api.call('listRecentPages', { worldId })
  })
  const pages = recent.data?.pages ?? []
  const files = useWorldFiles(
    worldId,
    pages.some((page) => page.cover)
  )
  const imageOf = (fileId: string | undefined) => files.data?.files.find((f) => f.id === fileId)?.url
  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <h2 id={titleId}>{t('world.recent')}</h2>
      {failed(recent) && <SectionError error={recent.error} onRetry={() => recent.refetch()} />}
      {recent.data &&
        (pages.length === 0 ? (
          <p className={styles.muted}>{t('world.noPages')}</p>
        ) : (
          <ul className={styles.recent} aria-label={t('world.recentLabel')}>
            {pages.map((page) => {
              const image = page.cover ? imageOf(page.cover.fileId) : undefined
              return (
                <li key={page.id}>
                  <Link
                    to="/mundos/$worldId/wiki/$pageId"
                    params={{ worldId, pageId: page.id }}
                    className={styles.recentLink}
                    viewTransition={SECTION}
                  >
                    <span className={styles.thumb} aria-hidden="true">
                      {image && page.cover ? (
                        <img src={image} alt="" style={coverStyle(page.cover)} />
                      ) : (
                        (page.icon ?? <FileText size={18} strokeWidth={1.5} />)
                      )}
                    </span>
                    <span className={styles.recentText}>
                      <span className={styles.recentTitle}>{page.title}</span>
                      {page.path.length > 0 && (
                        <span className={styles.recentPath}>{page.path.map((p) => p.title).join(' › ')}</span>
                      )}
                    </span>
                    <time className={styles.recentWhen} dateTime={page.editedAt}>
                      {ago(page.editedAt)}
                    </time>
                  </Link>
                </li>
              )
            })}
          </ul>
        ))}
    </section>
  )
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
