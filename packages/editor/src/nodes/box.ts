/** La caja: un marco con bloques dentro, sin rótulo. En Markdown, `> [!caja]` (tarea 10) */
import { mergeAttributes, Node } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    box: {
      /** Mete lo elegido en una caja */
      setBox: () => ReturnType
    }
  }
}

export const Box = Node.create({
  name: 'box',
  group: 'block',
  content: 'block+',
  defining: true,
  parseHTML: () => [{ tag: 'div[data-box]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes({ 'data-box': '' }, HTMLAttributes), 0],
  addCommands() {
    return {
      setBox:
        () =>
        ({ commands }) =>
          commands.wrapIn(this.name)
    }
  }
})
