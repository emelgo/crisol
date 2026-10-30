import { describe, expect, it } from 'vitest'
import { sectionsOf } from './text.ts'

const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const h = (id: string, text: string) => ({
  type: 'heading',
  attrs: { id, level: 2 },
  content: [{ type: 'text', text }]
})

describe('las secciones de un documento, para buscar', () => {
  it('lo de antes del primer título y lo de debajo de cada uno, con su id', () => {
    const doc = {
      type: 'doc',
      content: [
        p('La última ciudad libre.'),
        h('h1aaaaaa', 'Historia'),
        p('Fundada por los elfos.'),
        { type: 'bulletList', content: [{ type: 'listItem', content: [p('Y luego el faro.')] }] },
        h('h2aaaaaa', 'Vacío'),
        h('h3aaaaaa', 'Gente'),
        p('Maela Varn.')
      ]
    }
    expect(sectionsOf(doc)).toEqual([
      { heading: null, headingId: null, body: 'La última ciudad libre.' },
      { heading: 'Historia', headingId: 'h1aaaaaa', body: 'Fundada por los elfos.\nY luego el faro.' },
      { heading: 'Vacío', headingId: 'h2aaaaaa', body: '' },
      { heading: 'Gente', headingId: 'h3aaaaaa', body: 'Maela Varn.' }
    ])
  })

  it('un documento vacío no tiene secciones; el pie de una imagen cuenta', () => {
    expect(sectionsOf({ type: 'doc', content: [{ type: 'paragraph' }] })).toEqual([])
    const image = { type: 'fileEmbed', attrs: { name: 'mapa.png', caption: 'El continente' } }
    expect(sectionsOf({ type: 'doc', content: [image] })).toEqual([
      { heading: null, headingId: null, body: 'El continente' }
    ])
  })
})
