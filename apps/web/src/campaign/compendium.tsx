/**
 * El compendio de una campaña (docs/specs/personajes.md § campana): el contenido de su sistema, con las fuentes que
 * eligió, y el del mundo (docs/specs/compendio-mundo.md), para quien lo lleva. A la izquierda, el buscador (en sus dos
 * idiomas, sin tildes), los tipos y la lista; en el centro, lo elegido; a la derecha, su edición, su nombre en inglés,
 * su otra versión, de dónde sale y la atribución de su fuente
 */
import { visibilitiesFor } from '@crisol/contracts'
import { type Text, textOf } from '@crisol/systems'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Navigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  ChevronRight,
  Copy,
  Globe,
  Pencil,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  Upload,
  X
} from 'lucide-react'
import { createContext, type ReactNode, useContext, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import type { ActionOutput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { FormError } from '../components/field.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { useSettled } from '../components/settled.ts'
import { SystemImage } from '../components/system-image.tsx'
import { Tour } from '../components/tour.tsx'
import { PutInPlay } from '../creatures/put-in-play.tsx'
import { useDice } from '../dice/context.tsx'
import { useNarrow } from '../wiki/panel.tsx'
import styles from './compendium.module.css'
import { CompendiumSettings } from './compendium-settings.tsx'
import { ContentText } from './content-text.tsx'
import { DeleteEntry, EntryEditor, type EntryTarget } from './entry-editor.tsx'
import { EntryTable } from './entry-table.tsx'
import { OriginNotice, ToSystem } from './origin.tsx'

const route = getRouteApi('/mundos/$worldId/campanas/$campaignId/compendio')
/** El sistema del compendio abierto: de él salen sus imágenes */
const SystemIdContext = createContext<string | null>(null)
const PAGE = 100

type Language = 'es' | 'en'
type CompendiumType = ActionOutput<'getCampaignCompendium'>['types'][number]
type ContentHit = ActionOutput<'searchCampaignContent'>['items'][number]
type Field = CompendiumType['fields'][number]
type World = NonNullable<ActionOutput<'getCampaignCompendium'>['world']>
/** Qué capas se enseñan: las dos, solo la del sistema o solo la del mundo */
type Layer = 'all' | 'system' | 'world'
const LAYERS: Layer[] = ['all', 'system', 'world']
const inLayer = (layer: Layer, world: boolean | undefined) =>
  layer === 'all' || (layer === 'world' ? Boolean(world) : !world)

/** Una clave como texto: «trato_con_animales» → «Trato con animales» */
const humanize = (key: string) => {
  const text = key.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** El valor de un campo como texto, en el idioma de la campaña; sin valor (o «no»), nada */
function valueText(field: Field, value: unknown, language: Language, yes: string): string | null {
  if (value === undefined || value === null || value === '') return null
  const option = (v: unknown) => field.options?.find((o) => o.value === v)?.label ?? humanize(String(v))
  switch (field.kind) {
    case 'boolean':
      return value === true ? yes : null
    case 'choice':
      return option(value)
    case 'list':
      return Array.isArray(value) && value.length > 0 ? value.map(option).join(', ') : null
    case 'text':
      return textOf(value as Text, language) || null
    default:
      return typeof value === 'object' ? textOf(value as Text, language) || null : String(value)
  }
}

/** «2024» o «2014 · Legado» */
/** Lo del compendio del mundo, marcado */
function WorldTag() {
  const { t } = useTranslation()
  return <span className={`${styles.edition} ${styles.world}`}>{t('compendium.fromWorld')}</span>
}

function EditionTag({ edition, legacy }: { edition: string | null; legacy: boolean }) {
  const { t } = useTranslation()
  if (!edition) return null
  return (
    <span className={legacy ? `${styles.edition} ${styles.legacy}` : styles.edition}>
      {legacy ? t('compendium.legacy', { edition }) : edition}
    </span>
  )
}

/**
 * Lo del mundo que se le reveló a quien juega es nuevo hasta que lo abre (docs/specs/compendio-jugadores.md): con la
 * misma consulta que el número de novedades de la barra
 */
function useSeenEntry(worldId: string, campaignId: string, key: string | null, player: boolean) {
  const api = useApi()
  const client = useQueryClient()
  const news = useQuery({
    queryKey: ['pages', worldId, 'player', campaignId, null, 'news'],
    queryFn: () => api.call('listNews', { campaignId }),
    enabled: player
  })
  useEffect(() => {
    if (!key || !news.data?.news.some((n) => n.kind === 'content' && n.targetId === key)) return
    void api
      .call('seeNews', { campaignId, content: key })
      .then(() => client.invalidateQueries({ queryKey: ['pages', worldId, 'player', campaignId, null, 'news'] }))
  }, [key, news.data, api, client, worldId, campaignId])
}

export function CompendiumScreen() {
  const { t } = useTranslation()
  const { worldId, campaignId } = route.useParams()
  const { ver } = route.useSearch()
  const navigate = route.useNavigate()
  const api = useApi()
  const { account, pending } = useAccounts().useAccount()
  const narrow = useNarrow()
  const searchId = useId()
  const compendium = useQuery({
    queryKey: ['compendium', campaignId],
    queryFn: () => api.call('getCampaignCompendium', { campaignId }),
    enabled: Boolean(account)
  })
  const [query, setQuery] = useState('')
  // Se busca al dejar de escribir, no con cada tecla
  const wanted = useSettled(query.trim())
  const [layer, setLayer] = useState<Layer>('all')
  const hits = useInfiniteQuery({
    queryKey: ['compendium', campaignId, 'search', wanted, layer],
    // Solo una capa, si se elige: la filtra el servidor (antes de paginar)
    queryFn: ({ pageParam }) =>
      api.call('searchCampaignContent', {
        campaignId,
        query: wanted,
        limit: PAGE,
        offset: pageParam,
        ...(layer === 'all' ? {} : { layer })
      }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const seen = pages.reduce((n, p) => n + p.items.length, 0)
      return seen < last.total ? seen : undefined
    },
    enabled: Boolean(compendium.data?.system) && wanted !== ''
  })
  const items = hits.data?.pages.flatMap((p) => p.items) ?? []
  // Lo abierto va en la dirección: se enlaza y, en el móvil, «atrás» vuelve a la lista
  const shown = ver ?? null
  const open = (key: string) => void navigate({ search: { ver: key } })
  const back = () => void navigate({ search: {} })
  // Al volver a la lista (en lo estrecho), el foco va a lo que estaba abierto
  const [lastShown, setLastShown] = useState<string | null>(null)
  if (shown && shown !== lastShown) setLastShown(shown)
  useEffect(() => {
    if (shown || !lastShown || !narrow) return
    document.querySelector<HTMLElement>(`[data-entry="${CSS.escape(lastShown)}"]`)?.focus()
  }, [shown, lastShown, narrow])

  const [creating, setCreating] = useState(false)
  // Lo recién copiado al mundo se abre para cambiarlo
  const [editing, setEditing] = useState<string | null>(null)
  // Sus ajustes (lo que ven los jugadores): del máster
  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.call('getCampaign', { campaignId }),
    enabled: Boolean(account)
  })
  const master = campaign.data?.campaign.role === 'master'
  useSeenEntry(worldId, campaignId, shown, campaign.data?.campaign.role === 'player')
  const [settings, setSettings] = useState(false)
  const settingsButton = useRef<HTMLButtonElement>(null)
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  if (!compendium.data) {
    return failed(compendium) ? (
      <LoadError error={compendium.error} onRetry={() => compendium.refetch()} />
    ) : (
      <Loading />
    )
  }
  const { system, types, sources, sections, language, editable, world } = compendium.data
  if (!system) {
    return (
      <section className={styles.empty}>
        <PageTitle>{t('compendium.title')}</PageTitle>
        <p>{t('compendium.noSystem')}</p>
      </section>
    )
  }
  const typeOf = (key: string) => types.find((each) => each.key === key)
  const editions = [...new Set(sources.map((s) => s.edition).filter((e): e is string => e !== null))]
  const systemTarget: EntryTarget | null =
    editable && editable.types.length > 0
      ? { layer: 'system', systemId: editable.systemId, version: editable.version, types: editable.types }
      : null
  const worldTarget: EntryTarget | null =
    world?.writable && world.types.length > 0
      ? { layer: 'world', worldId: world.worldId, systemId: world.systemId, types: world.types }
      : null
  // Lo nuevo va al mundo; al sistema, si se elige y se puede
  const newTargets = [worldTarget, systemTarget].filter((each): each is EntryTarget => each !== null)

  return (
    <SystemIdContext.Provider value={system.id}>
      <div className={styles.page} data-reading={narrow && shown ? '' : undefined}>
        {/* El título, en el sitio de todas las pantallas (components/screen.tsx) */}
        <div className={styles.top}>
          <PageTitle>{t('compendium.title')}</PageTitle>
        </div>
        <aside className={styles.side} aria-label={t('compendium.title')}>
          <div className={styles.sideHead}>
            <span className={styles.system}>
              {editions.length > 0
                ? t('compendium.systemWith', { system: system.name, editions: editions.join(t('compendium.and')) })
                : system.name}
              {master && (
                <button
                  ref={settingsButton}
                  type="button"
                  className={styles.settings}
                  aria-label={t('compendium.settings.title')}
                  title={t('compendium.settings.title')}
                  onClick={() => setSettings(true)}
                >
                  <Settings size={14} aria-hidden="true" />
                </button>
              )}
            </span>
            {newTargets.length > 0 && (
              <button type="button" className={styles.newEntry} onClick={() => setCreating(true)}>
                <Plus size={16} aria-hidden="true" />
                {t('compendium.newEntry')}
              </button>
            )}
          </div>
          {types.length === 0 && <p className={styles.none}>{t('compendium.emptySystem')}</p>}
          <div className={styles.search} data-tour="compendio-buscar">
            <Search size={16} aria-hidden="true" />
            <label htmlFor={searchId} className={styles.hidden}>
              {t('compendium.search')}
            </label>
            <input
              id={searchId}
              type="search"
              placeholder={t('compendium.searchHint')}
              value={query}
              autoComplete="off"
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
            {query && (
              <button
                type="button"
                className={styles.clear}
                aria-label={t('compendium.clear')}
                onClick={() => setQuery('')}
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          {world && (
            <fieldset className={styles.layers}>
              <legend className={styles.hidden}>{t('compendium.layers')}</legend>
              {LAYERS.map((each) => (
                <label key={each} className={styles.layer}>
                  <input
                    type="radio"
                    name="capa"
                    value={each}
                    checked={layer === each}
                    onChange={() => setLayer(each)}
                  />
                  <span>{t(`compendium.layer.${each}`)}</span>
                </label>
              ))}
            </fieldset>
          )}
          {wanted ? (
            <>
              <ul className={styles.list} aria-label={t('compendium.results')} aria-busy={hits.isFetching}>
                {items.map((hit) => (
                  <HitRow
                    key={hit.key}
                    hit={hit}
                    typeLabel={typeOf(hit.type)?.label ?? hit.type}
                    current={hit.key === shown}
                    onOpen={() => open(hit.key)}
                  />
                ))}
                {hits.data && items.length === 0 && <li className={styles.none}>{t('compendium.none')}</li>}
              </ul>
              {hits.isError && <LoadError error={hits.error} onRetry={() => void hits.refetch()} />}
              {hits.hasNextPage && (
                <BusyButton
                  className={styles.more}
                  busy={hits.isFetchingNextPage}
                  onClick={() => void hits.fetchNextPage()}
                >
                  {hits.isFetchingNextPage ? t('compendium.loadingMore') : t('compendium.more')}
                </BusyButton>
              )}
            </>
          ) : (
            <Library
              campaignId={campaignId}
              sections={sections}
              types={types}
              layer={layer}
              byWorld={world?.byType ?? {}}
              current={shown}
              onOpen={open}
            />
          )}
        </aside>
        {shown ? (
          <Entry
            key={shown}
            campaignId={campaignId}
            entryKey={shown}
            types={types}
            sources={sources}
            language={language}
            systemTarget={systemTarget}
            worldTarget={worldTarget}
            world={world}
            startEditing={editing === shown}
            onEdited={() => setEditing(null)}
            onCopied={(key) => {
              setEditing(key)
              open(key)
            }}
            onOpen={open}
            onBack={narrow ? back : undefined}
            onGone={back}
          />
        ) : (
          !narrow && (
            <div className={styles.reading}>
              <p className={styles.pick}>{t('compendium.pick')}</p>
            </div>
          )
        )}
        {settings && (
          <CompendiumSettings
            campaignId={campaignId}
            compendium={compendium.data}
            onClose={() => {
              setSettings(false)
              settingsButton.current?.focus()
            }}
          />
        )}
        {creating && newTargets.length > 0 && (
          <EntryEditor
            campaignId={campaignId}
            targets={newTargets}
            language={language}
            item={null}
            onSaved={open}
            onClose={() => setCreating(false)}
          />
        )}
        <Tour
          id="compendio"
          steps={[
            { target: '[data-tour="compendio-buscar"]', text: t('tour.compendium.search') },
            { target: '[data-tour="compendio-estantes"]', text: t('tour.compendium.types') }
          ]}
        />
      </div>
    </SystemIdContext.Provider>
  )
}

type Section = ActionOutput<'getCampaignCompendium'>['sections'][number]
/** Lo filtrado de cada tipo, y cómo cambiarlo */
interface Filtering {
  chosen: Record<string, Record<string, string>>
  choose: (type: string, field: string, value: string) => void
  clear: (type: string) => void
}
type Browsed = ActionOutput<'browseCampaignContent'>

/**
 * El compendio como una biblioteca, igual que el de Foundry: por edición (si hay más de una), sus secciones (Reglas,
 * Clases, Conjuros…), en cada una sus tipos y, en cada tipo, sus carpetas (los conjuros por nivel); dentro, lo suyo.
 * Todo se abre y se cierra; cada tipo se pide al abrirlo
 */
function Library({
  campaignId,
  sections,
  types: all,
  layer,
  byWorld,
  current,
  onOpen
}: {
  campaignId: string
  sections: Section[]
  types: CompendiumType[]
  layer: Layer
  /** Cuántas hay del mundo de cada tipo */
  byWorld: Record<string, number>
  current: string | null
  onOpen: (key: string) => void
}) {
  const { t } = useTranslation()
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set())
  // Lo filtrado de cada tipo (por su campo, el valor elegido): se queda aunque se cierre su carpeta
  const [chosen, setChosen] = useState<Record<string, Record<string, string>>>({})
  const filtering = {
    chosen,
    choose: (type: string, field: string, value: string) =>
      setChosen((was) => ({ ...was, [type]: { ...(was[type] ?? {}), [field]: value } })),
    clear: (type: string) => setChosen(({ [type]: _, ...rest }) => rest)
  }
  const toggle = (id: string) =>
    setOpened((was) => {
      const next = new Set(was)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  // Lo del mundo va sin edición: se cuenta aparte, en su estante, y no en «Sin edición»
  const types = all.map((type) => {
    const own = byWorld[type.key] ?? 0
    if (own === 0) return type
    const loose = (type.editions[''] ?? 0) - own
    const { '': _, ...rest } = type.editions
    return { ...type, count: type.count - own, editions: loose > 0 ? { ...rest, '': loose } : rest }
  })
  const editions = [...new Set(types.flatMap((type) => Object.keys(type.editions)))].sort((a, b) => b.localeCompare(a))
  const byEdition = editions.length > 1
  const newest = editions[0] ?? ''
  const worldCount = Object.values(byWorld).reduce((n, c) => n + c, 0)
  const countOf = (typeKey: string, edition: string | null, only: 'system' | 'world') => {
    if (only === 'world') return byWorld[typeKey] ?? 0
    const type = types.find((each) => each.key === typeKey)
    return edition === null ? (type?.count ?? 0) : (type?.editions[edition] ?? 0)
  }
  const shelves = (edition: string | null, prefix: string, only: 'system' | 'world' = 'system') => (
    <ul className={styles.shelf}>
      {sections.map((section) => {
        const count = section.types.reduce((n, type) => n + countOf(type.key, edition, only), 0)
        if (count === 0) return null
        const id = `${prefix}${section.key}`
        return (
          <li key={section.key}>
            <Disclosure label={section.label} count={count} open={opened.has(id)} onToggle={() => toggle(id)}>
              {section.types.length === 1 && section.types[0] ? (
                <TypeShelf
                  campaignId={campaignId}
                  type={section.types[0].key}
                  edition={edition}
                  only={only}
                  idPrefix={`${id}/`}
                  opened={opened}
                  onToggle={toggle}
                  current={current}
                  onOpen={onOpen}
                  filtering={filtering}
                />
              ) : (
                <ul className={styles.shelf}>
                  {section.types.map((type) => {
                    const typeCount = countOf(type.key, edition, only)
                    if (typeCount === 0) return null
                    const typeId = `${id}/${type.key}`
                    return (
                      <li key={type.key}>
                        <Disclosure
                          label={type.label}
                          count={typeCount}
                          open={opened.has(typeId)}
                          onToggle={() => toggle(typeId)}
                        >
                          <TypeShelf
                            campaignId={campaignId}
                            type={type.key}
                            edition={edition}
                            only={only}
                            idPrefix={`${typeId}/`}
                            opened={opened}
                            onToggle={toggle}
                            current={current}
                            onOpen={onOpen}
                            filtering={filtering}
                          />
                        </Disclosure>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Disclosure>
          </li>
        )
      })}
    </ul>
  )
  if (layer === 'world')
    return (
      <nav className={styles.library} aria-label={t('compendium.library')} data-tour="compendio-estantes">
        {worldCount === 0 ? <p className={styles.none}>{t('compendium.noWorld')}</p> : shelves(null, 'w:', 'world')}
      </nav>
    )
  return (
    <nav className={styles.library} aria-label={t('compendium.library')} data-tour="compendio-estantes">
      {layer === 'all' && worldCount > 0 && (
        <ul className={styles.shelf}>
          <li>
            <Disclosure
              label={t('compendium.layer.world')}
              count={worldCount}
              open={opened.has('w:')}
              onToggle={() => toggle('w:')}
              edition
            >
              {shelves(null, 'w:/', 'world')}
            </Disclosure>
          </li>
        </ul>
      )}
      {byEdition ? (
        <ul className={styles.shelf}>
          {editions.map((edition) => {
            const id = `e:${edition}`
            const label = edition
              ? edition === newest
                ? edition
                : t('compendium.legacy', { edition })
              : t('compendium.noEdition')
            const count = types.reduce((n, type) => n + (type.editions[edition] ?? 0), 0)
            return (
              <li key={edition}>
                <Disclosure label={label} count={count} open={opened.has(id)} onToggle={() => toggle(id)} edition>
                  {shelves(edition, `${id}/`)}
                </Disclosure>
              </li>
            )
          })}
        </ul>
      ) : (
        shelves(null, '')
      )}
    </nav>
  )
}

/** Una carpeta que se abre y se cierra, con su nombre y cuántos lleva */
function Disclosure({
  label,
  count,
  open,
  onToggle,
  edition = false,
  children
}: {
  label: string
  count: number
  open: boolean
  onToggle: () => void
  edition?: boolean
  children: ReactNode
}) {
  return (
    <>
      <button
        type="button"
        className={edition ? `${styles.folder} ${styles.editionFolder}` : styles.folder}
        aria-expanded={open}
        onClick={onToggle}
      >
        <ChevronRight size={14} aria-hidden="true" className={styles.chevron} />
        <span className={styles.folderName}>{label}</span>
        <span className={styles.folderCount}>{count}</span>
      </button>
      {open && children}
    </>
  )
}

/** Lo de un tipo: se pide al abrirlo (una vez para todas las ediciones) y se reparte en sus carpetas */
function TypeShelf({
  campaignId,
  type,
  edition,
  only,
  idPrefix,
  opened,
  onToggle,
  current,
  onOpen,
  filtering
}: {
  campaignId: string
  type: string
  edition: string | null
  /** Solo lo del sistema o solo lo del mundo */
  only: 'system' | 'world'
  idPrefix: string
  opened: ReadonlySet<string>
  onToggle: (id: string) => void
  current: string | null
  onOpen: (key: string) => void
  filtering: Filtering
}) {
  const { t } = useTranslation()
  const api = useApi()
  const filtersId = useId()
  const systemId = useContext(SystemIdContext)
  const browsed = useQuery({
    queryKey: ['compendium', campaignId, 'browse', type],
    queryFn: () => api.call('browseCampaignContent', { campaignId, type })
  })
  if (!browsed.data)
    return failed(browsed) ? (
      <LoadError error={browsed.error} onRetry={() => void browsed.refetch()} />
    ) : (
      <p className={styles.none}>{t('compendium.loadingMore')}</p>
    )
  const inEdition = (item: Browsed['items'][number]) => edition === null || (item.edition ?? '') === edition
  const wanted = Object.entries(filtering.chosen[type] ?? {}).filter(([, value]) => value)
  const fits = (item: Browsed['items'][number]) => wanted.every(([field, value]) => item.values[field]?.includes(value))
  const items = browsed.data.items.filter(
    (item) => inLayer(only, item.world) && (only === 'world' || inEdition(item)) && fits(item)
  )
  const filters = browsed.data.filters.filter((f) => f.options.length > 1)
  const filtersOpen = opened.has(`${idPrefix}filtros`)
  const loose = items.filter((item) => item.folder === null)
  const entry = (item: Browsed['items'][number]) => (
    <li key={item.key}>
      <button
        type="button"
        className={styles.entry}
        data-entry={item.key}
        aria-current={item.key === current ? 'true' : undefined}
        onClick={() => onOpen(item.key)}
      >
        {item.img && <SystemImage systemId={systemId} path={item.img} className={styles.thumb} />}
        <span className={styles.entryName}>{item.name}</span>
        {edition === null && only === 'system' && <EditionTag edition={item.edition} legacy={item.legacy} />}
      </button>
    </li>
  )
  return (
    <ul className={styles.shelf}>
      {filters.length > 0 && (
        <li className={styles.filtering}>
          <button
            type="button"
            className={styles.filterToggle}
            aria-expanded={filtersOpen}
            aria-controls={filtersId}
            onClick={() => onToggle(`${idPrefix}filtros`)}
          >
            <SlidersHorizontal size={14} aria-hidden="true" />
            {wanted.length > 0 ? t('compendium.filtering', { count: wanted.length }) : t('compendium.filter')}
          </button>
          {wanted.length > 0 && (
            <button type="button" className={styles.clearFilters} onClick={() => filtering.clear(type)}>
              {t('compendium.clearFilters')}
            </button>
          )}
          {filtersOpen && (
            <div id={filtersId} className={styles.filters}>
              {filters.map((filter) => (
                <label key={filter.key} className={styles.filter}>
                  <span>{filter.label}</span>
                  <select
                    value={filtering.chosen[type]?.[filter.key] ?? ''}
                    onChange={(event) => filtering.choose(type, filter.key, event.currentTarget.value)}
                  >
                    <option value="">{t('compendium.any')}</option>
                    {filter.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
        </li>
      )}
      {items.length === 0 && wanted.length > 0 && <li className={styles.none}>{t('compendium.noMatch')}</li>}
      {browsed.data.folders.map((folder) => {
        const inside = items.filter((item) => item.folder === folder.key)
        if (inside.length === 0) return null
        const id = `${idPrefix}${folder.key}`
        return (
          <li key={folder.key}>
            <Disclosure label={folder.label} count={inside.length} open={opened.has(id)} onToggle={() => onToggle(id)}>
              <ul className={styles.shelf}>{inside.map(entry)}</ul>
            </Disclosure>
          </li>
        )
      })}
      {loose.map(entry)}
    </ul>
  )
}

function HitRow({
  hit,
  typeLabel,
  current,
  onOpen
}: {
  hit: ContentHit
  typeLabel: string
  current: boolean
  onOpen: () => void
}) {
  return (
    <li>
      <button type="button" className={styles.hit} aria-current={current ? 'true' : undefined} onClick={onOpen}>
        <span className={styles.hitText}>
          <span className={styles.hitName}>{hit.name}</span>
          <span className={styles.hitType}>{typeLabel}</span>
        </span>
        {hit.world ? <WorldTag /> : <EditionTag edition={hit.edition} legacy={hit.legacy} />}
      </button>
    </li>
  )
}

/** Un documento del compendio: su cabecera, sus datos, su texto, lo que concede por nivel y, al lado, su edición */
function Entry({
  campaignId,
  entryKey,
  types,
  sources,
  language,
  systemTarget,
  worldTarget,
  world,
  startEditing,
  onEdited,
  onCopied,
  onOpen,
  onBack,
  onGone
}: {
  campaignId: string
  entryKey: string
  types: CompendiumType[]
  sources: { key: string; name: string; edition: string | null; attribution: string }[]
  language: Language
  /** Dónde se puede escribir: el sistema (su propietario) y el mundo (quien lo lleva) */
  systemTarget: EntryTarget | null
  worldTarget: EntryTarget | null
  world: World | null
  /** Abrirla para cambiarla (lo recién copiado al mundo) */
  startEditing: boolean
  onEdited: () => void
  onCopied: (key: string) => void
  onOpen: (key: string) => void
  onBack: (() => void) | undefined
  /** Al borrarla: de vuelta a la lista */
  onGone: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const titleId = useId()
  const errorText = useErrorText()
  const announce = useAnnounce()
  // Sus tablas de tirar se tiran en la campaña, para quien elijan los dados (si vale en ella)
  const dice = useDice()
  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.call('getCampaign', { campaignId })
  })
  const visibility = visibilitiesFor(campaign.data?.campaign.role ?? 'player').includes(dice.visibility)
    ? dice.visibility
    : 'all'
  const rolling = useMutation({
    mutationFn: (table: number) => api.call('rollContentTable', { campaignId, key: entryKey, table, visibility }),
    onSuccess: (out) =>
      announce(t('compendium.rolledTable', { total: out.roll.total, text: out.roll.table?.results[0]?.text ?? '' }))
  })
  const roll = (table: number) =>
    rolling
      .mutateAsync(table)
      .then((out) => out.row)
      .catch(() => null)
  const read = useQuery({
    queryKey: ['compendium', campaignId, 'entry', entryKey],
    queryFn: () => api.call('getCampaignContent', { campaignId, keys: [entryKey] })
  })
  const item = read.data?.items[0]
  const [changing, setChanging] = useState<'edit' | 'delete' | 'toSystem' | null>(startEditing ? 'edit' : null)
  const client = useQueryClient()
  const copy = useMutation({
    mutationFn: () => {
      if (!world) throw new Error('sin mundo')
      return api.call('copyContent', { worldId: world.worldId, systemId: world.systemId, key: entryKey, to: 'world' })
    },
    onSuccess: async (out) => {
      await client.invalidateQueries({ queryKey: ['compendium', campaignId] })
      onCopied(out.key)
    }
  })
  // Al abrir otro, arriba; en lo estrecho (con «Volver a la lista»), el foco va a su título
  const narrow = Boolean(onBack)
  const systemId = useContext(SystemIdContext)
  useEffect(() => {
    if (!item) return
    const title = document.getElementById(titleId)
    title?.scrollIntoView?.({ block: 'nearest' })
    if (narrow) title?.focus()
  }, [item, titleId, narrow])
  if (!read.data) {
    return (
      <div className={styles.reading}>
        {failed(read) ? <LoadError error={read.error} onRetry={() => read.refetch()} /> : <Loading />}
      </div>
    )
  }
  // Una entrada que ya no está (o que no ve la campaña): se dice, en vez de una ficha en blanco
  if (!item)
    return (
      <div className={styles.reading}>
        <p className={styles.pick}>{t('compendium.missing')}</p>
      </div>
    )
  const type = types.find((each) => each.key === item.type)
  const name = textOf(item.data.name as Text, language) || item.key
  const english = language === 'es' ? textOf(item.data.name as Text, 'en') : ''
  const source = sources.find((s) => s.key === item.source)
  const fields = (type?.fields ?? []).flatMap((field) => {
    const text = valueText(field, item.data[field.key], language, t('compendium.yes'))
    return text === null ? [] : [{ field, text }]
  })
  const body = type?.text ? textOf(item.data[type.text] as Text, language) : ''
  const fromWorld = item.world ? { ...item, world: item.world } : null
  const target = fromWorld ? worldTarget : systemTarget
  const where = world ? { worldId: world.worldId, systemId: world.systemId } : null
  return (
    <>
      <article className={styles.reading} aria-labelledby={titleId}>
        {onBack && (
          <button type="button" className={styles.back} onClick={onBack}>
            <ArrowLeft size={16} aria-hidden="true" />
            {t('compendium.back')}
          </button>
        )}
        <header className={item.img ? `${styles.head} ${styles.withPortrait}` : styles.head}>
          {item.img && <SystemImage systemId={systemId} path={item.img} className={styles.portrait} />}
          <p className={styles.kind}>{type?.label ?? item.type}</p>
          <h2 id={titleId} className={styles.name} tabIndex={-1}>
            {name}
          </h2>
          {fromWorld ? <WorldTag /> : <EditionTag edition={item.edition} legacy={item.legacy} />}
          {(target || (!fromWorld && worldTarget) || (fromWorld && systemTarget)) && (
            <div className={styles.entryActions}>
              {!fromWorld && worldTarget && (
                <BusyButton className={styles.entryAction} busy={copy.isPending} onClick={() => copy.mutate()}>
                  <Copy size={14} aria-hidden="true" />
                  {t('compendium.copyToWorld')}
                </BusyButton>
              )}
              {target && (
                <>
                  <button type="button" className={styles.entryAction} onClick={() => setChanging('edit')}>
                    <Pencil size={14} aria-hidden="true" />
                    {t('compendium.edit')}
                  </button>
                  <button type="button" className={styles.entryAction} onClick={() => setChanging('delete')}>
                    <Trash2 size={14} aria-hidden="true" />
                    {t('compendium.delete')}
                  </button>
                </>
              )}
              {fromWorld && systemTarget && (
                <button type="button" className={styles.entryAction} onClick={() => setChanging('toSystem')}>
                  <Upload size={14} aria-hidden="true" />
                  {t('compendium.toSystem')}
                </button>
              )}
            </div>
          )}
        </header>
        <FormError message={copy.error ? errorText(copy.error) : null} />
        {fromWorld && where && (
          <OriginNotice
            campaignId={campaignId}
            where={where}
            item={fromWorld}
            language={language}
            writable={Boolean(worldTarget)}
          />
        )}
        {fields.length > 0 && (
          <dl className={styles.fields}>
            {fields.map(({ field, text }) => (
              <div key={field.key}>
                <dt>{field.label}</dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
        )}
        {item.play && <InPlay play={item.play} titleId={titleId} />}
        <FormError message={rolling.error ? errorText(rolling.error) : null} />
        {body && <ContentText text={body} onRoll={roll} />}
        {item.table && (
          <EntryTable
            campaignId={campaignId}
            entryKey={item.key}
            name={name}
            table={item.table}
            drawn={item.drawn ?? []}
            master={campaign.data?.campaign.role === 'master'}
            visibility={visibility}
            onOpen={onOpen}
          />
        )}
        {item.granted.length > 0 && (
          <section className={styles.granted} aria-labelledby={`${titleId}-granted`}>
            <h3 id={`${titleId}-granted`}>{t('compendium.byLevel')}</h3>
            <ul>
              {item.granted.map((g) => (
                <li key={'key' in g ? `${g.level}-${g.key}` : `${g.level}-${g.choose}`}>
                  <span className={styles.level}>
                    {g.level ? t('compendium.level', { level: g.level }) : t('compendium.start')}
                  </span>
                  {'key' in g ? (
                    <button type="button" className={styles.link} onClick={() => onOpen(g.key)}>
                      {g.name}
                    </button>
                  ) : (
                    <span>{t('compendium.choose', { what: g.choose, count: Number(g.count) || 1 })}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
      <aside className={styles.about} aria-label={t('compendium.about')}>
        <dl className={styles.aboutList}>
          {fromWorld && (
            <div>
              <dt>{t('compendium.origin')}</dt>
              <dd>
                <span className={styles.worldLine}>
                  <Globe size={14} aria-hidden="true" />
                  {t('compendium.worldCompendium')}
                </span>
                {fromWorld.world.origin && (
                  <span className={styles.copyOf}>
                    {t('compendium.copyOf', { name: fromWorld.world.origin.name ?? fromWorld.world.origin.key })}
                  </span>
                )}
              </dd>
            </div>
          )}
          {item.image?.credit && (
            <div>
              <dt>{t('compendium.imageCredit')}</dt>
              <dd>{item.image.credit}</dd>
            </div>
          )}
          {item.edition && (
            <div>
              <dt>{t('compendium.edition')}</dt>
              <dd>{source ? `${item.edition} · ${source.name}` : item.edition}</dd>
            </div>
          )}
          {english && english !== name && (
            <div>
              <dt>{t('compendium.english')}</dt>
              <dd lang="en">{english}</dd>
            </div>
          )}
          {item.versions.length > 0 && (
            <div>
              <dt>{t('compendium.alsoIn')}</dt>
              <dd>
                {item.versions.map((v) => (
                  <button key={v.key} type="button" className={styles.link} onClick={() => onOpen(v.key)}>
                    {v.legacy
                      ? t('compendium.legacy', { edition: v.edition ?? '' })
                      : (v.edition ?? t('compendium.otherVersion'))}
                  </button>
                ))}
              </dd>
            </div>
          )}
        </dl>
        {source && <p className={styles.attribution}>{source.attribution}</p>}
        {/* Una criatura (un actor): el máster la pone en juego desde aquí */}
        {type?.document === 'actor' && campaign.data?.campaign.role === 'master' && (
          <PutInPlay worldId={campaign.data.campaign.worldId} campaignId={campaignId} entryKey={item.key} />
        )}
      </aside>
      {changing === 'edit' && target && (
        <EntryEditor
          campaignId={campaignId}
          targets={[target]}
          language={language}
          item={item}
          onSaved={() => undefined}
          onClose={() => {
            setChanging(null)
            onEdited()
          }}
        />
      )}
      {changing === 'delete' && target && (
        <DeleteEntry
          campaignId={campaignId}
          target={target}
          item={item}
          name={name}
          onDeleted={onGone}
          onClose={() => setChanging(null)}
        />
      )}
      {changing === 'toSystem' && fromWorld && where && systemTarget?.layer === 'system' && (
        <ToSystem
          campaignId={campaignId}
          where={where}
          version={systemTarget.version}
          item={item}
          name={name}
          onMoved={(removed) => {
            if (removed) onGone()
          }}
          onClose={() => setChanging(null)}
        />
      )}
    </>
  )
}

type PlayText = NonNullable<ActionOutput<'getCampaignContent'>['items'][number]['play']>

/** Su mecánica, en palabras: sus acciones, sus usos, lo que cambia, cómo escala y cuánto lo calcula Crisol */
function InPlay({ play, titleId }: { play: PlayText; titleId: string }) {
  const { t } = useTranslation()
  const rows = [
    ...play.actions.map((a) => ({ key: `a-${a.label}`, label: a.label, text: a.parts.join(' · ') })),
    ...play.resources.map((r) => ({ key: `r-${r.label}`, label: r.label, text: r.parts.join(' · ') }))
  ]
  const lines = [...play.effects, ...(play.scaling ? [play.scaling] : []), ...(play.toggle ? [play.toggle] : [])]
  if (rows.length === 0 && lines.length === 0 && !play.manual && !play.automation) return null
  return (
    <section className={styles.play} aria-labelledby={`${titleId}-play`}>
      <div className={styles.playHead}>
        <h3 id={`${titleId}-play`}>{t('compendium.inPlay')}</h3>
        {play.automation && (
          <span className={styles.automation} data-level={play.automation}>
            {t(`compendium.automation.${play.automation}`)}
          </span>
        )}
      </div>
      {rows.length > 0 && (
        <dl className={styles.playRows}>
          {rows.map((row) => (
            <div key={row.key}>
              <dt>{row.label}</dt>
              <dd>{row.text}</dd>
            </div>
          ))}
        </dl>
      )}
      {lines.length > 0 && (
        <ul className={styles.playLines}>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {play.manual && <p className={styles.manual}>{play.manual}</p>}
    </section>
  )
}
