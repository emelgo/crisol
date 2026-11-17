/**
 * El centro de actividad (lienzo, pantallas 6, 6b, 6c y 8; decisiones 19-23 y 32): «Desde tu última visita», lo nuevo
 * agrupado por día real (con «Sesión» cuando hubo partida en la Mesa: sus mensajes y tiradas) y «Marcar como visto»,
 * que es lo único que lo marca. El máster ve las notas y los personajes de las jugadoras, lo revelado y los cambios de
 * fecha; quien juega, lo que le revelan, lo que le llega del registro y los cambios de fecha. La insignia de la barra y
 * el aviso en vivo salen de aquí también
 */
import type { ActivityItem, Campaign } from '@crisol/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import type { TFunction } from 'i18next'
import { CalendarDays, Check, Eye, Layers, MessageSquare, X } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Trans, useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useAnnounce } from '../components/announcer.tsx'
import { colorOf } from '../dice/rolls.ts'
import styles from './activity.module.css'
import { activityKey, useCampaignActivity } from './queries.ts'

/** El día real (AAAA-MM-DD, en la zona del navegador) de un momento */
export function localDay(at: string): string {
  const date = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

type Log = { day: string; messages: number; rolls: number; shown: number }

/** Lo nuevo por días, del más reciente al más antiguo: lo de cada día y lo del registro de ese día */
export function groupByDay(items: readonly ActivityItem[], log: readonly Log[]) {
  const days = new Map<string, { day: string; items: ActivityItem[]; log: Log | null }>()
  const dayOf = (day: string) => {
    let found = days.get(day)
    if (!found) {
      found = { day, items: [], log: null }
      days.set(day, found)
    }
    return found
  }
  for (const item of items) dayOf(localDay(item.at)).items.push(item)
  for (const entry of log) if (entry.messages + entry.rolls + entry.shown > 0) dayOf(entry.day).log = entry
  for (const group of days.values()) group.items.sort((a, b) => b.at.localeCompare(a.at))
  return [...days.values()].sort((a, b) => b.day.localeCompare(a.day))
}

/** «Hoy», «Ayer» o «domingo 16» */
function dayTitle(t: TFunction, day: string): string {
  const today = localDay(new Date().toISOString())
  const yesterday = localDay(new Date(Date.now() - 86_400_000).toISOString())
  if (day === today) return t('campaignTime.todayGroup')
  if (day === yesterday) return t('campaignTime.yesterdayGroup')
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1).toLocaleDateString('es', { weekday: 'long', day: 'numeric' })
}

const clock = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })

/** El nombre de una persona, con su inicial de color */
function Avatar({ person }: { person: { id: string; name: string } | null }) {
  return (
    <span className={styles.avatar} style={{ background: colorOf(person?.id ?? 'x', null) }} aria-hidden="true">
      {(person?.name ?? '?').charAt(0).toUpperCase()}
    </span>
  )
}

