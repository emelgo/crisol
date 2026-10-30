/**
 * Los secretos y las notas ocultas: bloques cuyo texto vive en su propio documento de Yjs (ADR-0003). El cuerpo de la
 * página solo guarda el id de ese documento: así el texto nunca va con lo demás y el módulo 5 podrá dárselo a quien
 * toque. copyOf: al pegar, el documento del que hay que hacer una copia (lo hace la pestaña que pegó, copyBy)
 */
import { mergeAttributes, Node } from '@tiptap/core'
import { calloutTokenizer, hiddenNoteTokenizer, renderCallout, renderHiddenNote } from '../markdown/syntax.ts'

export type SeparateKind = 'secret' | 'note'

function separateBlock(name: SeparateKind) {
  return Node.create({
    name,
    group: 'block',
    atom: true,
    selectable: true,
    draggable: true,
    isolating: true,
    addAttributes: () => ({
      documentId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-document'),
        renderHTML: (attributes) => ({ 'data-document': attributes.documentId })
      },
      copyOf: { default: null, rendered: false },
      copyBy: { default: null, rendered: false }
    }),
    parseHTML: () => [{ tag: `div[data-type="${name}"]` }],
    renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes({ 'data-type': name }, HTMLAttributes)],
    // En Markdown, `> [!secreto]` y la nota oculta entre `%%`. Lo de dentro no es del cuerpo: al escribir, se pone
    // antes en node.content; al leer, sale en content y se aparta (markdown/page.ts)
    markdownTokenizer:
      name === 'secret'
        ? calloutTokenizer('secret', (type) => (type === 'secreto' || type === 'secret' ? {} : null))
        : hiddenNoteTokenizer,
    parseMarkdown: (token, helpers) =>
      helpers.createNode(name, {}, (helpers.parseBlockChildren ?? helpers.parseChildren)(token.tokens ?? [])),
    renderMarkdown: (node, helpers) =>
      name === 'secret' ? renderCallout('secreto', node, helpers) : renderHiddenNote(node, helpers)
  })
}

export const Secret = separateBlock('secret')
export const HiddenNote = separateBlock('note')
export const SEPARATE_KINDS: readonly SeparateKind[] = ['secret', 'note']
