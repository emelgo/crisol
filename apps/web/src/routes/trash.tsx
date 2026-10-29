import type { TrashItem } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate } from '@tanstack/react-router'
import { type ReactNode, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from '../components/busy-button.tsx'
import { FormError } from '../components/field.tsx'
import { focusAfterRemoving } from '../components/focus.ts'
import styles from '../components/list.module.css'
import { PageTitle } from '../components/page-title.tsx'

const worldRoute = getRouteApi('/mundos/$worldId/papelera')

/** La papelera de la organización (para su propietario): mundos y campañas */
export function OrganizationTrash() {
  const { t } = useTranslation()
  return <TrashPage title={t('trash.title')} back={<Link to="/mundos">{t('worlds.title')}</Link>} scope={{}} />
}

/** La papelera de un mundo (para su máster): sus campañas */
export function WorldTrash() {
  const { t } = useTranslation()
  const { worldId } = worldRoute.useParams()
  const api = useApi()
  const worlds = useQuery({ queryKey: ['worlds'], queryFn: () => api.call('listWorlds', {}) })
  const world = worlds.data?.worlds.find((w) => w.id === worldId)
  return (
    <TrashPage
      title={world ? t('trash.worldTitle', { world: world.name }) : t('trash.title')}
      back={
        <Link to="/mundos/$worldId" params={{ worldId }}>
          {world?.name ?? t('worlds.title')}
        </Link>
      }
      scope={{ worldId }}
    />
  )
}

function TrashPage({ title, back, scope }: { title: string; back: ReactNode; scope: { worldId?: string } }) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const { account, pending } = useAccounts().useAccount()
  const trash = useQuery({
    queryKey: ['trash', scope.worldId ?? 'organization'],
    queryFn: () => api.call('listTrash', scope),
    enabled: Boolean(account)
  })

  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  return (
    <section>
      <p>{back}</p>
      <PageTitle>{title}</PageTitle>
      <FormError message={trash.error ? errorText(trash.error) : null} />
      {trash.data &&
        (trash.data.items.length === 0 ? (
          <p>{t('trash.empty')}</p>
        ) : (
          <ul className={styles.list} aria-label={t('trash.listLabel')}>
            {trash.data.items.map((item) => (
              <TrashEntry key={item.id} item={item} />
            ))}
          </ul>
        ))}
    </section>
  )
}

function TrashEntry({ item }: { item: TrashItem }) {
  const { t, i18n } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const entry = useRef<HTMLLIElement>(null)
  // Al restaurarlo, sale de la papelera: el foco irá al siguiente o al título de la página
  const refocus = useRef(() => {})
  const restore = useMutation({
    mutationFn: () => {
      if (item.kind === 'world') return api.call('restoreWorld', { worldId: item.id })
      if (item.kind === 'page') return api.call('restorePage', { pageId: item.id })
      return api.call('restoreCampaign', { campaignId: item.id })
    },
    onMutate: () => {
      refocus.current = focusAfterRemoving(entry.current)
    },
    // Vuelve a las listas: todo lo que se ve se pide otra vez
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      refocus.current()
    }
  })
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(new Date(item.purgeAt))

  return (
    <li ref={entry} className={styles.item}>
      <span className={`${styles.name} ${styles.entity}`}>{item.name}</span>
      <span className={styles.role}>
        {item.kind === 'world'
          ? t('trash.world')
          : item.kind === 'page'
            ? t('trash.pageOf', { world: item.worldName, count: item.subpages ?? 0 })
            : t('trash.campaignOf', { world: item.worldName })}{' '}
        · {t('trash.purgeAt', { date })}
      </span>
      <BusyButton
        className={styles.secondary}
        aria-label={t('trash.restoreButton', { name: item.name })}
        busy={restore.isPending}
        onClick={() => restore.mutate()}
      >
        {t('trash.restore')}
      </BusyButton>
      <FormError message={restore.error ? errorText(restore.error) : null} />
    </li>
  )
}
