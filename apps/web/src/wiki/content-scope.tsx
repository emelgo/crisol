/**
 * Desde dónde se buscan las entradas del compendio que se enlazan (`[[@Nombre]]`) o se incrustan (`![[@Nombre]]`):
 * el mundo (su wiki, quien lo lleva), una campaña (lo que ve ella: quien juega, solo lo suyo) o un sistema (sus
 * capítulos). Sin decirlo, la campaña con la que se lee (useReadAs) o, si no, el mundo de la página
 */
import { useQuery } from '@tanstack/react-query'
import { createContext, type ReactNode, useContext } from 'react'
import { useApi } from '../api/context.tsx'
import { PageLinksContext } from './links-context.ts'
import { useReadAs } from './read-as.tsx'

export type ContentScope =
  | { kind: 'world'; worldId: string }
  | { kind: 'campaign'; campaignId: string; worldId?: string }
  | { kind: 'system'; systemId: string }

const ContentScopeContext = createContext<ContentScope | null>(null)

export function ContentScopeProvider({ value, children }: { value: ContentScope; children: ReactNode }) {
  return <ContentScopeContext.Provider value={value}>{children}</ContentScopeContext.Provider>
}

export function useContentScope(): ContentScope | null {
  const given = useContext(ContentScopeContext)
  const readAs = useReadAs()
  const links = useContext(PageLinksContext)
  if (given) return given
  if (readAs)
    return { kind: 'campaign', campaignId: readAs.campaignId, ...(links?.worldId ? { worldId: links.worldId } : {}) }
  return links?.worldId ? { kind: 'world', worldId: links.worldId } : null
}

/** La entrada con ese nombre, como se ve desde aquí (con `system`, el elegido al ponerla) */
export function useLinkedEntry(name: string, system: string | null = null) {
  const api = useApi()
  const scope = useContentScope()
  const input = !scope
    ? null
    : {
        name,
        ...(scope.kind === 'world' ? { worldId: scope.worldId } : {}),
        ...(scope.kind === 'campaign' ? { campaignId: scope.campaignId } : {}),
        ...(scope.kind === 'system' ? { systemId: scope.systemId } : system ? { systemId: system } : {})
      }
  const linked = useQuery({
    queryKey: ['compendium', 'linked', scope, name, system],
    queryFn: () => api.call('getLinkedContent', input ?? { name, systemId: '' }),
    enabled: Boolean(input && name),
    staleTime: 30_000,
    retry: false
  })
  return { scope, linked, entry: linked.data?.entry ?? null, missing: linked.isFetched && !linked.data?.entry }
}

/** Dónde se abre una entrada: en el compendio de su campaña o, en un sistema, en el suyo */
export function entryHref(
  scope: ContentScope | null,
  entry: { key: string; campaignId: string | null; systemId: string }
) {
  const ver = encodeURIComponent(entry.key)
  if (scope?.kind === 'system') return `/sistemas/${scope.systemId}/compendio?ver=${ver}`
  const worldId = scope?.kind === 'world' ? scope.worldId : scope?.kind === 'campaign' ? scope.worldId : undefined
  if (entry.campaignId && worldId) return `/mundos/${worldId}/campanas/${entry.campaignId}/compendio?ver=${ver}`
  return null
}