/** Una línea de lo nuevo: quién, qué (con su enlace) y a qué hora */
function Item({
  item,
  worldId,
  campaignId,
  master,
  fresh
}: {
  item: ActivityItem
  worldId: string
  campaignId: string
  master: boolean
  fresh: boolean
}) {
  const { t } = useTranslation()
  let icon: ReactNode
  let text: ReactNode
  const person = (who: { name: string } | null) => who?.name ?? t('campaignTime.someone')
  if (item.type === 'note') {
    icon = <Avatar person={item.by} />
    const link = (
      <Link
        to="/mundos/$worldId/campanas/$campaignId/notas"
        params={{ worldId, campaignId }}
        search={{ nota: item.noteId, ...(item.by ? { de: item.by.id } : {}) }}
      />
    )
    text = (
      <Trans
        i18nKey={item.created ? 'campaignTime.noteNew' : 'campaignTime.noteChanged'}
        values={{ name: person(item.by), title: item.title }}
        components={{ b: <b />, a: link }}
      />
    )
  } else if (item.type === 'character') {
    icon = <Avatar person={item.by ?? item.owner} />
    const link = (
      <Link
        to="/mundos/$worldId/campanas/$campaignId/personajes/$characterId"
        params={{ worldId, campaignId, characterId: item.characterId }}
        search={{ vista: 'ficha' }}
      />
    )
    text = (
      <Trans
        i18nKey={item.created ? 'campaignTime.characterNew' : 'campaignTime.characterChanged'}
        count={item.changes}
        values={{ name: person(item.by ?? item.owner), character: item.name }}
        components={{ b: <b />, a: link }}
      />
    )
  } else if (item.type === 'revealed') {
    icon = (
      <span className={styles.glyph} aria-hidden="true">
        <Eye size={14} />
      </span>
    )
    const link = item.pageId ? (
      master ? (
        <Link to="/mundos/$worldId/wiki/$pageId" params={{ worldId, pageId: item.pageId }} />
      ) : (
        <Link
          to="/mundos/$worldId/campanas/$campaignId/paginas/$pageId"
          params={{ worldId, campaignId, pageId: item.pageId }}
        />
      )
    ) : (
      <span />
    )
    text = (
      <Trans
        i18nKey={master ? 'campaignTime.revealedMaster' : 'campaignTime.revealedPlayer'}
        values={{ title: item.title }}
        components={{ a: link }}
      />
    )
  } else {
    icon = (
      <span className={styles.glyph} aria-hidden="true">
        <CalendarDays size={14} />
      </span>
    )
    text = (
      <Trans
        i18nKey={item.travel ? 'campaignTime.dateTravel' : 'campaignTime.dateTo'}
        values={{ to: item.to }}
        components={{ b: <b /> }}
      />
    )
  }
  return (
    <li className={styles.item} data-fresh={fresh || undefined}>
      <span className={styles.dot} aria-hidden="true" />
      {icon}
      <span className={styles.text}>{text}</span>
      <time dateTime={item.at} className={styles.time}>
        {fresh ? t('campaignTime.now') : clock.format(new Date(item.at))}
      </time>
    </li>
  )
}

/** La clave de una línea, para saber cuáles acaban de llegar */
const itemKey = (item: ActivityItem) =>
  `${item.type}:${'noteId' in item ? item.noteId : 'characterId' in item ? item.characterId : 'targetId' in item ? item.targetId : item.to}:${item.at}`

