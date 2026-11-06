/**
 * Las páginas del mundo desde una campaña (ADR-0017, docs/specs/conocimiento.md): lo que sabe el jugador, en lectura.
 * Todo llega ya filtrado del servidor; aquí solo se pinta. Con ?como=, el máster lee como un personaje («Ver como
 * jugador»), con la franja que lo dice
 */
import type { Page, PanelBlock } from '@crisol/contracts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate, useNavigate } from '@tanstack/react-router'
import { ChevronDown, ChevronRight, Eye, FileText } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { ApiError } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { Loading } from '../components/brand.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Tour } from '../components/tour.tsx'
import { Backlinks } from '../wiki/backlinks.tsx'
import { ContentView, NewSecretsContext } from '../wiki/content.tsx'
import { PageCoverImage } from '../wiki/cover.tsx'
import { MapTab } from '../wiki/map/map-tab.tsx'
import panelStyles from '../wiki/panel-blocks.module.css'
import { usePageContent } from '../wiki/preview.tsx'
import { PageProperties } from '../wiki/properties.tsx'
import { type ReadAs, ReadAsProvider, readAsInput, readAsKey, useReadAs } from '../wiki/read-as.tsx'
import { RelatedBody } from '../wiki/related-block.tsx'
import treeStyles from '../wiki/tree.module.css'
import wiki from '../wiki/wiki.module.css'
import styles from './world-pages.module.css'

const homeRoute = getRouteApi('/mundos/$worldId/campanas/$campaignId/paginas')
const pageRoute = getRouteApi('/mundos/$worldId/campanas/$campaignId/paginas/$pageId')

/** Las consultas de lo que ve: cuelgan de ['pages', mundo] (las vacía el canal al cambiar algo o lo que sabe) */
const playerKey = (worldId: string, readAs: ReadAs, ...rest: unknown[]) => [
  'pages',
  worldId,
  'player',
  ...readAsKey(readAs),
  ...rest
]

const EMPTY: ReadonlySet<string> = new Set()

type TreeRow = {
  id: string
  parentId: string | null
  title: string
  icon: string | null
  level: number
  hasChildren: boolean
}

/** Lo nuevo de quien juega (no del máster viendo como alguien) */
function useNews(worldId: string) {
  const api = useApi()
  const readAs = useReadAs() as ReadAs
  return useQuery({
    queryKey: playerKey(worldId, readAs, 'news'),
    queryFn: () => api.call('listNews', { campaignId: readAs.campaignId }),
    enabled: !readAs.asCharacterId
  })
}

function useTree(worldId: string) {
  const api = useApi()
  const readAs = useReadAs() as ReadAs
  return useQuery({
    queryKey: playerKey(worldId, readAs, 'tree'),
    queryFn: () => api.call('listPageTree', { worldId, levels: 32, ...readAsInput(readAs) })
  })
}

/** «Páginas de Valdren», sin página: la primera que ve, o que aún no saben nada */
export function WorldPagesHome() {
  const { worldId, campaignId } = homeRoute.useParams()
  const { como } = homeRoute.useSearch()
  return (
    <PlayerWiki worldId={worldId} readAs={{ campaignId, asCharacterId: como }}>
      <FirstPage worldId={worldId} />
    </PlayerWiki>
  )
}

function FirstPage({ worldId }: { worldId: string }) {
  const { t } = useTranslation()
  const readAs = useReadAs() as ReadAs
  const api = useApi()
  const tree = useTree(worldId)
  // La portada del mundo, si la conocen; si no, la primera que ven
  const home = useQuery({
    queryKey: playerKey(worldId, readAs, 'home'),
    queryFn: () => api.call('getWorldHome', { worldId, ...readAsInput(readAs) })
  })
  if (!tree.data || !home.data)
    return failed(tree) ? <LoadError error={tree.error} onRetry={() => tree.refetch()} /> : <Loading />
  const first = home.data.pageId ? { id: home.data.pageId } : tree.data.pages[0]
  if (!first) return <p className={styles.nothing}>{t('playerPages.nothing')}</p>
  return (
    <Navigate
      to="/mundos/$worldId/campanas/$campaignId/paginas/$pageId"
      params={{ worldId, campaignId: readAs.campaignId, pageId: first.id }}
      search={readAs.asCharacterId ? { como: readAs.asCharacterId } : {}}
      replace
    />
  )
}

/** Una página, como la ve el jugador */
export function WorldPageView() {
  const { worldId, campaignId, pageId } = pageRoute.useParams()
  const { como } = pageRoute.useSearch()
  return (
    <PlayerWiki worldId={worldId} readAs={{ campaignId, asCharacterId: como }} currentId={pageId}>
      <PlayerPage worldId={worldId} pageId={pageId} />
    </PlayerWiki>
  )
}

