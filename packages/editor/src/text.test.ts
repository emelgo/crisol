import { describe, expect, it } from 'vitest'
import { findName, fragmentAround, plainText, separateHeadings, textBlocks } from './text.ts'

const doc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Historia' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'La gobierna ' },
        { type: 'pageLink', attrs: { pageId: 'p1', title: 'Maela Varn', label: null } },
        { type: 'text', text: '.' }
      ]
    },
    {
      type: 'bulletList',
      content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Marea alta' }] }] }]
    },
    { type: 'paragraph' }
  ]
}

describe('el texto de un documento', () => {
  it('un bloque por línea; un enlace cuenta con lo que enseña', () => {
    expect(plainText(doc)).toBe('Historia\nLa gobierna Maela Varn.\nMarea alta')
    expect(textBlocks(doc)[1]).toEqual({ text: 'La gobierna Maela Varn.', links: ['p1'] })
  })

  it('un nombre como palabra entera, sin mayúsculas; dentro de otra palabra no cuenta', () => {
    expect(findName('Llegó al Puerto Ceniza de noche', 'puerto ceniza')).toBe(9)
    expect(findName('Marea alta', 'Mar')).toBe(-1)
    expect(findName('El mar, la mar', 'Mar')).toBe(3)
    expect(findName('', 'x')).toBe(-1)
  })

  it('un fragmento alrededor, con «…» si corta', () => {
    const text = `${'a'.repeat(200)} Maela ${'b'.repeat(200)}`
    const fragment = fragmentAround(text, 201, 5, 40)
    expect(fragment.startsWith('…')).toBe(true)
    expect(fragment.endsWith('…')).toBe(true)
    expect(fragment).toContain('Maela')
    expect(fragmentAround('corto', 0)).toBe('corto')
  })
})

describe('dónde está cada secreto', () => {
  const heading = (id: string, text: string) => ({
    type: 'heading',
    attrs: { id, level: 2 },
    content: [{ type: 'text', text }]
  })
  const secret = (documentId: string) => ({ type: 'secret', attrs: { id: `b-${documentId}`, documentId } })

  it('el título de la sección del cuerpo que lo tiene, también dentro de otro bloque; antes del primero, ninguno', () => {
    const doc = {
      type: 'doc',
      content: [
        secret('d0'),
        heading('h1', 'Guaridas'),
        { type: 'paragraph', content: [{ type: 'text', text: 'Cuevas.' }] },
        secret('d1'),
        heading('h2', 'Historia'),
        { type: 'box', content: [secret('d2'), { type: 'note', attrs: { id: 'n', documentId: 'd3' } }] }
      ]
    }
    expect(Object.fromEntries(separateHeadings(doc))).toEqual({
      d0: { heading: null, headingId: null },
      d1: { heading: 'Guaridas', headingId: 'h1' },
      d2: { heading: 'Historia', headingId: 'h2' },
      d3: { heading: 'Historia', headingId: 'h2' }
    })
  })
})
