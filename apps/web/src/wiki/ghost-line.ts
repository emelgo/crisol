/**
 * La línea de más: debajo de lo último escrito hay siempre una línea vacía para seguir, sin pulsar Intro. No es del
 * documento (abrir una página no la cambia): es una marca que, al pulsarla (o al bajar con la flecha desde el final),
 * se convierte en un párrafo de verdad. Al escribir en él, aparece la siguiente (pulsar más abajo lleva al final, como siempre)
 */
import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, Selection, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'

export const GHOST_LINE = 'data-ghost-line'

/** Si al documento le falta la línea de más: si no acaba ya en un párrafo vacío */
export function needsGhostLine(doc: PMNode) {
  const last = doc.lastChild
  return !(last && last.type.name === 'paragraph' && last.content.size === 0)
}

/** Convierte la línea de más en un párrafo de verdad, con el cursor en él */
export function addLine(view: EditorView) {
  const { state } = view
  const paragraph = state.schema.nodes.paragraph
  if (!paragraph) return
  const end = state.doc.content.size
  const tr = state.tr.insert(end, paragraph.create())
  tr.setSelection(TextSelection.create(tr.doc, end + 1))
  view.dispatch(tr.scrollIntoView())
  view.focus()
}

export const GhostLine = Extension.create<{ className: string }>({
  name: 'ghostLine',
  addOptions: () => ({ className: '' }),
  addProseMirrorPlugins() {
    const { className } = this.options
    const editor = this.editor
    return [
      new Plugin({
        props: {
          decorations: (state) => {
            if (!editor.isEditable || !needsGhostLine(state.doc)) return null
            const widget = Decoration.widget(
              state.doc.content.size,
              (view) => {
                const line = document.createElement('div')
                line.className = className
                line.setAttribute(GHOST_LINE, '')
                line.setAttribute('aria-hidden', 'true')
                line.contentEditable = 'false'
                line.addEventListener('mousedown', (event) => {
                  event.preventDefault()
                  addLine(view)
                })
                return line
              },
              { side: 1, key: 'linea-de-mas', ignoreSelection: true }
            )
            return DecorationSet.create(state.doc, [widget])
          },
          handleKeyDown: (view, event) => {
            // Bajar con la flecha desde el final del todo lleva a la línea de más
            if (event.key !== 'ArrowDown' || !needsGhostLine(view.state.doc)) return false
            const { selection, doc } = view.state
            if (!selection.empty || selection.head !== Selection.atEnd(doc).head) return false
            addLine(view)
            return true
          }
        }
      })
    ]
  }
})
