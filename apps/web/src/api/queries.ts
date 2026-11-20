/** Consultas que se piden desde más de un sitio (la página y, antes de abrirla, la barra): sus claves, en uno solo */
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import type { ApiClient } from './client.ts'

/** El historial (de la organización, o de un mundo), por páginas */
export const historyQuery = (api: ApiClient, scope: { worldId?: string }) =>
  infiniteQueryOptions({
    queryKey: ['history', scope.worldId ?? 'organization'],
    queryFn: ({ pageParam }) => api.call('listHistory', { ...scope, ...(pageParam ? { before: pageParam } : {}) }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next
  })

/** Los ajustes de la IA (el conector de Mundos y el modo); con él sale también el de cada campaña */
export const aiSettingsQuery = (api: ApiClient) =>
  queryOptions({ queryKey: ['aiSettings'], queryFn: () => api.call('getAiSettings', {}) })

/** Las apps de IA conectadas a la cuenta (ADR-0030) */
export const aiConnectionsQuery = (api: ApiClient) =>
  queryOptions({ queryKey: ['aiConnections'], queryFn: () => api.call('listAiConnections', {}) })

export const apiTokensQuery = (api: ApiClient) =>
  queryOptions({ queryKey: ['apiTokens'], queryFn: () => api.call('listApiTokens', {}) })

/** La dirección del conector de una campaña: la de Mundos más la campaña (ADR-0030) */
export const campaignConnectorUrl = (connectorUrl: string, campaignId: string) =>
  `${connectorUrl}/campanas/${campaignId}`

/** La papelera (de la organización, o de un mundo) */
export const trashQuery = (api: ApiClient, scope: { worldId?: string }) =>
  queryOptions({
    queryKey: ['trash', scope.worldId ?? 'organization'],
    queryFn: () => api.call('listTrash', scope)
  })
