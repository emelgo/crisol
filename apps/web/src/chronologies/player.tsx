/**
 * Las cronologías desde una campaña (ADR-0017, decisión 4 de Enrique): quien juega ve las que el máster le enseña
 * (las revela a su campaña) y, dentro, solo lo que sabe su campaña; en solo lectura. La lista y cada una a pantalla
 * entera, como las del máster
 */
import { getRouteApi, Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import calendarStyles from '../calendars/calendars.module.css'
import { Loading } from '../components/brand.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { Screen } from '../components/screen.tsx'
import { ReadAsProvider } from '../wiki/read-as.tsx'
import styles from './chronologies.module.css'
import { usePlayerChronologies } from './queries.ts'
import { Chronology } from './screen.tsx'

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
                  to="/mundos/$worldId/campanas/$campaignId/cronologias/$chronologyId"
                  params={{ worldId, campaignId, chronologyId: chronology.id }}
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

export function PlayerChronology() {
  const { t } = useTranslation()
  const { worldId, campaignId, chronologyId } = oneRoute.useParams()
  return (
    <ReadAsProvider value={{ campaignId }}>
      <Chronology
        worldId={worldId}
        chronologyId={chronologyId}
        organizationId={undefined}
        editable={false}
        back={
          <Link
            to="/mundos/$worldId/campanas/$campaignId/cronologias"
            params={{ worldId, campaignId }}
            className={styles.back}
          >
            <ChevronLeft size={16} aria-hidden="true" />
            {t('chronologies.title')}
          </Link>
        }
      />
    </ReadAsProvider>
  )
}
