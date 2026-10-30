import { describe, expect, it } from 'vitest'
import { findName, fragmentAround, plainText, textBlocks } from './text.ts'

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
