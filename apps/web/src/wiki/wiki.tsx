import type { Page } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate, useNavigate } from '@tanstack/react-router'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { ApiError } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { Field, FormError } from '../components/field.tsx'
import { focusOnMount, useReturnFocus } from '../components/focus.ts'
import form from '../components/form.module.css'
import list from '../components/list.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Backlinks, useLinkedBy } from './backlinks.tsx'
import { CollabSocket } from './collab.tsx'
import { PageBody } from './editor.tsx'
import { ExportPage, ExportWiki } from './export.tsx'
import { PageIcon } from './icon.tsx'
import { BookmarkButton, Bookmarks, OpenTabs, SiblingNav } from './navigation.tsx'
import { PageProperties } from './properties.tsx'
import { childrenKey, PageTree } from './tree.tsx'
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
  children: (world: { name: string }) => ReactNode
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const { account, pending } = useAccounts().useAccount()
  const [open, setOpen] = useState(false)
  const toggleButton = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  // Al abrir el cajón, el foco entra en él; al cerrarlo (no al abrir una página, que lo lleva al título), vuelve
  const returnFocus = useRef(false)
  useEffect(() => {
    if (open) closeButton.current?.focus()
    else if (returnFocus.current) toggleButton.current?.focus()
    returnFocus.current = false
  }, [open])
  const close = (back: boolean) => {
    returnFocus.current = back
    setOpen(false)
  }
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
  if (!worlds.data) return failed(worlds) ? <LoadError error={worlds.error} onRetry={() => worlds.refetch()} /> : null
  if (!world) {
    return (
      <section>
        <PageTitle>{t('wiki.notFound')}</PageTitle>
        <Link to="/mundos">{t('worlds.title')}</Link>
      </section>
    )
  }

  return (
    <div className={styles.wiki}>
      <button
        type="button"
        className={`${list.secondary} ${styles.pagesToggle}`}
        ref={toggleButton}
        aria-expanded={open}
        aria-controls={asideId}
        onClick={() => setOpen(true)}
      >
        {t('wiki.pages')}
      </button>
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
          <h2 id={headingId}>{t('wiki.pages')}</h2>
          <BusyButton className={form.button} busy={create.isPending} onClick={() => create.mutate(null)}>
            {t('wiki.newPage')}
          </BusyButton>
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
        <PageTree worldId={worldId} currentId={current?.id} path={current?.path} onNavigate={() => close(false)} />
        <OpenTabs worldId={worldId} current={current} compact />
        <Bookmarks worldId={worldId} onNavigate={() => close(false)} />
        <nav aria-label={t('wiki.more')} className={styles.more}>
          <Link to="/mundos/$worldId/etiquetas" params={{ worldId }} onClick={() => close(false)}>
            {t('tags.title')}
          </Link>
          <ExportWiki worldId={worldId} />
        </nav>
      </aside>
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
function PageHeading({ page, startEditing }: { page: Page; startEditing: boolean }) {
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

  if (editing) {
    return (
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
    )
  }
  return (
    <div className={styles.heading}>
      <PageIcon page={page} />
      <PageTitle>{page.title}</PageTitle>
      <div className={list.actions}>
        <button type="button" ref={renameButton.ref} className={list.secondary} onClick={() => setEditing(true)}>
          {t('wiki.rename')}
        </button>
        <LockButton page={page} />
        <BookmarkButton page={page} />
        <ExportPage page={page} />
        <DeletePage page={page} />
      </div>
      {page.locked && <p className={styles.locked}>{t('editor.locked')}</p>}
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
          <article>
            <Breadcrumbs worldId={worldId} world={world.name} path={page.data.path} />
            <PageHeading key={`${page.data.id}-${nuevo ?? false}`} page={page.data} startEditing={nuevo === true} />
            <PageProperties key={page.data.id} page={page.data} />
            <PageBody page={page.data} />
            <Backlinks key={`enlaces-${page.data.id}`} page={page.data} />
            <Subpages page={page.data} />
            <SiblingNav page={page.data} />
          </article>
        )
      }}
    </WikiLayout>
  )
}
