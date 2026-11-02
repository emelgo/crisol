import type { Page, WikiPreferences } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Bookmark, BookmarkCheck, Folder, Plus } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { FormError } from '../components/field.tsx'
import { focusOnMount, useReturnFocus } from '../components/focus.ts'
import form from '../components/form.module.css'
import list from '../components/list.module.css'
import styles from './navigation.module.css'
import { childrenKey } from './tree.tsx'

/** Cuántas pestañas sin fijar se quedan abiertas: al abrir otra, se cierra la más antigua */
const LOOSE_TABS = 8

export const preferencesKey = (worldId: string) => ['pages', worldId, 'preferences']

/** Las pestañas y los marcadores de la cuenta en esta wiki, y con qué guardar cada parte */
function usePreferences(worldId: string) {
  const api = useApi()
  const queryClient = useQueryClient()
  const key = preferencesKey(worldId)
  const preferences = useQuery({ queryKey: key, queryFn: () => api.call('getWikiPreferences', { worldId }) })
  // Las pestañas cambian solas al navegar: se ven en el acto y se guardan en fila; solo cuenta la respuesta de la última
  const latest = useRef(0)
  const tabs = useMutation({
    scope: { id: `pestanas-${worldId}` },
    mutationFn: ({ next }: { next: WikiPreferences['tabs']; n: number }) =>
      api.call('setWikiTabs', { worldId, tabs: stored(next) }),
    onMutate: ({ next }) => {
      queryClient.setQueryData<WikiPreferences>(key, (old) => (old ? { ...old, tabs: next } : old))
    },
    onSuccess: (saved, { n }) => {
      if (n === latest.current) queryClient.setQueryData(key, saved)
    }
  })
  const saveTabs = useCallback(
    (next: WikiPreferences['tabs']) => {
      latest.current += 1
      tabs.mutate({ next, n: latest.current })
    },
    [tabs.mutate]
  )
  const bookmarks = useMutation({
    mutationFn: (next: { name: string; pages: string[] }[]) => api.call('setBookmarks', { worldId, bookmarks: next }),
    onSuccess: (saved) => queryClient.setQueryData(key, saved)
  })
  return { preferences: preferences.data, saveTabs, saveBookmarks: bookmarks }
}

const stored = (tabs: WikiPreferences['tabs']) => tabs.map(({ pageId, pinned }) => ({ pageId, pinned }))
/** Las fijadas, delante */
const ordered = <T extends { pinned: boolean }>(tabs: T[]) => [
  ...tabs.filter((t) => t.pinned),
  ...tabs.filter((t) => !t.pinned)
]

/**
 * Las pestañas: cada página que se abre entra en ellas, y las fijadas no se cierran solas. Se guardan por cuenta y
 * mundo. En el móvil, en el cajón del árbol, como «Abiertas» (compact)
 */
