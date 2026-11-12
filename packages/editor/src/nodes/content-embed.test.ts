import { describe, expect, it } from 'vitest'
import { pageFromMarkdown, pageToMarkdown } from '../markdown/page.ts'

const blocks = (markdown: string) => pageFromMarkdown(markdown).body.content ?? []

describe('la ficha de una entrada incrustada: `![[@Nombre]]` en su línea', () => {
  it('es una ficha, no una página «@Nombre»; con texto alrededor, el enlace de siempre', () => {
    expect(blocks('![[@Goblin jefe]]')).toEqual([
      expect.objectContaining({ type: 'contentEmbed', attrs: expect.objectContaining({ name: 'Goblin jefe' }) })
    ])
    expect(blocks('![[Puerto Ceniza]]')[0]?.type).toBe('pageEmbed')
    const inline = blocks('Ver [[@Goblin]] aquí')[0]?.content?.map((n) => n.type)
    expect(inline).toEqual(['text', 'contentLink', 'text'])
  })

  it('vuelve igual al Markdown, sin lo que la partiría', () => {
    const markdown = 'Antes.\n\n![[@Goblin jefe]]\n\nDespués.\n'
    const page = pageFromMarkdown(markdown)
    expect(pageToMarkdown({ properties: [], body: page.body, separate: () => null })).toBe(markdown)
    const odd = { type: 'doc', content: [{ type: 'contentEmbed', attrs: { name: 'Uno|dos#[x]', system: null } }] }
    expect(pageToMarkdown({ properties: [], body: odd, separate: () => null })).toBe('![[@Unodosx]]\n')
  })
})
