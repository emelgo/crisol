import { describe, expect, it } from 'vitest'
import { pageFromMarkdown, pageToMarkdown } from '../markdown/index.ts'

const first = (markdown: string) => pageFromMarkdown(markdown).body.content?.[0]

describe('un archivo en el texto, en Markdown', () => {
  it('se distingue de una página por la extensión', () => {
    expect(first('![[Mapa de Eana.png]]')).toMatchObject({ type: 'fileEmbed', attrs: { name: 'Mapa de Eana.png' } })
    expect(first('![[Costa Gris]]')).toMatchObject({ type: 'pageEmbed', attrs: { title: 'Costa Gris' } })
    // Una nota de Obsidian es una página
    expect(first('![[Costa Gris.md]]')?.type).toBe('pageEmbed')
    expect(first('![[Dr. Varn]]')?.type).toBe('pageEmbed')
  })

  it('el ancho, el texto alternativo, la página de un PDF y el pie', () => {
    expect(first('![[mapa.png|300]]')?.attrs).toMatchObject({ width: 300, alt: null })
    expect(first('![[mapa.png|El continente|300x200]]')?.attrs).toMatchObject({ width: 300, alt: 'El continente' })
    expect(first('![[Bestiario.pdf#page=12]]')?.attrs).toMatchObject({ name: 'Bestiario.pdf', page: 12 })
    expect(first('![[mapa.png]]\n*Eana en el año \\*mil\\**')?.attrs).toMatchObject({ caption: 'Eana en el año *mil*' })
  })

  it('lo que rompería el `![[…]]` no se escribe: corchetes y barras del pie o del texto alternativo', () => {
    const markdown = pageToMarkdown({
      properties: [],
      separate: () => null,
      body: {
        type: 'doc',
        content: [
          {
            type: 'fileEmbed',
            attrs: { name: 'mapa.png', alt: 'a|b]', caption: 'línea\nsegunda', width: null, page: null, fileId: null }
          }
        ]
      }
    })
    expect(markdown).toBe('![[mapa.png|a b]]\n*línea segunda*\n')
    expect(first(markdown)?.attrs).toMatchObject({ alt: 'a b', caption: 'línea segunda' })
  })
})
