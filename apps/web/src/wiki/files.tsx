/**
 * Los archivos: los de un mundo y, aparte, los comunes de la cuenta, que comparten todos sus mundos (ADR-0005; también
 * en su pantalla, fuera de los mundos). Las pantallas: la lista-árbol es files-section.tsx y sus piezas, file-*.tsx
 */

import { useQueries, useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { Loading } from '../components/brand.tsx'
import { failed, LoadError, SectionError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Tour } from '../components/tour.tsx'
import { COMMON, type Scope, splitScopes, worldRoot } from './file-tree.ts'
import styles from './files.module.css'
import { FilesSection, type OtherScope } from './files-section.tsx'

const route = getRouteApi('/mundos/$worldId/archivos')

/** Los archivos de un mundo: la misma pantalla que los comunes, sin el marco de la wiki (solo para quien lo dirige) */
export function WikiFiles() {
  const { t } = useTranslation()
  const { worldId } = route.useParams()
  const api = useApi()
  const { account, pending } = useAccounts().useAccount()
  const worlds = useQuery({
    queryKey: ['worlds'],
    queryFn: () => api.call('listWorlds', {}),
    enabled: Boolean(account)
  })
  const world = worlds.data?.worlds.find((w) => w.id === worldId && w.role === 'master')
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  if (!worlds.data)
    return failed(worlds) ? <LoadError error={worlds.error} onRetry={() => worlds.refetch()} /> : <Loading />
  if (!world) {
    return (
      <section className={styles.page}>
        <PageTitle>{t('wiki.notFound')}</PageTitle>
        <Link to="/mundos">{t('worlds.title')}</Link>
      </section>
    )
  }
  return <FilesPage worldId={worldId} world={world.name} organizationId={world.organizationId} />
}

/** Si la cuenta administra la organización: solo entonces sube y cambia los comunes */
function useOwns(organizationId: string | undefined) {
  const api = useApi()
  const organizations = useQuery({ queryKey: ['organizations'], queryFn: () => api.call('listOrganizations', {}) })
  return organizations.data?.organizations.some((o) => o.id === organizationId && o.role === 'owner') ?? false
}

/** Los de un mundo y, dentro, la carpeta «Comunes»: los de la cuenta, la misma en todos sus mundos */
function FilesPage({ worldId, world, organizationId }: { worldId: string; world: string; organizationId: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const files = useQuery({ queryKey: ['files', worldId], queryFn: () => api.call('listFiles', { worldId }) })
  const ownsCommon = useOwns(organizationId)
  // Las mismas listas mientras no cambien los datos
  const scopes = useMemo(() => files.data && splitScopes(files.data), [files.data])
  const commonLabel = t('files.common')
  const others = useMemo<OtherScope[]>(
    () => [
      {
        id: COMMON,
        name: commonLabel,
        worldId: null,
        organizationId,
        target: { organizationId },
        data: scopes?.common,
        canWrite: ownsCommon
      }
    ],
    [commonLabel, organizationId, scopes?.common, ownsCommon]
  )
  return (
    <section className={styles.page}>
      {failed(files) && <SectionError error={files.error} onRetry={() => files.refetch()} />}
      <FilesSection
        target={{ worldId }}
        data={scopes?.own}
        cacheKey={['files', worldId]}
        canWrite
        empty={t('files.empty')}
        title={<PageTitle>{t('files.worldTitle', { world })}</PageTitle>}
        others={others}
      />
      {files.data && <FilesTour />}
    </section>
  )
}

/** Lo propio de cada mundo de una lista de listFiles (fuera del componente: así no cambia en cada pintado) */
const ownScopes = (lists: { data?: Scope | undefined }[]) =>
  lists.map((list) => (list.data ? splitScopes(list.data).own : undefined))

/** Los comunes de la cuenta, en su pantalla, fuera de los mundos («Archivos» en la barra de Mis mundos) */
export function CommonFiles() {
  const { t } = useTranslation()
  const api = useApi()
  const { account, pending } = useAccounts().useAccount()
  const organizations = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.call('listOrganizations', {}),
    enabled: Boolean(account)
  })
  const owned = organizations.data?.organizations.find((o) => o.role === 'owner')
  const files = useQuery({
    queryKey: ['commonFiles'],
    queryFn: () => api.call('listCommonFiles', {}),
    enabled: Boolean(owned)
  })
  // Cada mundo que dirige, en su carpeta (Enrique, 2026-11-13): sale al crearlo, no se borra y se va con él
  const worlds = useQuery({
    queryKey: ['worlds'],
    queryFn: () => api.call('listWorlds', {}),
    enabled: Boolean(owned)
  })
  const mine = useMemo(() => (worlds.data?.worlds ?? []).filter((world) => world.role === 'master'), [worlds.data])
  // Lo de cada uno (sin sus comunes), la misma lista mientras no cambie
  const worldScopes = useQueries({
    queries: mine.map((world) => ({
      queryKey: ['files', world.id],
      queryFn: () => api.call('listFiles', { worldId: world.id })
    })),
    combine: ownScopes
  })
  const others = useMemo<OtherScope[]>(
    () =>
      mine.map((world, i) => ({
        id: worldRoot(world.id),
        name: world.name,
        worldId: world.id,
        organizationId: world.organizationId,
        color: world.color,
        target: { worldId: world.id },
        data: worldScopes[i],
        canWrite: true
      })),
    [mine, worldScopes]
  )
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  return (
    <section className={styles.page}>
      {failed(files) && <SectionError error={files.error} onRetry={() => files.refetch()} />}
      {owned ? (
        <FilesSection
          target={{ organizationId: owned.id }}
          data={files.data}
          cacheKey={['commonFiles']}
          canWrite
          empty={t('files.commonEmpty')}
          title={<PageTitle>{t('files.commonTitle')}</PageTitle>}
          others={others}
        />
      ) : (
        <PageTitle>{t('files.commonTitle')}</PageTitle>
      )}
      {owned && files.data && <FilesTour />}
    </section>
  )
}

/** El tutorial guiado de Archivos: subir, la lista y buscar */
function FilesTour() {
  const { t } = useTranslation()
  return (
    <Tour
      id="archivos"
      steps={[
        { target: '[data-tour="archivos-subir"]', text: t('tour.files.upload') },
        { target: '[data-tour="archivos-lista"]', text: t('tour.files.list') },
        { target: '[data-tour="archivos-buscar"]', text: t('tour.files.search') }
      ]}
    />
  )
}
