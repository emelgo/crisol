/**
 * Los libros de la campaña (ADR-0021, lienzo «Libros y campaña», tablero B): una tarjeta por libro de su sistema, con
 * su portada y su interruptor; «Elegir contenido» deja fuera entradas sueltas (por su clave). Lo del mundo, siempre
 * dentro. Pulsar una portada abre la ficha del libro
 */
import type { Book, Campaign } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Check, ChevronDown, ChevronRight, Minus, Plus, Search } from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import dialogStyles from '../components/dialog.module.css'
import { FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { Modal } from '../components/modal.tsx'
import { PageTitle } from '../components/page-title.tsx'
import segmented from '../components/segmented.module.css'
import { Tour } from '../components/tour.tsx'
import { BookCover } from './book-cover.tsx'
import { BookWindow, relayout, withTransition } from './book-window.tsx'
import styles from './books.module.css'

type Props = { worldId: string; worldName: string; campaign: Campaign }

export function CampaignBooks({ worldId, worldName, campaign }: Props) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const system = campaign.system
  const books = useQuery({
    queryKey: ['systemBooks', system?.id],
    queryFn: () => api.call('getSystemBooks', { systemId: system?.id ?? '' }),
    enabled: Boolean(system)
  })
  const compendium = useQuery({
    queryKey: ['compendium', campaign.id],
    queryFn: () => api.call('getCampaignCompendium', { campaignId: campaign.id }),
    enabled: Boolean(system)
  })
  const [only, setOnly] = useState(false)
  const [choosing, setChoosing] = useState<Book | null>(null)
  const [opened, setOpened] = useState<Book | null>(null)
  const all = books.data?.books ?? []
  const sources = campaign.systemChoices?.sources ?? all.map((b) => b.key)
  const excluded = campaign.systemChoices?.excluded ?? []
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['campaigns', worldId] }),
      queryClient.invalidateQueries({ queryKey: ['campaign', campaign.id] }),
      queryClient.invalidateQueries({ queryKey: ['compendium', campaign.id] }),
      queryClient.invalidateQueries({ queryKey: ['systemBooks', system?.id] })
    ])
  }
  const choose = useMutation({
    mutationFn: (systemChoices: { sources?: string[]; excluded?: string[] }) =>
      api.call('updateCampaign', { campaignId: campaign.id, systemChoices }),
    onSuccess: refresh
  })

  if (!system)
    return (
      <div className={styles.screen}>
        <div className={styles.col}>
          <header className={styles.titlebar}>
            <PageTitle className={styles.title}>{t('books.title')}</PageTitle>
          </header>
          <p className={styles.quiet}>{t('books.noSystem')}</p>
        </div>
      </div>
    )
  if (!books.data)
    return failed(books) ? <LoadError error={books.error} onRetry={() => books.refetch()} /> : <Loading />

  const shown = only ? all.filter((b) => sources.includes(b.key)) : all
  const world = compendium.data?.world
  const toggle = (book: Book) => {
    const on = sources.includes(book.key)
    const next = on ? sources.filter((k) => k !== book.key) : [...sources, book.key]
    choose.mutate({ sources: all.map((b) => b.key).filter((k) => next.includes(k)) })
  }
  return (
    <div className={styles.screen}>
      <div className={styles.col}>
        <header className={styles.titlebar}>
          <div className={styles.grow}>
            <PageTitle className={styles.title}>{t('books.title')}</PageTitle>
            <p className={styles.sub}>{t('books.lead', { campaign: campaign.name })}</p>
          </div>
          <fieldset className={segmented.group}>
            <legend className={styles.hidden}>{t('books.show')}</legend>
            <button type="button" aria-pressed={!only} onClick={() => relayout(() => flushSync(() => setOnly(false)))}>
              {t('books.all')}
            </button>
            <button type="button" aria-pressed={only} onClick={() => relayout(() => flushSync(() => setOnly(true)))}>
              {t('books.inCampaignCount', { count: sources.length })}
            </button>
          </fieldset>
        </header>
        <FormError message={choose.error ? errorText(choose.error) : null} />
        <ul className={styles.books} data-tour="libros-lista">
          {shown.map((book) => {
            const on = sources.includes(book.key)
            // Cuántas deja fuera la campaña: lo cuenta el compendio de la campaña, por clave
            const removed = on ? (compendium.data?.sources.find((s) => s.key === book.key)?.excluded ?? 0) : 0
            const missing = on
              ? book.requires
                  .filter((key) => !sources.includes(key))
                  .map((key) => all.find((b) => b.key === key)?.name ?? key)
              : []
            return (
              <li
                key={book.key}
                className={styles.book}
                data-book={book.key}
                style={{ viewTransitionName: `libro-${book.key}` }}
              >
                <button
                  type="button"
                  className={styles.coverButton}
                  onClick={(event) => {
                    const card = event.currentTarget
                    withTransition(card, () => flushSync(() => setOpened(book)))
                  }}
                >
                  <span className={styles.hidden}>{`${t('books.openPrefix')} `}</span>
                  <BookCover
                    book={book}
                    sub={subOf(t as (key: string) => string, book, books.data.editable)}
                    dim={!on}
                  />
                </button>
                <div className={styles.meta}>
                  {on ? (
                    <button type="button" className={styles.chooser} onClick={() => setChoosing(book)}>
                      {removed > 0 ? t('books.removed', { count: removed }) : t('books.choose')}
                    </button>
                  ) : (
                    <span>{t('books.entries', { count: book.count })}</span>
                  )}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={t('books.switch', { name: book.name })}
                    title={on && sources.length === 1 ? t('books.lastOne') : undefined}
                    className={styles.switch}
                    disabled={choose.isPending || (on && sources.length === 1)}
                    onClick={() => toggle(book)}
                  />
                </div>
                {missing.length > 0 && <p className={styles.warn}>{t('books.needs', { books: missing.join(', ') })}</p>}
              </li>
            )
          })}
          {world && (
            <li className={styles.book}>
              <span className={styles.coverStatic}>
                <BookCover
                  book={{ key: `mundo-${worldId}`, name: t('books.ofWorld', { world: worldName }), cover: null }}
                  sub={t('books.fromWorld')}
                  badge={<span className={styles.badge}>{t('books.fromWorld')}</span>}
                />
              </span>
              <div className={styles.meta}>
                <span>{t('books.entries', { count: world.count })}</span>
                <span className={styles.always}>{t('books.always')}</span>
              </div>
            </li>
          )}
          {books.data.editable && (
            <li className={styles.book}>
              <Link to="/sistemas/$systemId" params={{ systemId: system.id }} className={styles.newBook}>
                <Plus aria-hidden="true" size={22} />
                <span>
                  {t('books.newBook')}
                  <br />
                  <span className={styles.quiet}>{t('books.inSystem', { system: system.name })}</span>
                </span>
              </Link>
            </li>
          )}
        </ul>
      </div>
      <Tour id="libros" steps={[{ target: '[data-tour="libros-lista"]', text: t('tour.books.list') }]} />
      {choosing && (
        <ChooseContent
          systemId={system.id}
          book={choosing}
          excluded={excluded}
          busy={choose.isPending}
          error={choose.error ? errorText(choose.error) : null}
          onSave={async (next) => {
            await choose.mutateAsync({ excluded: next })
            setChoosing(null)
          }}
          onClose={() => setChoosing(null)}
        />
      )}
      {opened && (
        <BookWindow
          book={opened}
          books={all}
          systemName={books.data.name}
          builtIn={!books.data.editable && opened.origin === null}
          compendium={{ worldId, campaignId: campaign.id }}
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  )
}

/** Debajo del nombre: de dónde sale y su edición */
function subOf(t: (key: string) => string, book: Book, editable: boolean) {
  const origin =
    !editable && !book.origin ? t('books.origin.builtIn') : book.origin ? t(`books.origin.${book.origin}`) : ''
  return [origin, book.edition].filter(Boolean).join(' · ')
}

/**
 * Qué entra de un libro: por tipo (con su casilla y cuántas), que se despliega en sus entradas; lo desmarcado queda
 * fuera de la campaña (por su clave). Lo que el libro gane después, entra
 */
function ChooseContent({
  systemId,
  book,
  excluded,
  busy,
  error,
  onSave,
  onClose
}: {
  systemId: string
  book: Book
  excluded: readonly string[]
  busy: boolean
  error: string | null
  onSave: (excluded: string[]) => Promise<void>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const searchId = useId()
  const entries = useQuery({
    queryKey: ['bookEntries', systemId, book.key],
    queryFn: () => api.call('getBookEntries', { systemId, source: book.key })
  })
  const types = entries.data?.types ?? []
  const keys = useMemo(() => new Set(types.flatMap((type) => type.entries.map((e) => e.key))), [types])
  const [out, setOut] = useState<Set<string> | null>(null)
  const current = out ?? new Set(excluded.filter((k) => keys.has(k)))
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const total = keys.size
  const inside = total - current.size
  const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const wanted = fold(query.trim())
  const set = (update: (next: Set<string>) => void) => {
    const next = new Set(current)
    update(next)
    setOut(next)
  }
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={styles.chooseDialog} onClose={onClose}>
      <div className={dialogStyles.body}>
        <h2 id={titleId}>{t('books.chooseTitle', { name: book.name })}</h2>
        <div className={styles.chooseHead}>
          <label htmlFor={searchId} className={styles.hidden}>
            {t('books.search')}
          </label>
          <span className={styles.searchField}>
            <Search aria-hidden="true" size={16} />
            <input
              id={searchId}
              type="search"
              placeholder={t('books.search')}
              value={query}
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </span>
          <span className={styles.inside} aria-live="polite">
            {t('books.inside', { in: inside, total })}
          </span>
        </div>
        {!entries.data ? (
          failed(entries) ? (
            <LoadError error={entries.error} onRetry={() => entries.refetch()} />
          ) : (
            <Loading />
          )
        ) : (
          <ul className={styles.types}>
            {types.map((type) => {
              const shown = type.entries.filter((e) => !wanted || fold(e.name).includes(wanted))
              if (wanted && shown.length === 0) return null
              const typeOut = type.entries.filter((e) => current.has(e.key)).length
              const state = typeOut === 0 ? 'true' : typeOut === type.entries.length ? 'false' : 'mixed'
              const expanded = open === type.type || Boolean(wanted)
              return (
                <li key={type.type} className={styles.type}>
                  {/* biome-ignore lint/a11y/useSemanticElements: una casilla de tres estados (todo, parte, nada) */}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={state}
                    aria-label={t('books.typeAll', { type: type.label })}
                    className={styles.check}
                    onClick={() =>
                      set((next) => {
                        for (const e of type.entries) state === 'true' ? next.add(e.key) : next.delete(e.key)
                      })
                    }
                  >
                    {state === 'true' ? (
                      <Check size={12} strokeWidth={3} />
                    ) : state === 'mixed' ? (
                      <Minus size={12} strokeWidth={3} />
                    ) : null}
                  </button>
                  <span className={styles.typeName}>{type.label}</span>
                  <span className={styles.fraction}>
                    {type.entries.length - typeOut}/{type.entries.length}
                  </span>
                  <button
                    type="button"
                    className={styles.expand}
                    aria-expanded={expanded}
                    aria-label={t('books.showType', { type: type.label })}
                    onClick={() => setOpen(open === type.type ? null : type.type)}
                  >
                    {expanded ? (
                      <ChevronDown aria-hidden="true" size={16} />
                    ) : (
                      <ChevronRight aria-hidden="true" size={16} />
                    )}
                  </button>
                  {expanded && (
                    <div className={styles.chips}>
                      {shown.map((entry) => {
                        const inIt = !current.has(entry.key)
                        return (
                          <button
                            key={entry.key}
                            type="button"
                            aria-pressed={inIt}
                            className={inIt ? styles.chip : `${styles.chip} ${styles.chipOut}`}
                            onClick={() => set((next) => (inIt ? next.add(entry.key) : next.delete(entry.key)))}
                          >
                            {entry.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className={styles.quiet}>{t('books.later')}</p>
        <FormError message={error} />
        <div className={dialogStyles.actions}>
          <BusyButton
            type="button"
            className={form.button}
            busy={busy}
            onClick={() => onSave([...excluded.filter((k) => !keys.has(k)), ...current])}
          >
            {t('books.save')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('books.cancel')}
          </button>
          <button
            type="button"
            className={styles.bulk}
            onClick={() =>
              set((next) => {
                if (inside === 0) next.clear()
                else for (const k of keys) next.add(k)
              })
            }
          >
            {inside > 0 ? t('books.removeAll') : t('books.addAll')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
