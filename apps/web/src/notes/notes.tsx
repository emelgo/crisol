/**
 * Las notas del jugador (docs/specs/notas-jugador.md): «Mis notas» en el espacio de la campaña (y en su Mesa), con su
 * árbol de subpáginas y el editor de la wiki, que se guarda solo. En el móvil, la lista y la nota a pantalla completa.
 * El máster las lee, sin tocarlas, desde el Inicio de la campaña (junto a cada jugador)
 */
import type { PlayerNote, PlayerNoteItem } from '@crisol/contracts'
import type { NamedPage } from '@crisol/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, FilePlus2, NotebookPen, RotateCcw, Trash2 } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { type PageLinks, PageLinksContext } from '../wiki/page-links.tsx'
import { ReadAsProvider } from '../wiki/read-as.tsx'
import { NoteBody } from './note-body.tsx'
import styles from './notes.module.css'

/** Las consultas de las notas de una cuenta en una campaña («mine»: las de quien mira) */
export const notesKey = (campaignId: string, userId?: string) => ['notes', campaignId, userId ?? 'mine']
const noteKey = (id: string) => ['note', id]

export function useNotes(campaignId: string, userId?: string, trash = false) {
  const api = useApi()
  return useQuery({
    queryKey: [...notesKey(campaignId, userId), trash ? 'trash' : 'live'],
    queryFn: () => api.call('listPlayerNotes', { campaignId, ...(userId ? { userId } : {}), trash })
  })
}

/** Una nota en su árbol, con sus hijas */
interface Branch {
  note: PlayerNoteItem
  children: Branch[]
}

/** El árbol de una lista en su orden: las de arriba y, debajo de cada una, las suyas */
export function noteTree(notes: readonly PlayerNoteItem[]): Branch[] {
  const byParent = new Map<string | null, PlayerNoteItem[]>()
  const ids = new Set(notes.map((n) => n.id))
  for (const note of notes) {
    // Una cuya madre no está en la lista, arriba
    const parent = note.parentId && ids.has(note.parentId) ? note.parentId : null
    byParent.set(parent, [...(byParent.get(parent) ?? []), note])
  }
  const grow = (parent: string | null, seen: Set<string>): Branch[] =>
    (byParent.get(parent) ?? [])
      .filter((note) => !seen.has(note.id))
      .map((note) => ({ note, children: grow(note.id, new Set([...seen, note.id])) }))
  return grow(null, new Set())
}

/** El título, o «Sin título» */
export function useNoteTitle() {
  const { t } = useTranslation()
  return (note: { title: string }) => note.title.trim() || t('notes.untitled')
}

/** Crear una nota (o una subnota) y darla */
function useCreateNote(campaignId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (parentId: string | null) => api.call('createPlayerNote', { campaignId, parentId }),
    onSuccess: async ({ note }) => {
      queryClient.setQueryData(noteKey(note.id), { note })
      await queryClient.invalidateQueries({ queryKey: notesKey(campaignId) })
    }
  })
}

