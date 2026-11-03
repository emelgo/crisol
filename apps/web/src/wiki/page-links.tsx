/**
 * Los enlaces entre páginas en el editor: su vista (con el título de ahora, «por crear» si la página aún no existe, o
 * roto si está en la papelera) y `[[`, que sugiere páginas por título y alias, con erratas, y ofrece crearla
 */
import { foldName, type NamedPage, resolveName, searchNames } from '@crisol/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Extension, type Node } from '@tiptap/core'
import { NodeSelection, PluginKey } from '@tiptap/pm/state'
import { type NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer, ReactRenderer } from '@tiptap/react'
import { Suggestion, type SuggestionProps } from '@tiptap/suggestion'
import { forwardRef, useContext, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { type PageLinks, PageLinksContext, type WorldFile } from './links-context.ts'
import styles from './page-links.module.css'
import { LinkPreview } from './preview.tsx'
import menu from './slash-menu.module.css'

export { type PageLinks, PageLinksContext, type WorldFile } from './links-context.ts'

/** Las páginas del mundo con sus nombres: al día con los avisos de páginas (su clave cuelga de ['pages', mundo]) */
export function usePageLinks(worldId: string): PageLinks {
  const api = useApi()
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['pages', worldId, 'names'],
    queryFn: () => api.call('listPageNames', { worldId })
  })
  const files = useQuery({ queryKey: ['files', worldId], queryFn: () => api.call('listFiles', { worldId }) })
  const names = data?.pages ?? []
  return {
    worldId,
    names,
    files: files.data?.files ?? [],
    byId: new Map(names.map((page) => [page.id, page])),
    create: async (title) => {
      const created = await api.call('createPage', { worldId, title, parentId: null })
      await queryClient.invalidateQueries({ queryKey: ['pages', worldId] })
      return created.id
    }
  }
}

/** Las páginas del mundo de ahora, en una referencia: para las extensiones del editor, que se crean una vez */
export function useLinksRef() {
  const links = useContext(PageLinksContext)
  const ref = useRef<PageLinks | null>(links)
  useEffect(() => {
    ref.current = links
  })
  return ref
}

type LinkState = { state: 'ok'; page: NamedPage } | { state: 'missing' } | { state: 'broken' }

/** Adónde va un enlace ahora: por su id; sin id, por su nombre (si ya hay una sola página que se llame así) */
export function stateOf(links: PageLinks | null, pageId: string | null, title: string): LinkState {
  if (!links) return { state: 'missing' }
  if (pageId) {
    const page = links.byId.get(pageId)
    // Con id y sin página: en la papelera (o borrada). Mientras carga la lista, aún no se sabe
    return page ? { state: 'ok', page } : links.names.length > 0 ? { state: 'broken' } : { state: 'missing' }
  }
  const found = resolveName(title, links.names)
  return found.length === 1 && found[0] ? { state: 'ok', page: found[0] } : { state: 'missing' }
}

export function withPageLinkView(node: Node) {
  return node.extend({
    addNodeView() {
      return ReactNodeViewRenderer(PageLinkView, { as: 'span' })
    },
    addKeyboardShortcuts() {
      return {
        // Con el enlace elegido, Tab entra en su vista previa
        Tab: ({ editor }) => {
          const { selection } = editor.state
          if (!(selection instanceof NodeSelection) || selection.node.type.name !== this.name) return false
          const dom = editor.view.nodeDOM(selection.from)
          const link = dom instanceof HTMLElement ? dom.querySelector<HTMLAnchorElement>('a[data-page-link]') : null
          if (!link || !document.querySelector('[role="dialog"]')) return false
          link.dispatchEvent(new CustomEvent('crisol:preview-enter'))
          return true
        },
        // Con el enlace elegido, Intro lo sigue
        Enter: ({ editor }) => {
          const { selection } = editor.state
          if (!(selection instanceof NodeSelection) || selection.node.type.name !== this.name) return false
          const dom = editor.view.nodeDOM(selection.from)
          const link = dom instanceof HTMLElement ? dom.querySelector<HTMLAnchorElement>('a') : null
          link?.click()
          return Boolean(link)
        }
      }
    }
  })
}

