import type { Page, PageTabView } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate, useNavigate, useRouter } from '@tanstack/react-router'
import { Bookmark, Ellipsis, FileText, House, ListFilter, Lock, LockOpen, PanelRight, Plus } from 'lucide-react'
import { type ReactNode, type RefObject, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { ApiError } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { FormError } from '../components/field.tsx'
import { focusIsLost, focusOnMount, useReturnFocus } from '../components/focus.ts'
import form from '../components/form.module.css'
import list from '../components/list.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle, useHeadingFocusRequest } from '../components/page-title.tsx'
import { WorldBanner } from '../routes/world-card.tsx'
import { Backlinks, useLinkedBy } from './backlinks.tsx'
import { CollabSocket } from './collab.tsx'
import { CoverButton, PageCoverImage } from './cover.tsx'
import { PageBody } from './editor.tsx'
import { ExportPage, ExportWiki } from './export.tsx'
import { PageIcon } from './icon.tsx'
import { MapTab } from './map/map-tab.tsx'
import { BookmarkButton, Bookmarks, OpenTabs, SiblingNav } from './navigation.tsx'
import { useWikiPanel } from './panel.tsx'
import { PageProperties } from './properties.tsx'
import { QuickSwitcher } from './quick-switcher.tsx'
import { SearchBox } from './search-box.tsx'
import { SheetMenu, SheetPaper, SheetToggle } from './sheet/controls.tsx'
import { PageTabs, usePageTabs } from './tabs/page-tabs.tsx'
import { PageTree } from './tree.tsx'
import { Versions } from './versions.tsx'
import styles from './wiki.module.css'

const homeRoute = getRouteApi('/mundos/$worldId/wiki')
const pageRoute = getRouteApi('/mundos/$worldId/wiki/$pageId')

export const pageKey = (worldId: string, pageId: string) => ['pages', worldId, 'page', pageId]

/** Crea una página (o una subpágina) con el título provisional y la abre para ponerle nombre */
function useCreatePage(worldId: string) {
  const { t } = useTranslation()
  const api = useApi()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (parentId: string | null) => api.call('createPage', { worldId, title: t('wiki.untitled'), parentId }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['pages', worldId] })
      await navigate({
        to: '/mundos/$worldId/wiki/$pageId',
        params: { worldId, pageId: created.id },
        search: { nuevo: true }
      })
    }
  })
}

/**
 * La wiki de un mundo: el árbol a un lado y la página al otro. En el móvil, el árbol va en un cajón que se abre con
 * «Páginas». Solo para quien administra el mundo (hasta el módulo 5)
 */
export function WikiLayout({
  worldId,
  current,
  children
}: {
  worldId: string
  current?: Page | undefined
  children: (world: { name: string; organizationId: string }) => ReactNode
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const { account, pending } = useAccounts().useAccount()
  const { panel, collapsed, open, close } = useWikiPanel()
  const closeButton = useRef<HTMLButtonElement>(null)
  // Al abrir el cajón (en lo estrecho), el foco entra en él; al cerrarlo, vuelve al botón de la barra que lo abrió
  useEffect(() => {
    if (open) closeButton.current?.focus()
  }, [open])
  const asideId = useId()
  const headingId = useId()
  const create = useCreatePage(worldId)
  // Lo que se escribe en el buscador de cada vista (en las páginas, por nombre o #etiqueta)
  const [filter, setFilter] = useState('')
  const navigate = useNavigate()
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
      <section>
        <PageTitle>{t('wiki.notFound')}</PageTitle>
        <Link to="/mundos">{t('worlds.title')}</Link>
      </section>
    )
  }

  return (
    <div className={styles.wiki} data-collapsed={collapsed || undefined}>
      <aside
        id={asideId}
        className={styles.aside}
        data-open={open || undefined}
        aria-labelledby={headingId}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) close(true)
        }}
      >
        <div className={styles.asideHeader}>
          {/* Lo de la vista elegida en la barra: el mundo (sus páginas), las plantillas o los archivos */}
          <h2 id={headingId}>{world.name}</h2>
          {panel === 'pages' && (
            <BusyButton
              className={styles.newPageIcon}
              busy={create.isPending}
              aria-label={t('wiki.newPage')}
              title={t('wiki.newPage')}
              onClick={() => create.mutate(null)}
            >
              <Plus aria-hidden="true" size={16} />
            </BusyButton>
          )}
          <button
            type="button"
            ref={closeButton}
            className={`${list.secondary} ${styles.close}`}
            onClick={() => close(true)}
          >
            {t('wiki.closePages')}
          </button>
        </div>
        {/* El buscador, fijo en su sitio en cada vista, con lo suyo */}
        <PageFilter
          label={t('wiki.filter')}
          value={filter}
          onChange={setFilter}
          // En las páginas, Intro busca dentro del texto de todas
          {...(panel === 'pages'
            ? {
                onSearch: (q: string) => {
                  close(false)
                  void navigate({ to: '/mundos/$worldId/buscar', params: { worldId }, search: { q } })
                }
              }
            : {})}
        />
        <FormError message={create.error ? errorText(create.error) : null} />
        {panel === 'pages' && (
          <>
            {filter.trim() ? (
              <FilteredPages worldId={worldId} query={filter} currentId={current?.id} onNavigate={() => close(false)} />
            ) : (
              <PageTree
                worldId={worldId}
                currentId={current?.id}
                path={current?.path}
                onNavigate={() => close(false)}
              />
            )}
            <OpenTabs worldId={worldId} current={current} compact />
            {/* Los marcadores, debajo del árbol */}
            <div className={styles.asideBookmarks}>
              <Bookmarks worldId={worldId} onNavigate={() => close(false)} />
            </div>
            <div className={styles.more}>
              <ExportWiki worldId={worldId} />
            </div>
          </>
        )}
      </aside>
      <QuickSwitcher worldId={worldId} onCreatePage={() => create.mutate(null)} />
      <div className={styles.content}>
        <OpenTabs worldId={worldId} current={current} />
        <CollabSocket>{children(world)}</CollabSocket>
      </div>
    </div>
  )
}