/** El armazón: el árbol a un lado y la página al otro, todo leyendo desde la campaña */
function PlayerWiki({
  worldId,
  readAs,
  currentId,
  children
}: {
  worldId: string
  readAs: ReadAs
  currentId?: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  const api = useApi()
  const { account, pending } = useAccounts().useAccount()
  const worlds = useQuery({
    queryKey: ['worlds'],
    queryFn: () => api.call('listWorlds', {}),
    enabled: Boolean(account)
  })
  const world = worlds.data?.worlds.find((w) => w.id === worldId)
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  return (
    <ReadAsProvider value={readAs}>
      {readAs.asCharacterId && <ViewingAs worldId={worldId} readAs={readAs} />}
      <div className={wiki.wiki}>
        <aside className={wiki.aside} aria-labelledby="paginas-jugador" data-tour="paginas-arbol">
          <div className={wiki.asideHeader}>
            <h2 id="paginas-jugador">{world ? t('wiki.title', { world: world.name }) : t('wiki.pages')}</h2>
          </div>
          <PlayerTree worldId={worldId} currentId={currentId} />
        </aside>
        <div className={wiki.content} data-tour="paginas-pagina">
          {children}
        </div>
      </div>
      <Tour
        id="paginas-jugador"
        steps={[
          { target: '[data-tour="paginas-arbol"]', text: t('tour.playerPages.tree') },
          { target: '[data-tour="paginas-pagina"]', text: t('tour.playerPages.page') }
        ]}
      />
    </ReadAsProvider>
  )
}

/** El árbol de lo que ve: plegable, sin arrastrar ni menú */
function PlayerTree({ worldId, currentId }: { worldId: string; currentId?: string | undefined }) {
  const { t } = useTranslation()
  const readAs = useReadAs() as ReadAs
  const tree = useTree(worldId)
  const rows = tree.data?.pages ?? []
  const news = useNews(worldId).data?.news ?? []
  const isNew = (id: string) => news.some((n) => n.pageId === id || (n.kind === 'page' && n.targetId === id))
  // Abiertas: las de encima de la página abierta, y las que se abran a mano
  const above = useMemo(() => {
    const parents = new Map(rows.map((row) => [row.id, row.parentId]))
    const open = new Set<string>()
    let at = currentId ? (parents.get(currentId) ?? null) : null
    while (at) {
      open.add(at)
      at = parents.get(at) ?? null
    }
    return open
  }, [rows, currentId])
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const isOpen = (id: string) => toggled[id] ?? above.has(id)
  if (!tree.data) return failed(tree) ? <LoadError error={tree.error} onRetry={() => tree.refetch()} /> : null
  if (rows.length === 0) return <p className={styles.muted}>{t('playerPages.empty')}</p>
  const byParent = Map.groupBy(rows, (row) => row.parentId)
  const render = (parentId: string | null): ReactNode =>
    (byParent.get(parentId) ?? []).map((row: TreeRow) => (
      <li key={row.id}>
        <div className={styles.row} style={{ paddingInlineStart: `${(row.level - 1) * 0.875}rem` }}>
          {row.hasChildren ? (
            <button
              type="button"
              className={styles.toggle}
              aria-expanded={isOpen(row.id)}
              aria-label={t(isOpen(row.id) ? 'playerPages.collapse' : 'playerPages.expand', { title: row.title })}
              onClick={() => setToggled((current) => ({ ...current, [row.id]: !isOpen(row.id) }))}
            >
              {isOpen(row.id) ? (
                <ChevronDown size={14} aria-hidden="true" />
              ) : (
                <ChevronRight size={14} aria-hidden="true" />
              )}
            </button>
          ) : (
            <span className={styles.toggle} aria-hidden="true" />
          )}
          <Link
            to="/mundos/$worldId/campanas/$campaignId/paginas/$pageId"
            params={{ worldId, campaignId: readAs.campaignId, pageId: row.id }}
            search={readAs.asCharacterId ? { como: readAs.asCharacterId } : {}}
            className={treeStyles.item}
            aria-current={row.id === currentId ? 'page' : undefined}
          >
            <span className={treeStyles.icon} aria-hidden="true">
              {row.icon ?? <FileText size={14} />}
            </span>
            {row.title}
            {isNew(row.id) && <span className={styles.newBadge}>{t('playerPages.new')}</span>}
          </Link>
        </div>
        {row.hasChildren && isOpen(row.id) && <ul className={treeStyles.tree}>{render(row.id)}</ul>}
      </li>
    ))
  return (
    <nav aria-label={t('wiki.pages')}>
      <ul className={treeStyles.tree}>{render(null)}</ul>
    </nav>
  )
}

/** La página: su portada, su título, su texto y, a la derecha, quién la menciona, sus propiedades y su panel */
function PlayerPage({ worldId, pageId }: { worldId: string; pageId: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const readAs = useReadAs() as ReadAs
  const page = useQuery({
    queryKey: playerKey(worldId, readAs, 'page', pageId),
    queryFn: () => api.call('getPage', { pageId, ...readAsInput(readAs) }),
    placeholderData: (previous) => (previous?.worldId === worldId ? previous : undefined)
  })
  const gone = page.error instanceof ApiError && page.error.status === 404
  if (gone) return <p className={styles.nothing}>{t('playerPages.gone')}</p>
  if (!page.data) return failed(page) ? <LoadError error={page.error} onRetry={() => page.refetch()} /> : null
  return <PlayerEntry key={page.data.id} page={page.data} />
}

function PlayerEntry({ page }: { page: Page }) {
  const { t } = useTranslation()
  const api = useApi()
  const readAs = useReadAs() as ReadAs
  const tabs = useQuery({
    queryKey: playerKey(page.worldId, readAs, 'tabs', page.id),
    queryFn: () => api.call('listPageTabs', { pageId: page.id, ...readAsInput(readAs) })
  })
  // Sus pestañas que ve: las de texto y los mapas
  const texts = (tabs.data?.tabs ?? []).filter((tab) => tab.kind === 'text' || tab.kind === 'map')
  const { pestana } = pageRoute.useSearch()
  const navigate = useNavigate()
  const tabId = pestana ?? null
  const setTabId = (id: string | null) =>
    void navigate({
      to: '/mundos/$worldId/campanas/$campaignId/paginas/$pageId',
      params: { worldId: page.worldId, campaignId: readAs.campaignId, pageId: page.id },
      search: { ...(readAs.asCharacterId ? { como: readAs.asCharacterId } : {}), ...(id ? { pestana: id } : {}) },
      replace: true
    })
  const active = texts.find((tab) => tab.id === tabId) ?? null
  const content = usePageContent(page.worldId, page.id, null, false, active?.kind === 'text' ? active.id : undefined)
  // Lo nuevo de esta página, también lo que llega con ella abierta: se marca mientras se lee y deja de ser nuevo
  const news = useNews(page.worldId)
  const queryClient = useQueryClient()
  const [fresh, setFresh] = useState<ReadonlySet<string>>(EMPTY)
  useEffect(() => {
    if (!news.data || readAs.asCharacterId) return
    const mine = news.data.news.filter((n) => n.pageId === page.id || (n.kind === 'page' && n.targetId === page.id))
    if (mine.length === 0) return
    const secrets = mine.filter((n) => n.kind === 'secret').map((n) => n.targetId)
    if (secrets.length > 0) setFresh((now) => new Set([...now, ...secrets]))
    void api
      .call('seeNews', { campaignId: readAs.campaignId, pageId: page.id })
      .then(() => queryClient.invalidateQueries({ queryKey: playerKey(page.worldId, readAs, 'news') }))
  }, [news.data, page.id, page.worldId, readAs, api, queryClient])
  return (
    <>
      <div className={wiki.entryBanner} data-cover={page.cover ? '' : undefined}>
        {page.cover && <PageCoverImage page={page} />}
      </div>
      <div className={wiki.entry} data-entry="" data-entry-panel="">
        <article className={wiki.entryMain}>
          <header className={wiki.entryHeader}>
            <div className={wiki.entryTitle}>
              <div className={wiki.heading}>
                {page.icon && <span aria-hidden="true">{page.icon}</span>}
                <PageTitle className={styles.title}>{page.title}</PageTitle>
              </div>
            </div>
          </header>
          {texts.length > 0 && (
            // biome-ignore lint/a11y/useSemanticElements: un grupo de botones que eligen qué se ve, no un formulario
            <div role="group" aria-label={t('playerPages.tabs')} className={styles.tabs}>
              <button type="button" aria-pressed={!active} onClick={() => setTabId(null)}>
                {t('playerPages.text')}
              </button>
              {texts.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active?.id === tab.id}
                  onClick={() => setTabId(tab.id)}
                >
                  {tab.name}
                </button>
              ))}
            </div>
          )}
          {active?.kind === 'map' ? (
            <MapTab key={active.id} page={page} tab={active} />
          ) : (
            <div className={wiki.column}>
              {content.data ? (
                <NewSecretsContext.Provider value={fresh}>
                  <ContentView blocks={content.data.blocks} worldId={page.worldId} />
                </NewSecretsContext.Provider>
              ) : failed(content) ? (
                <LoadError error={content.error} onRetry={() => content.refetch()} />
              ) : null}
            </div>
          )}
        </article>
        <aside aria-label={t('wiki.pagePanel')} className={wiki.entryPanel}>
          <Backlinks page={page} />
          <PageProperties page={page} adders={false} />
          <ReadPanel page={page} />
        </aside>
      </div>
    </>
  )
}

