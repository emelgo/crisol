// @vitest-environment happy-dom
import { Editor } from '@tiptap/core'
import { afterEach, describe, expect, it } from 'vitest'
import { editorExtensions } from './schema.ts'

/** Pega el HTML en un editor vacío, como al pulsar Ctrl+V (los ids del primer párrafo se ponen un instante después) */
async function parse(html: string) {
  const editor = new Editor({ extensions: editorExtensions() })
  editors.push(editor)
  await new Promise((resolve) => setTimeout(resolve, 0))
  editor.view.pasteHTML(html)
  return editor
}

/** Los tipos de los bloques de arriba, sin el párrafo vacío que el editor deja siempre al final */
const blockTypes = (editor: Editor) => {
  const types = (editor.getJSON().content ?? []).map((block) => [block.type, block.attrs?.kind])
  return types.at(-1)?.[0] === 'paragraph' && !editor.state.doc.lastChild?.textContent ? types.slice(0, -1) : types
}
const editors: Editor[] = []

// happy-dom no tiene `rules`, el nombre antiguo de `cssRules` que usa ProseMirror al pegar con <style>
const sheet = (globalThis as { CSSStyleSheet?: { prototype: object } }).CSSStyleSheet
if (sheet && !('rules' in sheet.prototype)) {
  Object.defineProperty(sheet.prototype, 'rules', {
    get(this: { cssRules: unknown }) {
      return this.cssRules
    }
  })
}
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy()
})

describe('pegar HTML', () => {
  it('solo entra lo que el esquema conoce: ni scripts, ni estilos, ni marcos, ni atributos de fuera', async () => {
    const editor = await parse(`
      <style>p { color: red }</style>
      <script>alert('hola')</script>
      <h1 style="font-size: 40px" onclick="alert(1)" class="titulo">El faro</h1>
      <p><span style="color: red">La <b>Hermandad</b> lo <font face="Comic Sans">quemó</font>.</span></p>
      <object data="x.swf"></object><embed src="x.swf">
      <img src="x" onerror="alert(1)">
      <p><a href="javascript:alert(1)">Pulsa</a> o <a href="https://eana.example/mapa" onclick="x()">mira el mapa</a>.</p>
      <table><tr><th>Barrio</th><th>Peligro</th></tr><tr><td>Los Muelles</td><td>Medio</td></tr></table>
    `)
    const html = editor.getHTML()
    // (la tabla lleva su propio style de anchura mínima: es del esquema, no de lo pegado)
    expect(html).not.toMatch(
      /script|color: red|font-size|onclick|onerror|object|embed|<img|<font|Comic|class=|javascript:/
    )
    expect(html).toContain('<strong>Hermandad</strong>')
    expect(html).toContain('quemó')
    expect(html).toMatch(/<a [^>]*href="https:\/\/eana\.example\/mapa"[^>]*>mira el mapa<\/a>/)
    expect(html).toContain('Pulsa')
    expect(blockTypes(editor).map(([type]) => type)).toEqual(['heading', 'paragraph', 'paragraph', 'table'])
    expect(editor.getJSON().content?.[0]?.attrs?.level).toBe(1)
  })

  it('cada bloque recibe su id, y los ids repetidos de lo pegado se cambian', async () => {
    const editor = await parse(
      '<p data-id="aaaaaaaa">Uno</p><p data-id="aaaaaaaa">Dos</p><ul><li><p>Tres</p></li></ul>'
    )
    const ids: string[] = []
    editor.state.doc.descendants((node) => {
      if (node.attrs.id !== undefined) ids.push(node.attrs.id)
    })
    expect(ids.length).toBeGreaterThanOrEqual(5)
    expect(ids.every(Boolean)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('aaaaaaaa')
  })

  it('un recuadro y una caja pegados se reconocen; un tipo de recuadro que no existe pasa a nota', async () => {
    const editor = await parse(
      '<div data-callout="danger"><p>Arde.</p></div><div data-callout="raro"><p>¿?</p></div><div data-box><p>Caja</p></div>'
    )
    expect(blockTypes(editor)).toEqual([
      ['callout', 'danger'],
      ['callout', 'note'],
      ['box', undefined]
    ])
  })
})
