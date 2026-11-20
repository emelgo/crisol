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
    expect(inline[1]?.attrs).toMatchObject({ formula: '2d6+3', label: 'Trampa del almacén' })
    expect(back).toBe('La trampa hace `dice: 2d6+3 # Trampa del almacén` de daño.\n')
  })

  it('sin nombre, también; el código de siempre sigue siendo código', () => {
    const { read, back } = roundTrip('Tira `dice: 1d20+5` y luego `npm test`.')
    const inline = read.body.content?.[0]?.content ?? []
    expect(inline.find((n) => n.type === 'diceRoll')?.attrs).toMatchObject({ formula: '1d20+5', label: null })
    expect(inline.find((n) => n.text === 'npm test')?.marks?.[0]?.type).toBe('code')
    expect(back).toBe('Tira `dice: 1d20+5` y luego `npm test`.\n')
  })

  it('su texto (para buscar) es la tirada; vale para el esquema del editor', () => {
    const { read } = roundTrip('`dice: 1d20 # Iniciativa`')
    expect(plainText(read.body)).toBe('Iniciativa 1d20')
    expect(() => getSchema(editorExtensions()).nodeFromJSON(read.body).check()).not.toThrow()
  })

  it('una que no se cierra, con muchos espacios, se lee al momento (sin atascarse)', () => {
    const began = performance.now()
    pageFromMarkdown(`x \`dice: a#${' '.repeat(50_000)}`)
    expect(performance.now() - began).toBeLessThan(500)
    expect(pageFromMarkdown('`dice:   1d6   #   Daño   `').body.content?.[0]?.content?.[0]?.attrs).toMatchObject({
      formula: '1d6',
      label: 'Daño'
    })
  })

  it('una comilla invertida o una almohadilla de más no estropean la página: se quitan al escribirla', () => {
    const body = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'diceRoll', attrs: { formula: '1d6#x`', label: 'Ataque `rápido`' } }] }
      ]
    }
    const markdown = pageToMarkdown({ properties: [], body, separate: () => null })
    expect(markdown).toBe('`dice: 1d6x # Ataque rápido`\n')
    expect(pageFromMarkdown(markdown).body.content?.[0]?.content?.[0]?.attrs).toMatchObject({
      formula: '1d6x',
      label: 'Ataque rápido'
    })
  })

  it('con |texto, lo que se enseña en vez de la fórmula (`dice: 1d20+7|+7`), de ida y vuelta (ADR-0033)', () => {
    const markdown = 'Ataque `dice: 1d20+7|+7 # Mordisco`.\n'
    const body = pageFromMarkdown(markdown).body
    expect(body.content?.[0]?.content?.[1]).toMatchObject({
      type: 'diceRoll',
      attrs: { formula: '1d20+7', display: '+7', label: 'Mordisco' }
    })
    expect(pageToMarkdown({ properties: [], body, separate: () => null })).toBe(markdown)
  })
})
