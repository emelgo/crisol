import type { Page, PageTabView } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate, useNavigate, useRouter } from '@tanstack/react-router'
import { Ellipsis, FileText, House, LayoutTemplate, ListFilter, Lock, LockOpen, Plus, Printer } from 'lucide-react'
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { ApiError } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import list from '../components/list.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { Menu, MenuItem } from '../components/menu.tsx'
import { headingMayTakeFocus, PageTitle, useHeadingFocusRequest } from '../components/page-title.tsx'
import { itemTransition } from '../components/world-transition.ts'
import { WorldBanner } from '../routes/world-card.tsx'
import { TemplateIcon } from '../templates/icons.tsx'
import { useTemplates } from '../templates/picker.tsx'
import { Backlinks } from './backlinks.tsx'
import { CollabSocket } from './collab.tsx'
import { CoverButton, PageCoverImage } from './cover.tsx'
import { PageBody } from './editor.tsx'
import { ExportPage, ExportWiki } from './export.tsx'
import { PageIcon } from './icon.tsx'
import { MapTab } from './map/map-tab.tsx'
import { BookmarkButton, Bookmarks, OpenTabs } from './navigation.tsx'
import { NewPageContext, NewPageDialog, type NewPageRequest } from './new-page.tsx'
import { useWikiPanel } from './panel.tsx'
import panelStyles from './panel-blocks.module.css'
import { PanelBlocks } from './panel-blocks.tsx'
import { PageProperties, type PropertyAdder } from './properties.tsx'
import { QuickSwitcher } from './quick-switcher.tsx'
import { PageRevealButton } from './reveal.tsx'
import { SceneMain, SceneSide, SceneTabProvider } from './scene/scene-tab.tsx'
import { PrintDialog, SheetPaper } from './sheet/controls.tsx'
import { TableTab } from './table/table-tab.tsx'
import { PageTabs, usePageTabs, useTabTarget } from './tabs/page-tabs.tsx'
import { PageTree } from './tree.tsx'
import { Versions } from './versions.tsx'
import { WhoKnowsButton } from './who-knows.tsx'
import styles from './wiki.module.css'
import { WorldTour } from './world-tour.tsx'

const homeRoute = getRouteApi('/mundos/$worldId/wiki')
const pageRoute = getRouteApi('/mundos/$worldId/wiki/$pageId')

export const pageKey = (worldId: string, pageId: string) => ['pages', worldId, 'page', pageId]

