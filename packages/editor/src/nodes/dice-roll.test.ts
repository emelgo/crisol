import { getSchema } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { pageFromMarkdown, pageToMarkdown } from '../markdown/page.ts'
import { editorExtensions } from '../schema.ts'
import { plainText } from '../text.ts'

const roundTrip = (markdown: string) => {
  const read = pageFromMarkdown(markdown)
  return { read, back: pageToMarkdown({ properties: [], body: read.body, separate: () => null }) }
}

describe('una tirada escrita en el texto', () => {
  it('`dice: …` es una tirada, con su nombre, y vuelve igual', () => {
    const { read, back } = roundTrip('La trampa hace `dice: 2d6+3 # Trampa del almacén` de daño.')
    const inline = read.body.content?.[0]?.content ?? []
    expect(inline.map((n) => n.type)).toEqual(['text', 'diceRoll', 'text'])
    expect(inline[1]?.attrs).toEqual({ formula: '2d6+3', label: 'Trampa del almacén' })
    expect(back).toBe('La trampa hace `dice: 2d6+3 # Trampa del almacén` de daño.\n')
  })

  it('sin nombre, también; el código de siempre sigue siendo código', () => {
    const { read, back } = roundTrip('Tira `dice: 1d20+5` y luego `npm test`.')
    const inline = read.body.content?.[0]?.content ?? []
    expect(inline.find((n) => n.type === 'diceRoll')?.attrs).toEqual({ formula: '1d20+5', label: null })
    expect(inline.find((n) => n.text === 'npm test')?.marks?.[0]?.type).toBe('code')
    expect(back).toBe('Tira `dice: 1d20+5` y luego `npm test`.\n')
  })

  it('su texto (para buscar) es la tirada; vale para el esquema del editor', () => {
    const { read } = roundTrip('`dice: 1d20 # Iniciativa`')
    expect(plainText(read.body)).toBe('Iniciativa 1d20')
    expect(() => getSchema(editorExtensions()).nodeFromJSON(read.body).check()).not.toThrow()
  })
})
