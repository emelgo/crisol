/**
 * Los secretos y las notas ocultas: bloques cuyo texto vive en su propio documento de Yjs (ADR-0003). El cuerpo de la
 * página solo guarda el id de ese documento: así el texto nunca va con lo demás y el módulo 5 podrá dárselo a quien
 * toque. copyOf: al pegar, el documento del que hay que hacer una copia (lo hace la pestaña que pegó, copyBy)
 */
import { mergeAttributes, Node } from '@tiptap/core'

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
    renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes({ 'data-type': name }, HTMLAttributes)]
  })
}

export const Secret = separateBlock('secret')
export const HiddenNote = separateBlock('note')
export const SEPARATE_KINDS: readonly SeparateKind[] = ['secret', 'note']
