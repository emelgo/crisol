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

/**
 * Un cambio de columnas, como un salto de sección: lo que va debajo, a una o a dos columnas, hasta el siguiente. En
 * Markdown, `<div class="columnas-1"></div>` o `<div class="columnas-2"></div>`
 */
const columnsLine = /^<div class="columnas-([12])"><\/div>[ \t]*(?:\n|$)/
export const ColumnsChange = Node.create({
  name: 'columnsChange',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes: () => ({
    count: {
      default: 2,
      parseHTML: (element) => (element.getAttribute('data-columnas') === '1' ? 1 : 2),
      renderHTML: (attributes) => ({ 'data-columnas': String(attributes.count) })
    }
  }),
  parseHTML: () => [{ tag: 'div[data-columnas]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes)],
  markdownTokenizer: {
    name: 'columnsChange',
    level: 'block',
    start: (src) => src.search(/^<div class="columnas-[12]">/m),
    tokenize: (src) => {
      const match = columnsLine.exec(src)
      return match ? { type: 'columnsChange', raw: match[0], attrs: { count: Number(match[1]) } } : undefined
    }
  },
  parseMarkdown: (token, helpers) =>
    helpers.createNode('columnsChange', {
      count: (token as { attrs?: { count?: number } }).attrs?.count === 1 ? 1 : 2
    }),
  renderMarkdown: (node) => `<div class="columnas-${node.attrs?.count === 1 ? 1 : 2}"></div>`
})

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
