/**
 * La ficha de una entrada del compendio incrustada en una página o en un capítulo (revisión, tanda 7): además del
 * enlace `[[@Nombre]]`, `![[@Nombre]]` en su línea. Solo guarda su nombre (y, si se eligió al ponerla, de qué
 * sistema): la ficha la da la API con lo que ve quien lee, nunca el documento (una jugadora solo la ve si su campaña
 * ve esa entrada)
 */
import { mergeAttributes, Node } from '@tiptap/core'

const EMBED = /^!\[\[@([^[\]\n|#]+?)\]\][ \t]*(?:\n|$)/

/** Lo que se lee de un elemento (sin depender de los tipos del DOM, que este paquete no carga) */
type Element = { getAttribute(name: string): string | null }

/** En Markdown: sin corchetes, barras ni almohadillas en el nombre (cerrarían o partirían la ficha) */
export function contentEmbedMarkdown(name: string) {
  return `![[@${name.replace(/[[\]|#\n]/g, '').trim()}]]`
}

export const ContentEmbed = Node.create({
  name: 'contentEmbed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes: () => ({
    name: {
      default: '',
      parseHTML: (element: Element) => element.getAttribute('data-name') ?? '',
      renderHTML: (attributes: Record<string, unknown>) => ({ 'data-name': String(attributes.name ?? '') })
    },
    // El sistema elegido al ponerla, si el mundo tiene varios (no va al Markdown: allí, el nombre)
    system: {
      default: null,
      parseHTML: (element: Element) => element.getAttribute('data-system'),
      renderHTML: (attributes: Record<string, unknown>) =>
        attributes.system ? { 'data-system': String(attributes.system) } : {}
    }
  }),
  parseHTML: () => [{ tag: 'div[data-content-embed]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes({ 'data-content-embed': '' }, HTMLAttributes)],
  // Antes que la página incrustada (se registra después: marked prueba primero lo último)
  markdownTokenizer: {
    name: 'contentEmbed',
    level: 'block',
    start: (src) => src.search(/^!\[\[@/m),
    tokenize: (src) => {
      const match = EMBED.exec(src)
      const name = (match?.[1] ?? '').trim()
      if (!match || !name) return undefined
      return { type: 'contentEmbed', raw: match[0], name }
    }
  },
  parseMarkdown: (token, helpers) => helpers.createNode('contentEmbed', { name: token.name ?? '', system: null }),
  renderMarkdown: (node) => contentEmbedMarkdown(String(node.attrs?.name ?? ''))
})
