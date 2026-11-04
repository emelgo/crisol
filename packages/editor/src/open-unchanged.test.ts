// @vitest-environment happy-dom

import { Editor } from '@tiptap/core'
import { afterEach, describe, expect, it } from 'vitest'
import { editorExtensions } from './schema.ts'

let editor: Editor | null = null

afterEach(() => {
  editor?.destroy()
  editor = null
})

describe('abrir una página no la cambia', () => {
  it('aunque acabe en un recuadro, una tabla o un secreto, no se le añade nada al final', () => {
    const content = {
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { id: 'aaaaaaaa' }, content: [{ type: 'text', text: 'Hola.' }] },
        { type: 'secret', attrs: { id: 'bbbbbbbb', documentId: null } }
      ]
    }
    editor = new Editor({ extensions: editorExtensions(), content })
    const before = editor.getJSON()
    // Cualquier transacción (la primera sincronización, un clic): lo que añadan los complementos se vería aquí
    editor.view.dispatch(editor.state.tr.setMeta('prueba', true))
    expect(editor.getJSON()).toEqual(before)
    expect(editor.getJSON().content?.map((block) => block.type)).toEqual(['paragraph', 'secret'])
  })
})
