/**
 * Las cronologías desde una campaña (ADR-0017, ADR-0031): quien juega ve las de las pestañas que conoce y, dentro, solo
 * lo que sabe su campaña; en solo lectura. Su lista lleva a cada una, en la pestaña de su página
 */
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import calendarStyles from '../calendars/calendars.module.css'
import { Loading } from '../components/brand.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { Screen } from '../components/screen.tsx'
import styles from './chronologies.module.css'
import { usePlayerChronologies } from './queries.ts'

const listRoute = getRouteApi('/mundos/$worldId/campanas/$campaignId/cronologias')
const oneRoute = getRouteApi('/mundos/$worldId/campanas/$campaignId/cronologias/$chronologyId')

export function PlayerChronologies() {
  const { t } = useTranslation()
  const { worldId, campaignId } = listRoute.useParams()
  const listed = usePlayerChronologies(worldId, campaignId)
  if (!listed.data)
    return failed(listed) ? <LoadError error={listed.error} onRetry={() => listed.refetch()} /> : <Loading />
  const list = listed.data.chronologies
  return (
    <Screen title={t('chronologies.title')}>
      {list.length === 0 ? (
        <p className={styles.emptyPlayer}>{t('chronologies.nonePlayer')}</p>
      ) : (
        <ul className={styles.cards} aria-label={t('chronologies.list')}>
          {list.map((chronology) => (
            <li key={chronology.id} className={calendarStyles.card}>
              <div className={calendarStyles.cardHead}>
                <Link
                  to="/mundos/$worldId/campanas/$campaignId/paginas/$pageId"
                  params={{ worldId, campaignId, pageId: chronology.pageId }}
                  search={{ pestana: chronology.tabId }}
                  className={calendarStyles.name}
                >
                  {chronology.name}
                </Link>
              </div>
              <p className={calendarStyles.facts}>
                <span>{t('chronologies.entries', { count: chronology.entries })}</span>
                {chronology.span && (
                  <span>
                    {chronology.span.from === chronology.span.to
                      ? chronology.span.from
                      : t('chronologies.span', { from: chronology.span.from, to: chronology.span.to })}
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  )
}

/** La dirección de antes de una cronología de la campaña: a su pestaña, en su página; si ya no la ve, a la lista */
export function PlayerChronology() {
  const { worldId, campaignId, chronologyId } = oneRoute.useParams()
  const api = useApi()
  const found = useQuery({
    queryKey: ['chronology', chronologyId, campaignId],
    queryFn: () => api.call('getChronology', { chronologyId, campaignId }),
    retry: false
  })
  if (found.isError)
    return <Navigate to="/mundos/$worldId/campanas/$campaignId/cronologias" params={{ worldId, campaignId }} replace />
  if (!found.data) return <Loading />
  const { chronology } = found.data
  return (
    <Navigate
      to="/mundos/$worldId/campanas/$campaignId/paginas/$pageId"
      params={{ worldId, campaignId, pageId: chronology.pageId }}
      search={{ pestana: chronology.tabId }}
      replace
    />
  )
}
