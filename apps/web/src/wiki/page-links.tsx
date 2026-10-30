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
import { createContext, forwardRef, useContext, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import styles from './page-links.module.css'
import menu from './slash-menu.module.css'

/** Lo que necesitan los enlaces del editor: las páginas del mundo por su nombre, y crear una */
export interface PageLinks {
  worldId: string
  names: readonly NamedPage[]
  byId: ReadonlyMap<string, NamedPage>
  create: (title: string) => Promise<string>
}

export const PageLinksContext = createContext<PageLinks | null>(null)

/** Las páginas del mundo con sus nombres: al día con los avisos de páginas (su clave cuelga de ['pages', mundo]) */
export function usePageLinks(worldId: string): PageLinks {
  const api = useApi()
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['pages', worldId, 'names'],
    queryFn: () => api.call('listPageNames', { worldId })
  })
  const names = data?.pages ?? []
  return {
    worldId,
    names,
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
function stateOf(links: PageLinks | null, pageId: string | null, title: string): LinkState {
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

function PageLinkView({ node, updateAttributes }: NodeViewProps) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const links = useContext(PageLinksContext)
  const [trashOpen, setTrashOpen] = useState(false)
  const pageId = (node.attrs.pageId as string | null) ?? null
  const title = String(node.attrs.title ?? '')
  const label = (node.attrs.label as string | null) || null
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
        href={href ?? '#'}
        className={styles.link}
        data-state={target.state}
        aria-label={description}
        title={description}
        onClick={(event) => {
          event.preventDefault()
          if (target.state === 'ok') {
            if (!pageId) updateAttributes({ pageId: target.page.id })
            open(target.page.id)
          } else if (target.state === 'missing') create.mutate()
          else setTrashOpen(!trashOpen)
        }}
      >
        {text}
      </a>
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

/** Lo que se elige al escribir `[[`: una página, o crear una con lo escrito */
type LinkChoice = { kind: 'page'; page: NamedPage; name: string } | { kind: 'create'; title: string }

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
    return [
      Suggestion<LinkChoice, LinkChoice>({
        editor: this.editor,
        pluginKey: new PluginKey('linkSuggest'),
        char: '[[',
        allowSpaces: true,
        allowedPrefixes: null,
        allow: ({ state, range }) => state.doc.resolve(range.from).parent.type.name !== 'codeBlock',
        items: ({ query }) => {
          const current = links()
          const text = query.replace(/\]+$/, '').trim()
          const found: LinkChoice[] = searchNames(text, current?.names ?? [], 8).map(({ page, name }) => ({
            kind: 'page',
            page,
            name
          }))
          const exact = found.some((choice) => choice.kind === 'page' && foldName(choice.name) === foldName(text))
          return text && !exact ? [...found, { kind: 'create', title: text }] : found
        },
        command: ({ editor, range, props: choice }) => {
          const insert = (pageId: string, title: string) => {
            editor
              .chain()
              .focus()
              .insertContentAt(range, [
                { type: 'pageLink', attrs: { pageId, title } },
                { type: 'text', text: ' ' }
              ])
              .run()
            announce(title)
          }
          if (choice.kind === 'page') insert(choice.page.id, choice.page.title)
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
    ]
  }
})

type LinkListProps = SuggestionProps<LinkChoice, LinkChoice>

interface ListHandle {
  onKeyDown: (event: KeyboardEvent) => boolean
}

const keyOf = (choice: LinkChoice) => (choice.kind === 'page' ? choice.page.id : `crear:${choice.title}`)

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
            onMouseDown={(event) => {
              event.preventDefault()
              command(choice)
            }}
          >
            {choice.kind === 'page' ? (
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
