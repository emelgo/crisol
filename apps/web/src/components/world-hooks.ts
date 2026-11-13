/**
 * Lo que comparten los dos armazones (el de la app, con su barra, y el del mundo a pantalla completa): quién es el
 * propietario, el mundo que se dirige y abrir su historial y su papelera (con lo suyo pedido antes)
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { historyQuery, trashQuery } from '../api/queries.ts'
import { shownPath } from '../shown-path.ts'
import { useWindow } from './window.tsx'

/** Si la cuenta es propietaria de alguna organización: solo ella ve su historial, su papelera y la IA */
export function useIsOwner() {
  const api = useApi()
  const { account } = useAccounts().useAccount()
  const organizations = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.call('listOrganizations', {}),
    enabled: Boolean(account)
  })
  return organizations.data?.organizations.some((o) => o.role === 'owner') ?? false
}

/** El mundo en el que se está, si lo dirige la cuenta (su historial, su papelera y su wiki son suyos) */
export function useMasteredWorld() {
  const api = useApi()
  const { account } = useAccounts().useAccount()
  const worldId = useRouterState({ select: (state) => /^\/mundos\/([^/]+)/.exec(shownPath(state))?.[1] })
  const worlds = useQuery({
    queryKey: ['worlds'],
    queryFn: () => api.call('listWorlds', {}),
    enabled: Boolean(account && worldId)
  })
  return worlds.data?.worlds.find((w) => w.id === worldId && w.role === 'master')?.id
}

/**
 * Historial y Papelera (del mundo que se dirige, o de toda la cuenta): se piden en cuanto el ratón (o el foco) llega a
 * su botón, y se abren encima, sin dejar lo que se está viendo
 */
export function useHistoryAndTrash(worldId: string | undefined) {
  const api = useApi()
  const queryClient = useQueryClient()
  const windows = useWindow()
  const scope = worldId ? { worldId } : {}
  return {
    prefetchHistory: () => void queryClient.prefetchInfiniteQuery({ ...historyQuery(api, scope), staleTime: 10_000 }),
    prefetchTrash: () => void queryClient.prefetchQuery({ ...trashQuery(api, scope), staleTime: 10_000 }),
    openHistory: (trigger?: HTMLElement | null) => windows?.open('historial', trigger ?? undefined),
    openTrash: (trigger?: HTMLElement | null) => windows?.open('papelera', trigger ?? undefined)
  }
}
