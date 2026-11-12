/**
 * El lector de los capítulos de un libro (ADR-0025), como el de D&D Beyond: a la izquierda los capítulos y, dentro del
 * abierto, sus secciones, que siguen la lectura; anterior y siguiente al final; en el móvil, un «Ir a…» en lugar del
 * índice. Quien puede escribir el sistema (desde el sistema, no desde una campaña) escribe en el sitio, con el editor
 * de bloques, y crea, ordena y borra capítulos. El mismo encaje que el compendio (sus columnas y su título), para que
 * pasar de una pestaña a otra no mueva nada
 */
import type { Chapter, ChapterSummary } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Editor } from '@tiptap/core'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Ellipsis, Trash2 } from 'lucide-react'
import { type MouseEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import frame from '../campaign/compendium.module.css'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { CreateDialog } from '../components/create-dialog.tsx'
import dangerStyles from '../components/danger.module.css'
import dialogStyles from '../components/dialog.module.css'
import { EmptyState } from '../components/empty-state.tsx'
import { FormError } from '../components/field.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { Menu, MenuItem } from '../components/menu.tsx'
import { Modal } from '../components/modal.tsx'
import { type ContentScope, ContentScopeProvider } from '../wiki/content-scope.tsx'
import { useNarrow } from '../wiki/panel.tsx'
import { ChapterText } from './chapter-text.tsx'
import styles from './reader.module.css'

/** Una sección del capítulo abierto: un título de los tres primeros niveles, por su sitio en el documento */
interface Section {
  pos: number
  level: number
  text: string
}

const sectionsOf = (editor: Editor): Section[] => {
  const found: Section[] = []
  editor.state.doc.forEach((node, offset) => {
    const level = Number(node.attrs.level)
    if (node.type.name === 'heading' && level <= 3 && node.textContent.trim())
      found.push({ pos: offset, level, text: node.textContent.trim() })
  })
  return found
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

export function BookReader({
  systemId,
  source,
  campaignId,
  chapterId,
  onChapter,
  chapterHref,
  head,
  worldId
}: {
  systemId: string
  source: string
  /** Desde una campaña: lo que lee ella (sin los secretos, a quien no la dirige); no se escribe */
  campaignId?: string
  /** El abierto (sin él, el primero) */
  chapterId: string | null
  onChapter: (id: string | null) => void
  /** Su dirección, para que los enlaces se abran también en otra pestaña */
  chapterHref: (id: string) => string
  /** El título del libro y sus pestañas, en el sitio del título de todas las pantallas */
  head: ReactNode
  /** El mundo de la campaña (para abrir en su compendio lo que se enlaza) */
  worldId?: string
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const narrow = useNarrow()
  const listKey = ['chapters', systemId, source, campaignId ?? null]
  // Lo que se enlaza o se incrusta en un capítulo, desde la campaña (lo que ve ella) o desde su sistema
  const scope: ContentScope = campaignId
    ? { kind: 'campaign', campaignId, ...(worldId ? { worldId } : {}) }
    : { kind: 'system', systemId }
  const list = useQuery({
    queryKey: listKey,
    queryFn: () => api.call('listBookChapters', { systemId, source, ...(campaignId ? { campaignId } : {}) })
  })
  const chapters = list.data?.chapters ?? []
  const editable = list.data?.editable ?? false
  const currentId = chapterId && chapters.some((c) => c.id === chapterId) ? chapterId : (chapters[0]?.id ?? null)
  const at = chapters.findIndex((c) => c.id === currentId)
  const previous = at > 0 ? chapters[at - 1] : undefined
  const next = at >= 0 ? chapters[at + 1] : undefined
  const [editor, setEditor] = useState<Editor | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [active, setActive] = useState(-1)
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['chapters', systemId, source] }),
      queryClient.invalidateQueries({ queryKey: ['systemBooks', systemId] })
    ])
  }

  // Las secciones, al día con lo que se escribe
  useEffect(() => {
    if (!editor) {
      setSections([])
      return
    }
    const update = () => setSections(sectionsOf(editor))
    update()
    editor.on('update', update)
    return () => {
      editor.off('update', update)
    }
  }, [editor])

  // La sección que se está leyendo: la última cuyo título ya pasó el primer cuarto de la ventana; al final del todo (las
  // últimas no llegan a subir tanto), la última que se ve. La que se pulsa, mientras se va hacia ella
  const pinned = useRef(0)
  useEffect(() => {
    if (!editor || sections.length === 0) {
      setActive(-1)
      return
    }
    let frameId = 0
    let scroller: Element | null = null
    const update = (event?: Event) => {
      if (event?.target instanceof Element) scroller = event.target
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(() => {
        if (editor.isDestroyed || Date.now() < pinned.current) return
        const line = window.innerHeight * 0.25
        const box = scroller ?? document.scrollingElement
        const atEnd = Boolean(box && box.scrollTop > 0 && box.scrollTop + box.clientHeight >= box.scrollHeight - 4)
        let current = -1
        sections.forEach((section, index) => {
          const element = editor.view.nodeDOM(section.pos)
          if (!(element instanceof HTMLElement)) return
          const top = element.getBoundingClientRect().top
          if (top <= line || (atEnd && top < window.innerHeight)) current = index
        })
        setActive(current)
      })
    }
    update()
    document.addEventListener('scroll', update, { capture: true, passive: true })
    return () => {
      cancelAnimationFrame(frameId)
      document.removeEventListener('scroll', update, { capture: true })
    }
  }, [editor, sections])

  const goToSection = (index: number) => {
    const section = sections[index]
    const element = section && editor && !editor.isDestroyed ? editor.view.nodeDOM(section.pos) : null
    if (!(element instanceof HTMLElement)) return
    setActive(index)
    pinned.current = Date.now() + 900
    element.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' })
  }
  const follow = (id: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    onChapter(id)
  }

  if (!list.data) {
    return (
      <div className={frame.page}>
        <div className={frame.top}>{head}</div>
        <div className={styles.loading}>
          {failed(list) ? <LoadError error={list.error} onRetry={() => list.refetch()} /> : <Loading />}
        </div>
      </div>
    )
  }

  const create = async (title: string) => {
    const made = await api.call('saveChapter', { systemId, source, title })
    await refresh()
    onChapter(made.id)
  }

  if (chapters.length === 0) {
    return (
      <div className={frame.page}>
        <div className={frame.top}>{head}</div>
        <div className={styles.none}>
          <EmptyState
            kind="capitulos"
            action={
              editable ? (
                <CreateDialog
                  trigger={t('chapters.new')}
                  triggerClassName={styles.newBig}
                  title={t('chapters.newTitle')}
                  label={t('chapters.name')}
                  submit={t('chapters.create')}
                  onCreate={create}
                />
              ) : undefined
            }
          >
            <p>{t(editable ? 'chapters.emptyOwner' : 'chapters.empty')}</p>
          </EmptyState>
        </div>
      </div>
    )
  }

  return (
    <ContentScopeProvider value={scope}>
      <div className={frame.page} data-reading={narrow ? '' : undefined}>
        <div className={frame.top}>{head}</div>
        <nav className={`${frame.side} ${styles.index}`} aria-label={t('chapters.index')}>
          <ol className={styles.chapters}>
            {chapters.map((chapter) => {
              const open = chapter.id === currentId
              return (
                <li key={chapter.id}>
                  <a
                    href={chapterHref(chapter.id)}
                    className={styles.chapter}
                    aria-current={open ? 'page' : undefined}
                    onClick={follow(chapter.id)}
                  >
                    {chapter.title}
                  </a>
                  {open && sections.length > 0 && (
                    <ol className={styles.sections}>
                      {sections.map((section, index) => (
                        <li key={`${section.pos}-${section.text}`} data-level={section.level}>
                          <a
                            href={`${chapterHref(chapter.id)}#${index}`}
                            className={styles.section}
                            aria-current={index === active ? 'location' : undefined}
                            onClick={(event) => {
                              event.preventDefault()
                              goToSection(index)
                            }}
                          >
                            {section.text}
                          </a>
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              )
            })}
          </ol>
          {editable && (
            <CreateDialog
              trigger={t('chapters.new')}
              triggerClassName={styles.newChapter}
              title={t('chapters.newTitle')}
              label={t('chapters.name')}
              submit={t('chapters.create')}
              onCreate={create}
            />
          )}
        </nav>
        <article className={`${frame.reading} ${styles.reading}`} aria-busy={!currentId}>
          {narrow && (
            <GoTo
              chapters={chapters}
              currentId={currentId}
              sections={sections}
              active={active}
              onChapter={onChapter}
              onSection={goToSection}
            />
          )}
          {currentId && (
            <OpenChapter
              key={currentId}
              systemId={systemId}
              source={source}
              campaignId={campaignId}
              chapterId={currentId}
              editable={editable}
              position={at}
              count={chapters.length}
              chapterIds={chapters.map((c) => c.id)}
              onEditor={setEditor}
              onChanged={refresh}
              onDeleted={() => {
                void refresh()
                onChapter(next?.id ?? previous?.id ?? null)
              }}
            />
          )}
          {(previous || next) && (
            <nav className={styles.pager} aria-label={t('chapters.pager')}>
              {previous ? (
                <a href={chapterHref(previous.id)} className={styles.previous} onClick={follow(previous.id)}>
                  <span className={styles.pagerLabel}>
                    <ArrowLeft size={14} aria-hidden="true" />
                    {t('chapters.previous')}
                  </span>
                  <span className={styles.pagerTitle}>{previous.title}</span>
                </a>
              ) : (
                <span />
              )}
              {next && (
                <a href={chapterHref(next.id)} className={styles.next} onClick={follow(next.id)}>
                  <span className={styles.pagerLabel}>
                    {t('chapters.next')}
                    <ArrowRight size={14} aria-hidden="true" />
                  </span>
                  <span className={styles.pagerTitle}>{next.title}</span>
                </a>
              )}
            </nav>
          )}
        </article>
      </div>
    </ContentScopeProvider>
  )
}

/** En el móvil, en lugar del índice: los capítulos y las secciones del abierto, en un desplegable */
function GoTo({
  chapters,
  currentId,
  sections,
  active,
  onChapter,
  onSection
}: {
  chapters: readonly ChapterSummary[]
  currentId: string | null
  sections: readonly Section[]
  /** La sección que se está leyendo (−1, ninguna): el desplegable dice dónde se está */
  active: number
  onChapter: (id: string) => void
  onSection: (index: number) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <div className={styles.goTo}>
      <label htmlFor={id} className={styles.hidden}>
        {t('chapters.goTo')}
      </label>
      <select
        id={id}
        value={active >= 0 ? `s:${active}` : currentId ? `c:${currentId}` : ''}
        onChange={(event) => {
          const [kind, value] = event.currentTarget.value.split(':')
          if (kind === 'c' && value) onChapter(value)
          if (kind === 's' && value) onSection(Number(value))
        }}
      >
        <option value="" disabled>
          {t('chapters.goToHint')}
        </option>
        {chapters.map((chapter) => [
          <option key={chapter.id} value={`c:${chapter.id}`}>
            {chapter.title}
          </option>,
          ...(chapter.id === currentId
            ? sections.map((section, index) => (
                <option key={`${chapter.id}-${section.pos}`} value={`s:${index}`}>
                  {`${' '.repeat(section.level * 3)}${section.text}`}
                </option>
              ))
            : [])
        ])}
      </select>
    </div>
  )
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'error'

/** El capítulo abierto: su título y su texto; quien puede, lo escribe en el sitio, y lo sube, lo baja o lo borra */
function OpenChapter({
  systemId,
  source,
  campaignId,
  chapterId,
  editable,
  position,
  count,
  chapterIds,
  onEditor,
  onChanged,
  onDeleted
}: {
  systemId: string
  source: string
  campaignId: string | undefined
  chapterId: string
  editable: boolean
  position: number
  count: number
  chapterIds: readonly string[]
  onEditor: (editor: Editor | null) => void
  onChanged: () => Promise<void>
  onDeleted: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const queryKey = ['chapter', chapterId, campaignId ?? null]
  const chapter = useQuery({
    queryKey,
    queryFn: () => api.call('getChapter', { chapterId, ...(campaignId ? { campaignId } : {}) }),
    // Lo que se escribe no se pisa con lo que llega al volver a la pestaña
    refetchOnWindowFocus: !editable,
    staleTime: editable ? Number.POSITIVE_INFINITY : 0
  })
  const version = useRef<number | null>(null)
  if (chapter.data && version.current === null) version.current = chapter.data.version
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const [state, setState] = useState<SaveState>('idle')
  // Si ya se guardó algo (para volver a «Guardado» si lo último no cambiaba nada)
  const saved = useRef(false)
  const [title, setTitle] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [deleting, setDeleting] = useState(false)

  /** Guarda en orden (cada uno con la versión que dejó el anterior) */
  const save = (changes: { title?: string; markdown?: string }) => {
    setState('saving')
    queue.current = queue.current.then(async () => {
      if (version.current === null) return
      try {
        const result: Chapter = await api.call('saveChapter', {
          systemId,
          source,
          chapterId,
          version: version.current,
          ...changes
        })
        version.current = result.version
        queryClient.setQueryData(queryKey, result)
        saved.current = true
        setState('saved')
        if (changes.title !== undefined) await onChanged()
      } catch (error) {
        setState(error instanceof ApiError && error.code === 'CHAPTER_CHANGED' ? 'conflict' : 'error')
      }
    })
  }

  const move = useMutation({
    mutationFn: async (delta: -1 | 1) => {
      const ids = [...chapterIds]
      const [moved] = ids.splice(position, 1)
      if (!moved) return
      ids.splice(position + delta, 0, moved)
      await api.call('orderChapters', { systemId, source, chapterIds: ids })
      await onChanged()
    }
  })

  if (!chapter.data) {
    return failed(chapter) ? <LoadError error={chapter.error} onRetry={() => chapter.refetch()} /> : <Loading />
  }
  const shownTitle = title ?? chapter.data.title
  const commitTitle = () => {
    const trimmed = (title ?? '').trim()
    if (title === null) return
    if (!trimmed || trimmed === chapter.data?.title) {
      setTitle(null)
      return
    }
    save({ title: trimmed })
    setTitle(null)
  }

  return (
    <div className={styles.open}>
      <div className={styles.chapterHead}>
        {editable ? (
          <h2 className={styles.chapterTitle}>
            <input
              className={styles.titleInput}
              aria-label={t('chapters.name')}
              value={shownTitle}
              maxLength={200}
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
              onChange={(event) => setTitle(event.currentTarget.value)}
              onBlur={commitTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  event.currentTarget.blur()
                }
                if (event.key === 'Escape') setTitle(null)
              }}
            />
          </h2>
        ) : (
          <h2 className={styles.chapterTitle}>{chapter.data.title}</h2>
        )}
        {editable && (
          <div className={styles.tools}>
            <SaveStatus state={state} />
            <Menu label={t('chapters.more')} icon={<Ellipsis aria-hidden="true" size={18} />}>
              {(close) => (
                <>
                  <MenuItem
                    disabled={position <= 0 || move.isPending}
                    onClick={() => {
                      close()
                      move.mutate(-1)
                    }}
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                    {t('chapters.up')}
                  </MenuItem>
                  <MenuItem
                    disabled={position >= count - 1 || move.isPending}
                    onClick={() => {
                      close()
                      move.mutate(1)
                    }}
                  >
                    <ArrowDown size={16} aria-hidden="true" />
                    {t('chapters.down')}
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      close()
                      setDeleting(true)
                    }}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    {t('chapters.delete')}
                  </MenuItem>
                </>
              )}
            </Menu>
          </div>
        )}
      </div>
      {(state === 'conflict' || state === 'error') && (
        <div className={styles.problem} role="alert">
          <span>{t(state === 'conflict' ? 'chapters.conflict' : 'chapters.saveFailed')}</span>
          <button
            type="button"
            onClick={async () => {
              version.current = null
              await chapter.refetch()
              setState('idle')
              setReload((n) => n + 1)
            }}
          >
            {t('chapters.reload')}
          </button>
        </div>
      )}
      <div className={styles.text}>
        <ChapterText
          key={reload}
          markdown={chapter.data.markdown}
          editable={editable && state !== 'conflict'}
          label={t('chapters.text', { title: chapter.data.title })}
          onDirty={() => setState('dirty')}
          onClean={() => setState((now) => (now === 'dirty' ? (saved.current ? 'saved' : 'idle') : now))}
          onChange={(markdown) => save({ markdown })}
          onEditor={onEditor}
          {...(editable ? { systemId } : {})}
        />
      </div>
      {deleting && (
        <DeleteChapter
          title={chapter.data.title}
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await api.call('deleteChapter', { chapterId })
            onDeleted()
          }}
          errorText={errorText}
        />
      )}
    </div>
  )
}

