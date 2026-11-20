/**
 * Un enlace a otra página de la wiki, o a una sección o un bloque suyos, por su id. Sin resolver (la página aún no
 * existe), solo con el título: se resuelve cuando aparece. Enseña su texto propio o el título que tenga la página en
 * cada momento (la web lo busca; aquí, el último conocido). En Markdown, `[[Título#Sección|texto]]`
 */
import { mergeAttributes, Node } from '@tiptap/core'

/**
 * `[[Título]]`, `[[Título#Sección]]`, `[[Título#^id]]`, `[[Título|texto]]` y, como en Obsidian, `[[#Sección]]` (una
 * sección de donde se escribe). Con `!` delante es incrustar (tarea 15)
 */
const LINK = /^(!?)\[\[(?!@)([^[\]\n|#]*?)(#[^[\]\n|]*)?(?:\|([^[\]\n]*))?\]\]/

export interface PageLinkAttrs {
  pageId: string | null
  title: string
  anchor: string | null
  label: string | null
}

/** El Markdown de un enlace */
export function pageLinkMarkdown({ title, anchor, label }: Pick<PageLinkAttrs, 'title' | 'anchor' | 'label'>) {
  return `[[${title}${anchor ? `#${anchor}` : ''}${label ? `|${label}` : ''}]]`
}

/** Lo que se lee de un elemento (sin depender de los tipos del DOM, que este paquete no carga) */
type Element = { getAttribute(name: string): string | null; textContent: string | null }

const attribute = (name: string) => ({
  default: null,
  parseHTML: (element: Element) => element.getAttribute(`data-${name}`),
  renderHTML: (attributes: Record<string, unknown>) =>
    attributes[name] ? { [`data-${name}`]: String(attributes[name]) } : {}
})

export const PageLink = Node.create({
  name: 'pageLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({
    pageId: {
      ...attribute('page'),
      renderHTML: (a: Record<string, unknown>) => (a.pageId ? { 'data-page': a.pageId } : {})
    },
    title: {
      default: '',
      parseHTML: (element: Element) => element.getAttribute('data-title') ?? element.textContent ?? '',
      renderHTML: (attributes: Record<string, unknown>) => ({ 'data-title': String(attributes.title ?? '') })
    },
    anchor: attribute('anchor'),
    label: attribute('label')
  }),
  parseHTML: () => [{ tag: 'a[data-page-link]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'a',
    mergeAttributes({ 'data-page-link': '' }, HTMLAttributes),
    String(node.attrs.label || node.attrs.title)
  ],
  renderText: ({ node }) => String(node.attrs.label || node.attrs.title),
  markdownTokenizer: {
    name: 'pageLink',
    level: 'inline',
    start: (src) => src.search(/!?\[\[/),
    tokenize: (src) => {
      const match = LINK.exec(src)
      // Sin título, solo con su sección
      if (!match || (!match[2]?.trim() && !match[3]?.slice(1).trim())) return undefined
      return {
        type: 'pageLink',
        raw: match[0],
        embed: match[1] === '!',
        title: (match[2] ?? '').trim(),
        anchor: match[3] ? match[3].slice(1).trim() || null : null,
        label: match[4]?.trim() || null
      }
    }
  },
  // Lo incrustado aún no tiene su nodo: se queda como texto, tal cual
  parseMarkdown: (token, helpers) =>
    token.embed
      ? helpers.createTextNode(token.raw ?? '')
      : helpers.createNode('pageLink', {
          pageId: null,
          title: token.title ?? '',
          anchor: token.anchor ?? null,
          label: token.label ?? null
        }),
  renderMarkdown: (node) =>
    pageLinkMarkdown({
      title: String(node.attrs?.title ?? ''),
      anchor: (node.attrs?.anchor as string | null) ?? null,
      label: (node.attrs?.label as string | null) ?? null
    })
})