/** Un toque en el móvil (sin ratón fino): la vista previa va en una hoja abajo */
const coarsePointer = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

function PageLinkView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const links = useContext(PageLinksContext)
  const [trashOpen, setTrashOpen] = useState(false)
  // La vista previa: con el ratón encima, con el enlace elegido (teclado) o, en el móvil, en una hoja
  const [hovering, setHovering] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const linkRef = useRef<HTMLAnchorElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pageId = (node.attrs.pageId as string | null) ?? null
  const title = String(node.attrs.title ?? '')
  const label = (node.attrs.label as string | null) || null
  const anchor = (node.attrs.anchor as string | null) || null
  const target = stateOf(links, pageId, title)
  const text = label ?? (target.state === 'ok' ? target.page.title : title)
  const worldId = links?.worldId ?? ''
  const open = (id: string) => void navigate({ to: '/mundos/$worldId/wiki/$pageId', params: { worldId, pageId: id } })

  const restore = useMutation({
    mutationFn: () => api.call('restorePage', { pageId: pageId ?? '' }),
    onSuccess: () => {
      setTrashOpen(false)
      return queryClient.invalidateQueries({ queryKey: ['pages', worldId] })
    }
  })
  const create = useMutation({
    mutationFn: () => links?.create(title) ?? Promise.reject(new Error('sin wiki')),
    onSuccess: (id) => {
      updateAttributes({ pageId: id })
      open(id)
    }
  })

  // Al dejar de estar elegido, la vista previa se puede volver a abrir
  useEffect(() => {
    if (!selected) setDismissed(false)
  }, [selected])
  useEffect(() => () => clearTimeout(hoverTimer.current), [])
  // Tab con el enlace elegido entra en la vista previa (lo pide la tecla del editor con este evento)
  useEffect(() => {
    const element = linkRef.current
    if (!element) return
    const enter = () => previewRef.current?.querySelector<HTMLElement>('a, button')?.focus()
    element.addEventListener('crisol:preview-enter', enter)
    return () => element.removeEventListener('crisol:preview-enter', enter)
  }, [])

  const hover = (inside: boolean) => {
    clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setHovering(inside), inside ? 300 : 200)
  }
  const showPreview = target.state === 'ok' && (sheet || hovering || (selected && !dismissed))
  const closePreview = (returnFocus: boolean) => {
    clearTimeout(hoverTimer.current)
    setHovering(false)
    setSheet(false)
    setDismissed(true)
    if (returnFocus) editor.commands.focus()
  }

  const href = target.state === 'ok' ? `/mundos/${worldId}/wiki/${target.page.id}` : undefined
  const description =
    target.state === 'missing'
      ? t('links.missing', { title: text })
      : target.state === 'broken'
        ? t('links.broken', { title: text })
        : undefined
  return (
    <NodeViewWrapper as="span" className={styles.wrapper}>
      <a
        ref={linkRef}
        href={href ?? '#'}
        className={styles.link}
        data-state={target.state}
        data-page-link=""
        aria-label={description}
        title={description}
        onMouseEnter={() => !coarsePointer() && hover(true)}
        onMouseLeave={() => hover(false)}
        onClick={(event) => {
          event.preventDefault()
          if (target.state === 'ok') {
            if (!pageId) updateAttributes({ pageId: target.page.id })
            // En el móvil, primero la hoja con «Abrir página»
            if (coarsePointer()) setSheet(true)
            else open(target.page.id)
          } else if (target.state === 'missing') create.mutate()
          else setTrashOpen(!trashOpen)
        }}
      >
        {text}
      </a>
      {showPreview && target.state === 'ok' && (
        <LinkPreview
          ref={previewRef}
          worldId={worldId}
          pageId={target.page.id}
          anchor={anchor}
          anchorElement={linkRef.current}
          sheet={sheet}
          onHover={hover}
          onClose={closePreview}
        />
      )}
      {trashOpen && (
        <span className={styles.trash} contentEditable={false} role="status">
          {t('links.inTrash')}{' '}
          <button
            type="button"
            className={styles.restore}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => restore.mutate()}
          >
            {t('links.restore')}
          </button>
        </span>
      )}
    </NodeViewWrapper>
  )
}