/** El panel en lectura: lo que el máster no ocultó (ya filtrado), sin tocarlo */
function ReadPanel({ page }: { page: Page }) {
  if (page.panel.length === 0) return null
  return (
    <div className={styles.panel}>
      {page.panel.map((block) => (
        <section key={block.id} className={panelStyles.block}>
          {'title' in block && block.title && <h3 className={styles.blockTitle}>{block.title}</h3>}
          <ReadBlock page={page} block={block} />
        </section>
      ))}
    </div>
  )
}

function ReadBlock({ page, block }: { page: Page; block: PanelBlock }) {
  const { t } = useTranslation()
  switch (block.type) {
    case 'text':
      return <p className={styles.text}>{block.text}</p>
    case 'image':
      return block.fileId ? (
        <figure className={styles.figure}>
          <img src={`/api/files/${block.fileId}`} alt={block.caption} loading="lazy" />
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>
      ) : null
    case 'meter':
      return (
        <p className={styles.text}>
          <meter min={0} max={block.max} value={block.value} className={styles.meter} />
          <span>{t('playerPages.ofMax', { value: block.value, max: block.max })}</span>
        </p>
      )
    case 'rating':
      return <p className={styles.text}>{t('playerPages.ofMax', { value: block.value, max: block.max })}</p>
    case 'tokens':
      return <p className={styles.text}>{t('playerPages.ofMax', { value: block.value, max: block.max })}</p>
    case 'subpages':
      return <ReadSubpages page={page} />
    case 'tagged':
      return <ReadTagged page={page} tag={block.tag} />
    case 'related':
      return <RelatedBody page={page} block={block} onFix={() => undefined} />
  }
}

