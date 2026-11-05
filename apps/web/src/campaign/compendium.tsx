/**
 * El compendio de una campaña (docs/specs/personajes.md § campana): el contenido de su sistema, con las fuentes que
 * eligió. A la izquierda, el buscador (en sus dos idiomas, sin tildes), los tipos y la lista; en el centro, lo
 * elegido; a la derecha, su edición, su nombre en inglés, su otra versión y la atribución de su fuente
 */
import { type Text, textOf } from '@crisol/systems'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { getRouteApi, Navigate } from '@tanstack/react-router'
import { ArrowLeft, ChevronRight, Search, X } from 'lucide-react'
import { type ReactNode, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import type { ActionOutput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { useSettled } from '../components/settled.ts'
import { Tour } from '../components/tour.tsx'
import { useNarrow } from '../wiki/panel.tsx'
import styles from './compendium.module.css'
import { ContentText } from './content-text.tsx'

const route = getRouteApi('/mundos/$worldId/campanas/$campaignId/compendio')
const PAGE = 100

type Language = 'es' | 'en'
type CompendiumType = ActionOutput<'getCampaignCompendium'>['types'][number]
type ContentHit = ActionOutput<'searchCampaignContent'>['items'][number]
type Field = CompendiumType['fields'][number]

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
function EditionTag({ edition, legacy }: { edition: string | null; legacy: boolean }) {
  const { t } = useTranslation()
  if (!edition) return null
  return (
    <span className={legacy ? `${styles.edition} ${styles.legacy}` : styles.edition}>
      {legacy ? t('compendium.legacy', { edition }) : edition}
    </span>
  )
}

export function CompendiumScreen() {
  const { t } = useTranslation()
  const { campaignId } = route.useParams()
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
  const hits = useInfiniteQuery({
    queryKey: ['compendium', campaignId, 'search', wanted],
    queryFn: ({ pageParam }) =>
      api.call('searchCampaignContent', { campaignId, query: wanted, limit: PAGE, offset: pageParam }),
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

  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  if (!compendium.data) {
    return failed(compendium) ? (
      <LoadError error={compendium.error} onRetry={() => compendium.refetch()} />
    ) : (
      <Loading />
    )
  }
  const { system, types, sources, sections, language } = compendium.data
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

  return (
    <div className={styles.page} data-reading={narrow && shown ? '' : undefined}>
      <aside className={styles.side} aria-label={t('compendium.title')}>
        <div className={styles.sideHead}>
          <PageTitle className={styles.title}>{t('compendium.title')}</PageTitle>
          <span className={styles.system}>
            {editions.length > 0
              ? t('compendium.systemWith', { system: system.name, editions: editions.join(t('compendium.and')) })
              : system.name}
          </span>
        </div>
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
          <Library campaignId={campaignId} sections={sections} types={types} current={shown} onOpen={open} />
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
          onOpen={open}
          onBack={narrow ? back : undefined}
        />
      ) : (
        !narrow && (
          <div className={styles.reading}>
            <p className={styles.pick}>{t('compendium.pick')}</p>
          </div>
        )
      )}
      <Tour
        id="compendio"
        steps={[
          { target: '[data-tour="compendio-buscar"]', text: t('tour.compendium.search') },
          { target: '[data-tour="compendio-estantes"]', text: t('tour.compendium.types') }
        ]}
      />
    </div>
  )
}

type Section = ActionOutput<'getCampaignCompendium'>['sections'][number]
type Browsed = ActionOutput<'browseCampaignContent'>

/**
 * El compendio como una biblioteca, igual que el de Foundry: por edición (si hay más de una), sus secciones (Reglas,
 * Clases, Conjuros…), en cada una sus tipos y, en cada tipo, sus carpetas (los conjuros por nivel); dentro, lo suyo.
 * Todo se abre y se cierra; cada tipo se pide al abrirlo
 */
function Library({
  campaignId,
  sections,
  types,
  current,
  onOpen
}: {
  campaignId: string
  sections: Section[]
  types: CompendiumType[]
  current: string | null
  onOpen: (key: string) => void
}) {
  const { t } = useTranslation()
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set())
  const toggle = (id: string) =>
    setOpened((was) => {
      const next = new Set(was)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const editions = [...new Set(types.flatMap((type) => Object.keys(type.editions)))].sort((a, b) => b.localeCompare(a))
  const byEdition = editions.length > 1
  const newest = editions[0] ?? ''
  const countOf = (typeKey: string, edition: string | null) => {
    const type = types.find((each) => each.key === typeKey)
    return edition === null ? (type?.count ?? 0) : (type?.editions[edition] ?? 0)
  }
  const shelves = (edition: string | null, prefix: string) => (
    <ul className={styles.shelf}>
      {sections.map((section) => {
        const count = section.types.reduce((n, type) => n + countOf(type.key, edition), 0)
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
                  idPrefix={`${id}/`}
                  opened={opened}
                  onToggle={toggle}
                  current={current}
                  onOpen={onOpen}
                />
              ) : (
                <ul className={styles.shelf}>
                  {section.types.map((type) => {
                    const typeCount = countOf(type.key, edition)
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
                            idPrefix={`${typeId}/`}
                            opened={opened}
                            onToggle={toggle}
                            current={current}
                            onOpen={onOpen}
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
  return (
    <nav className={styles.library} aria-label={t('compendium.library')} data-tour="compendio-estantes">
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
  idPrefix,
  opened,
  onToggle,
  current,
  onOpen
}: {
  campaignId: string
  type: string
  edition: string | null
  idPrefix: string
  opened: ReadonlySet<string>
  onToggle: (id: string) => void
  current: string | null
  onOpen: (key: string) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
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
  const items = browsed.data.items.filter(inEdition)
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
        <span className={styles.entryName}>{item.name}</span>
        {edition === null && <EditionTag edition={item.edition} legacy={item.legacy} />}
      </button>
    </li>
  )
  return (
    <ul className={styles.shelf}>
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
        <EditionTag edition={hit.edition} legacy={hit.legacy} />
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
  onOpen,
  onBack
}: {
  campaignId: string
  entryKey: string
  types: CompendiumType[]
  sources: { key: string; name: string; edition: string | null; attribution: string }[]
  language: Language
  onOpen: (key: string) => void
  onBack: (() => void) | undefined
}) {
  const { t } = useTranslation()
  const api = useApi()
  const titleId = useId()
  const read = useQuery({
    queryKey: ['compendium', campaignId, 'entry', entryKey],
    queryFn: () => api.call('getCampaignContent', { campaignId, keys: [entryKey] })
  })
  const item = read.data?.items[0]
  // Al abrir otro, arriba; en lo estrecho (con «Volver a la lista»), el foco va a su título
  const narrow = Boolean(onBack)
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
  if (!item) return <div className={styles.reading} />
  const type = types.find((each) => each.key === item.type)
  const name = textOf(item.data.name as Text, language) || item.key
  const english = language === 'es' ? textOf(item.data.name as Text, 'en') : ''
  const source = sources.find((s) => s.key === item.source)
  const fields = (type?.fields ?? []).flatMap((field) => {
    const text = valueText(field, item.data[field.key], language, t('compendium.yes'))
    return text === null ? [] : [{ field, text }]
  })
  const body = type?.text ? textOf(item.data[type.text] as Text, language) : ''
  return (
    <>
      <article className={styles.reading} aria-labelledby={titleId}>
        {onBack && (
          <button type="button" className={styles.back} onClick={onBack}>
            <ArrowLeft size={16} aria-hidden="true" />
            {t('compendium.back')}
          </button>
        )}
        <header className={styles.head}>
          <p className={styles.kind}>{type?.label ?? item.type}</p>
          <h2 id={titleId} className={styles.name} tabIndex={-1}>
            {name}
          </h2>
          <EditionTag edition={item.edition} legacy={item.legacy} />
        </header>
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
        {body && <ContentText text={body} />}
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
      </aside>
    </>
  )
}
