/**
 * Un sistema, por dentro (ADR-0021, lienzo «Libros y campaña», tableros C y E): sus libros en tarjetas, la ficha de cada
 * uno en su ventana (con sus ajustes, en un sistema de la cuenta) y «Libro nuevo»: con la IA desde un PDF de la
 * biblioteca, desde el archivo de otro sistema o vacío. Lo que la IA propone se revisa en su pantalla
 */
import type { Book } from '@crisol/contracts'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { FileText, Pencil, Plus, ScrollText, Settings, Sparkles, Upload } from 'lucide-react'
import { type FormEvent, useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { BookCover } from '../campaign/book-cover.tsx'
import { BookWindow, withTransition } from '../campaign/book-window.tsx'
import books from '../campaign/books.module.css'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { CopyField } from '../components/copy-field.tsx'
import { ConfirmByName, DangerZone } from '../components/danger.tsx'
import dialogStyles from '../components/dialog.module.css'
import { Field, FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { Modal } from '../components/modal.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Screen } from '../components/screen.tsx'
import { Tour } from '../components/tour.tsx'
import { itemTransition } from '../components/world-transition.ts'
import styles from './system.module.css'

const route = getRouteApi('/sistemas/$systemId')

export function SystemScreen() {
  const { t } = useTranslation()
  const api = useApi()
  const { systemId } = route.useParams()
  const data = useQuery({
    queryKey: ['systemBooks', systemId],
    queryFn: () => api.call('getSystemBooks', { systemId })
  })
  const [opened, setOpened] = useState<Book | null>(null)
  const [settings, setSettings] = useState<Book | null>(null)
  const [creating, setCreating] = useState(false)
  if (!data.data) return failed(data) ? <LoadError error={data.error} onRetry={() => data.refetch()} /> : <Loading />
  const { name, editable } = data.data
  const all = data.data.books
  return (
    <Screen>
      <div className={styles.heading}>
        <span className={styles.icon} aria-hidden="true" style={itemTransition(systemId, 'icono')}>
          <ScrollText size={22} strokeWidth={1.5} />
        </span>
        <div style={itemTransition(systemId, 'nombre')}>
          <PageTitle>{name}</PageTitle>
        </div>
        <span className={styles.kind}>
          <ScrollText size={14} aria-hidden="true" />
          {t('systemBooks.kind')}
        </span>
      </div>
      <h2 className={styles.h}>{t('systemBooks.books')}</h2>
      {!editable && <p className={styles.note}>{t('systemBooks.builtIn')}</p>}
      <ul className={books.books} data-tour="sistema-libros">
        {all.map((book) => (
          <li key={book.key} className={books.book} style={{ viewTransitionName: `libro-${book.key}` }}>
            <button
              type="button"
              className={books.coverButton}
              aria-label={t('books.open', { name: book.name })}
              onClick={(event) => {
                const card = event.currentTarget
                withTransition(card, () => flushSync(() => setOpened(book)))
              }}
            >
              <BookCover
                book={book}
                sub={[book.origin ? t(`books.origin.${book.origin}`) : '', book.edition].filter(Boolean).join(' · ')}
              />
            </button>
            <div className={books.meta}>
              {book.pending > 0 ? (
                <Link
                  to="/sistemas/$systemId/libros/$bookKey/revisar"
                  params={{ systemId, bookKey: book.key }}
                  className={styles.pending}
                >
                  <Sparkles aria-hidden="true" size={14} />
                  {t('systemBooks.review', { count: book.pending })}
                </Link>
              ) : (
                <span>{t('books.entries', { count: book.count })}</span>
              )}
              {editable && (
                <button
                  type="button"
                  className={styles.gear}
                  aria-label={t('systemBooks.settingsOf', { name: book.name })}
                  title={t('systemBooks.settingsOf', { name: book.name })}
                  aria-haspopup="dialog"
                  onClick={() => setSettings(book)}
                >
                  <Settings size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          </li>
        ))}
        {editable && (
          <li className={books.book}>
            <button type="button" className={books.newBook} onClick={() => setCreating(true)} data-tour="libro-nuevo">
              <Plus aria-hidden="true" size={22} />
              <span>{t('systemBooks.newBook')}</span>
            </button>
          </li>
        )}
      </ul>
      <Tour
        id="sistema"
        steps={[
          { target: '[data-tour="sistema-libros"]', text: t('tour.system.books') },
          ...(editable ? [{ target: '[data-tour="libro-nuevo"]', text: t('tour.system.create') }] : [])
        ]}
      />
      {opened && (
        <BookWindow
          book={opened}
          books={all}
          systemName={name}
          builtIn={!editable && opened.origin === null}
          onClose={() => setOpened(null)}
        />
      )}
      {settings && (
        <BookSettings
          systemId={systemId}
          version={data.data.version}
          book={settings}
          books={all}
          onClose={() => setSettings(null)}
        />
      )}
      {creating && (
        <NewBook systemId={systemId} system={name} version={data.data.version} onClose={() => setCreating(false)} />
      )}
    </Screen>
  )
}

type Way = 'ai' | 'file' | 'own'

/** Un libro de otro sistema, en su archivo de Crisol: sus datos y sus entradas */
type FileBook = { source: Record<string, unknown>; items: Record<string, unknown>[] }

/** Libro nuevo: con la IA desde un PDF, desde el archivo de otro sistema o vacío */
function NewBook({
  systemId,
  system,
  version,
  onClose
}: {
  systemId: string
  system: string
  version: number
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const fileId = useId()
  const [way, setWay] = useState<Way>('ai')
  const [pdf, setPdf] = useState<{ fileId: string; name: string } | null>(null)
  const [name, setName] = useState('')
  const [edition, setEdition] = useState('')
  const [description, setDescription] = useState('')
  const [fileBooks, setFileBooks] = useState<FileBook[] | null>(null)
  const [fileBook, setFileBook] = useState<FileBook | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [done, setDone] = useState<{ key: string; name: string; pdf: string | null } | null>(null)
  // Los PDF de la biblioteca de los mundos (los comunes, una vez)
  const worlds = useQuery({ queryKey: ['worlds'], queryFn: () => api.call('listWorlds', {}) })
  const libraries = useQueries({
    queries: (worlds.data?.worlds ?? []).slice(0, 8).map((w) => ({
      queryKey: ['library', w.id],
      queryFn: () => api.call('listLibrary', { worldId: w.id }),
      enabled: way === 'ai'
    }))
  })
  const pdfs = [...new Map(libraries.flatMap((l) => l.data?.books ?? []).map((b) => [b.fileId, b] as const)).values()]
  const create = useMutation({
    mutationFn: async () => {
      if (way === 'file' && fileBook) {
        const source = fileBook.source
        const made = await api.call('createBook', {
          systemId,
          version,
          name: name || String(source.name ?? ''),
          origin: 'file',
          ...(typeof source.edition === 'string' ? { edition: source.edition } : {}),
          ...(typeof source.license === 'string' ? { license: source.license } : {}),
          ...(typeof source.attribution === 'string' ? { attribution: source.attribution } : {})
        })
        let current = made.version
        for (let i = 0; i < fileBook.items.length; i += 100) {
          const items = fileBook.items.slice(i, i + 100).map((item) => ({ ...item, source: made.key }))
          current = (await api.call('putSystemContent', { systemId, version: current, items: items as never })).version
        }
        return { key: made.key, name: name || String(source.name ?? ''), pdf: null }
      }
      const made = await api.call('createBook', {
        systemId,
        version,
        name,
        origin: way === 'ai' ? 'pdf' : 'own',
        ...(edition ? { edition } : {}),
        ...(description ? { description } : {}),
        ...(way === 'ai' && pdf ? { file: pdf.fileId } : {})
      })
      return { key: made.key, name, pdf: way === 'ai' && pdf ? pdf.name : null }
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['systemBooks', systemId] })
      if (result.pdf) setDone(result)
      else dialog.current?.close()
    }
  })
  const readFile = async (file: File) => {
    setFileError(null)
    setFileBooks(null)
    setFileBook(null)
    try {
      const parsed = JSON.parse(await file.text()) as {
        system?: { sources?: Record<string, unknown>[] }
        content?: Record<string, unknown>[]
      }
      const sources = parsed.system?.sources ?? []
      if (!Array.isArray(sources) || sources.length === 0 || !Array.isArray(parsed.content)) throw new Error('bad')
      const found = sources.map((source) => ({
        source,
        items: (parsed.content ?? []).filter((item) => item.source === source.key)
      }))
      setFileBooks(found)
      const first = found[0] ?? null
      setFileBook(first)
      setName(first ? String(first.source.name ?? '') : '')
    } catch {
      setFileError(t('systemBooks.fileBad'))
    }
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    create.mutate()
  }
  const ready = way === 'file' ? Boolean(fileBook && name.trim()) : Boolean(name.trim()) && (way !== 'ai' || pdf)
  const ways: { key: Way; icon: typeof Sparkles; title: string; hint: string }[] = [
    { key: 'ai', icon: Sparkles, title: t('systemBooks.ai'), hint: t('systemBooks.aiHint') },
    { key: 'file', icon: Upload, title: t('systemBooks.file'), hint: t('systemBooks.fileHint') },
    { key: 'own', icon: Pencil, title: t('systemBooks.own'), hint: t('systemBooks.ownHint') }
  ]
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={styles.newDialog} onClose={onClose}>
      <form className={dialogStyles.body} onSubmit={submit}>
        <h2 id={titleId}>{t('systemBooks.newTitle', { system })}</h2>
        {done ? (
          <>
            <p className={styles.done}>{t('systemBooks.created')}</p>
            <p>{t('systemBooks.askAi')}</p>
            <CopyField
              label={t('systemBooks.copyPhrase')}
              value={t('systemBooks.phrase', { pdf: done.pdf ?? '', book: done.name, system })}
            />
            <div className={dialogStyles.actions}>
              <button type="button" className={form.button} onClick={() => dialog.current?.close()}>
                {t('systemBooks.close')}
              </button>
            </div>
          </>
        ) : (
          <>
            <fieldset className={styles.ways}>
              <legend className={books.hidden}>{t('systemBooks.how')}</legend>
              {ways.map((w) => (
                <button
                  key={w.key}
                  type="button"
                  className={styles.way}
                  aria-pressed={way === w.key}
                  onClick={() => setWay(w.key)}
                >
                  <w.icon aria-hidden="true" size={22} />
                  <b>{w.title}</b>
                  <span>{w.hint}</span>
                </button>
              ))}
            </fieldset>
            {way === 'ai' && (
              <div>
                <h3 className={styles.h}>{t('systemBooks.pdfs')}</h3>
                {pdfs.length === 0 ? (
                  <p className={styles.note}>{t('systemBooks.noPdfs')}</p>
                ) : (
                  <ul className={styles.pdfs}>
                    {pdfs.map((book) => (
                      <li key={book.fileId}>
                        <button
                          type="button"
                          className={styles.pdf}
                          aria-pressed={pdf?.fileId === book.fileId}
                          onClick={() => {
                            setPdf({ fileId: book.fileId, name: book.name })
                            if (!name.trim()) setName(book.name.replace(/\.pdf$/i, ''))
                          }}
                        >
                          <FileText aria-hidden="true" size={18} />
                          <span>
                            <b>{book.name}</b>
                            <span>{book.pages > 0 ? t('systemBooks.pdfPages', { count: book.pages }) : ''}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {way === 'file' && (
              <div className={styles.fileRow}>
                <label htmlFor={fileId} className={form.field}>
                  {t('systemBooks.pickFile')}
                  <input
                    id={fileId}
                    type="file"
                    accept=".json,application/json"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0]
                      if (file) void readFile(file)
                    }}
                  />
                </label>
                <FormError message={fileError} />
                {fileBooks && fileBooks.length > 1 && (
                  <fieldset className={styles.fileBooks}>
                    <legend>{t('systemBooks.fileBooks')}</legend>
                    {fileBooks.map((b) => (
                      <label key={String(b.source.key)} className={form.check}>
                        <input
                          type="radio"
                          name="libro"
                          checked={fileBook === b}
                          onChange={() => {
                            setFileBook(b)
                            setName(String(b.source.name ?? ''))
                          }}
                        />
                        {String(b.source.name ?? b.source.key)} ·{' '}
                        {t('systemBooks.fileEntries', { count: b.items.length })}
                      </label>
                    ))}
                  </fieldset>
                )}
              </div>
            )}
            <div className={styles.fields}>
              <Field
                label={t('systemBooks.name')}
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
                maxLength={200}
                required
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
              />
              {way !== 'file' && (
                <Field
                  label={t('systemBooks.edition')}
                  value={edition}
                  onChange={(event) => setEdition(event.currentTarget.value)}
                  maxLength={40}
                />
              )}
            </div>
            {way === 'own' && (
              <Field
                label={t('systemBooks.description')}
                value={description}
                onChange={(event) => setDescription(event.currentTarget.value)}
                maxLength={600}
              />
            )}
            <FormError message={create.error ? errorText(create.error) : null} />
            <div className={dialogStyles.actions}>
              <BusyButton type="submit" className={form.button} busy={create.isPending} disabled={!ready}>
                {t('systemBooks.create')}
              </BusyButton>
              <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
                {t('systemBooks.cancel')}
              </button>
            </div>
          </>
        )}
      </form>
    </Modal>
  )
}

/** Los ajustes de un libro: su nombre, de qué va, su edición, su licencia, a qué amplía y su versión; y borrarlo */
function BookSettings({
  systemId,
  version,
  book,
  books: all,
  onClose
}: {
  systemId: string
  version: number
  book: Book
  books: readonly Book[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [draft, setDraft] = useState({
    name: book.name,
    description: book.description ?? '',
    edition: book.edition ?? '',
    license: book.license,
    attribution: book.attribution,
    requires: book.requires,
    newVersion: false
  })
  const save = useMutation({
    mutationFn: () =>
      api.call('updateBook', {
        systemId,
        version,
        key: book.key,
        name: draft.name,
        description: draft.description.trim() || null,
        edition: draft.edition.trim() || null,
        license: draft.license,
        attribution: draft.attribution,
        requires: draft.requires,
        ...(draft.newVersion ? { newVersion: true as const } : {})
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['systemBooks', systemId] })
      dialog.current?.close()
    }
  })
  const others = all.filter((b) => b.key !== book.key)
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={styles.newDialog} onClose={onClose}>
      <form
        className={dialogStyles.body}
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate()
        }}
      >
        <h2 id={titleId}>{t('systemBooks.settingsTitle', { name: book.name })}</h2>
        <Field
          label={t('systemBooks.name')}
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.currentTarget.value })}
          maxLength={200}
          required
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
        />
        <Field
          label={t('systemBooks.description')}
          value={draft.description}
          onChange={(event) => setDraft({ ...draft, description: event.currentTarget.value })}
          maxLength={600}
        />
        <div className={styles.fields}>
          <Field
            label={t('systemBooks.edition')}
            value={draft.edition}
            onChange={(event) => setDraft({ ...draft, edition: event.currentTarget.value })}
            maxLength={40}
          />
          <Field
            label={t('systemBooks.license')}
            value={draft.license}
            onChange={(event) => setDraft({ ...draft, license: event.currentTarget.value })}
            maxLength={200}
            required
          />
        </div>
        <Field
          label={t('systemBooks.attribution')}
          value={draft.attribution}
          onChange={(event) => setDraft({ ...draft, attribution: event.currentTarget.value })}
          maxLength={4000}
          required
        />
        {others.length > 0 && (
          <fieldset className={styles.fileBooks}>
            <legend>{t('systemBooks.requires')}</legend>
            {others.map((other) => (
              <label key={other.key} className={form.check}>
                <input
                  type="checkbox"
                  checked={draft.requires.includes(other.key)}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      requires: event.currentTarget.checked
                        ? [...draft.requires, other.key]
                        : draft.requires.filter((k) => k !== other.key)
                    })
                  }
                />
                {other.name}
              </label>
            ))}
          </fieldset>
        )}
        <label className={form.check}>
          <input
            type="checkbox"
            checked={draft.newVersion}
            onChange={(event) => setDraft({ ...draft, newVersion: event.currentTarget.checked })}
          />
          {t('systemBooks.newVersion')} ({book.version} → {book.version + 1})
        </label>
        <FormError message={save.error ? errorText(save.error) : null} />
        <div className={dialogStyles.actions}>
          <BusyButton type="submit" className={form.button} busy={save.isPending}>
            {t('systemBooks.save')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('systemBooks.cancel')}
          </button>
        </div>
        <DangerZone>
          {book.campaigns.length > 0 ? (
            <p className={styles.note}>
              {t('systemBooks.inUse', { campaigns: book.campaigns.map((c) => `«${c.name}»`).join(', ') })}
            </p>
          ) : (
            <ConfirmByName
              name={book.name}
              action={t('systemBooks.deleteBook')}
              title={t('systemBooks.deleteTitle', { name: book.name })}
              warning={t('systemBooks.deleteWarning')}
              label={t('systemBooks.name')}
              onConfirm={async () => {
                await api.call('deleteBook', { systemId, version, key: book.key })
                await queryClient.invalidateQueries({ queryKey: ['systemBooks', systemId] })
                dialog.current?.close()
              }}
            />
          )}
        </DangerZone>
      </form>
    </Modal>
  )
}