/** Lo que se elige al escribir `[[`: una página, o crear una con lo escrito; tras `![[`, también un archivo */
type LinkChoice =
  | { kind: 'page'; page: NamedPage; name: string }
  | { kind: 'create'; title: string }
  | { kind: 'file'; file: WorldFile }

export interface LinkSuggestOptions {
  /** Las páginas de ahora (cambian mientras el editor sigue abierto) */
  links: () => PageLinks | null
  announce: (title: string) => void
}

export const LinkSuggest = Extension.create<LinkSuggestOptions>({
  name: 'linkSuggest',
  priority: 200,
  addOptions: () => ({ links: () => null, announce: () => {} }),
  addProseMirrorPlugins() {
    const { links, announce } = this.options
    const editor = this.editor
    // «[[» como en el Markdown y «@» como en el Crisol antiguo (este, al empezar una palabra; sin incrustar)
    const suggest = (char: '[[' | '@') => {
      // Lo escrito tras el disparador (la orden de elegir no lo recibe: se guarda al buscar)
      let lastQuery = ''
      return Suggestion<LinkChoice, LinkChoice>({
        editor,
        pluginKey: new PluginKey(char === '@' ? 'linkMention' : 'linkSuggest'),
        char,
        allowSpaces: true,
        allowedPrefixes: char === '@' ? [' '] : null,
        allow: ({ state, range }) => state.doc.resolve(range.from).parent.type.name !== 'codeBlock',
        items: ({ query, editor }) => {
          lastQuery = query
          const current = links()
          // `![[`: el «!» va justo antes de los corchetes
          const start = editor.state.selection.from - query.length - 2
          const embedding = char === '[[' && start > 1 && editor.state.doc.textBetween(start - 1, start) === '!'
          // «Título#Sección»: se busca por el título; la sección va con el enlace
          const [name = ''] = query.replace(/\]+$/, '').split('#')
          const text = name.trim()
          const found: LinkChoice[] = searchNames(text, current?.names ?? [], 8).map(({ page, name: matched }) => ({
            kind: 'page',
            page,
            name: matched
          }))
          const exact = found.some((choice) => choice.kind === 'page' && foldName(choice.name) === foldName(text))
          const files: LinkChoice[] = embedding
            ? (current?.files ?? [])
                .filter((file) => foldName(file.name).includes(foldName(text)))
                .slice(0, 5)
                .map((file) => ({ kind: 'file', file }))
            : []
          return [...files, ...(text && !exact ? [...found, { kind: 'create', title: text } as const] : found)]
        },
        command: ({ editor, range, props: choice }) => {
          const anchor = lastQuery.replace(/\]+$/, '').split('#').slice(1).join('#').trim() || null
          // Con «!» delante, incrustar; si no, enlazar
          const embed =
            char === '[[' && range.from > 1 && editor.state.doc.textBetween(range.from - 1, range.from) === '!'
          const insert = (pageId: string, title: string) => {
            const content = embed
              ? [{ type: 'pageEmbed', attrs: { pageId, title, anchor } }]
              : [
                  { type: 'pageLink', attrs: { pageId, title, anchor } },
                  { type: 'text', text: ' ' }
                ]
            editor
              .chain()
              .focus()
              .insertContentAt(embed ? { from: range.from - 1, to: range.to } : range, content)
              .run()
            announce(title)
          }
          if (choice.kind === 'file') {
            editor
              .chain()
              .focus()
              .insertContentAt({ from: range.from - 1, to: range.to }, [
                { type: 'fileEmbed', attrs: { fileId: choice.file.id, name: choice.file.name } }
              ])
              .run()
            announce(choice.file.name)
          } else if (choice.kind === 'page') insert(choice.page.id, choice.page.title)
          else
            void links()
              ?.create(choice.title)
              .then((id) => insert(id, choice.title))
        },
        render: () => {
          let renderer: ReactRenderer<ListHandle, LinkListProps> | null = null
          let unmount: (() => void) | null = null
          return {
            onStart: (props) => {
              renderer = new ReactRenderer(LinkList, { props, editor: props.editor })
              // Va al final de la página: por encima de ella, que monta sobre su portada
              renderer.element.style.zIndex = '30'
              unmount = props.mount(renderer.element)
            },
            onUpdate: (props) => renderer?.updateProps(props),
            onKeyDown: ({ event }) => renderer?.ref?.onKeyDown(event) ?? false,
            onExit: () => {
              unmount?.()
              renderer?.destroy()
              renderer = null
            }
          }
        }
      })
    }
    return [suggest('[['), suggest('@')]
  }
})

