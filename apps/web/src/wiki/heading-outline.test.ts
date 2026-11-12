import { editorExtensions } from '@crisol/editor'
import { Editor } from '@tiptap/core'
import { afterEach, describe, expect, it } from 'vitest'
import { HeadingOutline } from './heading-outline.ts'

let editor: Editor | null = null

const open = (content: string) => {
  const element = document.createElement('div')
  document.body.append(element)
  editor = new Editor({ element, extensions: [...editorExtensions(), HeadingOutline], content })
  return editor
}

/** Cada título: su etiqueta y el nivel que oye el lector de pantalla */
const outline = (e: Editor) =>
  [...e.view.dom.querySelectorAll('h1, h2, h3, h4, h5, h6')].map(
    (h) => `${h.tagName.toLowerCase()}:${h.getAttribute('aria-level') ?? h.tagName.slice(1)}`
  )

afterEach(() => {
  editor?.destroy()
  editor = null
  document.body.innerHTML = ''
})

describe('los niveles de los títulos', () => {
  it('sin saltos tras el título de la página (h1): quien empieza por «##» oye un nivel 2', () => {
    // «## Guarida» se pinta como h3 (el título de la página es el h1): sin «#» antes, sería un salto de h1 a h3
    const e = open('<h3>Guarida</h3><p>En la cima.</p><h4>La cueva</h4><h3>El valle</h3>')
    expect(outline(e)).toEqual(['h3:2', 'h4:3', 'h3:2'])
  })

  it('con los títulos en orden no cambia nada', () => {
    expect(outline(open('<h2>Puerto Ceniza</h2><h3>Segunda parte</h3>'))).toEqual(['h2:2', 'h3:3'])
  })

  it('se recalcula al escribir', () => {
    const e = open('<h3>Guarida</h3>')
    e.commands.insertContentAt(0, '<h2>La costa</h2>')
    expect(outline(e)).toEqual(['h2:2', 'h3:3'])
  })
})
