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
import { summaryOf, undoLayers } from '../summaries.ts'

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
  const undone = effectivelyUndone(entries)

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
              <HistoryItem key={entry.id} entry={entry} undone={undone(entry)} date={date} />
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

/**
 * Si lo que hizo una operación ya no está: la deshizo otra que no se ha deshecho a su vez (si se deshizo, se rehízo).
 * Lo que la deshizo es más reciente, así que ya está cargado; si no lo está, se da por deshecha
 */
function effectivelyUndone(entries: HistoryEntry[]) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  const undone = (entry: HistoryEntry): boolean => {
    if (!entry.undoneBy) return false
    const by = byId.get(entry.undoneBy)
    return !by || !undone(by)
  }
  return undone
}

/**
 * Una operación. Lo deshecho, tachado. El botón, solo en la última de cada cadena (las otras ya están deshechas) y
 * nunca en lo del sistema: en un deshacer dice «Rehacer»; en lo demás, «Deshacer»
 */
function HistoryItem({ entry, undone, date }: { entry: HistoryEntry; undone: boolean; date: Intl.DateTimeFormat }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const [conflict, setConflict] = useState<string | null>(null)
  // Lo que hay debajo de un deshacer: deshacerlo lo rehace (si las capas son impares) o lo vuelve a deshacer
  const { depth, root } = entry.action === 'undoOperation' ? undoLayers(entry.details) : { depth: 0, root: entry }
  const redo = depth % 2 === 1
  const undo = useMutation({
    mutationFn: () => api.call('undoOperation', { operationId: entry.id }),
    onSuccess: async (result) => {
      if (result.status === 'conflict') {
        const values = result.by ? { actor: actorOf(t, result.by), what: summaryOf(t, result.by) } : null
        if (redo) setConflict(values ? t('history.redoConflict', values) : t('history.redoConflictUnknown'))
        else setConflict(values ? t('history.conflict', values) : t('history.conflictUnknown'))
        return
      }
      // Lo deshecho puede tocar cualquier cosa de lo que se ve
      await queryClient.invalidateQueries()
    }
  })
  const what = summaryOf(t, root)
  const undoable = !entry.undoneBy && entry.via !== 'system'

  return (
    <li className={styles.item}>
      <span className={undone ? `${styles.name} ${styles.undone}` : styles.name}>
        <strong>{actorOf(t, entry)}</strong> {summaryOf(t, entry)}
      </span>
      <span className={styles.role}>
        <time dateTime={entry.at}>{date.format(new Date(entry.at))}</time> · {viaOf(t, entry)}
        {undone && ` · ${t('history.undone')}`}
      </span>
      {undoable && (
        <button
          type="button"
          className={styles.secondary}
          aria-label={redo ? t('history.redoButton', { what }) : t('history.undoButton', { what })}
          disabled={undo.isPending}
          onClick={() => {
            setConflict(null)
            undo.mutate()
          }}
        >
          {redo ? t('history.redo') : t('history.undo')}
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
