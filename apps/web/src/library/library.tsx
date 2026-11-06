/**
 * «Biblioteca» (docs/specs/biblioteca.md): los PDF del mundo y los comunes de la cuenta, como libros. A la izquierda,
 * buscar dentro de ellos (por libro, con sus mejores páginas) o, sin buscar, los libros con cómo va su lectura; en el
 * centro, el libro abierto en la página del resultado, con lo buscado marcado. Del máster, hasta el módulo 5
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate } from '@tanstack/react-router'
import { BookOpen, RotateCcw, Search } from 'lucide-react'
import { Fragment, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import type { ActionOutput } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { Loading } from '../components/brand.tsx'
import { FormError } from '../components/field.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { useSettled } from '../components/settled.ts'
import { Tour } from '../components/tour.tsx'
import { PdfPages } from '../wiki/pdf-viewer.tsx'
import styles from './library.module.css'

const route = getRouteApi('/mundos/$worldId/campanas/$campaignId/biblioteca')
type Book = ActionOutput<'listLibrary'>['books'][number]

/** Un fragmento con lo encontrado entre ** marcado */
function Excerpt({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/)
  return (
    <>{parts.map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : <Fragment key={i}>{part}</Fragment>))}</>
  )
}

/** Cómo va su lectura, en una palabra */
function BookState({ book }: { book: Book }) {
  const { t } = useTranslation()
  if (book.status === 'reading')
    return (
      <span className={styles.busy}>
        {t('library.reading', { percent: book.pages ? Math.floor((book.read / book.pages) * 100) : 0 })}
      </span>
    )
  return <span className={styles[book.status]}>{t(`library.status.${book.status}`)}</span>
}

