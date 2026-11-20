/**
 * Un enlace desde una página a una entrada del compendio (docs/specs/criaturas.md § wiki): la criatura de un PNJ, un
 * objeto, un conjuro. Por su nombre, que se busca en el compendio del mundo y en los de los sistemas de sus campañas
 * (lo del mundo, primero). En Markdown, `[[@Goblin jefe]]` o `[[@Goblin jefe|el jefe]]`; para lo que se llama igual,
 * con su tipo delante (`[[@objeto/Escudo]]`) o por su clave (`[[@escudo-armadura]]`, ADR-0033)
 */
import { mergeAttributes, Node } from '@tiptap/core'

const CONTENT_LINK = /^\[\[@([^[\]\n|]+?)(?:\|([^[\]\n]*))?\]\]/

export interface ContentLinkAttrs {
  name: string
  label: string | null
}

/** El Markdown de un enlace a una entrada del compendio */
export function contentLinkMarkdown({ name, label }: ContentLinkAttrs) {
  return `[[@${name}${label ? `|${label}` : ''}]]`
}

type Element = { getAttribute(name: string): string | null; textContent: string | null }

export const ContentLink = Node.create({
  name: 'contentLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({
    name: {
      default: '',
      parseHTML: (element: Element) => element.getAttribute('data-name') ?? element.textContent ?? '',
      renderHTML: (attributes: Record<string, unknown>) => ({ 'data-name': String(attributes.name ?? '') })
    },
    label: {
      default: null,
      parseHTML: (element: Element) => element.getAttribute('data-label'),
      renderHTML: (attributes: Record<string, unknown>) =>
        attributes.label ? { 'data-label': String(attributes.label) } : {}
    }
  }),
  parseHTML: () => [{ tag: 'a[data-content-link]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'a',
    mergeAttributes({ 'data-content-link': '' }, HTMLAttributes),
    String(node.attrs.label || node.attrs.name)
  ],
  renderText: ({ node }) => String(node.attrs.label || node.attrs.name),
  markdownTokenizer: {
    name: 'contentLink',
    level: 'inline',
    start: (src) => src.search(/\[\[@/),
    tokenize: (src) => {
      const match = CONTENT_LINK.exec(src)
      if (!match) return undefined
      return { type: 'contentLink', raw: match[0], name: (match[1] ?? '').trim(), label: match[2]?.trim() || null }
    }
  },
  parseMarkdown: (token, helpers) =>
    helpers.createNode('contentLink', { name: token.name ?? '', label: token.label ?? null }),
  renderMarkdown: (node) =>
    contentLinkMarkdown({
      name: String(node.attrs?.name ?? ''),
      label: (node.attrs?.label as string | null) ?? null
    })
})