type LinkListProps = SuggestionProps<LinkChoice, LinkChoice>

interface ListHandle {
  onKeyDown: (event: KeyboardEvent) => boolean
}

const keyOf = (choice: LinkChoice) =>
  choice.kind === 'page'
    ? choice.page.id
    : choice.kind === 'file'
      ? `archivo:${choice.file.id}`
      : `crear:${choice.title}`

const LinkList = forwardRef<ListHandle, LinkListProps>(function LinkList({ items, command, editor }, ref) {
  const { t } = useTranslation()
  const id = useId()
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const current = items.find((item) => keyOf(item) === activeKey) ?? items[0]
  // Los títulos repetidos llevan su ruta
  const repeated = new Set(
    items.flatMap((item, i) =>
      item.kind === 'page' &&
      items.some(
        (other, j) => j !== i && other.kind === 'page' && foldName(other.page.title) === foldName(item.page.title)
      )
        ? [item.page.id]
        : []
    )
  )

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (items.length === 0) return false
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const index = current ? items.indexOf(current) : 0
        const next = items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]
        setActiveKey(next ? keyOf(next) : null)
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        if (current) command(current)
        return true
      }
      return false
    }
  }))

  const optionId = (choice: LinkChoice) => `${id}-${items.indexOf(choice)}`
  useEffect(() => {
    const dom = editor.view.dom
    dom.setAttribute('aria-controls', `${id}-list`)
    dom.setAttribute('aria-autocomplete', 'list')
    if (current) dom.setAttribute('aria-activedescendant', optionId(current))
    else dom.removeAttribute('aria-activedescendant')
  })
  useEffect(() => {
    const dom = editor.view.dom
    return () => {
      for (const name of ['aria-controls', 'aria-autocomplete', 'aria-activedescendant']) dom.removeAttribute(name)
    }
  }, [editor])

  return (
    <div className={menu.menu}>
      <div id={`${id}-list`} role="listbox" aria-label={t('links.menu')} className={menu.list}>
        {items.map((choice) => (
          <div
            key={keyOf(choice)}
            id={optionId(choice)}
            role="option"
            aria-selected={choice === current}
            className={menu.option}
            tabIndex={-1}
            onMouseEnter={() => setActiveKey(keyOf(choice))}
            onMouseDown={(event) => {
              event.preventDefault()
              command(choice)
            }}
          >
            {choice.kind === 'file' ? (
              <>
                <span>{choice.file.name}</span>
                <span className={menu.hint}>{t('links.file')}</span>
              </>
            ) : choice.kind === 'page' ? (
              <>
                <span>{choice.page.title}</span>
                <span className={menu.hint}>
                  {choice.name !== choice.page.title
                    ? t('links.aliasOf', { name: choice.name })
                    : repeated.has(choice.page.id)
                      ? choice.page.path.slice(0, -1).join(' / ')
                      : ''}
                </span>
              </>
            ) : (
              <span>{t('links.create', { title: choice.title })}</span>
            )}
          </div>
        ))}
      </div>
      {items.length === 0 && <p className={menu.empty}>{t('links.none')}</p>}
    </div>
  )
})
