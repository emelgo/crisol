/**
 * Una página incrustada (o una sección o un bloque suyos), en solo lectura y con enlace a su origen. Solo guarda a qué
 * apunta: lo de dentro lo da la API, nunca el documento del otro. En Markdown, `![[Título#Sección]]` en su línea
 */
import { mergeAttributes, Node } from '@tiptap/core'
import { isFileName } from './file-embed.ts'

const EMBED = /^!\[\[([^[\]\n|#]+?)(#[^[\]\n|]*)?\]\][ \t]*(?:\n|$)/

/** Lo que se lee de un elemento (sin depender de los tipos del DOM, que este paquete no carga) */
type Element = { getAttribute(name: string): string | null }

export const PageEmbed = Node.create({
  name: 'pageEmbed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes: () => ({
    pageId: {
      default: null,
      parseHTML: (element: Element) => element.getAttribute('data-page'),
      renderHTML: (attributes: Record<string, unknown>) => (attributes.pageId ? { 'data-page': attributes.pageId } : {})
    },
    title: {
      default: '',
      parseHTML: (element: Element) => element.getAttribute('data-title') ?? '',
      renderHTML: (attributes: Record<string, unknown>) => ({ 'data-title': String(attributes.title ?? '') })
    },
    anchor: {
      default: null,
      parseHTML: (element: Element) => element.getAttribute('data-anchor'),
      renderHTML: (attributes: Record<string, unknown>) =>
        attributes.anchor ? { 'data-anchor': attributes.anchor } : {}
    }
  }),
  parseHTML: () => [{ tag: 'div[data-page-embed]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes({ 'data-page-embed': '' }, HTMLAttributes)],
  markdownTokenizer: {
    name: 'pageEmbed',
    level: 'block',
    start: (src) => src.search(/^!\[\[/m),
    tokenize: (src) => {
      const match = EMBED.exec(src)
      // Un nombre con extensión de archivo es un archivo (fileEmbed), no una página; con «@», una ficha (contentEmbed)
      if (!match || isFileName(match[1] ?? '') || (match[1] ?? '').trimStart().startsWith('@')) return undefined
      return {
        type: 'pageEmbed',
        raw: match[0],
        title: (match[1] ?? '').trim(),
        anchor: match[2] ? match[2].slice(1).trim() || null : null
      }
    }
  },
  parseMarkdown: (token, helpers) =>
    helpers.createNode('pageEmbed', { pageId: null, title: token.title ?? '', anchor: token.anchor ?? null }),
  renderMarkdown: (node) => {
    const anchor = node.attrs?.anchor ? `#${String(node.attrs.anchor)}` : ''
    return `![[${String(node.attrs?.title ?? '')}${anchor}]]`
  }
})
