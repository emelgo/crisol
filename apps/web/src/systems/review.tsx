/**
 * Revisar lo que la IA propuso para un libro desde su PDF (ADR-0021, lienzo, tablero F): nada entra sin pasar por aquí.
 * Por tipo: cada entrada con su casilla (lo repetido, sin marcar), sus avisos, su tipo (se puede cambiar) y su página;
 * al lado, el texto del PDF del que sale o cómo queda. Se añade lo marcado y se descarta lo demás, tipo a tipo
 */
import type { PendingEntry } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ChevronLeft, Sparkles, TriangleAlert } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import styles from './review.module.css'

const route = getRouteApi('/sistemas/$systemId/libros/$bookKey/revisar')

/** Un valor de una entrada, para leerlo: un texto en su idioma, una lista, un número */
function show(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(show).join(', ')
  if (typeof value === 'object') {
    const text = value as Record<string, unknown>
    if (typeof text.es === 'string') return text.es
    if (typeof text.en === 'string') return text.en
    return Object.entries(text)
      .map(([k, v]) => `${k}: ${show(v)}`)
      .join(' · ')
  }
  return ''
}

export function ReviewScreen() {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const { systemId, bookKey } = route.useParams()
  const tabsId = useId()
  const [type, setType] = useState<string | undefined>(undefined)
  const [current, setCurrent] = useState<string | null>(null)
  const [tab, setTab] = useState<'pdf' | 'result'>('pdf')
  // Lo desmarcado y los tipos cambiados, por clave (lo repetido empieza sin marcar)
  const [unchecked, setUnchecked] = useState<Record<string, boolean>>({})
  const [types, setTypes] = useState<Record<string, string>>({})
  const books = useQuery({
    queryKey: ['systemBooks', systemId],
    queryFn: () => api.call('getSystemBooks', { systemId })
  })
  const pending = useQuery({
    queryKey: ['pending', systemId, bookKey, type ?? null],
    queryFn: () => api.call('listPending', { systemId, source: bookKey, ...(type ? { type } : {}) })
  })
  const book = books.data?.books.find((b) => b.key === bookKey)
  const items = pending.data?.items ?? []
  const isOut = (entry: PendingEntry) => unchecked[entry.key] ?? Boolean(entry.repeats)
  const chosen = items.filter((e) => !isOut(e))
  const rest = items.filter((e) => isOut(e))
  const settle = useMutation({
    mutationFn: () =>
      api.call('settlePending', {
        systemId,
        accept: chosen.map((e) => e.key),
        discard: rest.map((e) => e.key),
        types: Object.fromEntries(chosen.flatMap((e) => (types[e.key] ? [[e.key, types[e.key] as string]] : [])))
      }),
    onSuccess: async () => {
      setType(undefined)
      setCurrent(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pending', systemId, bookKey] }),
        queryClient.invalidateQueries({ queryKey: ['systemBooks', systemId] })
      ])
    }
  })
  if (!books.data || !pending.data) {
    const error = failed(books) ? books : failed(pending) ? pending : null
    return error ? <LoadError error={error.error} onRetry={() => error.refetch()} /> : <Loading />
  }
  const open = items.find((e) => e.key === current) ?? items[0] ?? null
  const typeOptions = Object.entries(Object.fromEntries((pending.data.counts ?? []).map((c) => [c.type, c.label]))) as [
    string,
    string
  ][]
  const bookName = book?.name ?? bookKey
  return (
    <div className={styles.review}>
      <header className={styles.top}>
        <div className={styles.grow}>
          <Link to="/sistemas/$systemId" params={{ systemId }} className={styles.back}>
            <ChevronLeft aria-hidden="true" size={15} />
            {t('review.back', { system: books.data.name })}
          </Link>
          <PageTitle className={styles.title}>{t('review.title')}</PageTitle>
        </div>
        <span className={styles.tag}>
          <Sparkles aria-hidden="true" size={13} />
          {bookName}
        </span>
      </header>
      {items.length === 0 ? (
        <p className={styles.nothing}>{t('review.nothing')}</p>
      ) : (
        <div className={styles.mid}>
          <nav className={styles.types} aria-label={t('review.types')}>
            {pending.data.counts.map((c) => (
              <button
                key={c.type}
                type="button"
                aria-current={c.type === pending.data.type ? 'true' : undefined}
                onClick={() => {
                  setType(c.type)
                  setCurrent(null)
                }}
              >
                {c.label}
                <span>{c.count}</span>
              </button>
            ))}
          </nav>
          <section
            className={styles.entries}
            aria-label={pending.data.counts.find((c) => c.type === pending.data.type)?.label}
          >
            <div className={styles.entriesHead}>
              <b>{pending.data.counts.find((c) => c.type === pending.data.type)?.label}</b>
              <span className={styles.quiet}>{t('review.inside', { in: chosen.length, total: items.length })}</span>
              <button
                type="button"
                className={styles.bulk}
                onClick={() => setUnchecked(Object.fromEntries(items.map((e) => [e.key, false])))}
              >
                {t('review.all')}
              </button>
              <button
                type="button"
                className={styles.bulk}
                onClick={() => setUnchecked(Object.fromEntries(items.map((e) => [e.key, true])))}
              >
                {t('review.none')}
              </button>
            </div>
            <ul className={styles.list}>
              {items.map((entry) => {
                const inIt = !isOut(entry)
                const warnings = [
                  ...entry.notes,
                  ...(entry.repeats
                    ? [
                        t('review.repeats', {
                          book:
                            books.data.books.find((b) => b.key === entry.repeats?.source)?.name ??
                            entry.repeats.source ??
                            '',
                          name: entry.repeats.name
                        })
                      ]
                    : [])
                ]
                return (
                  <li
                    key={entry.key}
                    className={styles.entry}
                    aria-current={open?.key === entry.key ? 'true' : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={inIt}
                      aria-label={t('review.pick', { name: entry.name })}
                      className={styles.check}
                      onChange={() => setUnchecked({ ...unchecked, [entry.key]: inIt })}
                    />
                    <button type="button" className={styles.name} onClick={() => setCurrent(entry.key)}>
                      <b>{entry.name}</b>
                      {warnings.map((w) => (
                        <small key={w} className={styles.warn}>
                          <TriangleAlert aria-hidden="true" size={12} />
                          {w}
                        </small>
                      ))}
                    </button>
                    <select
                      className={styles.select}
                      aria-label={t('review.typeOf', { name: entry.name })}
                      value={types[entry.key] ?? entry.type}
                      onChange={(event) => setTypes({ ...types, [entry.key]: event.currentTarget.value })}
                    >
                      {typeOptions.map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <span className={styles.page}>{entry.page ? t('review.page', { page: entry.page }) : ''}</span>
                  </li>
                )
              })}
            </ul>
          </section>
          <section className={styles.side}>
            <div className={styles.tabs} role="tablist" aria-label={open?.name ?? ''}>
              <button
                type="button"
                role="tab"
                id={`${tabsId}-pdf`}
                aria-selected={tab === 'pdf'}
                aria-controls={`${tabsId}-panel`}
                onClick={() => setTab('pdf')}
              >
                {t('review.inPdf')}
              </button>
              <button
                type="button"
                role="tab"
                id={`${tabsId}-result`}
                aria-selected={tab === 'result'}
                aria-controls={`${tabsId}-panel`}
                onClick={() => setTab('result')}
              >
                {t('review.result')}
              </button>
            </div>
            <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${tab}`} className={styles.panel}>
              {open &&
                (tab === 'pdf' ? (
                  <div className={styles.paper}>
                    {open.excerpt ? <p className={styles.excerpt}>{open.excerpt}</p> : <p>{t('review.noExcerpt')}</p>}
                    {open.page && <span className={styles.pageNumber}>{open.page}</span>}
                  </div>
                ) : (
                  <div className={styles.result}>
                    <h3>{open.name}</h3>
                    <dl>
                      {Object.entries(open.item.data)
                        .filter(([key]) => key !== 'name')
                        .map(([key, value]) => (
                          <div key={key}>
                            <dt>{key}</dt>
                            <dd>{show(value)}</dd>
                          </div>
                        ))}
                    </dl>
                  </div>
                ))}
            </div>
          </section>
        </div>
      )}
      {items.length > 0 && (
        <footer className={styles.bottom}>
          <BusyButton
            type="button"
            className={form.button}
            busy={settle.isPending}
            disabled={chosen.length === 0 && rest.length === 0}
            onClick={() => settle.mutate()}
          >
            {chosen.length > 0
              ? t('review.accept', { count: chosen.length, book: bookName })
              : t('review.discardRest', { count: rest.length })}
          </BusyButton>
          {chosen.length > 0 && rest.length > 0 && (
            <span className={styles.quiet}>{t('review.andDiscard', { count: rest.length })}</span>
          )}
          <FormError message={settle.error ? errorText(settle.error) : null} />
          <span className={styles.hint}>{t('review.hint')}</span>
        </footer>
      )}
    </div>
  )
}
