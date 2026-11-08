/**
 * Buscar en la wiki: lo buscado, la etiqueta y la rama van en la dirección (se puede volver y compartir). Los
 * resultados van por página, con sus secciones y su extracto; lo de un secreto, marcado
 */
import type { SearchResult } from '@crisol/contracts'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { type FormEvent, Fragment, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import form from '../components/form.module.css'
import list from '../components/list.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import styles from './search.module.css'
import { WikiLayout } from './wiki.tsx'

const route = getRouteApi('/mundos/$worldId/buscar')

export interface SearchParams {
  q?: string
  etiqueta?: string
  rama?: string
  pagina?: number
}

/** Lo que se acepta en la dirección (lo demás se ignora) */
export function searchParams(search: Record<string, unknown>): SearchParams {
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : undefined)
  const page = Number(search.pagina)
  return {
    ...(text(search.q) ? { q: text(search.q) } : {}),
    ...(text(search.etiqueta) ? { etiqueta: text(search.etiqueta) } : {}),
    ...(text(search.rama) ? { rama: text(search.rama) } : {}),
    ...(Number.isInteger(page) && page > 1 ? { pagina: Math.min(page, 500) } : {})
  }
}

export function WikiSearch() {
  const { worldId } = route.useParams()
  return <WikiLayout worldId={worldId}>{(world) => <SearchPage worldId={worldId} world={world.name} />}</WikiLayout>
}

function SearchPage({ worldId, world }: { worldId: string; world: string }) {
  const { t } = useTranslation()
  const api = useApi()
  const params = route.useSearch()
  const navigate = useNavigate()
  const queryId = useId()
  const tagId = useId()
  const query = params.q ?? ''
  const page = params.pagina ?? 1
  const tags = useQuery({ queryKey: ['pages', worldId, 'tags'], queryFn: () => api.call('listTags', { worldId }) })
  const names = useQuery({
    queryKey: ['pages', worldId, 'names'],
    queryFn: () => api.call('listPageNames', { worldId }),
    enabled: Boolean(params.rama)
  })
  const branch = params.rama ? names.data?.pages.find((p) => p.id === params.rama) : undefined
  const results = useQuery({
    queryKey: ['pages', worldId, 'search', query, params.etiqueta ?? '', params.rama ?? '', page],
    queryFn: () =>
      api.call('searchWiki', {
        worldId,
        query,
        page,
        ...(params.etiqueta ? { tag: params.etiqueta } : {}),
        ...(params.rama ? { branchId: params.rama } : {})
      }),
    enabled: query !== '',
    placeholderData: keepPreviousData
  })
  const go = (next: SearchParams) =>
    navigate({ to: '/mundos/$worldId/buscar', params: { worldId }, search: searchParams({ ...params, ...next }) })
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    go({ q: String(data.get('q') ?? ''), etiqueta: String(data.get('etiqueta') ?? ''), pagina: 1 })
  }
  const total = results.data?.total ?? 0
  const pages = Math.ceil(total / (results.data?.pageSize ?? 20))
  return (
    <section>
      <PageTitle>{t('search.worldTitle', { world })}</PageTitle>
      <search>
        <form className={styles.form} onSubmit={submit}>
          <div className={form.field}>
            <label htmlFor={queryId}>{t('search.label')}</label>
            <input id={queryId} type="search" name="q" defaultValue={query} key={query} maxLength={200} />
          </div>
          <div className={form.field}>
            <label htmlFor={tagId}>{t('search.tag')}</label>
            <select id={tagId} name="etiqueta" defaultValue={params.etiqueta ?? ''} key={params.etiqueta ?? ''}>
              <option value="">{t('search.anyTag')}</option>
              {tags.data?.tags.map(({ tag, depth }) => (
                <option key={tag} value={tag}>
                  {`${'  '.repeat(depth)}${tag}`}
                </option>
              ))}
            </select>
          </div>
          <BusyButton type="submit" className={form.button} busy={results.isFetching}>
            {t('search.submit')}
          </BusyButton>
        </form>
      </search>
      {params.rama && (
        <p className={styles.branch}>
          {t('search.inBranch', { title: branch?.title ?? '…' })}{' '}
          <button type="button" className={list.secondary} onClick={() => go({ rama: '', pagina: 1 })}>
            {t('search.wholeWiki')}
          </button>
        </p>
      )}
      {failed(results) && <LoadError error={results.error} onRetry={() => results.refetch()} />}
      <p role="status" className={styles.count}>
        {/* Mientras llega lo nuevo, lo de antes sigue a la vista pero no se anuncia */}
        {query && results.data && !results.isPlaceholderData ? t('search.count', { count: total, query }) : ''}
      </p>
      {results.data && results.data.results.length > 0 && (
        <ol className={styles.results} aria-label={t('search.results')}>
          {results.data.results.map((result) => (
            <ResultItem key={result.id} worldId={worldId} result={result} />
          ))}
        </ol>
      )}
      {pages > 1 && (
        <nav aria-label={t('search.pages')} className={styles.pager}>
          {page > 1 && (
            <Link to="/mundos/$worldId/buscar" params={{ worldId }} search={{ ...params, pagina: page - 1 }}>
              {t('search.previous')}
            </Link>
          )}
          <span>{t('search.pageOf', { page, pages })}</span>
          {page < pages && (
            <Link to="/mundos/$worldId/buscar" params={{ worldId }} search={{ ...params, pagina: page + 1 }}>
              {t('search.next')}
            </Link>
          )}
        </nav>
      )}
    </section>
  )
}

/** El extracto con lo encontrado resaltado (viene entre ** del servidor) */
function Excerpt({ text }: { text: string }) {
  return (
    <>
      {/* Cada bloque (una casilla, un elemento de lista) va en su línea: aquí, separados con « · » */}
      {text
        .replace(/\s*\n+\s*/g, ' · ')
        .split('**')
        .map((part, i) =>
          // Las partes impares son lo encontrado
          i % 2 === 1 ? <mark key={String(i)}>{part}</mark> : <Fragment key={String(i)}>{part}</Fragment>
        )}
    </>
  )
}

function ResultItem({ worldId, result }: { worldId: string; result: SearchResult }) {
  const { t } = useTranslation()
  const above = result.path.slice(0, -1)
  return (
    <li className={styles.result}>
      <Link to="/mundos/$worldId/wiki/$pageId" params={{ worldId, pageId: result.id }} className={styles.title}>
        {result.icon ? `${result.icon} ` : ''}
        {result.title}
      </Link>
      {above.length > 0 && <p className={styles.path}>{above.map((step) => step.title).join(' / ')}</p>}
      {result.sections.length > 0 && (
        <ul className={styles.sections}>
          {result.sections.map((section, i) => (
            <li key={String(i)}>
              {(section.heading || section.secret) && (
                <p className={styles.heading}>
                  {section.secret && <span className={styles.secret}>{t('search.secret')}</span>}
                  {section.heading}
                </p>
              )}
              <p className={styles.excerpt}>
                <Excerpt text={section.excerpt} />
              </p>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