/** Normalizado para comparar: sin mayúsculas ni tildes */
const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es')

/** El campo para filtrar el árbol, como en LegendKeeper: por nombre o, con «#», por etiqueta */
function PageFilter({
  label,
  value,
  onChange,
  onSearch
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onSearch?: (query: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className={styles.filter}>
      <input
        type="search"
        value={value}
        aria-label={label}
        placeholder={label}
        title={onSearch ? t('wiki.filterHint') : undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.stopPropagation()
            onChange('')
          }
          if (onSearch && event.key === 'Enter' && value.trim() && !value.trim().startsWith('#')) {
            event.preventDefault()
            onSearch(value.trim())
          }
        }}
      />
      <ListFilter aria-hidden="true" size={16} />
    </div>
  )
}

/** Las páginas que coinciden con el filtro, en una lista, con su camino debajo */
function FilteredPages({
  worldId,
  query,
  currentId,
  onNavigate
}: {
  worldId: string
  query: string
  currentId: string | undefined
  onNavigate: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const names = useQuery({
    queryKey: ['pages', worldId, 'names'],
    queryFn: () => api.call('listPageNames', { worldId })
  })
  const wanted = plain(query.trim())
  const byTag = wanted.startsWith('#')
  const tag = wanted.slice(1)
  const found = (names.data?.pages ?? []).filter((page) =>
    byTag
      ? page.tags.some((each) => plain(each).startsWith(tag))
      : [page.title, ...page.aliases].some((name) => plain(name).includes(wanted))
  )
  if (!names.data) return null
  if (found.length === 0) return <p className={styles.filterEmpty}>{t('wiki.filterEmpty')}</p>
  return (
    <ul className={styles.filtered} aria-label={t('wiki.filterResults')}>
      {found.map((page) => (
        <li key={page.id}>
          <Link
            to="/mundos/$worldId/wiki/$pageId"
            params={{ worldId, pageId: page.id }}
            aria-current={page.id === currentId ? 'page' : undefined}
            onClick={onNavigate}
          >
            <FileText aria-hidden="true" size={15} />
            <span>
              {page.title}
              {page.path.length > 1 && <small>{page.path.slice(0, -1).join(' › ')}</small>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** La wiki sin página abierta */
export function WikiHome() {
  const { worldId } = homeRoute.useParams()
  // Sin página abierta, la portada del mundo
  return <Navigate to="/mundos/$worldId" params={{ worldId }} replace />
}

/** El título de la página, que se renombra en el sitio. Una recién creada empieza ya con el campo abierto */

/**
 * La cabecera de la página, como en Everlore: arriba, la portada ancha (o, sin ella, «Añadir portada»); después, el
 * mundo en pequeño sobre el icono y el título, que se cambia ahí mismo, y a la derecha sus acciones. Al bajar, la
 * cabecera se queda pegada arriba, más pequeña. banner: lo que va en lugar de la portada (la cabecera del mundo, en su
 * página de portada)
 */
function PageHead({
  page,
  world,
  startEditing,
  home = false,
  actions
}: {
  page: Page
  world: string
  startEditing: boolean
  /** La portada del mundo: lleva su etiqueta junto al título */
  home?: boolean
  actions: ReactNode
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const router = useRouter()
  // Recién creada: ya con su nombre puesto, la dirección deja de decir «nuevo» (si aún se está en ella: al salir del
  // título pulsando otra página, se guarda sin volver aquí)
  const named = () => {
    if (!startEditing || !router.state.location.pathname.endsWith(`/wiki/${page.id}`)) return
    void navigate({
      to: '/mundos/$worldId/wiki/$pageId',
      params: { worldId: page.worldId, pageId: page.id },
      search: {},
      replace: true
    })
  }
  // Pegada y pequeña en cuanto lo de encima de ella se va de la vista
  const sentinel = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const element = sentinel.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setCompact(!entry?.isIntersecting), { threshold: 0 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return (
    <>
      <div ref={sentinel} aria-hidden="true" className={styles.sentinel} />
      <header className={styles.entryHeader} data-compact={compact || undefined}>
        <div className={styles.entryTitle}>
          {/* El mundo, en pequeño (en su portada no: sería repetirlo) */}
          {!home && <span className={styles.entryWorld}>{world}</span>}
          <div className={styles.heading}>
            {page.icon && <PageIcon page={page} />}
            <InlineTitle page={page} autoFocus={startEditing} onDone={named} />
            {home && (
              <span className={styles.homeBadge}>
                <House aria-hidden="true" size={12} />
                {t('wiki.homeBadge')}
              </span>
            )}
            {page.locked && <span className={styles.locked}>{t('editor.locked')}</span>}
          </div>
        </div>
        <div className={styles.pageActions}>{actions}</div>
      </header>
    </>
  )
}

/**
 * El título de la página, que es su propio encabezado y se cambia ahí mismo (como en el Crisol antiguo): Intro, la
 * flecha abajo al final o salir del campo lo guardan; Intro y la flecha bajan al texto; Escape lo deja como estaba.
 * Vacío o igual, vuelve el de antes sin más; un error (del servidor) sale debajo y el foco se queda. Con la página
 * bloqueada, solo se lee
 */
function InlineTitle({ page, autoFocus, onDone }: { page: Page; autoFocus: boolean; onDone: () => void }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const request = useHeadingFocusRequest()
  const box = useRef<HTMLSpanElement>(null)
  const errorId = useId()
  const [error, setError] = useState<string | null>(null)
  const rename = useMutation({
    mutationFn: (title: string) => api.call('updatePage', { pageId: page.id, title }),
    onSuccess: async () => {
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['pages', page.worldId] })
      onDone()
    },
    onError: (failure) => {
      setError(errorText(failure))
      box.current?.focus()
    }
  })
  // El texto lo pone esto, no React: mientras se escribe, lo que llegue del servidor no lo pisa
  useLayoutEffect(() => {
    if (box.current && document.activeElement !== box.current) box.current.textContent = page.title
  }, [page.title])
  // Recién creada: el foco en el título, con todo elegido para escribir encima
  useEffect(() => {
    if (!autoFocus || !box.current) return
    box.current.focus()
    const range = document.createRange()
    range.selectNodeContents(box.current)
    getSelection()?.removeAllRanges()
    getSelection()?.addRange(range)
  }, [autoFocus])
  const toBody = () => {
    const body = box.current?.closest('article')?.querySelector<HTMLElement>('.ProseMirror[contenteditable="true"]')
    body?.focus()
  }
  const commit = () => {
    const text = (box.current?.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (!text || text === page.title) {
      if (box.current) box.current.textContent = page.title
      setError(null)
      onDone()
      return
    }
    if (box.current) box.current.textContent = text
    rename.mutate(text)
  }
  const atEnd = () => {
    const selection = getSelection()
    if (!selection?.rangeCount || !box.current) return false
    const range = selection.getRangeAt(0).cloneRange()
    range.setEnd(box.current, box.current.childNodes.length)
    return range.toString() === ''
  }
  return (
    <div className={styles.titleBox}>
      <h1
        tabIndex={-1}
        ref={(heading) => {
          if (!heading || !request.current) return
          request.current = false
          if (focusIsLost()) heading.focus()
        }}
      >
        {/* biome-ignore lint/a11y/useSemanticElements: el título es el propio encabezado, que se escribe en el sitio */}
        <span
          ref={box}
          className={styles.title}
          role="textbox"
          tabIndex={0}
          aria-label={t('wiki.titleLabel')}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          aria-readonly={page.locked || undefined}
          contentEditable={!page.locked}
          suppressContentEditableWarning
          spellCheck={false}
          data-placeholder={t('wiki.untitled')}
          onKeyDown={(event) => {
            // Solo texto: sin negritas ni cursivas en el título
            if ((event.ctrlKey || event.metaKey) && ['b', 'i', 'u'].includes(event.key.toLowerCase())) {
              event.preventDefault()
              return
            }
            if (event.key === 'Enter' || (event.key === 'ArrowDown' && atEnd())) {
              event.preventDefault()
              commit()
              if (!rename.isError) toBody()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              if (box.current) box.current.textContent = page.title
              setError(null)
              toBody()
            }
          }}
          onBlur={() => {
            if (!rename.isPending) commit()
          }}
          onPaste={(event) => {
            event.preventDefault()
            document.execCommand('insertText', false, event.clipboardData.getData('text/plain').replace(/\s+/g, ' '))
          }}
        />
      </h1>
      {error && (
        <p id={errorId} className={styles.titleError} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/** «Más»: lo que se hace de vez en cuando con la página, fuera de la vista hasta que se pide */
function MoreActions({ page }: { page: Page }) {
  const { t } = useTranslation()
  const api = useApi()
  const home = useQuery({
    queryKey: ['pages', page.worldId, 'home'],
    queryFn: () => api.call('getWorldHome', { worldId: page.worldId })
  })
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const panelId = useId()
  // Abierto: pulsar fuera lo cierra; Escape también, y el foco vuelve a «Más»
  useEffect(() => {
    if (!open) return
    const outside = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])
  return (
    <div ref={root} className={styles.moreMenu}>
      <button
        type="button"
        ref={trigger}
        aria-label={t('wiki.moreActions')}
        title={t('wiki.moreActions')}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <Ellipsis aria-hidden="true" size={18} />
      </button>
      {open && (
        <div id={panelId} className={styles.morePanel}>
          <SheetMenu page={page} />
          <NewSubpage page={page} onDone={() => setOpen(false)} />
          <ExportPage page={page} />
          {/* La portada del mundo no se borra */}
          {home.data?.pageId !== page.id && <DeletePage page={page} />}
        </div>
      )}
    </div>
  )
}

/** El candado: pone la página en lectura (no es un permiso: quien escribe puede quitarlo). Ctrl+E también */
function LockButton({ page }: { page: Page }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const toggle = useMutation({
    mutationFn: () => api.call('updatePage', { pageId: page.id, locked: !page.locked }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pages', page.worldId] })
  })
  const latest = useRef(toggle)
  latest.current = toggle
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'e') {
        event.preventDefault()
        if (!latest.current.isPending) latest.current.mutate()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  const label = t(page.locked ? 'editor.unlock' : 'editor.lock')
  return (
    <BusyButton
      className={list.secondary}
      aria-pressed={page.locked}
      aria-label={label}
      title={`${label} (Ctrl+E)`}
      busy={toggle.isPending}
      onClick={() => toggle.mutate()}
    >
      {page.locked ? <Lock aria-hidden="true" size={18} /> : <LockOpen aria-hidden="true" size={18} />}
    </BusyButton>
  )
}

/** Borrar: tras confirmar, la página (con sus subpáginas) va a la papelera y se vuelve a su madre */
function DeletePage({ page }: { page: Page }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const button = useReturnFocus()
  const warningId = useId()
  const [confirming, setConfirming] = useState(false)
  // Al confirmar, cuántas páginas la enlazan: sus enlaces se verán rotos
  const linkedBy = useLinkedBy(page, confirming)
  const remove = useMutation({
    mutationFn: () => api.call('deletePage', { pageId: page.id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pages', page.worldId] })
      announce(t('wiki.deleted', { title: page.title }))
      const parent = page.path.at(-2)
      await navigate(
        parent
          ? { to: '/mundos/$worldId/wiki/$pageId', params: { worldId: page.worldId, pageId: parent.id } }
          : { to: '/mundos/$worldId/wiki', params: { worldId: page.worldId } }
      )
    }
  })
  if (!confirming) {
    return (
      <button type="button" ref={button.ref} className={list.secondary} onClick={() => setConfirming(true)}>
        {t('wiki.delete')}
      </button>
    )
  }
  return (
    <div className={list.confirm}>
      <p id={warningId}>
        {t(page.hasChildren ? 'wiki.deleteWarningWithSubpages' : 'wiki.deleteWarning', { title: page.title })}
        {linkedBy ? ` ${t('wiki.linkedBy', { count: linkedBy })}` : ''}
      </p>
      <div className={list.actions}>
        <BusyButton
          ref={focusOnMount}
          className={form.button}
          aria-describedby={warningId}
          busy={remove.isPending}
          onClick={() => remove.mutate()}
        >
          {t('wiki.delete')}
        </BusyButton>
        <button
          type="button"
          className={list.secondary}
          onClick={() => {
            button.back()
            setConfirming(false)
          }}
        >
          {t('list.cancel')}
        </button>
      </div>
      <FormError message={remove.error ? errorText(remove.error) : null} />
    </div>
  )
}

/** «Nueva subpágina», en «⋯»: se crea dentro de esta y se abre para ponerle nombre (en el árbol, debajo de su madre) */
function NewSubpage({ page, onDone }: { page: Page; onDone: () => void }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const create = useCreatePage(page.worldId)
  if (page.locked) return null
  return (
    <>
      <BusyButton
        className={list.secondary}
        busy={create.isPending}
        onClick={() => create.mutate(page.id, { onSuccess: onDone })}
      >
        {t('wiki.newSubpage')}
      </BusyButton>
      <FormError message={create.error ? errorText(create.error) : null} />
    </>
  )
}

/** Una página de la wiki abierta */
export function WikiPage() {
  const { t } = useTranslation()
  const api = useApi()
  const { worldId, pageId } = pageRoute.useParams()
  const { nuevo, pestana } = pageRoute.useSearch()
  const page = useQuery({ queryKey: pageKey(worldId, pageId), queryFn: () => api.call('getPage', { pageId }) })
  const missing = page.error instanceof ApiError && page.error.status === 404
  useEffect(() => {
    // Mientras se le pone nombre no hay título que lo diga
    if (page.data) document.title = t('app.pageTitle', { page: page.data.title })
  }, [page.data, t])

  return (
    <WikiLayout worldId={worldId} current={page.data}>
      {(world) => {
        if (missing) {
          return (
            <section>
              <PageTitle>{t('wiki.pageNotFound')}</PageTitle>
              <Link to="/mundos/$worldId/wiki" params={{ worldId }}>
                {t('wiki.title', { world: world.name })}
              </Link>
            </section>
          )
        }
        if (!page.data) return failed(page) ? <LoadError error={page.error} onRetry={() => page.refetch()} /> : null
        return <OpenPage page={page.data} world={world.name} nuevo={nuevo === true} pestana={pestana ?? null} />
      }}
    </WikiLayout>
  )
}

/** La página abierta: su texto o, con ?pestana=, una de sus pestañas (un mapa) */
function OpenPage({
  page,
  world,
  nuevo,
  pestana
}: {
  page: Page
  world: string
  nuevo: boolean
  pestana: string | null
}) {
  const api = useApi()
  const tabs = usePageTabs(page)
  const all = tabs.data ?? []
  const active = pestana ? (all.find((tab) => tab.id === pestana) ?? null) : null
  // La portada del mundo lleva su portada (la del mundo), como en su Inicio
  const home = useQuery({
    queryKey: ['pages', page.worldId, 'home'],
    queryFn: () => api.call('getWorldHome', { worldId: page.worldId })
  })
  const worlds = useQuery({ queryKey: ['worlds'], queryFn: () => api.call('listWorlds', {}) })
  const look = worlds.data?.worlds.find((w) => w.id === page.worldId)
  const isHome = home.data?.pageId === page.id
  const banner = isHome && look ? <WorldBanner world={look} /> : undefined
  // Una pestaña que ya no está (quitada, o de otra página): al texto, una vez al día la lista
  if (pestana && tabs.data && !tabs.isFetching && !active) {
    return (
      <Navigate
        to="/mundos/$worldId/wiki/$pageId"
        params={{ worldId: page.worldId, pageId: page.id }}
        search={{}}
        replace
      />
    )
  }
  if (pestana && !active) return null
  return <EntryView page={page} world={world} nuevo={nuevo} tabs={all} active={active} banner={banner} home={isHome} />
}

/**
 * Una página, como en Everlore: la cabecera, sus pestañas, lo de la elegida (el texto en una columna ancha, con su
 * hoja; un mapa, a todo lo ancho) y, a la derecha, el panel fijo a toda altura (sus propiedades, quién la menciona,
 * su índice y sus versiones), que se esconde con su botón. banner: en lugar de la portada (la cabecera del mundo)
 */
export function EntryView({
  page,
  world,
  nuevo = false,
  tabs,
  active = null,
  banner,
  home = false
}: {
  page: Page
  world: string
  nuevo?: boolean
  tabs: PageTabView[]
  active?: PageTabView | null
  banner?: ReactNode
  home?: boolean
}) {
  const { t } = useTranslation()
  const main = useRef<HTMLElement>(null)
  // Se ve al llegar a cada página; el botón lo esconde solo en esta visita
  const [panel, setPanel] = useState(true)
  const [shownFor, setShownFor] = useState(page.id)
  if (shownFor !== page.id) {
    setShownFor(page.id)
    setPanel(true)
  }
  return (
    <>
      {/* La portada, a todo lo ancho (la del mundo en su portada; si no, la de la página o «Añadir portada») */}
      <div className={styles.entryBanner} data-cover={banner || page.cover ? '' : undefined}>
        {banner ??
          (page.cover ? (
            <PageCoverImage page={page} />
          ) : (
            !page.locked && <CoverButton page={page} className={styles.addCover} label={t('cover.add')} />
          ))}
      </div>
      <div className={styles.entry} data-entry-panel={panel || undefined}>
        <article ref={main} className={styles.entryMain}>
          <PageHead
            key={page.id}
            page={page}
            world={world}
            startEditing={nuevo}
            home={home}
            actions={
              <>
                <BookmarkButton page={page} />
                <LockButton page={page} />
                <SheetToggle page={page} />
                <MoreActions page={page} />
                <button
                  type="button"
                  className={styles.panelToggle}
                  aria-pressed={panel}
                  aria-label={t('wiki.togglePanel')}
                  title={t('wiki.togglePanel')}
                  onClick={() => setPanel(!panel)}
                >
                  <PanelRight aria-hidden="true" size={18} />
                </button>
              </>
            }
          />
          <PageTabs page={page} tabs={tabs} active={active?.id ?? null} />
          {active ? (
            <MapTab key={active.id} page={page} tab={active} />
          ) : (
            <div className={styles.column}>
              <SheetPaper page={page}>
                <PageBody page={page} />
              </SheetPaper>
              <SiblingNav page={page} />
            </div>
          )}
        </article>
        {panel && (
          <aside aria-label={t('wiki.pagePanel')} className={styles.entryPanel}>
            {/* Las propiedades, a un lado (como los bloques del panel de Everlore) */}
            <PageProperties key={page.id} page={page} />
            <Backlinks key={`enlaces-${page.id}`} page={page} />
            {!active && <Contents key={`indice-${page.id}`} root={main} />}
            <Versions key={`versiones-${page.id}`} page={page} />
          </aside>
        )}
      </div>
    </>
  )
}

/** El índice: los títulos del texto de la página (no los de los secretos), que se siguen al escribir */
function Contents({ root }: { root: RefObject<HTMLElement | null> }) {
  const { t } = useTranslation()
  const id = useId()
  const [headings, setHeadings] = useState<{ level: number; text: string; element: HTMLElement }[]>([])
  useEffect(() => {
    const container = root.current
    if (!container) return
    let frame = 0
    const read = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const found = [...container.querySelectorAll<HTMLElement>('[role="textbox"] > :is(h2, h3, h4)')]
        setHeadings(
          found
            .map((element) => ({ level: Number(element.tagName[1]), text: element.textContent?.trim() ?? '', element }))
            .filter((heading) => heading.text)
        )
      })
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(container, { childList: true, subtree: true, characterData: true })
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [root])
  return (
    <section aria-labelledby={`${id}-title`} className={styles.contents}>
      <h2 id={`${id}-title`}>{t('wiki.contents')}</h2>
      {headings.length === 0 ? (
        <p>{t('wiki.contentsEmpty')}</p>
      ) : (
        <ul>
          {headings.map((heading, index) => (
            <li key={`${index}-${heading.text}`} data-level={heading.level}>
              <button type="button" onClick={() => heading.element.scrollIntoView({ block: 'start' })}>
                {heading.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
