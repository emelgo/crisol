/** La caja: un marco con bloques dentro, sin rótulo. En Markdown, `> [!caja]` (tarea 10) */
import { mergeAttributes, Node } from '@tiptap/core'
import { calloutTokenizer, renderCallout } from '../markdown/syntax.ts'

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
  // En Markdown: `> [!caja]`
  markdownTokenizer: calloutTokenizer('box', (type) => (type === 'caja' || type === 'box' ? {} : null)),
  parseMarkdown: (token, helpers) =>
    helpers.createNode('box', {}, (helpers.parseBlockChildren ?? helpers.parseChildren)(token.tokens ?? [])),
  renderMarkdown: (node, helpers) => renderCallout('caja', node, helpers),
  addCommands() {
    return {
      setBox:
        () =>
        ({ commands }) =>
          commands.wrapIn(this.name)
    }
  }
})
