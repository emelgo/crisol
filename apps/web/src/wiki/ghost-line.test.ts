import { editorExtensions } from '@crisol/editor'
import { Editor } from '@tiptap/core'
import { Selection } from '@tiptap/pm/state'
import { afterEach, describe, expect, it } from 'vitest'
import { GHOST_LINE, GhostLine, needsGhostLine } from './ghost-line.ts'

let editor: Editor | null = null

const open = (content: string, editable = true) => {
  const element = document.createElement('div')
  document.body.append(element)
  editor = new Editor({
    element,
    editable,
    extensions: [...editorExtensions(), GhostLine.configure({ className: 'linea' })],
    content
  })
  return editor
}

const ghost = (e: Editor) => e.view.dom.querySelector<HTMLElement>(`[${GHOST_LINE}]`)
const keyDown = (e: Editor, key: string) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  return e.view.someProp('handleKeyDown', (handle) => handle(e.view, event)) ?? false
}

afterEach(() => {
  editor?.destroy()
  editor = null
  document.body.innerHTML = ''
})

describe('la línea de más', () => {
  it('falta si el texto no acaba en un párrafo vacío', () => {
    expect(needsGhostLine(open('<p>Hola</p>').state.doc)).toBe(true)
    editor?.destroy()
    expect(needsGhostLine(open('<p>Hola</p><p></p>').state.doc)).toBe(false)
    editor?.destroy()
    expect(needsGhostLine(open('<h2>Título</h2>').state.doc)).toBe(true)
  })

  it('sale debajo de lo escrito, oculta a los lectores y con su clase, sin cambiar el documento', () => {
    const e = open('<p>Hola</p>')
    const line = ghost(e)
    expect(line).not.toBeNull()
    expect(line?.classList.contains('linea')).toBe(true)
    expect(line?.getAttribute('aria-hidden')).toBe('true')
    expect(line?.contentEditable).toBe('false')
    expect(e.state.doc.childCount).toBe(1)
  })

  it('no sale si ya hay una línea vacía al final, ni en lectura', () => {
    expect(ghost(open('<p>Hola</p><p></p>'))).toBeNull()
    editor?.destroy()
    expect(ghost(open('<p>Hola</p>', false))).toBeNull()
  })

  it('al pulsarla se convierte en un párrafo de verdad con el cursor en él', () => {
    const e = open('<p>Hola</p>')
    const line = ghost(e)
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    line?.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(e.state.doc.childCount).toBe(2)
    expect(e.state.doc.lastChild?.type.name).toBe('paragraph')
    expect(e.state.doc.lastChild?.content.size).toBe(0)
    expect(e.state.selection.from).toBe(e.state.doc.content.size - 1)
    // Ya acaba en una vacía: no hay otra
    expect(ghost(e)).toBeNull()
  })

  it('bajar con la flecha desde el final lleva a ella; desde otro sitio, no', () => {
    const e = open('<p>Uno</p><p>Dos</p>')
    // El cursor al principio: la flecha hace lo de siempre
    e.commands.setTextSelection(1)
    expect(keyDown(e, 'ArrowDown')).toBe(false)
    expect(e.state.doc.childCount).toBe(2)
    // Otra tecla, tampoco
    e.commands.setTextSelection(e.state.doc.content.size - 1)
    expect(keyDown(e, 'ArrowUp')).toBe(false)
    // Con texto elegido, tampoco
    e.commands.setTextSelection({ from: 6, to: 8 })
    expect(keyDown(e, 'ArrowDown')).toBe(false)
    // Al final del todo, sí
    e.commands.setTextSelection(e.state.doc.content.size - 1)
    expect(keyDown(e, 'ArrowDown')).toBe(true)
    expect(e.state.doc.childCount).toBe(3)
    // Ya está la vacía al final: otra vez abajo no añade más
    expect(keyDown(e, 'ArrowDown')).toBe(false)
    expect(e.state.doc.childCount).toBe(3)
  })

  it('Intro al final del todo, si lo último es un bloque sin texto (una imagen, un secreto), abre una línea después', () => {
    const e = open('')
    e.commands.setContent({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] },
        { type: 'secret', attrs: { id: 'bbbbbbbb', documentId: null } }
      ]
    })
    // Como Ctrl+Fin: el final del documento, que es el bloque
    e.view.dispatch(e.state.tr.setSelection(Selection.atEnd(e.state.doc)))
    expect(keyDown(e, 'Enter')).toBe(true)
    expect(e.state.doc.childCount).toBe(3)
    expect(e.state.doc.child(1).type.name).toBe('secret')
    expect(e.state.doc.lastChild?.type.name).toBe('paragraph')
    expect(e.state.selection.from).toBe(e.state.doc.content.size - 1)
  })
})
