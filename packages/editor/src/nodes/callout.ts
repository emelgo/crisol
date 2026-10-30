/**
 * Los recuadros (callouts): nota, consejo, aviso, peligro y leer en voz alta. Llevan bloques dentro. En Markdown son
 * `> [!aviso]` (tarea 10); aquí, el tipo en inglés
 */
import { mergeAttributes, Node } from '@tiptap/core'

export const CALLOUT_KINDS = ['note', 'tip', 'warning', 'danger', 'read-aloud'] as const
export type CalloutKind = (typeof CALLOUT_KINDS)[number]

export const isCalloutKind = (value: unknown): value is CalloutKind => CALLOUT_KINDS.includes(value as CalloutKind)

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
    }
  }),
  parseHTML: () => [{ tag: 'div[data-callout]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes), 0],
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
