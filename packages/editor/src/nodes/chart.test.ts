import { getSchema } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { pageFromMarkdown, pageToMarkdown } from '../markdown/page.ts'
import { editorExtensions } from '../schema.ts'
import { chartMarkdown } from './chart.ts'

const blocks = (markdown: string) => pageFromMarkdown(markdown).body.content ?? []
const back = (markdown: string) =>
  pageToMarkdown({ properties: [], body: pageFromMarkdown(markdown).body, separate: () => null })

const YAML = 'type: bar\nlabels: [Sesión 1, Sesión 2]\nseries:\n  - title: Oro\n    data: [120, 60]\nbeginAtZero: true'

describe('un gráfico: el bloque ```chart', () => {
  it('se lee como un gráfico con su YAML tal cual; otro bloque de código sigue siendo código', () => {
    expect(blocks(`\`\`\`chart\n${YAML}\n\`\`\``)).toEqual([
      expect.objectContaining({ type: 'chart', attrs: expect.objectContaining({ yaml: YAML }) })
    ])
    expect(blocks('```js\nconst a = 1\n```')[0]?.type).toBe('codeBlock')
    expect(blocks('```chartx\nhola\n```')[0]?.type).toBe('codeBlock')
  })

  it('vuelve igual al Markdown, entre texto y con su id de bloque', () => {
    const markdown = `Antes.\n\n\`\`\`chart\n${YAML}\n\`\`\`\n\nDespués.\n`
    expect(back(markdown)).toBe(markdown)
    const page = pageFromMarkdown(`\`\`\`chart\n${YAML}\n\`\`\`\n\n^graf1234\n`)
    expect(page.body.content?.[0]?.attrs?.id).toBe('graf1234')
    expect(pageToMarkdown({ properties: [], body: page.body, separate: () => null, ids: true })).toBe(
      `\`\`\`chart\n${YAML}\n\`\`\`\n\n^graf1234\n`
    )
  })

  it('un YAML con ``` dentro va con una valla más larga, y vuelve igual', () => {
    const odd = 'type: bar\ntitle: "```"\nlabels: [a]\nseries:\n  - data: [1]'
    const tricky = 'type: pie\nnota: |\n  ```\n  dentro\n  ```'
    expect(chartMarkdown(odd)).toBe(`\`\`\`chart\n${odd}\n\`\`\``)
    expect(chartMarkdown(tricky)).toBe(`\`\`\`\`chart\n${tricky}\n\`\`\`\``)
    expect(blocks(chartMarkdown(tricky))[0]?.attrs?.yaml).toBe(tricky)
    expect(chartMarkdown('')).toBe('```chart\n```')
    expect(blocks('```chart\n```')[0]).toMatchObject({ type: 'chart', attrs: { yaml: '' } })
  })

  it('es un átomo con id, y en HTML guarda su YAML', () => {
    const schema = getSchema(editorExtensions())
    const chart = schema.nodes.chart
    expect(chart?.spec.atom).toBe(true)
    const node = chart?.create({ id: 'abcdefgh', yaml: YAML })
    expect(node && chart?.spec.toDOM?.(node)).toEqual([
      'div',
      { 'data-chart': '', 'data-yaml': YAML, 'data-id': 'abcdefgh' }
    ])
  })
})