/** «Desde tu última visita», en el Inicio de la campaña */
export function ActivityCenter({
  worldId,
  campaign,
  master,
  compact = false
}: {
  worldId: string
  campaign: Campaign
  master: boolean
  compact?: boolean
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const announce = useAnnounce()
  const activity = useCampaignActivity(campaign.id)
  // Lo que había al marcarlo, para verlo otra vez sin volver a contarlo
  const [previous, setPrevious] = useState<{ items: ActivityItem[]; log: Log[] } | null>(null)
  const [showPrevious, setShowPrevious] = useState(false)
  // Lo que llega mientras se mira: «ahora», resaltado un momento
  const seenKeys = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const items = activity.data?.items
  useEffect(() => {
    if (!items) return
    const keys = new Set(items.map(itemKey))
    if (seenKeys.current) {
      const arrived = [...keys].filter((key) => !seenKeys.current?.has(key))
      if (arrived.length > 0) setFresh((current) => new Set([...current, ...arrived]))
    }
    seenKeys.current = keys
  }, [items])
  const mark = useMutation({
    mutationFn: () => api.call('markActivitySeen', { campaignId: campaign.id }),
    onMutate: () => {
      if (activity.data) setPrevious({ items: activity.data.items, log: activity.data.log })
      setShowPrevious(false)
    },
    onSuccess: () => {
      announce(t('campaignTime.nothingNew'))
      setFresh(new Set())
      return client.invalidateQueries({ queryKey: activityKey(campaign.id) })
    }
  })
  if (!activity.data) return null
  const { count, since } = activity.data
  const shown = showPrevious && previous ? previous : activity.data
  const groups = groupByDay(shown.items, shown.log)
  const sinceText = since ? new Date(since).toLocaleDateString('es', { weekday: 'long', day: 'numeric' }) : null
  return (
    <section
      className={compact ? `${styles.center} ${styles.compact}` : styles.center}
      aria-labelledby={`actividad-${campaign.id}`}
      data-tour="inicio-actividad"
    >
      <header className={styles.head}>
        <h2 id={`actividad-${campaign.id}`}>{t('campaignTime.activity')}</h2>
        {count > 0 && (
          <span className={styles.count}>
            <span aria-hidden="true">{count}</span>
            <span className={styles.srOnly}>{t('campaignTime.activityCount', { count })}</span>
          </span>
        )}
        {sinceText && <span className={styles.since}>{sinceText}</span>}
        {count > 0 && (
          <button
            type="button"
            className={styles.mark}
            disabled={mark.isPending}
            aria-label={compact ? t('campaignTime.markSeen') : undefined}
            title={compact ? t('campaignTime.markSeen') : undefined}
            onClick={() => mark.mutate()}
          >
            <Check aria-hidden="true" size={15} />
            {!compact && t('campaignTime.markSeen')}
          </button>
        )}
      </header>
      {groups.length === 0 ? (
        <p className={styles.nothing}>
          <Check aria-hidden="true" size={15} />
          {t('campaignTime.nothingNew')}
          {previous && previous.items.length + previous.log.length > 0 && (
            <button type="button" className={styles.previous} onClick={() => setShowPrevious(true)}>
              {t('campaignTime.seePrevious')}
            </button>
          )}
        </p>
      ) : (
        <ol className={styles.days}>
          {groups.map((group) => (
            <li key={group.day} className={styles.dayGroup}>
              <h3 className={styles.dayHead}>
                <span>{dayTitle(t, group.day)}</span>
                {group.log && group.log.messages + group.log.rolls > 0 && (
                  <span className={styles.session}>
                    <Layers aria-hidden="true" size={12} />
                    {t('campaignTime.session')}
                  </span>
                )}
              </h3>
              {group.log && <LogLine log={group.log} />}
              {group.items.length > 0 && (
                <ul className={styles.items}>
                  {group.items.map((item) => (
                    <Item
                      key={itemKey(item)}
                      item={item}
                      worldId={worldId}
                      campaignId={campaign.id}
                      master={master}
                      fresh={fresh.has(itemKey(item))}
                    />
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/** Lo del registro de un día: cuántos mensajes, tiradas y cosas enseñadas */
function LogLine({ log }: { log: Log }) {
  const { t } = useTranslation()
  const parts = [
    log.messages > 0 && t('campaignTime.sessionLine.messages', { count: log.messages }),
    log.rolls > 0 && t('campaignTime.sessionLine.rolls', { count: log.rolls }),
    log.shown > 0 && t('campaignTime.sessionLine.shown', { count: log.shown })
  ].filter(Boolean)
  return (
    <p className={styles.logLine}>
      <MessageSquare aria-hidden="true" size={13} />
      {parts.join(' · ')}
    </p>
  )
}

/**
 * La insignia de la campaña en la barra (decisión 22) y el aviso en vivo: lo nuevo que llega mientras se está dentro de
 * la campaña, con «Ver», que lleva a su Inicio
 */
export function useActivityBadge(campaignId: string) {
  return useCampaignActivity(campaignId).data?.count ?? 0
}

export function LiveActivityNotice({
  worldId,
  campaign,
  master
}: {
  worldId: string
  campaign: { id: string; name: string }
  master: boolean
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const announce = useAnnounce()
  const activity = useCampaignActivity(campaign.id)
  const known = useRef<Set<string> | null>(null)
  const [notice, setNotice] = useState<ActivityItem | null>(null)
  const items = activity.data?.items
  useEffect(() => {
    if (!items) return
    const keys = new Set(items.map(itemKey))
    const before = known.current
    known.current = keys
    if (!before) return
    const arrived = items.filter((item) => !before.has(itemKey(item)))
    const newest = arrived.sort((a, b) => b.at.localeCompare(a.at))[0]
    if (newest) {
      setNotice(newest)
      announce(t('campaignTime.liveNew', { campaign: campaign.name }))
    }
  }, [items, announce, t, campaign.name])
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 10_000)
    return () => window.clearTimeout(timer)
  }, [notice])
  if (!notice) return null
  return createPortal(
    <aside className={styles.live} aria-label={t('campaignTime.liveNew', { campaign: campaign.name })}>
      <ul className={styles.liveList}>
        <Item item={notice} worldId={worldId} campaignId={campaign.id} master={master} fresh />
      </ul>
      <span className={styles.liveWhere}>{campaign.name}</span>
      <button
        type="button"
        className={styles.liveSee}
        onClick={() => {
          setNotice(null)
          void navigate({ to: '/mundos/$worldId/campanas/$campaignId', params: { worldId, campaignId: campaign.id } })
        }}
      >
        {t('campaignTime.see')}
      </button>
      <button
        type="button"
        className={styles.liveClose}
        aria-label={t('campaignTime.dismiss')}
        onClick={() => setNotice(null)}
      >
        <X aria-hidden="true" size={14} />
      </button>
    </aside>,
    document.body
  )
}
