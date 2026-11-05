/**
 * El compendio de una campaña (docs/specs/personajes.md § campana): el contenido de su sistema, con las fuentes que
 * eligió. A la izquierda, el buscador (en sus dos idiomas, sin tildes), los tipos y la lista; en el centro, lo
 * elegido; a la derecha, su edición, su nombre en inglés, su otra versión y la atribución de su fuente
 */
import { type Text, textOf } from '@crisol/systems'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { getRouteApi, Navigate } from '@tanstack/react-router'
import { ArrowLeft, Search, X } from 'lucide-react'
import { useDeferredValue, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import type { ActionOutput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { Loading } from '../components/brand.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
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
  const [type, setType] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const wanted = useDeferredValue(query.trim())
  const hits = useInfiniteQuery({
    queryKey: ['compendium', campaignId, 'search', wanted, type],
    queryFn: ({ pageParam }) =>
      api.call('searchCampaignContent', {
        campaignId,
        ...(wanted ? { query: wanted } : {}),
        ...(type ? { type } : {}),
        limit: PAGE,
        offset: pageParam
      }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const seen = pages.reduce((n, p) => n + p.items.length, 0)
      return seen < last.total ? seen : undefined
    },
    enabled: Boolean(compendium.data?.system)
  })
  const items = hits.data?.pages.flatMap((p) => p.items) ?? []
  // En lo ancho, sin nada elegido, el primero de la lista
  const shown = selected ?? (narrow ? null : (items[0]?.key ?? null))

  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  if (!compendium.data) {
    return failed(compendium) ? (
      <LoadError error={compendium.error} onRetry={() => compendium.refetch()} />
    ) : (
      <Loading />
    )
  }
  const { system, types, sources, language } = compendium.data
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
        <div className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <label htmlFor={searchId} className={styles.hidden}>
            {t('compendium.search')}
          </label>
          <input
            id={searchId}
            type="search"
            placeholder={t('compendium.search')}
            value={query}
            autoComplete="off"
            onChange={(event) => {
              setQuery(event.currentTarget.value)
              setSelected(null)
            }}
          />
          {query && (
            <button
              type="button"
              className={styles.clear}
              aria-label={t('compendium.clear')}
              onClick={() => {
                setQuery('')
                setSelected(null)
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <fieldset className={styles.types}>
          <legend className={styles.hidden}>{t('compendium.types')}</legend>
          {[null, ...types.map((each) => each.key)].map((key) => (
            <button
              key={key ?? 'todo'}
              type="button"
              className={styles.type}
              aria-pressed={type === key}
              onClick={() => {
                setType(key)
                setSelected(null)
              }}
            >
              {key ? (typeOf(key)?.label ?? key) : t('compendium.all')}
            </button>
          ))}
        </fieldset>
        <ul className={styles.list} aria-label={t('compendium.results')} aria-busy={hits.isFetching}>
          {items.map((hit) => (
            <HitRow
              key={hit.key}
              hit={hit}
              typeLabel={typeOf(hit.type)?.label ?? hit.type}
              current={hit.key === shown}
              onOpen={() => setSelected(hit.key)}
            />
          ))}
          {hits.data && items.length === 0 && <li className={styles.none}>{t('compendium.none')}</li>}
        </ul>
        {hits.hasNextPage && (
          <button
            type="button"
            className={styles.more}
            disabled={hits.isFetchingNextPage}
            onClick={() => void hits.fetchNextPage()}
          >
            {t('compendium.more')}
          </button>
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
          onOpen={setSelected}
          onBack={narrow ? () => setSelected(null) : undefined}
        />
      ) : (
        !narrow && <div className={styles.reading} />
      )}
    </div>
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
  // Al abrir otro, arriba
  useEffect(() => {
    if (item) document.getElementById(titleId)?.scrollIntoView?.({ block: 'nearest' })
  }, [item, titleId])
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
          <h2 id={titleId} className={styles.name}>
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
                    {v.legacy ? t('compendium.legacy', { edition: v.edition ?? '' }) : v.edition}
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