/** «Guardado», pequeño y gris (docs/diseno.md) */
function SaveStatus({ state }: { state: SaveState }) {
  const { t } = useTranslation()
  const text =
    state === 'saving' || state === 'dirty' ? t('chapters.saving') : state === 'saved' ? t('chapters.saved') : ''
  return (
    <span className={styles.status} aria-live="polite">
      {text}
    </span>
  )
}

function DeleteChapter({
  title,
  onClose,
  onConfirm,
  errorText
}: {
  title: string
  onClose: () => void
  onConfirm: () => Promise<void>
  errorText: (error: unknown) => string
}) {
  const { t } = useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const remove = useMutation({ mutationFn: onConfirm })
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={dialogStyles.dialog} onClose={onClose}>
      <form
        className={dialogStyles.body}
        onSubmit={(event) => {
          event.preventDefault()
          remove.mutate()
        }}
      >
        <h2 id={titleId}>{t('chapters.deleteTitle', { title })}</h2>
        <p className={dialogStyles.description}>{t('chapters.deleteHint')}</p>
        <FormError message={remove.error ? errorText(remove.error) : null} />
        <div className={dialogStyles.actions}>
          <BusyButton type="submit" className={dangerStyles.solid} busy={remove.isPending}>
            {t('chapters.delete')}
          </BusyButton>
          <button
            type="button"
            className={dialogStyles.cancel}
            data-autofocus=""
            onClick={() => dialog.current?.close()}
          >
            {t('list.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
