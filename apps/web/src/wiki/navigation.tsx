import type { Page, WikiPreferences } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Bookmark, BookmarkCheck } from 'lucide-react'
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
  const { preferences, saveTabs } = usePreferences(worldId)
  const tabs = preferences?.tabs

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
    const neighbour = rest.at(-1)
    void navigate(
      neighbour
        ? { to: '/mundos/$worldId/wiki/$pageId', params: { worldId, pageId: neighbour.pageId } }
        : { to: '/mundos/$worldId/wiki', params: { worldId } }
    )
  }
  const togglePin = (pageId: string) =>
    saveTabs(ordered(tabs.map((tab) => (tab.pageId === pageId ? { ...tab, pinned: !tab.pinned } : tab))))

  return (
    <nav aria-label={t(compact ? 'tabs.recent' : 'tabs.title')} className={compact ? styles.recent : styles.tabs}>
      {compact && <h3>{t('tabs.recent')}</h3>}
      <ul>
        {ordered(tabs).map((tab) => (
          <li key={tab.pageId} data-current={tab.pageId === currentId || undefined}>
            <Link
              to="/mundos/$worldId/wiki/$pageId"
              params={{ worldId, pageId: tab.pageId }}
              aria-current={tab.pageId === currentId ? 'page' : undefined}
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
  const groupId = useId()
  const [choosing, setChoosing] = useState(false)
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
  if (!choosing) {
    return (
      <BusyButton
        ref={button.ref}
        className={list.secondary}
        aria-label={t('bookmarks.add')}
        title={t('bookmarks.add')}
        busy={saveBookmarks.isPending}
        onClick={() => (groups.length === 0 ? addTo(t('bookmarks.defaultGroup')) : setChoosing(true))}
      >
        <Bookmark aria-hidden="true" size={18} />
      </BusyButton>
    )
  }
  return (
    <form
      className={styles.choose}
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        const name = String(data.get('nuevo') ?? '').trim() || String(data.get('grupo') ?? '')
        if (name) addTo(name)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          button.back()
          setChoosing(false)
        }
      }}
    >
      <fieldset>
        <legend>{t('bookmarks.chooseGroup')}</legend>
        {groups.map((group, index) => (
          <label key={group.name} className={styles.option}>
            <input
              type="radio"
              name="grupo"
              value={group.name}
              defaultChecked={index === 0}
              ref={index === 0 ? focusOnMount : undefined}
            />
            {group.name}
          </label>
        ))}
      </fieldset>
      <div className={form.field}>
        <label htmlFor={groupId}>{t('bookmarks.newGroup')}</label>
        <input id={groupId} name="nuevo" maxLength={60} autoComplete="off" />
      </div>
      <FormError message={saveBookmarks.error ? errorText(saveBookmarks.error) : null} />
      <div className={list.actions}>
        <BusyButton type="submit" className={form.button} busy={saveBookmarks.isPending}>
          {t('bookmarks.save')}
        </BusyButton>
        <button
          type="button"
          className={list.secondary}
          onClick={() => {
            button.back()
            setChoosing(false)
          }}
        >
          {t('list.cancel')}
        </button>
      </div>
    </form>
  )
}

/** La anterior y la siguiente entre sus hermanas, en el orden del árbol */
export function SiblingNav({ page }: { page: Page }) {
  const { t } = useTranslation()
  const api = useApi()
  const siblings = useQuery({
    queryKey: childrenKey(page.worldId, page.parentId),
    queryFn: () => api.call('listPageChildren', { worldId: page.worldId, parentId: page.parentId })
  })
  const sisters = siblings.data?.pages ?? []
  const at = sisters.findIndex((sibling) => sibling.id === page.id)
  const previous = at > 0 ? sisters[at - 1] : undefined
  const next = at >= 0 ? sisters[at + 1] : undefined
  if (!previous && !next) return null
  return (
    <nav aria-label={t('siblings.title')} className={styles.siblings}>
      {previous && (
        <Link to="/mundos/$worldId/wiki/$pageId" params={{ worldId: page.worldId, pageId: previous.id }} rel="prev">
          <span>{t('siblings.previous')}</span>
          {previous.title}
        </Link>
      )}
      {next && (
        <Link
          to="/mundos/$worldId/wiki/$pageId"
          params={{ worldId: page.worldId, pageId: next.id }}
          rel="next"
          className={styles.next}
        >
          <span>{t('siblings.next')}</span>
          {next.title}
        </Link>
      )}
    </nav>
  )
}
