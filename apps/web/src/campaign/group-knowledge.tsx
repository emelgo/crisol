/**
 * «Lo que sabe el grupo» (docs/specs/revelar.md): lo revelado a una campaña, por días, de lo más reciente a lo más
 * antiguo, con a quién; se filtra por personaje y por tipo, se abre y se oculta otra vez. Aparte, lo que sabe todo el
 * mundo (si la campaña parte de él). Se abre como ventana desde «Revelado», en la barra de la campaña
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import styles from './group-knowledge.module.css'

type Item = {
  kind: 'page' | 'secret' | 'tab' | 'pin' | 'element' | 'content' | 'event' | 'chronology'
  targetId: string
  name: string
  pageId: string | null
  pageTitle: string | null
  known: boolean
  audience: 'all' | { id: string; name: string }[]
  at: string
}

export function GroupKnowledge({ worldId, campaignId }: { worldId: string; campaignId: string }) {
  const { t, i18n } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const known = useQuery({
    queryKey: ['pages', worldId, 'group', campaignId],
    queryFn: () => api.call('listCampaignKnowledge', { campaignId })
  })
  const [character, setCharacter] = useState('')
  const [kind, setKind] = useState('')
  const hide = useMutation({
    mutationFn: (item: Item) => api.call('hide', { campaignId, kind: item.kind, targetId: item.targetId }),
    onSuccess: async (_, item) => {
      announce(t('group.hidden', { name: item.name }))
      await queryClient.invalidateQueries({ queryKey: ['pages', worldId] })
    },
    onError: (error) => announce(errorText(error))
  })
  const day = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'full' })
  const characters = useMemo(() => {
    const all = new Map<string, string>()
    for (const item of known.data?.campaign ?? [])
      if (item.audience !== 'all') for (const c of item.audience) all.set(c.id, c.name)
    return [...all]
  }, [known.data])
  if (!known.data) return failed(known) ? <LoadError error={known.error} onRetry={() => known.refetch()} /> : null
  const keep = (item: Item) =>
    (!kind || item.kind === kind) &&
    (!character || item.audience === 'all' || item.audience.some((c) => c.id === character))
  const own = known.data.campaign.filter(keep)
  const byDay = Map.groupBy(own, (item) => day.format(new Date(item.at)))
  const row = (item: Item, canHide: boolean) => (
    <li key={`${item.kind}-${item.targetId}`} className={styles.item}>
      <span className={styles.kind}>{t(`group.kinds.${item.kind}`)}</span>
      <span className={styles.name}>
        {item.pageId ? (
          <Link to="/mundos/$worldId/wiki/$pageId" params={{ worldId, pageId: item.pageId }}>
            {item.name}
          </Link>
        ) : (
          item.name
        )}
        {item.pageTitle && item.kind !== 'page' && <span className={styles.where}> · {item.pageTitle}</span>}
      </span>
      <span className={styles.who}>
        {!item.known
          ? t('group.notKnown')
          : item.audience === 'all'
            ? t('group.everyone')
            : item.audience.map((c) => c.name).join(', ')}
      </span>
      {canHide && item.known && (
        <button type="button" className={styles.hide} disabled={hide.isPending} onClick={() => hide.mutate(item)}>
          {t('group.hide')}
        </button>
      )}
    </li>
  )
  return (
    <section className={styles.page}>
      <PageTitle>{t('group.title')}</PageTitle>
      <div className={styles.filters}>
        <label>
          <span>{t('group.byCharacter')}</span>
          <select value={character} onChange={(event) => setCharacter(event.currentTarget.value)}>
            <option value="">{t('group.all')}</option>
            {characters.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t('group.byKind')}</span>
          <select value={kind} onChange={(event) => setKind(event.currentTarget.value)}>
            <option value="">{t('group.all')}</option>
            {(['page', 'secret', 'tab', 'pin', 'content', 'chronology', 'event'] as const).map((each) => (
              <option key={each} value={each}>
                {t(`group.kinds.${each}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {own.length === 0 && <p className={styles.empty}>{t('group.empty')}</p>}
      {[...byDay].map(([date, items]) => (
        <section key={date} aria-label={date}>
          <h2 className={styles.day}>{date}</h2>
          <ul className={styles.list}>{items.map((item) => row(item, true))}</ul>
        </section>
      ))}
      {known.data.knowsWorld && known.data.world.length > 0 && (
        <section aria-labelledby="sabe-el-mundo">
          <h2 id="sabe-el-mundo" className={styles.day}>
            {t('group.world')}
          </h2>
          <ul className={styles.list}>{known.data.world.filter(keep).map((item) => row(item, false))}</ul>
        </section>
      )}
    </section>
  )
}
