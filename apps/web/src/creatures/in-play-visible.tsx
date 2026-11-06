/**
 * «En juego» de un jugador (docs/specs/compendio-jugadores.md): las criaturas que el máster tiene a la vista, juntas
 * por su nombre (las copias) y las únicas aparte, cada una con su imagen y cómo está en palabras: ni sus PG ni su hoja
 */
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Star, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ActionOutput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { Loading } from '../components/brand.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { SystemImage } from '../components/system-image.tsx'
import styles from './in-play-visible.module.css'

const route = getRouteApi('/mundos/$worldId/campanas/$campaignId/en-juego')
type Visible = ActionOutput<'listVisibleInPlay'>['creatures'][number]

/** Su nombre sin su número: el de su grupo («Goblin 3» → «Goblin») */
const baseName = (c: Visible) => (c.number === null ? c.name : c.name.replace(new RegExp(`\\s*${c.number}$`), ''))

export function VisibleInPlay({ campaign }: { campaign: ActionOutput<'getCampaign'>['campaign'] }) {
  const { t } = useTranslation()
  const { campaignId } = route.useParams()
  const api = useApi()
  const list = useQuery({
    queryKey: ['creatures', campaignId, 'visible'],
    queryFn: () => api.call('listVisibleInPlay', { campaignId })
  })
  if (!list.data) return failed(list) ? <LoadError error={list.error} onRetry={() => list.refetch()} /> : <Loading />
  const creatures = list.data.creatures
  const groups = new Map<string, Visible[]>()
  for (const c of creatures.filter((each) => each.number !== null))
    groups.set(baseName(c), [...(groups.get(baseName(c)) ?? []), c])
  const uniques = creatures.filter((c) => c.number === null)
  const systemId = campaign.system?.id ?? null
  const card = (c: Visible) => <CreatureCard key={c.id} creature={c} systemId={systemId} />
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <PageTitle className={styles.title}>{t('inPlay.title')}</PageTitle>
        <span className={styles.count}>{t('inPlay.inSight', { count: creatures.length })}</span>
      </header>
      {creatures.length === 0 && <p className={styles.none}>{t('inPlay.nothingInSight')}</p>}
      {[...groups.entries()].map(([name, copies]) => (
        <section key={name} className={styles.group} aria-label={name}>
          <h2 className={styles.groupHead}>
            {name} · {copies.length}
          </h2>
          <ul className={styles.cards}>{copies.map(card)}</ul>
        </section>
      ))}
      {uniques.length > 0 && (
        <section className={styles.group} aria-label={t('inPlay.uniques')}>
          <h2 className={styles.groupHead}>{t('inPlay.uniques')}</h2>
          <ul className={styles.cards}>{uniques.map(card)}</ul>
        </section>
      )}
    </div>
  )
}

/** Una tarjeta: su imagen, su nombre y cómo está */
function CreatureCard({ creature, systemId }: { creature: Visible; systemId: string | null }) {
  const { t } = useTranslation()
  return (
    <li className={styles.card} data-state={creature.state ?? undefined}>
      <SystemImage
        systemId={systemId}
        path={creature.img}
        className={styles.portrait}
        fallback={
          <span className={styles.portrait} aria-hidden="true">
            <User size={28} />
          </span>
        }
      />
      <div className={styles.body}>
        <span className={styles.name}>
          {creature.number === null && <Star size={14} aria-label={t('inPlay.unique')} />}
          {creature.name}
        </span>
        {creature.state && <span className={styles.state}>{t(`inPlay.state.${creature.state}`)}</span>}
      </div>
    </li>
  )
}
