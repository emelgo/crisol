import type { HistoryEntry } from '@crisol/contracts'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate } from '@tanstack/react-router'
import type { TFunction } from 'i18next'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { FormError } from '../components/field.tsx'
import styles from '../components/list.module.css'

const worldRoute = getRouteApi('/mundos/$worldId/historial')

/** El historial de toda la organización (para su propietario) */
export function OrganizationHistory() {
  const { t } = useTranslation()
  return <HistoryPage title={t('history.title')} back={<Link to="/mundos">{t('worlds.title')}</Link>} scope={{}} />
}

/** El historial de un mundo (para su máster) */
export function WorldHistory() {
  const { t } = useTranslation()
  const { worldId } = worldRoute.useParams()
  const api = useApi()
  const worlds = useQuery({ queryKey: ['worlds'], queryFn: () => api.call('listWorlds', {}) })
  const world = worlds.data?.worlds.find((w) => w.id === worldId)
  return (
    <HistoryPage
      title={world ? t('history.worldTitle', { world: world.name }) : t('history.title')}
      back={
        <Link to="/mundos/$worldId" params={{ worldId }}>
          {world?.name ?? t('worlds.title')}
        </Link>
      }
      scope={{ worldId }}
    />
  )
}

function HistoryPage({ title, back, scope }: { title: string; back: ReactNode; scope: { worldId?: string } }) {
  const { t, i18n } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const { account, pending } = useAccounts().useAccount()
  const history = useInfiniteQuery({
    queryKey: ['history', scope.worldId ?? 'organization'],
    queryFn: ({ pageParam }) => api.call('listHistory', { ...scope, ...(pageParam ? { before: pageParam } : {}) }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next,
    enabled: Boolean(account)
  })

  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
  const entries = history.data?.pages.flatMap((page) => page.entries) ?? []

  return (
    <section>
      <p>{back}</p>
      <h1>{title}</h1>
      <FormError message={history.error ? errorText(history.error) : null} />
      {history.data &&
        (entries.length === 0 ? (
          <p>{t('history.empty')}</p>
        ) : (
          <ul className={styles.list} aria-label={t('history.listLabel')}>
            {entries.map((entry) => (
              <HistoryItem key={entry.id} entry={entry} date={date} />
            ))}
          </ul>
        ))}
      {history.hasNextPage && (
        <button
          type="button"
          className={styles.secondary}
          disabled={history.isFetchingNextPage}
          onClick={() => history.fetchNextPage()}
        >
          {t('history.more')}
        </button>
      )}
    </section>
  )
}

/** Una operación, con «Deshacer» si se puede (no está deshecha ni es del sistema) */
function HistoryItem({ entry, date }: { entry: HistoryEntry; date: Intl.DateTimeFormat }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const [conflict, setConflict] = useState<string | null>(null)
  const undo = useMutation({
    mutationFn: () => api.call('undoOperation', { operationId: entry.id }),
    onSuccess: async (result) => {
      if (result.status === 'conflict') {
        setConflict(
          result.by
            ? t('history.conflict', { actor: actorOf(t, result.by), what: summaryOf(t, result.by) })
            : t('history.conflictUnknown')
        )
        return
      }
      // Lo deshecho puede tocar cualquier cosa de lo que se ve
      await queryClient.invalidateQueries()
    }
  })
  const summary = summaryOf(t, entry)
  const undoable = !entry.undoneBy && entry.via !== 'system'

  return (
    <li className={styles.item}>
      <span className={styles.name}>
        <strong>{actorOf(t, entry)}</strong> {summary}
      </span>
      <span className={styles.role}>
        <time dateTime={entry.at}>{date.format(new Date(entry.at))}</time> · {viaOf(t, entry)}
        {entry.undoneBy && ` · ${t('history.undone')}`}
      </span>
      {undoable && (
        <button
          type="button"
          className={styles.secondary}
          aria-label={t('history.undoButton', { what: summary })}
          disabled={undo.isPending}
          onClick={() => {
            setConflict(null)
            undo.mutate()
          }}
        >
          {t('history.undo')}
        </button>
      )}
      {conflict && <p className={styles.confirm}>{conflict}</p>}
      <FormError message={undo.error ? errorText(undo.error) : null} />
    </li>
  )
}

function actorOf(t: TFunction, entry: HistoryEntry) {
  if (entry.actor) return entry.actor.name
  return entry.via === 'system' ? t('history.system') : t('history.deletedAccount')
}

function viaOf(t: TFunction, entry: HistoryEntry) {
  if (entry.via === 'ai') return entry.tool ? t('history.via.aiTool', { tool: entry.tool }) : t('history.via.ai')
  return t(`history.via.${entry.via}`)
}

/** La frase de cada acción, con sus datos; una que la web aún no conoce se dice tal cual */
function summaryOf(t: TFunction, { action, details }: Pick<HistoryEntry, 'action' | 'details'>): string {
  const text = (value: unknown) => String(value ?? '')
  switch (action) {
    case 'undoOperation': {
      const original = { action: text(details.action), details: (details.details ?? {}) as Record<string, unknown> }
      return t('history.actions.undoOperation', { what: summaryOf(t, original) })
    }
    case 'createOrganization':
      return t('history.actions.createOrganization', { name: text(details.name) })
    case 'bootstrapOwner':
      return t('history.actions.bootstrapOwner')
    case 'createWorld':
      return t('history.actions.createWorld', { name: text(details.name) })
    case 'renameWorld':
      return t('history.actions.renameWorld', { from: text(details.from), to: text(details.to) })
    case 'createCampaign':
      return t('history.actions.createCampaign', { name: text(details.name), world: text(details.world) })
    case 'renameCampaign':
      return t('history.actions.renameCampaign', { from: text(details.from), to: text(details.to) })
    case 'regenerateInvitation':
      return t('history.actions.regenerateInvitation', { campaign: text(details.campaign) })
    case 'setInvitationsOpen':
      return details.open
        ? t('history.actions.openInvitations', { campaign: text(details.campaign) })
        : t('history.actions.closeInvitations', { campaign: text(details.campaign) })
    case 'joinCampaign':
      return t('history.actions.joinCampaign', { campaign: text(details.campaign) })
    case 'removeMember':
      return t('history.actions.removeMember', { member: text(details.member), campaign: text(details.campaign) })
    case 'leaveCampaign':
      return t('history.actions.leaveCampaign', { campaign: text(details.campaign) })
    case 'deleteWorld':
      return t('history.actions.deleteWorld', { name: text(details.name) })
    case 'deleteCampaign':
      return t('history.actions.deleteCampaign', { name: text(details.name), world: text(details.world) })
    case 'restoreWorld':
      return t('history.actions.restoreWorld', { name: text(details.name) })
    case 'restoreCampaign':
      return t('history.actions.restoreCampaign', { name: text(details.name), world: text(details.world) })
    default:
      return t('history.actions.unknown', { action })
  }
}