/** Crea una página (o una subpágina) con el título provisional y la abre para ponerle nombre */
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
  const { account, pending } = useAccounts().useAccount()
  const { panel, open, close } = useWikiPanel()
  const closeButton = useRef<HTMLButtonElement>(null)
  // Al abrir el cajón (en lo estrecho), el foco entra en él; al cerrarlo, vuelve al botón de la barra que lo abrió
  useEffect(() => {
    if (open) closeButton.current?.focus()
  }, [open])
  const asideId = useId()
  const headingId = useId()
  // El cuadro de «Página nueva» (o de una subpágina), abierto
  const [creating, setCreating] = useState<{ parent: { id: string; title: string } | null; n: number } | null>(null)
  // Cada vez, un cuadro nuevo (su número): nunca se reutiliza uno que se cerró
  const requestNewPage = useCallback<NewPageRequest>((parent) => setCreating({ parent, n: Date.now() }), [])
  // Lo que se escribe en el buscador de cada vista (en las páginas, por nombre o #etiqueta)
  const [filter, setFilter] = useState('')
  const navigate = useNavigate()
  const worlds = useQuery({
    queryKey: ['worlds'],
    queryFn: () => api.call('listWorlds', {}),
    enabled: Boolean(account)
  })
  const world = worlds.data?.worlds.find((w) => w.id === worldId && w.role === 'master')
  const root = useRef<HTMLDivElement>(null)
  useSideTop(root, Boolean(world))

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
    <NewPageContext.Provider value={requestNewPage}>
      <WorldTour master />
      <div ref={root} className={styles.wiki}>
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
            {panel === 'pages' && <ExportWiki worldId={worldId} className={styles.newPageIcon} />}
            {panel === 'pages' && (
              <button
                type="button"
                className={styles.newPageIcon}
                aria-label={t('wiki.newPage')}
                title={t('wiki.newPage')}
                aria-haspopup="dialog"
                onClick={() => requestNewPage(null)}
              >
                <Plus aria-hidden="true" size={16} />
              </button>
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
          {panel === 'pages' && (
            <>
              {filter.trim() ? (
                <FilteredPages
                  worldId={worldId}
                  query={filter}
                  currentId={current?.id}
                  onNavigate={() => close(false)}
                />
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
            </>
          )}
        </aside>
        <QuickSwitcher worldId={worldId} onCreatePage={() => requestNewPage(null)} />
        <div className={styles.content}>
          <OpenTabs worldId={worldId} current={current} />
          <CollabSocket>{children(world)}</CollabSocket>
        </div>
        {creating && (
          <NewPageDialog
            key={creating.n}
            worldId={worldId}
            parent={creating.parent}
            onClose={() => setCreating(null)}
          />
        )}
      </div>
    </NewPageContext.Provider>
  )
}

/**
 * Como en Archivos, las fichas de los lados empiezan a la misma altura que allí (8,5rem desde arriba: su margen y el
 * hueco del título), haya portada o no. La de la izquierda lo hace con su margen (CSS); la de la derecha va dentro de
 * la página, así que se mide cuánto tiene que subir o bajar (--panel-top)
 */
export function useSideTop(root: RefObject<HTMLDivElement | null>, ready: boolean) {
  useLayoutEffect(() => {
    const element = root.current
    if (!element || typeof ResizeObserver === 'undefined') return
    let frame = 0
    const measure = () => {
      frame = 0
      const entry = element.querySelector('[data-entry]')
      if (!entry) return element.style.removeProperty('--panel-top')
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const top = SIDE_TOP_REM * rem
      element.style.setProperty(
        '--panel-top',
        `${top - (entry.getBoundingClientRect().top - element.getBoundingClientRect().top)}px`
      )
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    const resized = new ResizeObserver(schedule)
    resized.observe(element)
    const changed = new MutationObserver(schedule)
    changed.observe(element, { childList: true, subtree: true })
    // Al bajar la página, las fichas suben hasta pegarse arriba: crecen lo mismo (--side-lift), y siguen llegando abajo
    let lifted = 0
    const lift = () => {
      lifted = 0
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const most = (SIDE_TOP_REM - 1) * rem
      element.style.setProperty('--side-lift', `${Math.min(Math.max(window.scrollY, 0), most)}px`)
    }
    const onScroll = () => {
      if (!lifted) lifted = requestAnimationFrame(lift)
    }
    lift()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(lifted)
      resized.disconnect()
      changed.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [root, ready])
}

/** Donde empiezan las fichas de los lados, como en Archivos (su relleno de 2rem y su margen de 6,5rem) */
const SIDE_TOP_REM = 8.5

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
  const hintId = useId()
  return (
    <div className={styles.filter} data-tour="buscador">
      {/* La pista, también para el lector de pantalla y lo táctil (no solo en el title) */}
      {onSearch && (
        <span id={hintId} className={panelStyles.visuallyHidden}>
          {t('wiki.filterHint')}
        </span>
      )}
      <input
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        data-form-type="other"
        type="search"
        value={value}
        aria-label={label}
        aria-describedby={onSearch ? hintId : undefined}
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
  startEditing,
  home = false,
  template,
  actions
}: {
  page: Page
  startEditing: boolean
  /** La portada del mundo: lleva su etiqueta junto al título */
  home?: boolean
  /** La página de una plantilla (su id): «Plantilla» junto al título, y su icono y su nombre viajan desde su tarjeta */
  template?: string | undefined
  actions: ReactNode
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const router = useRouter()
  const target = useTabTarget(page)
  // Recién creada: ya con su nombre puesto, la dirección deja de decir «nuevo» (si aún se está en ella: al salir del
  // título pulsando otra página, se guarda sin volver aquí)
  const named = () => {
    if (!startEditing || router.state.location.pathname !== router.buildLocation(target(null)).pathname) return
    void navigate({ ...target(null), replace: true })
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
          <div className={styles.heading}>
            {page.icon && (
              <PageIcon
                page={page}
                {...(template ? { style: itemTransition(template, 'icono'), elemento: 'icono' } : {})}
              />
            )}
            <InlineTitle
              page={page}
              autoFocus={startEditing}
              onDone={named}
              {...(template ? { style: itemTransition(template, 'nombre'), iconFirst: true } : {})}
            />
            {template ? (
              <span className={`${styles.templateBadge} ${styles.templateMark}`} data-tour="plantilla-marca">
                <LayoutTemplate aria-hidden="true" size={12} />
                {t('templateEditor.kind')}
              </span>
            ) : (
              page.template && <TemplateBadge templateId={page.template} />
            )}
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

/** La plantilla con la que se hizo la página, junto a su título: lleva a ella. Si se borró, lo dice (y no lleva) */
function TemplateBadge({ templateId }: { templateId: string }) {
  const { t } = useTranslation()
  const list = useTemplates().data
  const template = list?.templates.find((each) => each.id === templateId)
  const deleted = list?.deleted.find((each) => each.id === templateId)
  const shown = template ?? deleted
  if (!shown) return null
  if (!template) {
    return (
      <span className={styles.templateBadge} title={t('templates.madeWithDeleted', { name: shown.name })}>
        <TemplateIcon icon={shown.icon} size={12} />
        {t('templates.deletedName', { name: shown.name })}
      </span>
    )
  }
  return (
    <Link
      to="/plantillas/$templateId"
      params={{ templateId }}
      className={styles.templateBadge}
      title={t('templates.madeWith', { name: template.name })}
    >
      <TemplateIcon icon={shown.icon} size={12} />
      {template.name}
    </Link>
  )
}

/**
 * El título de la página, que es su propio encabezado y se cambia ahí mismo (como en el Crisol antiguo): Intro, la
 * flecha abajo al final o salir del campo lo guardan; Intro y la flecha bajan al texto; Escape lo deja como estaba.
 * Vacío o igual, vuelve el de antes sin más; un error (del servidor) sale debajo y el foco se queda. Con la página
 * bloqueada, solo se lee
 */
function InlineTitle({
  page,
  autoFocus,
  onDone,
  style,
  iconFirst = false
}: {
  page: Page
  autoFocus: boolean
  onDone: () => void
  /** Su nombre de transición (el título de una plantilla, desde su tarjeta) */
  style?: CSSProperties | undefined
  /** Un emoji al principio pasa a ser su icono (el de una plantilla, que sale en las listas y en sus páginas) */
  iconFirst?: boolean
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const request = useHeadingFocusRequest()
  const box = useRef<HTMLSpanElement>(null)
  const errorId = useId()
  const [error, setError] = useState<string | null>(null)
  const rename = useMutation({
    mutationFn: (change: { title: string; icon?: string }) => api.call('updatePage', { pageId: page.id, ...change }),
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
    let text = (box.current?.textContent ?? '').replace(/\s+/g, ' ').trim()
    const emoji = iconFirst ? text.match(LEADING_EMOJI) : null
    const icon = emoji?.[1]
    if (emoji) text = text.slice(emoji[0].length).trim() || page.title
    if (!text || (text === page.title && !icon)) {
      if (box.current) box.current.textContent = page.title
      setError(null)
      onDone()
      return
    }
    if (box.current) box.current.textContent = text
    rename.mutate({ title: text, ...(icon ? { icon } : {}) })
  }
  const atEnd = () => {
    const selection = getSelection()
    if (!selection?.rangeCount || !box.current) return false
    const range = selection.getRangeAt(0).cloneRange()
    range.setEnd(box.current, box.current.childNodes.length)
    return range.toString() === ''
  }
  return (
    <div className={styles.titleBox} style={style} data-elemento={style ? 'nombre' : undefined}>
      <h1
        tabIndex={-1}
        ref={(heading) => {
          if (!heading || !request.current) return
          request.current = false
          if (headingMayTakeFocus(request)) heading.focus()
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

/** Un emoji al principio de un texto (con su tono, su variante y sus uniones), y el espacio que lo sigue */
const LEADING_EMOJI = /^(\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|\uFE0F|\u200D\p{Extended_Pictographic})*)\s*/u

/**
 * «Más»: lo que se hace de vez en cuando con la página, en el menú común (flota junto a su botón; Escape o pulsar fuera
 * lo cierran): imprimir o descargar (un cuadro que pregunta cómo), exportar y sus versiones. items: lo de una
 * plantilla, en lugar de exportar
 */
function MoreActions({ page, items }: { page: Page; items?: ReactNode }) {
  const { t } = useTranslation()
  const [printing, setPrinting] = useState(false)
  return (
    <div className={styles.moreMenu}>
      <Menu label={t('wiki.moreActions')} icon={<Ellipsis aria-hidden="true" size={18} />}>
        {(close) => (
          <>
            <MenuItem
              aria-haspopup="dialog"
              onClick={() => {
                close()
                setPrinting(true)
              }}
            >
              <Printer aria-hidden="true" size={15} />
              {t('sheet.printOrDownload')}
            </MenuItem>
            {/* Lo demás (subpágina, renombrar, mover, borrar…), con el botón derecho en el árbol */}
            {items ?? <ExportPage page={page} />}
            <Versions page={page} />
          </>
        )}
      </Menu>
      {printing && <PrintDialog page={page} onClose={() => setPrinting(false)} />}
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

/** Una página de la wiki abierta */
export function WikiPage() {
  const { t } = useTranslation()
  const api = useApi()
  const { worldId, pageId } = pageRoute.useParams()
  const { nuevo, pestana } = pageRoute.useSearch()
  const page = useQuery({
    queryKey: pageKey(worldId, pageId),
    queryFn: () => api.call('getPage', { pageId }),
    // Al cambiar de página, la de antes se queda hasta que llega la nueva (sin hueco en blanco entre las dos)
    placeholderData: (previous) => (previous?.worldId === worldId ? previous : undefined)
  })
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
        return <OpenPage page={page.data} nuevo={nuevo === true} pestana={pestana ?? null} />
      }}
    </WikiLayout>
  )
}

/** La página abierta: su texto o, con ?pestana=, una de sus pestañas (un mapa) */
function OpenPage({ page, nuevo, pestana }: { page: Page; nuevo: boolean; pestana: string | null }) {
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
  return (
    <EntryView
      // Cada página entra con su animación
      key={page.id}
      page={page}
      nuevo={nuevo}
      tabs={all}
      active={active}
      banner={banner}
      home={isHome}
    />
  )
}

/**
 * La página de una plantilla (ADR-0024), abierta en su editor: su id, lo suyo en «⋯» y, a la derecha, sus campos y sus
 * bloques, que se definen en vez de rellenarse
 */
export interface TemplateMode {
  id: string
  more: ReactNode
  side: ReactNode
}

/**
 * Una página, como en Everlore: la cabecera, sus pestañas, lo de la elegida (el texto en una columna ancha, con su
 * hoja; un mapa, a todo lo ancho) y, a la derecha, el panel fijo a toda altura (sus propiedades, quién la menciona,
 * su índice y sus versiones), que se esconde con su botón. banner: en lugar de la portada (la cabecera del mundo)
 */
export function EntryView({
  page,
  nuevo = false,
  tabs,
  active = null,
  banner,
  home = false,
  template
}: {
  page: Page
  nuevo?: boolean
  tabs: PageTabView[]
  active?: PageTabView | null
  banner?: ReactNode
  home?: boolean
  template?: TemplateMode
}) {
  const { t } = useTranslation()
  const main = useRef<HTMLElement>(null)
  // Añadir etiquetas o una propiedad desde «Añadir bloque» del panel: lo hace la ficha de propiedades
  const addProperty = useRef<PropertyAdder | null>(null)
  /** La página: la cabecera, sus pestañas y lo de la elegida en medio; a la derecha, su panel (o el de la pestaña) */
  const body = (content: ReactNode, side: ReactNode) => (
    <div className={styles.entry} data-entry="" data-entry-panel="">
      <article ref={main} className={styles.entryMain}>
        <PageHead
          key={page.id}
          page={page}
          startEditing={nuevo}
          home={home}
          template={template?.id}
          actions={
            template ? (
              // Una plantilla no la conoce nadie ni se marca: el candado y «⋯», con lo suyo
              <>
                <LockButton page={page} />
                <MoreActions page={page} items={template.more} />
              </>
            ) : (
              <>
                <WhoKnowsButton page={page} />
                <PageRevealButton page={page} />
                <BookmarkButton page={page} />
                <LockButton page={page} />
                <MoreActions page={page} />
              </>
            )
          }
        />
        <PageTabs page={page} tabs={tabs} active={active?.id ?? null} />
        {content}
      </article>
      <aside aria-label={t('wiki.pagePanel')} className={styles.entryPanel} data-tour="panel-bloques">
        {side}
      </aside>
    </div>
  )
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
      {/* La escena: su mapa en medio y su rejilla en el sitio del panel de la página */}
      <SceneTabProvider page={page} tab={active?.kind === 'scene' ? active : null}>
        {active?.kind === 'scene'
          ? body(<SceneMain key={active.id} />, <SceneSide />)
          : body(
              active?.kind === 'text' ? (
                // Otra página de texto: la misma hoja y el mismo editor, con su propio documento
                <div className={styles.column}>
                  <SheetPaper page={page}>
                    <PageBody key={active.id} page={page} documentId={active.documentId} />
                  </SheetPaper>
                </div>
              ) : active?.kind === 'table' ? (
                <TableTab key={active.id} page={page} tab={active} />
              ) : active ? (
                <MapTab key={active.id} page={page} tab={active} />
              ) : (
                <div className={styles.column}>
                  <SheetPaper page={page}>
                    <PageBody page={page} />
                  </SheetPaper>
                </div>
              ),
              template?.side ?? (
                <>
                  {/* «Mencionado en», arriba (como en Everlore); después, las propiedades y los bloques */}
                  <Backlinks key={`enlaces-${page.id}`} page={page} />
                  {/* Las propiedades, a un lado (como los bloques del panel de Everlore): tras el retrato, si lo hay */}
                  <PanelBlocks
                    key={`bloques-${page.id}`}
                    page={page}
                    properties={<PageProperties key={page.id} page={page} adders={false} adderRef={addProperty} />}
                    onAddProperty={page.locked ? undefined : (kind) => addProperty.current?.(kind)}
                  />
                </>
              )
            )}
      </SceneTabProvider>
    </>
  )
}