export function LibraryScreen() {
  const { t } = useTranslation()
  const { worldId } = route.useParams()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const api = useApi()
  const client = useQueryClient()
  const errorText = useErrorText()
  const searchId = useId()
  const { account, pending } = useAccounts().useAccount()
  const [query, setQuery] = useState(search.q ?? '')
  const wanted = useSettled(query.trim())
  const books = useQuery({
    queryKey: ['library', worldId],
    queryFn: () => api.call('listLibrary', { worldId }),
    enabled: Boolean(account),
    // Mientras alguno se lee, su avance
    refetchInterval: (q) =>
      q.state.data?.books.some((b) => b.status === 'pending' || b.status === 'reading') ? 3000 : false
  })
  const found = useQuery({
    queryKey: ['library', worldId, 'search', wanted],
    queryFn: () => api.call('searchLibrary', { worldId, query: wanted }),
    enabled: Boolean(account) && wanted.length > 0
  })
  const again = useMutation({
    mutationFn: (fileId: string) => api.call('readBookAgain', { fileId }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['library', worldId] })
  })
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  if (!books.data)
    return failed(books) ? <LoadError error={books.error} onRetry={() => books.refetch()} /> : <Loading />
  const open = books.data.books.find((b) => b.fileId === search.libro)
  const show = (fileId: string, page?: number) =>
    void navigate({
      search: { libro: fileId, ...(page ? { pagina: page } : {}), ...(wanted ? { q: wanted } : {}) }
    })
  const scope = (common: boolean) => (common ? t('library.common') : t('library.world'))
  return (
    <div className={styles.page}>
      <aside className={styles.side} aria-label={t('library.title')}>
        <PageTitle className={styles.title}>{t('library.title')}</PageTitle>
        <search className={styles.search} data-tour="biblioteca-buscar">
          <label htmlFor={searchId} className={styles.hidden}>
            {t('library.search')}
          </label>
          <Search size={16} aria-hidden="true" />
          <input
            id={searchId}
            type="search"
            autoComplete="off"
            placeholder={t('library.search')}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </search>
        {wanted ? (
          <section aria-label={t('library.results')} aria-busy={found.isFetching}>
            <p className={styles.hidden} role="status">
              {found.data ? t('library.found', { count: found.data.books.length }) : ''}
            </p>
            {found.data?.books.length === 0 && found.data.pages.length === 0 && (
              <p className={styles.muted}>{t('library.nothing')}</p>
            )}
            {found.data?.books.map((book) => (
              <section key={book.fileId} className={styles.group} aria-label={book.name}>
                <div className={styles.groupHead}>
                  <span className={styles.bookName}>{book.name}</span>
                  <span className={styles.scope}>{scope(book.common)}</span>
                </div>
                <ul className={styles.hits}>
                  {book.pages.map((hit) => (
                    <li key={hit.page}>
                      <button
                        type="button"
                        className={styles.hit}
                        aria-current={open?.fileId === book.fileId && search.pagina === hit.page ? 'true' : undefined}
                        onClick={() => show(book.fileId, hit.page)}
                      >
                        <span className={styles.hitHead}>
                          {t('library.page', { page: hit.page })}
                          {hit.semantic && <span className={styles.semantic}>{t('library.semantic')}</span>}
                        </span>
                        <span className={styles.excerpt}>
                          <Excerpt text={hit.excerpt} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {found.data && found.data.pages.length > 0 && (
              <p className={styles.alsoIn}>
                {t('library.alsoIn')}{' '}
                {found.data.pages.map((page, i) => (
                  <Fragment key={page.pageId}>
                    {i > 0 && ', '}
                    <Link to="/mundos/$worldId/wiki/$pageId" params={{ worldId, pageId: page.pageId }}>
                      {page.title}
                    </Link>
                  </Fragment>
                ))}
              </p>
            )}
          </section>
        ) : (
          <section aria-labelledby={`${searchId}-books`} data-tour="biblioteca-libros">
            <h2 id={`${searchId}-books`} className={styles.small}>
              {t('library.books')}
            </h2>
            {books.data.books.length === 0 && <p className={styles.muted}>{t('library.empty')}</p>}
            <ul className={styles.books}>
              {books.data.books.map((book) => (
                <li key={book.fileId}>
                  <button
                    type="button"
                    className={styles.book}
                    aria-current={open?.fileId === book.fileId ? 'true' : undefined}
                    onClick={() => show(book.fileId)}
                  >
                    <BookOpen size={18} aria-hidden="true" />
                    <span className={styles.bookText}>
                      <span className={styles.bookName}>{book.name}</span>
                      <span className={styles.meta}>
                        {book.pages > 0
                          ? t('library.meta', { count: book.pages, scope: scope(book.common) })
                          : scope(book.common)}
                        {' · '}
                        <BookState book={book} />
                      </span>
                    </span>
                  </button>
                  {book.status === 'failed' && (
                    <button
                      type="button"
                      className={styles.again}
                      onClick={() => again.mutate(book.fileId)}
                      aria-label={t('library.againOf', { name: book.name })}
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                      {t('library.again')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <FormError message={again.error ? errorText(again.error) : null} />
          </section>
        )}
      </aside>
      <section className={styles.reader} aria-label={open ? open.name : t('library.title')}>
        {open ? (
          <>
            <div className={styles.readerHead}>
              <span className={styles.bookName}>{open.name}</span>
              <span className={styles.scope}>{scope(open.common)}</span>
              <a href={open.url} target="_blank" rel="noopener" className={styles.openApart}>
                {t('pdf.open')}
              </a>
            </div>
            <PdfPages
              key={open.url}
              url={open.url}
              name={open.name}
              first={search.pagina ?? 1}
              highlight={search.q ? search.q.split(/\s+/) : []}
            />
          </>
        ) : (
          <p className={styles.pick}>{t('library.pick')}</p>
        )}
      </section>
      <Tour
        id="biblioteca"
        steps={[
          { target: '[data-tour="biblioteca-buscar"]', text: t('tour.library.search') },
          ...(wanted ? [] : [{ target: '[data-tour="biblioteca-libros"]', text: t('tour.library.books') }])
        ]}
      />
    </div>
  )
}
