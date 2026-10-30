/**
 * Los bloques de hoja (spec § `hojas`): saltos de página y de columna, el statblock, la nota lateral, «a lo ancho» para
 * varios bloques y el índice. En la vista sencilla se ven discretos; en la de hoja, como hoja. Cada uno con su Markdown
 */
import { mergeAttributes, Node } from '@tiptap/core'
import { calloutTokenizer, renderCallout } from '../markdown/syntax.ts'
import { wideAttribute } from './wide.ts'

/** Un salto (de página o de columna): una línea `<div class="…"></div>`, como en Homebrewery */
function sheetBreak(name: 'pageBreak' | 'columnBreak', className: string) {
  const line = new RegExp(`^<div class="${className}"></div>[ \\t]*(?:\\n|$)`)
  return Node.create({
    name,
    group: 'block',
    atom: true,
    selectable: true,
    draggable: true,
    parseHTML: () => [{ tag: `div[data-${className}]` }],
    renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes({ [`data-${className}`]: '' }, HTMLAttributes)],
    markdownTokenizer: {
      name,
      level: 'block',
      start: (src) => src.search(new RegExp(`^<div class="${className}">`, 'm')),
      tokenize: (src) => {
        const match = line.exec(src)
        return match ? { type: name, raw: match[0] } : undefined
      }
    },
    parseMarkdown: (_token, helpers) => helpers.createNode(name),
    renderMarkdown: () => `<div class="${className}"></div>`
  })
}

export const PageBreak = sheetBreak('pageBreak', 'salto-pagina')
export const ColumnBreak = sheetBreak('columnBreak', 'salto-columna')

/** Un statblock: un marco con contenido libre que no se parte (los datos de criatura llegan en el módulo 4) */
export const Statblock = Node.create({
  name: 'statblock',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes: () => ({ ...wideAttribute }),
  parseHTML: () => [{ tag: 'div[data-statblock]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes({ 'data-statblock': '' }, HTMLAttributes), 0],
  markdownTokenizer: calloutTokenizer('statblock', (type, options) =>
    type === 'statblock' ? { wide: options.includes('ancho') } : null
  ),
  parseMarkdown: (token, helpers) =>
    helpers.createNode(
      'statblock',
      { wide: token.attrs?.wide ?? false },
      (helpers.parseBlockChildren ?? helpers.parseChildren)(token.tokens ?? [])
    ),
  renderMarkdown: (node, helpers) => renderCallout('statblock', node, helpers, node.attrs?.wide ? ['ancho'] : [])
})

export type SidenoteSide = 'right' | 'left'

/** La nota lateral: en la hoja, un recuadro estrecho en un lado de la columna, con el texto alrededor */
export const Sidenote = Node.create({
  name: 'sidenote',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes: () => ({
    side: {
      default: 'right',
      parseHTML: (element: { getAttribute(name: string): string | null }) =>
        element.getAttribute('data-side') === 'left' ? 'left' : 'right',
      renderHTML: (attributes: Record<string, unknown>) => ({ 'data-side': attributes.side })
    }
  }),
  parseHTML: () => [{ tag: 'aside[data-sidenote]' }],
  renderHTML: ({ HTMLAttributes }) => ['aside', mergeAttributes({ 'data-sidenote': '' }, HTMLAttributes), 0],
  markdownTokenizer: calloutTokenizer('sidenote', (type, options) =>
    type === 'lateral' ? { side: options.includes('izquierda') ? 'left' : 'right' } : null
  ),
  parseMarkdown: (token, helpers) =>
    helpers.createNode(
      'sidenote',
      { side: token.attrs?.side ?? 'right' },
      (helpers.parseBlockChildren ?? helpers.parseChildren)(token.tokens ?? [])
    ),
  renderMarkdown: (node, helpers) =>
    renderCallout('lateral', node, helpers, node.attrs?.side === 'left' ? ['izquierda'] : [])
})

/** «A lo ancho» para varios bloques (una tabla, una imagen…): en la hoja ocupan las dos columnas */
export const WideBlock = Node.create({
  name: 'wideBlock',
  group: 'block',
  content: 'block+',
  defining: true,
  parseHTML: () => [{ tag: 'div[data-wide-block]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes({ 'data-wide-block': '' }, HTMLAttributes), 0],
  markdownTokenizer: calloutTokenizer('wideBlock', (type) => (type === 'ancho' ? {} : null)),
  parseMarkdown: (token, helpers) =>
    helpers.createNode('wideBlock', {}, (helpers.parseBlockChildren ?? helpers.parseChildren)(token.tokens ?? [])),
  renderMarkdown: (node, helpers) => renderCallout('ancho', node, helpers)
})

/**
 * El índice de contenidos: no guarda nada, se hace con los títulos de la página cada vez que se pinta (en la hoja, con
 * su número de página). En Markdown, `> [!indice]`; lo que traiga dentro al leerlo se descarta
 */
export const TableOfContents = Node.create({
  name: 'tableOfContents',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  parseHTML: () => [{ tag: 'nav[data-toc]' }],
  renderHTML: ({ HTMLAttributes }) => ['nav', mergeAttributes({ 'data-toc': '' }, HTMLAttributes)],
  markdownTokenizer: calloutTokenizer('tableOfContents', (type) =>
    type === 'indice' || type === 'índice' ? {} : null
  ),
  parseMarkdown: (_token, helpers) => helpers.createNode('tableOfContents'),
  renderMarkdown: () => '> [!indice]'
})
