/**
 * «En juego» (docs/specs/criaturas.md): las criaturas en juego de la campaña, para el máster. A la izquierda, la lista
 * (las copias juntas por su criatura, las únicas aparte) con su vida y cómo están; en el centro, la hoja de la elegida
 * (la misma hoja en partida que un personaje); a la derecha, el registro de tiradas, desde el que se aplica el daño
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate } from '@tanstack/react-router'
import { Dices, Plus, Star, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import type { ActionOutput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { PlaySheet } from '../characters/play-sheet.tsx'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { FormError } from '../components/field.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Tour } from '../components/tour.tsx'
import { RollLog } from '../dice/log.tsx'
import styles from './in-play.module.css'
import { creatureKey, useCreatureSave } from './save.ts'

const route = getRouteApi('/mundos/$worldId/campanas/$campaignId/en-juego')
type Creature = ActionOutput<'listInPlay'>['creatures'][number]

/** Su nombre sin su número: el de su grupo («Goblin 3» → «Goblin») */
const baseName = (c: Creature) => (c.number === null ? c.name : c.name.replace(new RegExp(`\\s*${c.number}$`), ''))

export function InPlayScreen() {
  const { t } = useTranslation()
  const { worldId, campaignId } = route.useParams()
  const { ver } = route.useSearch()
  const navigate = route.useNavigate()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const { account, pending } = useAccounts().useAccount()
  const list = useQuery({
    queryKey: ['creatures', campaignId],
    queryFn: () => api.call('listInPlay', { campaignId }),
    enabled: Boolean(account)
  })
  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.call('getCampaign', { campaignId }),
    enabled: Boolean(account)
  })
  const removing = useMutation({
    mutationFn: (input: { copiesOf?: string; creatureIds?: string[] }) =>
      api.call('removeFromPlay', { campaignId, ...input }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['creatures', campaignId] })
  })
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  if (!list.data || !campaign.data)
    return failed(list) ? <LoadError error={list.error} onRetry={() => list.refetch()} /> : <Loading />
  const creatures = list.data.creatures
  const open = (id: string) => void navigate({ search: { ver: id } })
  const shown = creatures.find((c) => c.id === ver) ?? creatures[0]
  // Las copias, juntas por su criatura (en el orden en que se pusieron); las únicas, aparte
  const groups = new Map<string, Creature[]>()
  for (const c of creatures.filter((each) => !each.unique)) groups.set(c.key, [...(groups.get(c.key) ?? []), c])
  const uniques = creatures.filter((c) => c.unique)
  const row = (c: Creature) => (
    <CreatureRow key={c.id} creature={c} current={c.id === shown?.id} onOpen={() => open(c.id)} />
  )
  return (
    <div className={styles.page}>
      <aside className={styles.side} aria-label={t('inPlay.title')} data-tour="en-juego-lista">
        <div className={styles.sideHead}>
          <PageTitle className={styles.title}>{t('inPlay.title')}</PageTitle>
          <span className={styles.count}>{t('inPlay.count', { count: creatures.length })}</span>
          {groups.size > 0 && (
            <BusyButton
              className={styles.removeAll}
              busy={removing.isPending}
              onClick={() =>
                void Promise.all([...groups.keys()].map((key) => removing.mutateAsync({ copiesOf: key }))).catch(
                  () => undefined
                )
              }
            >
              {t('inPlay.removeCopies')}
            </BusyButton>
          )}
        </div>
        <FormError message={removing.error ? errorText(removing.error) : null} />
        {creatures.length === 0 && <p className={styles.none}>{t('inPlay.empty')}</p>}
        {[...groups.entries()].map(([key, copies]) => (
          <section key={key} className={styles.group} aria-label={baseName(copies[0] as Creature)}>
            <div className={styles.groupHead}>
              <span>
                {baseName(copies[0] as Creature)} · {copies.length}
              </span>
              <button type="button" className={styles.link} onClick={() => removing.mutate({ copiesOf: key })}>
                {t('inPlay.removeGroup', { count: copies.length })}
              </button>
            </div>
            <ul className={styles.list}>{copies.map(row)}</ul>
          </section>
        ))}
        {uniques.length > 0 && (
          <section className={styles.group} aria-label={t('inPlay.uniques')}>
            <div className={styles.groupHead}>
              <span>{t('inPlay.uniques')}</span>
            </div>
            <ul className={styles.list}>{uniques.map(row)}</ul>
          </section>
        )}
        <Link
          to="/mundos/$worldId/campanas/$campaignId/compendio"
          params={{ worldId, campaignId }}
          className={styles.add}
        >
          <Plus size={16} aria-hidden="true" />
          {t('inPlay.add')}
        </Link>
      </aside>
      {shown ? (
        <CreatureSheet
          key={shown.id}
          creatureId={shown.id}
          campaignId={campaignId}
          onRemoved={() => void navigate({ search: {} })}
        />
      ) : (
        <div className={styles.reading}>
          <p className={styles.none}>{t('inPlay.pick')}</p>
        </div>
      )}
      <aside className={styles.log} aria-label={t('inPlay.log')} data-tour="en-juego-registro">
        <RollLog campaign={campaign.data.campaign} />
      </aside>
      <Tour
        id="en-juego"
        steps={[
          { target: '[data-tour="en-juego-lista"]', text: t('tour.inPlay.list') },
          { target: '[data-tour="en-juego-registro"]', text: t('tour.inPlay.log') }
        ]}
      />
    </div>
  )
}