/** El árbol de las notas: tocar una la abre; quien las escribe crea subnotas y las borra */
export function NoteTree({
  campaignId,
  userId,
  selected,
  onOpen,
  editable
}: {
  campaignId: string
  /** De quién (el máster, de un jugador); sin él, las de quien mira */
  userId?: string
  selected: string | null
  onOpen: (note: PlayerNoteItem) => void
  editable: boolean
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const titleOf = useNoteTitle()
  const notes = useNotes(campaignId, userId)
  const trash = useNotes(campaignId, userId, true)
  const create = useCreateNote(campaignId)
  const refresh = () => queryClient.invalidateQueries({ queryKey: notesKey(campaignId, userId) })
  const remove = useMutation({
    mutationFn: (note: PlayerNoteItem) => api.call('deletePlayerNote', { id: note.id }),
    onSuccess: (_, note) => {
      announce(t('notes.deleted', { title: titleOf(note) }))
      return refresh()
    },
    onError: (error) => announce(errorText(error))
  })
  const restore = useMutation({
    mutationFn: (note: PlayerNoteItem) => api.call('restorePlayerNote', { id: note.id }),
    onSuccess: (_, note) => {
      announce(t('notes.restored', { title: titleOf(note) }))
      return refresh()
    },
    onError: (error) => announce(errorText(error))
  })
  const make = (parentId: string | null) =>
    create.mutate(parentId, {
      onSuccess: ({ note }) => onOpen(note),
      onError: (error) => announce(errorText(error))
    })
  if (!notes.data) return failed(notes) ? <LoadError error={notes.error} onRetry={() => notes.refetch()} /> : null
  const tree = noteTree(notes.data.notes)
  const trashed = trash.data?.notes ?? []
  const branch = (b: Branch, level: number): ReactNode => (
    <li key={b.note.id}>
      <div
        className={styles.row}
        data-current={b.note.id === selected || undefined}
        style={{ '--level': level } as never}
      >
        <button
          type="button"
          className={styles.open}
          aria-current={b.note.id === selected ? 'page' : undefined}
          onClick={() => onOpen(b.note)}
        >
          {b.note.icon ? <span aria-hidden="true">{b.note.icon}</span> : <NotebookPen aria-hidden="true" size={15} />}
          <span className={styles.name}>{titleOf(b.note)}</span>
        </button>
        {editable && (
          <span className={styles.rowActions}>
            <button
              type="button"
              className={styles.icon}
              aria-label={t('notes.newChild', { title: titleOf(b.note) })}
              title={t('notes.newChildShort')}
              onClick={() => make(b.note.id)}
            >
              <FilePlus2 aria-hidden="true" size={15} />
            </button>
            <button
              type="button"
              className={styles.icon}
              aria-label={t('notes.delete', { title: titleOf(b.note) })}
              title={t('notes.deleteShort')}
              onClick={() => remove.mutate(b.note)}
            >
              <Trash2 aria-hidden="true" size={15} />
            </button>
          </span>
        )}
      </div>
      {b.children.length > 0 && <ul className={styles.tree}>{b.children.map((c) => branch(c, level + 1))}</ul>}
    </li>
  )
  return (
    <div className={styles.list} data-tour="notas-lista">
      {tree.length === 0 && !editable && <p className={styles.quiet}>{t('notes.noneOther')}</p>}
      {tree.length > 0 && (
        <ul className={styles.tree} aria-label={t('notes.list')}>
          {tree.map((b) => branch(b, 0))}
        </ul>
      )}
      {editable && (
        // «Nueva nota», como un recuadro más de la lista, discontinuo y al final
        <button
          type="button"
          className={styles.new}
          data-tour="notas-nueva"
          disabled={create.isPending}
          onClick={() => make(null)}
        >
          <FilePlus2 aria-hidden="true" size={16} />
          {t('notes.new')}
        </button>
      )}
      {editable && trashed.length > 0 && (
        <details className={styles.trash}>
          <summary>{t('notes.trash', { count: trashed.length })}</summary>
          <ul>
            {trashed.map((note) => (
              <li key={note.id} className={styles.trashRow}>
                <span className={styles.name}>{titleOf(note)}</span>
                <button
                  type="button"
                  className={styles.icon}
                  aria-label={t('notes.restore', { title: titleOf(note) })}
                  title={t('notes.restoreShort')}
                  onClick={() => restore.mutate(note)}
                >
                  <RotateCcw aria-hidden="true" size={15} />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

/**
 * Las páginas que se enlazan en una nota: las que conoce su campaña (quien escribe, para `[[`) y las de sus enlaces tal
 * como las resolvió el servidor (también para el máster). Desde una nota no se crean páginas
 */
function useNoteLinks(worldId: string, campaignId: string, note: PlayerNote | undefined): PageLinks {
  const api = useApi()
  const tree = useQuery({
    queryKey: ['pages', worldId, 'player', campaignId, null, 'tree'],
    queryFn: () => api.call('listPageTree', { worldId, levels: 32, campaignId }),
    enabled: Boolean(note?.editable)
  })
  return useMemo(() => {
    const byId = new Map<string, NamedPage>()
    for (const row of tree.data?.pages ?? []) byId.set(row.id, { id: row.id, title: row.title, aliases: [], path: [] })
    for (const link of note?.links ?? [])
      if (link.pageId && !byId.has(link.pageId))
        byId.set(link.pageId, { id: link.pageId, title: link.title, aliases: [], path: [] })
    const names = [...byId.values()]
    return {
      worldId,
      names,
      byId,
      files: [],
      canCreate: false,
      create: () => Promise.reject(new Error('Desde una nota no se crean páginas'))
    }
  }, [tree.data, note?.links, worldId])
}

type SaveState = 'saved' | 'saving' | 'failed'

/**
 * Guardar una nota con su versión, de uno en uno (lo de ahora espera a lo de antes). Si cambió en otro sitio, se vuelve
 * a leer y el editor se pone al día
 */
function useNoteSaver(note: PlayerNote | undefined, onReload: () => void) {
  const api = useApi()
  const queryClient = useQueryClient()
  const announce = useAnnounce()
  const { t } = useTranslation()
  const [state, setState] = useState<SaveState>('saved')
  const version = useRef(note?.version ?? 1)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const id = note?.id
  const campaignId = note?.campaignId
  useEffect(() => {
    if (note) version.current = Math.max(version.current, note.version)
  }, [note])
  const save = useCallback(
    (patch: { title?: string; markdown?: string }) => {
      if (!id || !campaignId) return
      setState('saving')
      queue.current = queue.current.then(async () => {
        try {
          const out = await api.call('updatePlayerNote', { id, version: version.current, ...patch })
          version.current = out.note.version
          queryClient.setQueryData(noteKey(id), out)
          if (patch.title !== undefined) await queryClient.invalidateQueries({ queryKey: notesKey(campaignId) })
          setState('saved')
        } catch (error) {
          setState('failed')
          if (error instanceof ApiError && error.code === 'NOTE_CHANGED') {
            announce(t('notes.changed'))
            await queryClient.invalidateQueries({ queryKey: noteKey(id) })
            onReload()
          }
        }
      })
    },
    [api, queryClient, announce, t, id, campaignId, onReload]
  )
  return { state, save, typing: () => setState('saving') }
}

/** Una nota abierta: su título (se escribe en el sitio) y su texto */
export function NotePane({
  worldId,
  campaignId,
  noteId,
  back,
  compact = false
}: {
  worldId: string
  campaignId: string
  noteId: string
  /** En el móvil, la vuelta a la lista */
  back?: ReactNode
  /** En una ventana de la Mesa: sin el título grande */
  compact?: boolean
}) {
  const { t } = useTranslation()
  const api = useApi()
  const titleOf = useNoteTitle()
  const titleId = useId()
  const query = useQuery({ queryKey: noteKey(noteId), queryFn: () => api.call('getPlayerNote', { id: noteId }) })
  const note = query.data?.note
  // Cambia cuando hay que volver a montar el editor con lo guardado (cambió en otro sitio)
  const [round, setRound] = useState(0)
  const reload = useCallback(() => setRound((n) => n + 1), [])
  const { state, save, typing } = useNoteSaver(note, reload)
  const links = useNoteLinks(worldId, campaignId, note)
  const [title, setTitle] = useState<string | null>(null)
  const titleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(titleTimer.current), [])
  if (!note) return failed(query) ? <LoadError error={query.error} onRetry={() => query.refetch()} /> : null
  const shownTitle = title ?? note.title
  const saveTitle = (value: string) => {
    clearTimeout(titleTimer.current)
    if (value.trim() !== note.title.trim()) save({ title: value.trim() })
  }
  return (
    <ReadAsProvider value={{ campaignId }}>
      <PageLinksContext.Provider value={links}>
        <article className={styles.note} data-compact={compact || undefined} aria-labelledby={titleId}>
          <div className={styles.noteHead}>
            {back}
            {note.editable ? (
              <input
                id={titleId}
                className={styles.title}
                value={shownTitle}
                placeholder={t('notes.untitled')}
                aria-label={t('notes.titleField')}
                autoComplete="off"
                data-1p-ignore=""
                data-lpignore="true"
                data-tour="notas-titulo"
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setTitle(value)
                  typing()
                  clearTimeout(titleTimer.current)
                  titleTimer.current = setTimeout(() => saveTitle(value), 800)
                }}
                onBlur={(event) => saveTitle(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    saveTitle(event.currentTarget.value)
                    event.currentTarget.closest('article')?.querySelector<HTMLElement>('[role="textbox"]')?.focus()
                  } else if (event.key === 'Escape') {
                    clearTimeout(titleTimer.current)
                    setTitle(null)
                  }
                }}
              />
            ) : (
              <h2 id={titleId} className={styles.title}>
                {titleOf(note)}
              </h2>
            )}
            {note.editable && (
              <p className={styles.saveState} aria-hidden="true" data-failed={state === 'failed' || undefined}>
                {t(`notes.${state}`)}
              </p>
            )}
          </div>
          <div className={styles.bodyBox} data-tour="notas-texto">
            <NoteBody
              key={`${note.id}:${round}`}
              markdown={note.markdown}
              editable={note.editable}
              label={t('notes.body', { title: titleOf(note) })}
              onDirty={typing}
              onChange={(markdown) => save({ markdown })}
            />
          </div>
        </article>
      </PageLinksContext.Provider>
    </ReadAsProvider>
  )
}

/** La vuelta a la lista, en el móvil */
export function BackToList({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <button type="button" className={styles.back} onClick={onBack} aria-label={label} title={label}>
      <ArrowLeft aria-hidden="true" size={20} />
    </button>
  )
}
