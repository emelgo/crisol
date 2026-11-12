// @vitest-environment happy-dom
import { Editor } from '@tiptap/core'
import { afterEach, describe, expect, it } from 'vitest'
import { editorExtensions } from '../schema.ts'

const editors: Editor[] = []
const editor = (content: string | object) => {
  const made = new Editor({ extensions: editorExtensions(), content })
  editors.push(made)
  return made
}

afterEach(() => {
  for (const made of editors.splice(0)) made.destroy()
})

describe('la ficha de una entrada incrustada, en HTML (copiar y pegar en el editor)', () => {
  it('lleva su nombre y, si se eligió, su sistema', () => {
    const html = editor({
      type: 'doc',
      content: [
        { type: 'contentEmbed', attrs: { name: 'Goblin jefe', system: 'sys-1' } },
        { type: 'contentEmbed', attrs: { name: 'Orco', system: null } }
      ]
    }).getHTML()
    expect(html).toContain('<div data-content-embed="" data-name="Goblin jefe" data-system="sys-1"></div>')
    expect(html).toContain('<div data-content-embed="" data-name="Orco"></div>')
  })

  it('al leerla de vuelta recupera su nombre y su sistema; sin ellos, vacío y sin sistema', () => {
    const blocks = editor(
      '<div data-content-embed data-name="Goblin jefe" data-system="sys-1"></div><div data-content-embed></div>'
    )
      .getJSON()
      .content?.filter((block) => block.type === 'contentEmbed')
    expect(blocks?.map((block) => block.attrs)).toMatchObject([
      { name: 'Goblin jefe', system: 'sys-1' },
      { name: '', system: null }
    ])
  })
})
