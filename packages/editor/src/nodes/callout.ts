/**
 * Los recuadros (callouts): nota, consejo, aviso, peligro y leer en voz alta. Llevan bloques dentro. En Markdown son
 * `> [!aviso]` (tarea 10); aquí, el tipo en inglés
 */
import { mergeAttributes, Node } from '@tiptap/core'
import { CALLOUT_MARKDOWN, calloutKindOf, calloutTokenizer, renderCallout } from '../markdown/syntax.ts'
import { type CalloutKind, isCalloutKind } from './callout-kinds.ts'
import { wideAttribute } from './wide.ts'

export { CALLOUT_KINDS, type CalloutKind, isCalloutKind } from './callout-kinds.ts'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      /** Mete lo elegido en un recuadro, o cambia el tipo del recuadro en el que está */
      setCallout: (kind: CalloutKind) => ReturnType
    }
  }
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes: () => ({
    kind: {
      default: 'note',
      parseHTML: (element) => {
        const kind = element.getAttribute('data-callout')
        return isCalloutKind(kind) ? kind : 'note'
      },
      renderHTML: (attributes) => ({ 'data-callout': attributes.kind })
    },
    ...wideAttribute
  }),
  parseHTML: () => [{ tag: 'div[data-callout]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes), 0],
  // En Markdown: `> [!aviso]`
  markdownTokenizer: calloutTokenizer('callout', (type, options) => {
    const kind = calloutKindOf(type)
    return kind ? { kind, wide: options.includes('ancho') } : null
  }),
  parseMarkdown: (token, helpers) =>
    helpers.createNode(
      'callout',
      { kind: token.attrs?.kind ?? 'note', wide: token.attrs?.wide ?? false },
      (helpers.parseBlockChildren ?? helpers.parseChildren)(token.tokens ?? [])
    ),
  renderMarkdown: (node, helpers) =>
    renderCallout(
      CALLOUT_MARKDOWN[node.attrs?.kind as CalloutKind] ?? 'nota',
      node,
      helpers,
      node.attrs?.wide ? ['ancho'] : []
    ),
  addCommands() {
    return {
      setCallout:
        (kind) =>
        ({ editor, commands }) =>
          editor.isActive(this.name)
            ? commands.updateAttributes(this.name, { kind })
            : commands.wrapIn(this.name, { kind })
    }
  }
})
