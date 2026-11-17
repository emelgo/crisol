/**
 * Lo que se pide del tiempo de una campaña (módulos 8 y 10 · campaña). Sus claves cuelgan de ['campaign', id]: el aviso
 * de que cambió una campaña (también su «hoy», su zona o un día a mano) las vuelve a pedir
 */
import type { HistoryEntry } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../api/context.tsx'

export const todayKey = (campaignId: string) => ['campaign', campaignId, 'today'] as const
export const activityKey = (campaignId: string) => ['activity', campaignId] as const

/** El «hoy» de la campaña, con su clima, su sol y (al máster) la previsión */
export function useCampaignToday(campaignId: string, enabled = true) {
  const api = useApi()
  return useQuery({
    queryKey: todayKey(campaignId),
    queryFn: () => api.call('getCampaignToday', { campaignId }),
    enabled
  })
}

/** La zona horaria del navegador, para agrupar el registro por días reales */
export function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** Lo nuevo desde la última visita (el número de la insignia, en count) */
export function useCampaignActivity(campaignId: string, enabled = true) {
  const api = useApi()
  return useQuery({
    queryKey: activityKey(campaignId),
    queryFn: () => api.call('getCampaignActivity', { campaignId, timeZone: timeZone() }),
    enabled
  })
}

/** Cambiar el «hoy»: con botones (días o semanas) o con una fecha */
export function useSetToday(campaignId: string) {
  const api = useApi()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (change: { days: number } | { weeks: number } | { date: string }) =>
      api.call('setCampaignToday', { campaignId, ...change }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: todayKey(campaignId) })
      void client.invalidateQueries({ queryKey: ['log', campaignId] })
      void client.invalidateQueries({ queryKey: ['chronology'] })
    }
  })
}

/** Las operaciones del «hoy» que se deshacen con «Deshacer» */
const TODAY_ACTIONS = new Set(['setCampaignToday', 'travel'])

/** La última operación del «hoy» de esta campaña hecha desde la web y sin deshacer */
export function lastTodayChange(entries: readonly HistoryEntry[], campaignName: string): HistoryEntry | null {
  return (
    entries.find(
      (entry) =>
        TODAY_ACTIONS.has(entry.action) &&
        entry.via === 'ui' &&
        !entry.undoneBy &&
        !entry.undoes &&
        entry.details.campaign === campaignName
    ) ?? null
  )
}

/** «Deshacer» el último cambio del «hoy» (por el historial del mundo: el registro dice «La fecha vuelve a…») */
export function useUndoToday(worldId: string, campaignId: string, campaignName: string) {
  const api = useApi()
  const client = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const history = await api.call('listHistory', { worldId, limit: 20 })
      const last = lastTodayChange(history.entries, campaignName)
      if (last) await api.call('undoOperation', { operationId: last.id })
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: todayKey(campaignId) })
      void client.invalidateQueries({ queryKey: ['log', campaignId] })
    }
  })
}
