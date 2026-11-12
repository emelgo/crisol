import type { HistoryEntry } from '@crisol/contracts'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate } from '@tanstack/react-router'
import type { TFunction } from 'i18next'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { historyQuery } from '../api/queries.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { EmptyState } from '../components/empty-state.tsx'
import { FormError } from '../components/field.tsx'
import { focusOnMount } from '../components/focus.ts'
import styles from '../components/list.module.css'
import { PageTitle } from '../components/page-title.tsx'
import { summaryOf, undoLayers } from '../summaries.ts'

const worldRoute = getRouteApi('/mundos/$worldId/historial')

/** El historial de toda la organización (para su propietario) */
export function OrganizationHistory() {
  const { t } = useTranslation()
  return <HistoryPage title={t('history.title')} scope={{}} />
}

/** El historial de un mundo (para su máster) */
export function WorldHistory() {
  const { worldId } = worldRoute.useParams()
  return <WorldHistoryOf worldId={worldId} back />
}

/** El de un mundo en la ventana de la barra (dentro de él): sin enlace de vuelta */
export function WorldHistoryWindow({ worldId }: { worldId: string }) {
  return <WorldHistoryOf worldId={worldId} />
}

function WorldHistoryOf({ worldId, back = false }: { worldId: string; back?: boolean }) {
  const { t } = useTranslation()
  const api = useApi()
  const worlds = useQuery({ queryKey: ['worlds'], queryFn: () => api.call('listWorlds', {}) })
  const world = worlds.data?.worlds.find((w) => w.id === worldId)
  return (
    <HistoryPage
      title={world ? t('history.worldTitle', { world: world.name }) : t('history.title')}
      back={
        back && (
          <Link to="/mundos/$worldId" params={{ worldId }}>
            {world?.name ?? t('worlds.title')}
          </Link>
        )
      }
      scope={{ worldId }}
    />
  )
}

/** back: el enlace de vuelta, solo como página; en una ventana no hace falta */
function HistoryPage({ title, back, scope }: { title: string; back?: ReactNode; scope: { worldId?: string } }) {
  const { t, i18n } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const { account, pending } = useAccounts().useAccount()
  const history = useInfiniteQuery({ ...historyQuery(api, scope), enabled: Boolean(account) })
  // Tras deshacer o rehacer, el botón de la operación nueva (arriba): el del deshecho ya no está
  const [focusEntry, setFocusEntry] = useState<string | null>(null)
  // En el de la cuenta, de qué mundo es cada cosa
  const worlds = useQuery({
    queryKey: ['worlds'],
    queryFn: () => api.call('listWorlds', {}),
    enabled: Boolean(account) && !scope.worldId
  })

  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
  const worldNames = new Map((worlds.data?.worlds ?? []).map((w) => [w.id, w.name]))
  const entries = history.data?.pages.flatMap((page) => page.entries) ?? []
  const undone = effectivelyUndone(entries)

  return (
    <section>
      {back && <p>{back}</p>}
      <PageTitle>{title}</PageTitle>
      <FormError message={history.error ? errorText(history.error) : null} />
      {!history.data && !history.error && <Loading />}
      {history.data &&
        (entries.length === 0 ? (
          <EmptyState kind="historial">
            <p className={styles.appear}>{t('history.empty')}</p>
          </EmptyState>
        ) : (
          <ul className={`${styles.list} ${styles.appear}`} aria-label={t('history.listLabel')}>
            {entries.map((entry) => (
              <HistoryItem
                key={entry.id}
                entry={entry}
                undone={undone(entry)}
                date={date}
                focus={entry.id === focusEntry}
                worldName={scope.worldId ? undefined : worldNames.get(entry.worldId ?? '')}
                onUndone={setFocusEntry}
              />
            ))}
          </ul>
        ))}
      {history.hasNextPage && (
        <BusyButton
          className={styles.secondary}
          busy={history.isFetchingNextPage}
          onClick={() => history.fetchNextPage()}
        >
          {t('history.more')}
        </BusyButton>
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
function HistoryItem(props: {
  entry: HistoryEntry
  undone: boolean
  date: Intl.DateTimeFormat
  /** Llevar el foco a su botón (es la operación que se acaba de hacer al deshacer o rehacer) */
  focus: boolean
  /** El mundo de la entrada, en el historial de la cuenta */
  worldName?: string | undefined
  onUndone(entryId: string): void
}) {
  const { entry, undone, date, worldName } = props
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const announce = useAnnounce()
  // Por qué no se pudo deshacer y, si fue en una página, cuál: para ir a sus versiones
  const [conflict, setConflict] = useState<{ text: string; by: HistoryEntry | null } | null>(null)
  // Lo que hay debajo de un deshacer: deshacerlo lo rehace (si las capas son impares) o lo vuelve a deshacer
  const { depth, root } = entry.action === 'undoOperation' ? undoLayers(entry.details) : { depth: 0, root: entry }
  const redo = depth % 2 === 1
  const undo = useMutation({
    mutationFn: () => api.call('undoOperation', { operationId: entry.id }),
    onSuccess: async (result) => {
      if (result.status === 'conflict') {
        const values = result.by ? { actor: actorOf(t, result.by), what: summaryOf(t, result.by) } : null
        const text = values
          ? t(redo ? 'history.redoConflict' : 'history.conflict', values)
          : t(redo ? 'history.redoConflictUnknown' : 'history.conflictUnknown')
        setConflict({ text, by: result.by ?? null })
        announce(text)
        return
      }
      // Lo deshecho puede tocar cualquier cosa de lo que se ve
      await queryClient.invalidateQueries()
      props.onUndone(result.entry.id)
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
        {/* En el de la cuenta, de qué mundo es (dentro de un mundo, sobra) */}
        {worldName && <>{worldName} · </>}
        <time dateTime={entry.at}>{date.format(new Date(entry.at))}</time>
        {/* Desde la web es lo normal: solo se dice cuando fue la IA o Crisol */}
        {entry.via !== 'ui' && ` · ${viaOf(t, entry)}`}
        {undone && ` · ${t('history.undone')}`}
      </span>
      {undoable && (
        <BusyButton
          ref={props.focus ? focusOnMount : undefined}
          className={styles.secondary}
          aria-label={redo ? t('history.redoButton', { what }) : t('history.undoButton', { what })}
          busy={undo.isPending}
          onClick={() => {
            setConflict(null)
            undo.mutate()
          }}
        >
          {redo ? t('history.redo') : t('history.undo')}
        </BusyButton>
      )}
      {conflict && <Conflict text={conflict.text} by={conflict.by} />}
      <FormError message={undo.error ? errorText(undo.error) : null} />
    </li>
  )
}

/** No se pudo deshacer: por qué, y cómo seguir. Si lo de después fue en una página, el enlace a sus versiones */
function Conflict({ text, by }: { text: string; by: HistoryEntry | null }) {
  const { t } = useTranslation()
  const pageId = typeof by?.details.pageId === 'string' ? by.details.pageId : null
  const title = typeof by?.details.title === 'string' ? by.details.title : ''
  return (
    <div className={styles.conflict}>
      <p>{text}</p>
      {pageId && by?.worldId ? (
        <Link to="/mundos/$worldId/wiki/$pageId" params={{ worldId: by.worldId, pageId }}>
          {t('history.conflictVersions', { title })}
        </Link>
      ) : (
        <p>{t('history.conflictHint')}</p>
      )}
    </div>
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
