/**
 * El «hoy» en las cronologías (decisión 10; lienzo, pantallas 5, 5b y 5c): la línea «Hoy» y «hace / dentro de N días»
 * en las vistas de una campaña; en la del mundo, «Hoy de…» elige la campaña (si hay alguna con fecha). El «hoy» se pasa
 * al calendario de la cronología con su correspondencia
 */
import type { CalendarView, CampaignDate } from '@crisol/contracts'
import { convertDate, dayNumber, type FullDate } from '@crisol/domain'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { todayKey } from './queries.ts'
import styles from './time.module.css'
import { chipDate } from './words.ts'

/** La línea «Hoy» de una cronología: su día en el calendario de ella, cómo se lee y de qué campaña es */
export interface TodayMark {
  day: number
  text: string
  campaign: string | null
}

/** El «hoy» en el calendario de una cronología (null si no se puede pasar a él) */
export function todayIn(
  calendars: readonly CalendarView[],
  calendarId: string,
  today: Pick<CampaignDate, 'calendarId' | 'date' | 'day'>
): number | null {
  if (today.calendarId === calendarId) return today.day
  const world = calendars.map((c) => ({ id: c.id, primary: c.primary, definition: c.definition }))
  const target = calendars.find((c) => c.id === calendarId)
  const found = convertDate(world, today.calendarId, calendarId, today.date)?.start
  if (!target || !found || found.month === undefined || found.day === undefined) return null
  try {
    return dayNumber(target.definition, found as FullDate)
  } catch {
    return null
  }
}

/** «Hoy de…» en la cronología del mundo: las campañas del mundo que tienen fecha (lo elegido se recuerda) */
export function useWorldTodays(worldId: string) {
  const api = useApi()
  const campaigns = useQuery({
    queryKey: ['campaigns', worldId],
    queryFn: () => api.call('listCampaigns', { worldId })
  })
  const mine = (campaigns.data?.campaigns ?? []).filter((c) => c.role === 'master')
  const todays = useQueries({
    queries: mine.map((campaign) => ({
      queryKey: todayKey(campaign.id),
      queryFn: () => api.call('getCampaignToday', { campaignId: campaign.id })
    }))
  })
  return mine.flatMap((campaign, index) => {
    const data = todays[index]?.data
    return data?.today ? [{ campaign, today: data.today, zone: data.zone }] : []
  })
}

const rememberKey = (worldId: string) => `crisol.cronologias.hoy.${worldId}`

export function useChosenToday(worldId: string) {
  const options = useWorldTodays(worldId)
  const [chosen, setChosen] = useState<string | null>(() => {
    try {
      return localStorage.getItem(rememberKey(worldId))
    } catch {
      return null
    }
  })
  const choose = (id: string) => {
    setChosen(id)
    try {
      localStorage.setItem(rememberKey(worldId), id)
    } catch {
      // Sin almacenamiento: se queda para esta visita
    }
  }
  const current = chosen === 'none' ? null : (options.find((o) => o.campaign.id === chosen) ?? options[0] ?? null)
  return { options, current, chosen: current?.campaign.id ?? 'none', choose }
}

/** El selector «Hoy de…» de la cabecera de la cronología del mundo */
export function TodayOf({
  options,
  value,
  onChange
}: {
  options: ReturnType<typeof useWorldTodays>
  value: string
  onChange: (id: string) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  if (options.length === 0) return null
  return (
    <span className={styles.todayOf}>
      <label htmlFor={id}>{t('campaignTime.todayOf')}</label>
      <select id={id} className={styles.select} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(({ campaign, today }) => (
          <option key={campaign.id} value={campaign.id}>
            {campaign.name} · {chipDate(today.text)}
          </option>
        ))}
        <option value="none">{t('campaignTime.todayNone')}</option>
      </select>
    </span>
  )
}
