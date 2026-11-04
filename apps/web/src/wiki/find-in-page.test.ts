import { editorSchema } from '@crisol/editor'
import { describe, expect, it } from 'vitest'
import { findMatches, mergeMatches } from './find-in-page.tsx'

const schema = editorSchema()
const doc = schema.nodeFromJSON({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'El ' },
        { type: 'text', text: 'Dragón', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' rojo y el dragon azul.' }
      ]
    },
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'DRAGONES' }] }
  ]
})

describe('buscar en la página', () => {
  it('sin tildes ni mayúsculas, también a través de las marcas, con su sitio en el documento', () => {
    const found = findMatches(doc, 'dragon')
    expect(found).toHaveLength(3)
    expect(found.map((m) => doc.textBetween(m.from, m.to))).toEqual(['Dragón', 'dragon', 'DRAGON'])
    expect(findMatches(doc, 'n ro').map((m) => doc.textBetween(m.from, m.to))).toEqual(['n ro'])
    expect(findMatches(doc, '   ')).toEqual([])
  })
})

describe('buscar en la página: enlaces y secretos', () => {
  it('un enlace a una página cuenta con el texto que enseña', () => {
    const withLink = schema.nodeFromJSON({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Ve a ' },
            { type: 'pageLink', attrs: { pageId: null, title: 'Puerto Ceniza', label: null } },
            { type: 'pageLink', attrs: { pageId: null, title: 'Costa', label: 'la ceniza gris' } }
          ]
        }
      ]
    })
    const found = findMatches(withLink, 'ceniza')
    expect(found).toHaveLength(2)
    // Lo encontrado abarca el enlace entero
    expect(found.map((m) => withLink.nodeAt(m.from)?.type.name)).toEqual(['pageLink', 'pageLink'])
  })

  it('lo de los secretos va en su sitio del cuerpo, en orden', () => {
    const order = mergeMatches(
      [
        { from: 3, to: 5 },
        { from: 40, to: 44 }
      ],
      [
        { at: 20, count: 2 },
        { at: 60, count: 1 }
      ]
    )
    expect(order).toEqual([
      { source: -1, index: 0 },
      { source: 0, index: 0 },
      { source: 0, index: 1 },
      { source: -1, index: 1 },
      { source: 1, index: 0 }
    ])
  })
})
