/**
 * Un sistema, por dentro (ADR-0021, lienzo «Libros y campaña», tableros C y E): sus libros en tarjetas, la ficha de cada
 * uno en su ventana (con sus ajustes, en un sistema de la cuenta) y «Libro nuevo»: con la IA desde un PDF de la
 * biblioteca, desde el archivo de otro sistema o vacío. Lo que la IA propone se revisa en su pantalla
 */
import type { Book, PageCover } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { Image as ImageIcon, Pencil, Plus, Settings, Sparkles, Upload } from 'lucide-react'
import { type FormEvent, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { BookCover } from '../campaign/book-cover.tsx'
import books from '../campaign/books.module.css'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { ConfirmByName, DangerZone } from '../components/danger.tsx'
import dialogStyles from '../components/dialog.module.css'
import { Field, FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { Modal } from '../components/modal.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Screen } from '../components/screen.tsx'
import { Tour } from '../components/tour.tsx'
import { itemTransition, SECTION } from '../components/world-transition.ts'
import { ColorChoices } from '../routes/world-card.tsx'
import { CoverDialog, LOCAL_FILE, type LocalImage } from '../routes/world-cover.tsx'
import { coverStyle } from '../wiki/cover-look.ts'
import styles from './system.module.css'
import { SystemIcon, systemCoverUrl } from './system-look.tsx'

const route = getRouteApi('/sistemas/$systemId')

export function SystemScreen() {
  const { t } = useTranslation()
  const api = useApi()
  const { systemId } = route.useParams()
  const data = useQuery({
    queryKey: ['systemBooks', systemId],
    queryFn: () => api.call('getSystemBooks', { systemId })
  })
  const [settings, setSettings] = useState<Book | null>(null)
  const [creating, setCreating] = useState(false)
  // Su icono y su portada (y, detrás, su portada muy difuminada, como la de un mundo)
  const summary = useQuery({ queryKey: ['systems'], queryFn: () => api.call('listSystems', {}) }).data?.systems.find(
    (each) => each.id === systemId
  )
  if (!data.data) return failed(data) ? <LoadError error={data.error} onRetry={() => data.refetch()} /> : <Loading />
  const { name, editable } = data.data
  const all = data.data.books
  return (
    <Screen>
      {/* Su Inicio, dentro de su espacio (la barra ya dice dónde se está): su portada, si tiene, y su nombre con su
          icono (sin el pergamino fijo ni «Sistema») */}
      {summary?.cover && (
        <div className={styles.banner}>
          <img src={systemCoverUrl(summary) ?? ''} alt="" style={coverStyle(summary.cover)} />
        </div>
      )}
      <div className={styles.heading}>
        {summary?.icon && (
          <span
            className={styles.icon}
            aria-hidden="true"
            data-elemento="icono"
            style={itemTransition(systemId, 'icono')}
          >
            <SystemIcon icon={summary.icon} size={26} />
          </span>
        )}
        <div style={itemTransition(systemId, 'nombre')} data-elemento="nombre">
          <PageTitle>{name}</PageTitle>
        </div>
      </div>
      <h2 className={styles.h}>{t('systemBooks.books')}</h2>
      {!editable && <p className={styles.note}>{t('systemBooks.builtIn')}</p>}
      <ul className={books.books} data-tour="sistema-libros">
        {all.map((book) => (
          <li key={book.key} className={books.book} style={{ viewTransitionName: `libro-${book.key}` }}>
            {/* Se abre por dentro: el compendio en ese libro (su árbol, la entrada y sus datos) */}
            <Link
              to="/sistemas/$systemId/libros/$bookKey"
              params={{ systemId, bookKey: book.key }}
              className={books.coverButton}
              viewTransition={SECTION}
            >
              <span className={books.hidden}>{`${t('books.openPrefix')} `}</span>
              <BookCover
                book={{ ...book, systemId }}
                sub={[book.origin ? t(`books.origin.${book.origin}`) : '', book.edition].filter(Boolean).join(' · ')}
              />
            </Link>
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
                <span>
                  {t('books.entries', { count: book.count })}
                  {book.chapters > 0 && ` · ${t('chapters.count', { count: book.chapters })}`}
                </span>
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
          ...(editable ? [{ target: '[data-tour="libro-nuevo"]', text: t('tour.system.create') }] : []),
          // Un paso por cada botón de su barra (docs/diseno.md)
          { target: '[data-tour="barra-compendio"]', text: t('tour.system.compendium') },
          { target: '[data-tour="barra-reglas"]', text: t('tour.system.rules') },
          ...(editable ? [{ target: '[data-tour="barra-ajustes-sistema"]', text: t('tour.system.settings') }] : [])
        ]}
      />
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

type Way = 'file' | 'own'

/** Un libro de otro sistema, en su archivo de Crisol: sus datos y sus entradas */
type FileBook = { source: Record<string, unknown>; items: Record<string, unknown>[] }

/**
 * Libro nuevo: desde el archivo de otro sistema o vacío. Con la IA (desde un PDF), solo mencionado: se le pide a ella,
 * por el MCP (Enrique, 2026-11-13)
 */
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
  const [way, setWay] = useState<Way>('own')
  const [name, setName] = useState('')
  const [edition, setEdition] = useState('')
  const [description, setDescription] = useState('')
  const [fileBooks, setFileBooks] = useState<FileBook[] | null>(null)
  const [fileBook, setFileBook] = useState<FileBook | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const create = useMutation({
    mutationFn: async () => {
      if (way === 'file' && fileBook) {
        // De una vez: el libro y su contenido (lo que se llame como algo de otro libro, renombrado; no se pisa nada)
        const source = fileBook.source
        const textOf = (value: unknown) =>
          typeof value === 'string'
            ? value
            : value && typeof value === 'object'
              ? String((value as Record<string, unknown>).es ?? Object.values(value as object)[0] ?? '')
              : ''
        const made = await api.call('importBook', {
          systemId,
          version,
          name: name || textOf(source.name),
          origin: 'file',
          ...(typeof source.edition === 'string' ? { edition: source.edition } : {}),
          ...(typeof source.license === 'string' ? { license: source.license } : {}),
          ...(textOf(source.attribution) ? { attribution: textOf(source.attribution) } : {}),
          items: fileBook.items.map(({ source: _, ...item }) => item) as never
        })
        return made
      }
      return api.call('createBook', {
        systemId,
        version,
        name,
        origin: 'own',
        ...(edition ? { edition } : {}),
        ...(description ? { description } : {})
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['systemBooks', systemId] })
      dialog.current?.close()
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
  const ready = way === 'file' ? Boolean(fileBook && name.trim()) : Boolean(name.trim())
  const ways: { key: Way; icon: typeof Upload; title: string; hint: string }[] = [
    { key: 'own', icon: Pencil, title: t('systemBooks.own'), hint: t('systemBooks.ownHint') },
    { key: 'file', icon: Upload, title: t('systemBooks.file'), hint: t('systemBooks.fileHint') }
  ]
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={styles.newDialog} onClose={onClose}>
      <form className={dialogStyles.body} onSubmit={submit}>
        <h2 id={titleId}>{t('systemBooks.newTitle', { system })}</h2>
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
        <p className={styles.aiMention}>
          <Sparkles aria-hidden="true" size={14} />
          {t('systemBooks.aiMention')}
        </p>
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
                    {String(b.source.name ?? b.source.key)} · {t('systemBooks.fileEntries', { count: b.items.length })}
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
    color: book.color,
    master: book.master,
    newVersion: false
  })
  // Su portada: con el cuadro de la de un mundo (de los archivos comunes; una subida va a ellos), se guarda al momento
  const [coverOpen, setCoverOpen] = useState(false)
  const organizations = useQuery({ queryKey: ['organizations'], queryFn: () => api.call('listOrganizations', {}) })
  const owned = organizations.data?.organizations.find((o) => o.role === 'owner')
  const saveCover = async (cover: PageCover | null, local: LocalImage | null) => {
    let chosen = cover
    if (local && cover?.fileId === LOCAL_FILE && owned) {
      const stored = await api.uploadFile({ organizationId: owned.id, name: local.file.name }, local.file)
      chosen = { ...cover, fileId: stored.id }
      await queryClient.invalidateQueries({ queryKey: ['commonFiles'] })
    }
    await api.call('updateBook', { systemId, version, key: book.key, cover: chosen })
    await queryClient.invalidateQueries({ queryKey: ['systemBooks', systemId] })
  }
  const save = useMutation({
    mutationFn: () =>
      api.call('updateBook', {
        systemId,
        version,
        key: book.key,
        ...(draft.name !== book.name ? { name: draft.name } : {}),
        ...(draft.description !== (book.description ?? '') ? { description: draft.description.trim() || null } : {}),
        ...(draft.edition !== (book.edition ?? '') ? { edition: draft.edition.trim() || null } : {}),
        ...(draft.license !== book.license ? { license: draft.license } : {}),
        ...(draft.attribution !== book.attribution ? { attribution: draft.attribution } : {}),
        ...(draft.requires.join() !== book.requires.join() ? { requires: draft.requires } : {}),
        ...(draft.color !== book.color ? { color: draft.color } : {}),
        ...(draft.master !== book.master ? { master: draft.master } : {}),
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
        {/* Su portada o, sin ella, su color (el de la tapa) */}
        <div className={styles.coverRow}>
          <span className={styles.coverLabel}>{t('systemBooks.cover')}</span>
          <button type="button" className={styles.rowAction} aria-haspopup="dialog" onClick={() => setCoverOpen(true)}>
            <ImageIcon size={14} aria-hidden="true" />
            {book.cover ? t('systemBooks.changeCover') : t('systemBooks.addCover')}
          </button>
        </div>
        {!book.cover && <ColorChoices value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />}
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
            checked={draft.master}
            onChange={(event) => setDraft({ ...draft, master: event.currentTarget.checked })}
          />
          <span>
            {t('systemBooks.master')}
            <span className={form.hint}> · {t('systemBooks.masterHint')}</span>
          </span>
        </label>
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
        {coverOpen && (
          <CoverDialog
            title={t('systemBooks.coverOf', { name: book.name })}
            // La de una imagen del sistema (la pone la IA) no se elige aquí: elegir una de los comunes la cambia
            cover={book.cover?.fileId ? { ...book.cover, fileId: book.cover.fileId } : null}
            aspect="3 / 4"
            onSave={saveCover}
            onClose={() => setCoverOpen(false)}
          />
        )}
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
