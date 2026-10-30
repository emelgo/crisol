import type { Page } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate, useNavigate } from '@tanstack/react-router'
import { Ellipsis } from 'lucide-react'
import { type ReactNode, type RefObject, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { ApiError } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { Field, FormError } from '../components/field.tsx'
import { focusOnMount, useReturnFocus } from '../components/focus.ts'
import form from '../components/form.module.css'
import list from '../components/list.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Backlinks, useLinkedBy } from './backlinks.tsx'
import { CollabSocket } from './collab.tsx'
import { CoverButton, PageCoverImage } from './cover.tsx'
import { PageBody } from './editor.tsx'
import { ExportPage, ExportWiki } from './export.tsx'
import { PageIcon } from './icon.tsx'
import { BookmarkButton, Bookmarks, OpenTabs, SiblingNav } from './navigation.tsx'
import { useWikiPanel } from './panel.tsx'
import { PageProperties } from './properties.tsx'
import { QuickSwitcher } from './quick-switcher.tsx'
import { SearchBox } from './search-box.tsx'
import { SheetLayout, SheetToggle } from './sheet/controls.tsx'
import { childrenKey, PageTree } from './tree.tsx'
import { Versions } from './versions.tsx'
import styles from './wiki.module.css'

const homeRoute = getRouteApi('/mundos/$worldId/wiki')
const pageRoute = getRouteApi('/mundos/$worldId/wiki/$pageId')

export const pageKey = (worldId: string, pageId: string) => ['pages', worldId, 'page', pageId]

/** Para el campo del título de una página recién creada: el foco y todo el texto elegido, para escribir encima */
function focusAndSelect(input: HTMLInputElement | null) {
  input?.focus()
  input?.select()
}

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
  const { panel, collapsed, open, close, show } = useWikiPanel()
  const closeButton = useRef<HTMLButtonElement>(null)
  // Al abrir el cajón (en lo estrecho), el foco entra en él; al cerrarlo, vuelve al botón de la barra que lo abrió
  useEffect(() => {
    if (open) closeButton.current?.focus()
  }, [open])
  const asideId = useId()
  const headingId = useId()
  const create = useCreatePage(worldId)
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

  const titles = { pages: t('wiki.pages'), search: t('ribbon.search'), bookmarks: t('ribbon.bookmarks') }
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
        {/* Las pestañas del panel: las páginas, buscar y los marcadores (antes, botones de la barra) */}
        <div className={styles.panelTabs} role="tablist" aria-label={t('ribbon.wiki')}>
          {(['pages', 'search', 'bookmarks'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={panel === tab}
              className={styles.panelTab}
              onClick={(event) => show(tab, event.currentTarget)}
            >
              {titles[tab]}
            </button>
          ))}
        </div>
        <div className={styles.asideHeader}>
          <h2 id={headingId} className={styles.hiddenTitle}>
            {titles[panel]}
          </h2>
          {panel === 'pages' && (
            <BusyButton className={form.button} busy={create.isPending} onClick={() => create.mutate(null)}>
              {t('wiki.newPage')}
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
        <FormError message={create.error ? errorText(create.error) : null} />
        {panel === 'pages' && (
          <>
            <PageTree worldId={worldId} currentId={current?.id} path={current?.path} onNavigate={() => close(false)} />
            <OpenTabs worldId={worldId} current={current} compact />
            <div className={styles.more}>
              <ExportWiki worldId={worldId} />
            </div>
          </>
        )}
        {panel === 'search' && <SearchBox worldId={worldId} onSearch={() => close(false)} />}
        {panel === 'bookmarks' && <Bookmarks worldId={worldId} onNavigate={() => close(false)} />}
      </aside>
      <QuickSwitcher worldId={worldId} onCreatePage={() => create.mutate(null)} />
      <div className={styles.content}>
        <OpenTabs worldId={worldId} current={current} />
        <CollabSocket>{children(world)}</CollabSocket>
      </div>
    </div>
  )
}

/** Migas de pan: el mundo y la ruta hasta la página */
function Breadcrumbs({ worldId, world, path }: { worldId: string; world: string; path: Page['path'] }) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('wiki.breadcrumbs')} className={styles.crumbs}>
      <ol>
        <li>
          <Link to="/mundos/$worldId/wiki" params={{ worldId }}>
            {world}
          </Link>
        </li>
        {path.slice(0, -1).map((step) => (
          <li key={step.id}>
            <Link to="/mundos/$worldId/wiki/$pageId" params={{ worldId, pageId: step.id }}>
              {step.title}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** La wiki sin página abierta */
export function WikiHome() {
  const { t } = useTranslation()
  const { worldId } = homeRoute.useParams()
  return (
    <WikiLayout worldId={worldId}>
      {(world) => (
        <section>
          <PageTitle>{t('wiki.title', { world: world.name })}</PageTitle>
          <p>{t('wiki.pick')}</p>
        </section>
      )}
    </WikiLayout>
  )
}

/** El título de la página, que se renombra en el sitio. Una recién creada empieza ya con el campo abierto */
function PageHeading({ page, world, startEditing }: { page: Page; world: string; startEditing: boolean }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const renameButton = useReturnFocus()
  const [editing, setEditing] = useState(startEditing)
  const stop = () => {
    renameButton.back()
    setEditing(false)
    if (startEditing) {
      void navigate({
        to: '/mundos/$worldId/wiki/$pageId',
        params: { worldId: page.worldId, pageId: page.id },
        search: {},
        replace: true
      })
    }
  }
  const rename = useMutation({
    mutationFn: (title: string) => api.call('updatePage', { pageId: page.id, title }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pages', page.worldId] })
      stop()
    }
  })

  const crumbs = <Breadcrumbs worldId={page.worldId} world={world} path={page.path} />
  if (editing) {
    return (
      <>
        {crumbs}
        <form
          className={styles.rename}
          onSubmit={(event) => {
            event.preventDefault()
            rename.mutate(String(new FormData(event.currentTarget).get('title')))
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') stop()
          }}
        >
          <Field
            label={t('wiki.titleLabel')}
            name="title"
            autoComplete="off"
            defaultValue={page.title}
            maxLength={200}
            required
            ref={focusAndSelect}
          />
          <FormError message={rename.error ? errorText(rename.error) : null} />
          <div className={list.actions}>
            <BusyButton type="submit" className={form.button} busy={rename.isPending}>
              {t('list.save')}
            </BusyButton>
            <button type="button" className={list.secondary} onClick={stop}>
              {t('list.cancel')}
            </button>
          </div>
        </form>
      </>
    )
  }
  return (
    <>
      <div className={styles.pageBar}>
        {crumbs}
        <div className={styles.pageActions}>
          <BookmarkButton page={page} />
          <SheetToggle page={page} />
          <MoreActions page={page} triggerRef={renameButton.ref} onRename={() => setEditing(true)} />
        </div>
      </div>
      <PageCoverImage page={page} />
      <div className={styles.heading}>
        <PageIcon page={page} />
        <PageTitle>{page.title}</PageTitle>
        {page.locked && <p className={styles.locked}>{t('editor.locked')}</p>}
      </div>
    </>
  )
}

/** «Más»: lo que se hace de vez en cuando con la página, fuera de la vista hasta que se pide */
function MoreActions({
  page,
  triggerRef,
  onRename
}: {
  page: Page
  triggerRef: (element: HTMLElement | null) => void
  onRename: () => void
}) {
  const { t } = useTranslation()
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
        ref={(element) => {
          trigger.current = element
          triggerRef(element)
        }}
        aria-label={t('wiki.moreActions')}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <Ellipsis aria-hidden="true" size={18} />
        {t('wiki.moreShort')}
      </button>
      {open && (
        <div id={panelId} className={styles.morePanel}>
          <button
            type="button"
            className={list.secondary}
            onClick={() => {
              setOpen(false)
              onRename()
            }}
          >
            {t('wiki.rename')}
          </button>
          <LockButton page={page} />
          <CoverButton page={page} />
          <ExportPage page={page} />
          <DeletePage page={page} />
        </div>
      )}
    </div>
  )
}

/** El candado: pone el editor en lectura (no es un permiso: quien escribe puede quitarlo) */
function LockButton({ page }: { page: Page }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const toggle = useMutation({
    mutationFn: () => api.call('updatePage', { pageId: page.id, locked: !page.locked }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pages', page.worldId] })
  })
  return (
    <BusyButton
      className={list.secondary}
      aria-pressed={page.locked}
      busy={toggle.isPending}
      onClick={() => toggle.mutate()}
    >
      {t(page.locked ? 'editor.unlock' : 'editor.lock')}
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

/** Las subpáginas de la abierta (la misma consulta que su rama en el árbol) y crear otra */
function Subpages({ page }: { page: Page }) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const create = useCreatePage(page.worldId)
  const children = useQuery({
    queryKey: childrenKey(page.worldId, page.id),
    queryFn: () => api.call('listPageChildren', { worldId: page.worldId, parentId: page.id })
  })
  return (
    <section aria-labelledby="subpaginas" className={styles.subpages}>
      <h2 id="subpaginas">{t('wiki.subpages')}</h2>
      {children.data &&
        (children.data.pages.length === 0 ? (
          <p>{t('wiki.noSubpages')}</p>
        ) : (
          <ul className={list.list}>
            {children.data.pages.map((child) => (
              <li key={child.id} className={list.item}>
                <Link
                  to="/mundos/$worldId/wiki/$pageId"
                  params={{ worldId: page.worldId, pageId: child.id }}
                  className={`${list.name} ${list.entity}`}
                >
                  {child.title}
                </Link>
              </li>
            ))}
          </ul>
        ))}
      <FormError message={create.error ? errorText(create.error) : null} />
      <BusyButton className={form.button} busy={create.isPending} onClick={() => create.mutate(page.id)}>
        {t('wiki.newSubpage')}
      </BusyButton>
    </section>
  )
}

/** Una página de la wiki abierta */
export function WikiPage() {
  const { t } = useTranslation()
  const api = useApi()
  const { worldId, pageId } = pageRoute.useParams()
  const { nuevo } = pageRoute.useSearch()
  const page = useQuery({ queryKey: pageKey(worldId, pageId), queryFn: () => api.call('getPage', { pageId }) })
  const missing = page.error instanceof ApiError && page.error.status === 404
  const pageMain = useRef<HTMLDivElement>(null)
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
        return (
          <article className={styles.page}>
            <div className={styles.pageMain} ref={pageMain}>
              <PageHeading
                key={`${page.data.id}-${nuevo ?? false}`}
                page={page.data}
                world={world.name}
                startEditing={nuevo === true}
              />
              <PageProperties key={page.data.id} page={page.data} />
              <SheetLayout page={page.data} body={<PageBody page={page.data} />} />
              <Subpages page={page.data} />
              <SiblingNav page={page.data} />
            </div>
            <aside aria-label={t('wiki.pagePanel')} className={styles.pagePanel}>
              <Contents key={`indice-${page.data.id}`} root={pageMain} />
              <Backlinks key={`enlaces-${page.data.id}`} page={page.data} />
              <Versions key={`versiones-${page.data.id}`} page={page.data} />
            </aside>
          </article>
        )
      }}
    </WikiLayout>
  )
}

/** El índice: los títulos del texto de la página (no los de los secretos), que se siguen al escribir */
function Contents({ root }: { root: RefObject<HTMLDivElement | null> }) {
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
