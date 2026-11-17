/** Las consultas de las cronologías que usan otras partes de la app (la barra de la campaña), sin cargar sus vistas */
import { useQuery } from '@tanstack/react-query'
import { useApi } from '../api/context.tsx'

/** Las cronologías que conoce la campaña de quien juega */
export function usePlayerChronologies(worldId: string, campaignId: string, enabled = true) {
  const api = useApi()
  return useQuery({
    queryKey: ['chronologies', worldId, campaignId, null],
    queryFn: () => api.call('listChronologies', { worldId, campaignId }),
    enabled
  })
}