export function OpenTabs({
  worldId,
  current,
  compact = false
}: {
  worldId: string
  current?: Page | undefined
  compact?: boolean
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { preferences, saveTabs } = usePreferences(worldId)
  const tabs = preferences?.tabs
  // Recolocar arrastrando: la que se lleva y sobre cuál va
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)

  // La página abierta entra en las pestañas; si sobran sin fijar, se va la más antigua
  const currentId = current?.id
  useEffect(() => {
    if (!tabs || !current || compact || tabs.some((tab) => tab.pageId === current.id)) return
    const next = [...tabs, { pageId: current.id, title: current.title, pinned: false }]
    const loose = next.filter((tab) => !tab.pinned)
    const drop = new Set(loose.slice(0, Math.max(0, loose.length - LOOSE_TABS)).map((tab) => tab.pageId))
    saveTabs(next.filter((tab) => !drop.has(tab.pageId)))
  }, [tabs, current, compact, saveTabs])

  if (!tabs || tabs.length === 0) return null
  const close = (pageId: string) => {
    const rest = tabs.filter((tab) => tab.pageId !== pageId)
    saveTabs(rest)
    if (pageId !== currentId) return
    // A la de al lado; si no queda ninguna, a la portada del mundo por la misma vista (sin rehacer la pantalla)
    const home = queryClient.getQueryData<{ pageId: string | null }>(['pages', worldId, 'home'])?.pageId
    const next = rest.at(-1)?.pageId ?? home
    if (next === pageId) return
    void navigate(
      next
        ? { to: '/mundos/$worldId/wiki/$pageId', params: { worldId, pageId: next } }
        : { to: '/mundos/$worldId', params: { worldId } }
    )
  }
  /** Pone una pestaña en el sitio de otra (las fijadas siguen delante) */
  const moveTab = (pageId: string, target: string) => {
    if (pageId === target) return
    const list = ordered(tabs)
    const from = list.findIndex((tab) => tab.pageId === pageId)
    const to = list.findIndex((tab) => tab.pageId === target)
    if (from < 0 || to < 0) return
    const next = [...list]
    const [moved] = next.splice(from, 1)
    if (moved) next.splice(to, 0, moved)
    saveTabs(ordered(next))
  }
  const togglePin = (pageId: string) =>
    saveTabs(ordered(tabs.map((tab) => (tab.pageId === pageId ? { ...tab, pinned: !tab.pinned } : tab))))

  return (
    <nav aria-label={t(compact ? 'tabs.recent' : 'tabs.title')} className={compact ? styles.recent : styles.tabs}>
      {compact && <h3>{t('tabs.recent')}</h3>}
      <ul>
        {ordered(tabs).map((tab) => (
          <li
            key={tab.pageId}
            data-current={tab.pageId === currentId || undefined}
            data-dragging={dragging === tab.pageId || undefined}
            data-over={(over === tab.pageId && dragging !== tab.pageId) || undefined}
            draggable={!compact}
            onDragStart={(event) => {
              setDragging(tab.pageId)
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', tab.title)
            }}
            onDragEnd={() => {
              setDragging(null)
              setOver(null)
            }}
            onDragOver={(event) => {
              if (!dragging) return
              event.preventDefault()
              setOver(tab.pageId)
            }}
            onDrop={(event) => {
              event.preventDefault()
              if (dragging) moveTab(dragging, tab.pageId)
              setDragging(null)
              setOver(null)
            }}
          >
            <Link
              to="/mundos/$worldId/wiki/$pageId"
              params={{ worldId, pageId: tab.pageId }}
              aria-current={tab.pageId === currentId ? 'page' : undefined}
              draggable={false}
              // Alt + flechas: la pestaña, a la izquierda o a la derecha
              onKeyDown={(event) => {
                if (compact || !event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
                event.preventDefault()
                const list = ordered(tabs)
                const index = list.findIndex((other) => other.pageId === tab.pageId)
                const target = list[index + (event.key === 'ArrowLeft' ? -1 : 1)]
                if (target) moveTab(tab.pageId, target.pageId)
              }}
            >
              {tab.title}
            </Link>
            {!compact && (
              <>
                <button
                  type="button"
                  className={styles.tabButton}
                  aria-pressed={tab.pinned}
                  aria-label={t('tabs.pin', { title: tab.title })}
                  onClick={() => togglePin(tab.pageId)}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="M9 4h6l-1 6 3 3H7l3-3-1-6zM12 13v7" />
                  </svg>
                </button>
                {!tab.pinned && (
                  <button
                    type="button"
                    className={styles.tabButton}
                    aria-label={t('tabs.close', { title: tab.title })}
                    onClick={() => close(tab.pageId)}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Los marcadores de la cuenta, por grupos, junto al árbol */
export function Bookmarks({ worldId, onNavigate }: { worldId: string; onNavigate?: () => void }) {
  const { t } = useTranslation()
  const headingId = useId()
  const { preferences } = usePreferences(worldId)
  const groups = preferences?.bookmarks.filter((group) => group.pages.length > 0) ?? []
  if (groups.length === 0) return null
  return (
    <section aria-labelledby={headingId} className={styles.bookmarks}>
      <h3 id={headingId}>{t('bookmarks.title')}</h3>
      {groups.map((group) => (
        <div key={group.name}>
          {groups.length > 1 && <h4>{group.name}</h4>}
          <ul aria-label={group.name}>
            {group.pages.map((page) => (
              <li key={page.id}>
                <Link to="/mundos/$worldId/wiki/$pageId" params={{ worldId, pageId: page.id }} onClick={onNavigate}>
                  {page.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

/**
 * Marcar la página abierta: sin grupos, de un clic en el de siempre; con grupos, eligiendo uno o creando otro. Si ya
 * está, quitarla de todos
 */
export function BookmarkButton({ page }: { page: Page }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const announce = useAnnounce()
  const { preferences, saveBookmarks } = usePreferences(page.worldId)
  const button = useReturnFocus()
  const [choosing, setChoosing] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const close = () => {
    setChoosing(false)
    button.back()
  }
  // Abierta, pulsar fuera la cierra
  useEffect(() => {
    if (!choosing) return
    const outside = (event: Event) => {
      if (!wrap.current?.contains(event.target as Node)) setChoosing(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [choosing])
  if (!preferences) return null
  const groups = preferences.bookmarks.map((group) => ({ name: group.name, pages: group.pages.map((p) => p.id) }))
  const marked = groups.some((group) => group.pages.includes(page.id))
  const save = (next: typeof groups, message: string) =>
    saveBookmarks.mutate(next, {
      onSuccess: () => {
        announce(message)
        button.back()
        setChoosing(false)
      }
    })
  const addTo = (name: string) => {
    const exists = groups.some((group) => group.name === name)
    const next = exists
      ? groups.map((group) => (group.name === name ? { ...group, pages: [...group.pages, page.id] } : group))
      : [...groups, { name, pages: [page.id] }]
    save(next, t('bookmarks.added', { title: page.title, group: name }))
  }

  if (marked) {
    return (
      <BusyButton
        ref={button.ref}
        className={list.secondary}
        aria-label={t('bookmarks.remove')}
        title={t('bookmarks.remove')}
        aria-pressed
        busy={saveBookmarks.isPending}
        onClick={() =>
          save(
            groups.map((group) => ({ ...group, pages: group.pages.filter((id) => id !== page.id) })),
            t('bookmarks.removed', { title: page.title })
          )
        }
      >
        <BookmarkCheck aria-hidden="true" size={18} />
      </BusyButton>
    )
  }
  return (
    <div ref={wrap} className={styles.bookmarkWrap} data-action-wrap="">
      <BusyButton
        ref={button.ref}
        className={list.secondary}
        aria-label={t('bookmarks.add')}
        title={t('bookmarks.add')}
        aria-expanded={groups.length > 0 ? choosing : undefined}
        busy={saveBookmarks.isPending}
        onClick={() => (groups.length === 0 ? addTo(t('bookmarks.defaultGroup')) : setChoosing(!choosing))}
      >
        <Bookmark aria-hidden="true" size={18} />
      </BusyButton>
      {choosing && (
        // biome-ignore lint/a11y/useSemanticElements: un desplegable (ARIA), no un grupo de un formulario
        <div
          className={styles.bookmarkMenu}
          role="group"
          aria-label={t('bookmarks.chooseGroup')}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close()
          }}
        >
          <p className={styles.bookmarkLabel}>{t('bookmarks.chooseGroup')}</p>
          <ul className={styles.bookmarkGroups}>
            {groups.map((group, index) => (
              <li key={group.name}>
                <button type="button" ref={index === 0 ? focusOnMount : undefined} onClick={() => addTo(group.name)}>
                  <Folder aria-hidden="true" size={14} />
                  <span>{group.name}</span>
                  <span className={styles.bookmarkCount}>{group.pages.length}</span>
                </button>
              </li>
            ))}
          </ul>
          <form
            className={styles.bookmarkNew}
            onSubmit={(event) => {
              event.preventDefault()
              const name = String(new FormData(event.currentTarget).get('nuevo') ?? '').trim()
              if (name) addTo(name)
            }}
          >
            <input
              name="nuevo"
              maxLength={60}
              autoComplete="off"
              placeholder={t('bookmarks.newGroup')}
              aria-label={t('bookmarks.newGroup')}
            />
            <button type="submit" aria-label={t('bookmarks.createGroup')} title={t('bookmarks.createGroup')}>
              <Plus aria-hidden="true" size={14} />
            </button>
          </form>
          <FormError message={saveBookmarks.error ? errorText(saveBookmarks.error) : null} />
        </div>
      )}
    </div>
  )
}