function ReadSubpages({ page }: { page: Page }) {
  const { t } = useTranslation()
  const tree = useTree(page.worldId)
  const readAs = useReadAs() as ReadAs
  const children = (tree.data?.pages ?? []).filter((row) => row.parentId === page.id)
  if (tree.data && children.length === 0) return <p className={styles.muted}>{t('panelBlocks.noSubpages')}</p>
  return (
    <ul className={panelStyles.pages}>
      {children.map((child) => (
        <li key={child.id}>
          <Link
            to="/mundos/$worldId/campanas/$campaignId/paginas/$pageId"
            params={{ worldId: page.worldId, campaignId: readAs.campaignId, pageId: child.id }}
            search={readAs.asCharacterId ? { como: readAs.asCharacterId } : {}}
          >
            {child.title}
          </Link>
        </li>
      ))}
    </ul>
  )
}

function ReadTagged({ page, tag }: { page: Page; tag: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const readAs = useReadAs() as ReadAs
  const found = useQuery({
    queryKey: playerKey(page.worldId, readAs, 'tagged', tag),
    queryFn: () => api.call('searchWiki', { worldId: page.worldId, tag, page: 1, ...readAsInput(readAs) }),
    enabled: Boolean(tag)
  })
  const list = (found.data?.results ?? []).filter((result) => result.id !== page.id)
  return (
    <>
      <p className={panelStyles.tagChip}>#{tag}</p>
      {found.data && list.length === 0 ? (
        <p className={styles.muted}>{t('panelBlocks.noTagged')}</p>
      ) : (
        <ul className={panelStyles.pages}>
          {list.map((result) => (
            <li key={result.id}>
              <Link
                to="/mundos/$worldId/campanas/$campaignId/paginas/$pageId"
                params={{ worldId: page.worldId, campaignId: readAs.campaignId, pageId: result.id }}
                search={readAs.asCharacterId ? { como: readAs.asCharacterId } : {}}
              >
                {result.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/** «Viendo como Lía»: la franja del máster que lee como un personaje, con «Volver» */
function ViewingAs({ worldId, readAs }: { worldId: string; readAs: ReadAs }) {
  const { t } = useTranslation()
  const api = useApi()
  const characters = useQuery({
    queryKey: ['characters', readAs.campaignId],
    queryFn: () => api.call('listCharacters', { campaignId: readAs.campaignId })
  })
  const name =
    readAs.asCharacterId === 'campaign'
      ? t('playerPages.theCampaign')
      : (characters.data?.characters.find((c) => c.id === readAs.asCharacterId)?.name ?? '')
  return (
    <div role="status" className={styles.viewingAs}>
      <Eye size={14} aria-hidden="true" />
      <span>{t('playerPages.viewingAs', { name })}</span>
      <Link to="/mundos/$worldId/wiki" params={{ worldId }} className={styles.back}>
        {t('playerPages.back')}
      </Link>
    </div>
  )
}
