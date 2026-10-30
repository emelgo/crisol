import { editorSchema } from '@crisol/editor'
import { describe, expect, it } from 'vitest'
import { findMatches } from './find-in-page.tsx'

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