/** Una en la lista: su nombre, su vida en barra y cómo está */
function CreatureRow({ creature, current, onOpen }: { creature: Creature; current: boolean; onOpen: () => void }) {
  const { t } = useTranslation()
  const life = creature.life
  const share = life && life.max > 0 ? Math.max(0, Math.min(1, life.value / life.max)) : 0
  return (
    <li>
      <button
        type="button"
        className={styles.row}
        aria-current={current ? 'true' : undefined}
        data-condition={creature.condition}
        onClick={onOpen}
      >
        <span className={styles.rowHead}>
          <span className={styles.rowName}>
            {creature.unique && <Star size={14} aria-label={t('inPlay.unique')} />}
            {creature.name}
          </span>
          {life && (
            <span className={styles.life}>
              {life.value}
              <span className={styles.max}> / {life.max}</span>
            </span>
          )}
        </span>
        {life && (
          <span className={styles.bar} aria-hidden="true">
            <span className={styles.fill} style={{ inlineSize: `${share * 100}%` }} />
          </span>
        )}
        <span className={styles.chips}>
          {creature.stats.slice(0, 1).map((s) => (
            <span key={s.key} className={styles.chip}>
              {s.label.length > 4 ? s.key.toUpperCase() : s.label} {s.value}
            </span>
          ))}
          {creature.condition !== 'ok' && (
            <span className={`${styles.chip} ${styles.condition}`}>{t(`inPlay.condition.${creature.condition}`)}</span>
          )}
        </span>
      </button>
    </li>
  )
}

/** La hoja de una criatura en juego: su cabecera (su nombre, tirar sus PG, otro máximo, quitarla) y sus bloques */
function CreatureSheet({
  creatureId,
  campaignId,
  onRemoved
}: {
  creatureId: string
  campaignId: string
  onRemoved: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const titleId = useId()
  const maxId = useId()
  const read = useQuery({ queryKey: creatureKey(creatureId), queryFn: () => api.call('getInPlay', { creatureId }) })
  const { save, error } = useCreatureSave(creatureId, campaignId)
  const [max, setMax] = useState('')
  const change = useMutation({
    mutationFn: (input: { rollHp?: true; max?: { value: number | null } }) => {
      const version = read.data?.creature.version ?? 1
      return api.call('playCreature', { creatureId, version, ...input })
    },
    onSuccess: (out) => {
      client.setQueryData(creatureKey(creatureId), out)
      setMax('')
      void client.invalidateQueries({ queryKey: ['creatures', campaignId] })
    }
  })
  const remove = useMutation({
    mutationFn: () => api.call('removeFromPlay', { campaignId, creatureIds: [creatureId] }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['creatures', campaignId] })
      onRemoved()
    }
  })
  if (!read.data)
    return (
      <div className={styles.reading}>
        {failed(read) ? <LoadError error={read.error} onRetry={() => read.refetch()} /> : <Loading />}
      </div>
    )
  const { creature, state } = read.data
  const problem = error ?? change.error ?? remove.error
  return (
    <article className={styles.reading} aria-labelledby={titleId}>
      <header className={styles.head}>
        <h2 id={titleId} className={styles.name}>
          {creature.name}
        </h2>
        <div className={styles.tags}>
          {creature.unique && (
            <span className={styles.tag}>
              <Star size={12} aria-hidden="true" />
              {t('inPlay.unique')}
            </span>
          )}
        </div>
        <div className={styles.actions}>
          {creature.life && (
            <>
              <BusyButton
                className={styles.action}
                busy={change.isPending}
                onClick={() => change.mutate({ rollHp: true })}
              >
                <Dices size={14} aria-hidden="true" />
                {t('inPlay.rollHp')}
              </BusyButton>
              <form
                className={styles.maxForm}
                onSubmit={(event) => {
                  event.preventDefault()
                  const value = Number(max)
                  if (Number.isInteger(value) && value > 0) change.mutate({ max: { value } })
                }}
              >
                <label htmlFor={maxId}>{t('inPlay.otherMax')}</label>
                <input
                  id={maxId}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder={String(creature.life.max)}
                  value={max}
                  onChange={(event) => setMax(event.currentTarget.value)}
                />
              </form>
            </>
          )}
          <BusyButton className={styles.action} busy={remove.isPending} onClick={() => remove.mutate()}>
            <Trash2 size={14} aria-hidden="true" />
            {t('inPlay.remove')}
          </BusyButton>
        </div>
      </header>
      <FormError message={problem ? errorText(problem) : null} />
      <PlaySheet
        subject={{ campaignId, play: creature.play }}
        state={state}
        save={save}
        rollWith={(input) => api.call('rollForCreature', { creatureId, ...input })}
      />
    </article>
  )
}
