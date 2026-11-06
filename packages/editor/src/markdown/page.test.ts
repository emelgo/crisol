import type { JSONContent } from '@tiptap/core'
import { getSchema } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { editorExtensions } from '../schema.ts'
import { pageFromMarkdown, pageToMarkdown } from './page.ts'

const text = (value: string, marks?: JSONContent['marks']): JSONContent => ({
  type: 'text',
  text: value,
  ...(marks ? { marks } : {})
})
const paragraph = (id: string | null, ...content: JSONContent[]): JSONContent => ({
  type: 'paragraph',
  attrs: { id },
  content
})

/** Un cuerpo con todos los nodos y marcas del esquema (la prueba de abajo comprueba que no falte ninguno) */
const body: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { id: 'h1aaaaaa', level: 1 },
      content: [text('Puerto Ceniza')]
    },
    paragraph(
      'p1aaaaaa',
      text('La última ciudad '),
      text('libre', [{ type: 'bold' }]),
      text(' de la '),
      text('Costa Gris', [{ type: 'italic' }]),
      text(', con su '),
      text('lonja', [{ type: 'underline' }]),
      text(', su '),
      text('faro', [{ type: 'strike' }]),
      text(' y su '),
      text('sal', [{ type: 'code' }]),
      text('. '),
      text('Mapa', [{ type: 'link', attrs: { href: 'https://eana.example/mapa' } }]),
      text('.'),
      { type: 'hardBreak' },
      text('Segunda línea. Ver '),
      { type: 'pageLink', attrs: { pageId: null, title: 'Maela Varn', anchor: 'Historia', label: 'la jefa' } },
      text(' y '),
      { type: 'pageLink', attrs: { pageId: null, title: 'Lugares/Notas', anchor: '^k3x9a1b2', label: null } },
      text(', su criatura '),
      { type: 'contentLink', attrs: { name: 'Goblin jefe', label: 'el jefe' } },
      text('. La trampa: '),
      { type: 'diceRoll', attrs: { formula: '2d6+3', label: 'Trampa' } },
      text('.')
    ),
    { type: 'heading', attrs: { id: 'h2aaaaaa', level: 2 }, content: [text('Barrios')] },
    { type: 'heading', attrs: { id: 'h3aaaaaa', level: 3 }, content: [text('Los Muelles')] },
    {
      type: 'bulletList',
      attrs: { id: 'ulaaaaaa' },
      content: [
        { type: 'listItem', attrs: { id: null }, content: [paragraph(null, text('La Lonja'))] },
        { type: 'listItem', attrs: { id: null }, content: [paragraph(null, text('El Faro Roto'))] }
      ]
    },
    paragraph('p2aaaaaa', text('Entre listas.')),
    {
      type: 'orderedList',
      attrs: { id: 'olaaaaaa', start: 1, type: null },
      content: [{ type: 'listItem', attrs: { id: null }, content: [paragraph(null, text('Llegar al puerto'))] }]
    },
    paragraph('p3aaaaaa', text('Pendiente:')),
    {
      type: 'taskList',
      attrs: { id: 'tlaaaaaa' },
      content: [
        { type: 'taskItem', attrs: { id: null, checked: true }, content: [paragraph(null, text('Hablar con Maela'))] },
        { type: 'taskItem', attrs: { id: null, checked: false }, content: [paragraph(null, text('Buscar el mapa'))] }
      ]
    },
    { type: 'blockquote', attrs: { id: 'bqaaaaaa' }, content: [paragraph(null, text('Nadie sale sin permiso.'))] },
    {
      type: 'codeBlock',
      attrs: { id: 'cbaaaaaa', language: 'js' },
      content: [text('tirar(1, 20)\nsumar(4)')]
    },
    { type: 'horizontalRule', attrs: { id: 'hraaaaaa' } },
    {
      type: 'table',
      attrs: { id: 'tbaaaaaa' },
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableHeader',
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
              content: [paragraph(null, text('Barrio'))]
            },
            {
              type: 'tableHeader',
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
              content: [paragraph(null, text('Peligro'))]
            }
          ]
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
              content: [paragraph(null, text('Muelles'))]
            },
            {
              type: 'tableCell',
              attrs: { colspan: 1, rowspan: 1, colwidth: null },
              content: [paragraph(null, text('Medio'))]
            }
          ]
        }
      ]
    },
    ...(['note', 'tip', 'warning', 'danger', 'read-aloud'] as const).map(
      (kind): JSONContent => ({
        type: 'callout',
        attrs: { id: `c${kind.slice(0, 2)}aaaaa`.slice(0, 8), kind, wide: kind === 'tip' },
        content: [paragraph(null, text(`Recuadro ${kind}.`)), paragraph(null, text('Segundo párrafo.'))]
      })
    ),
    { type: 'box', attrs: { id: 'bxaaaaaa', wide: false }, content: [paragraph(null, text('Dentro de la caja.'))] },
    { type: 'box', attrs: { id: 'bxbaaaaa', wide: true }, content: [paragraph(null, text('Caja a lo ancho.'))] },
    { type: 'pageBreak', attrs: { id: 'pbaaaaaa' } },
    { type: 'columnBreak', attrs: { id: 'cbaaaaaa' } },
    { type: 'columnsChange', attrs: { id: 'ccaaaaaa', count: 2 } },
    paragraph(null, text('A dos columnas.')),
    { type: 'columnsChange', attrs: { id: 'ccbaaaaa', count: 1 } },
    {
      type: 'statblock',
      attrs: { id: 'sbaaaaaa', wide: true },
      content: [paragraph(null, text('Dragón rojo adulto')), paragraph(null, text('CA 19'))]
    },
    { type: 'sidenote', attrs: { id: 'snaaaaaa', side: 'left' }, content: [paragraph(null, text('Al margen.'))] },
    { type: 'sidenote', attrs: { id: 'snbaaaaa', side: 'right' }, content: [paragraph(null, text('Al otro.'))] },
    { type: 'wideBlock', attrs: { id: 'wbaaaaaa' }, content: [paragraph(null, text('Todo a lo ancho.'))] },
    { type: 'tableOfContents', attrs: { id: 'tcaaaaaa' } },
    { type: 'pageEmbed', attrs: { id: 'emaaaaaa', pageId: null, title: 'Costa Gris', anchor: 'Historia' } },
    {
      type: 'fileEmbed',
      attrs: {
        id: 'fiaaaaaa',
        fileId: null,
        name: 'Mapa de Eana.png',
        width: 300,
        page: null,
        alt: 'El continente',
        caption: 'Eana en el año *mil*'
      }
    },
    {
      type: 'fileEmbed',
      attrs: { id: 'fibaaaaa', fileId: null, name: 'Bestiario.pdf', width: null, page: 12, alt: null, caption: null }
    },
    { type: 'secret', attrs: { id: 'scaaaaaa', documentId: 'doc-secreto', copyOf: null, copyBy: null } },
    { type: 'note', attrs: { id: 'ntaaaaaa', documentId: 'doc-nota', copyOf: null, copyBy: null } },
    paragraph('p4aaaaaa', text('Fin.'))
  ]
}

const separateContents: Record<string, JSONContent[]> = {
  'doc-secreto': [
    paragraph(null, text('La Hermandad quemó el faro.')),
    {
      type: 'bulletList',
      attrs: { id: null },
      content: [{ type: 'listItem', attrs: { id: null }, content: [paragraph(null, text('Lo sabe Maela'))] }]
    }
  ],
  'doc-nota': [paragraph(null, text('Preguntar por su familia.'))]
}

/** Lo de dentro sin ids (solo salen los de primer nivel) y sin los atributos que son null */
function normalize(node: JSONContent, depth = 0): JSONContent {
  const attrs = Object.fromEntries(
    Object.entries(node.attrs ?? {}).filter(([name, value]) => value !== null && !(name === 'id' && depth > 1))
  )
  return {
    type: node.type,
    ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
    ...(node.text !== undefined ? { text: node.text } : {}),
    ...(node.marks
      ? {
          marks: node.marks.map((mark) => ({
            type: mark.type,
            ...(mark.attrs
              ? { attrs: Object.fromEntries(Object.entries(mark.attrs).filter(([, v]) => v !== null)) }
              : {})
          }))
        }
      : {}),
    ...(node.content ? { content: node.content.map((child) => normalize(child, depth + 1)) } : {})
  }
}

function types(node: JSONContent, found = { nodes: new Set<string>(), marks: new Set<string>() }) {
  if (node.type) found.nodes.add(node.type)
  for (const mark of node.marks ?? []) found.marks.add(mark.type)
  for (const child of node.content ?? []) types(child, found)
  return found
}

describe('el Markdown de una página', () => {
  const schema = getSchema(editorExtensions())

  it('la prueba lleva todos los nodos y marcas del esquema: uno nuevo sin su forma en Markdown la hace fallar', () => {
    const all = { type: 'doc', content: [...(body.content ?? []), ...Object.values(separateContents).flat()] }
    const found = types(all)
    expect([...found.nodes].sort()).toEqual(Object.keys(schema.nodes).sort())
    expect([...found.marks].sort()).toEqual(Object.keys(schema.marks).sort())
    expect(() => schema.nodeFromJSON(body).check()).not.toThrow()
  })

  it('de ida y vuelta da lo mismo: el cuerpo, los ids de primer nivel y lo de dentro de los secretos', () => {
    const markdown = pageToMarkdown({
      properties: [{ name: 'alias', type: 'list', value: ['Puerto'] }],
      body,
      separate: (id) => separateContents[id] ?? null,
      ids: true
    })
    const read = pageFromMarkdown(markdown)
    expect(read.properties).toEqual([{ name: 'alias', type: 'list', value: ['Puerto'] }])
    const expected: JSONContent = {
      ...body,
      content: body.content?.map((block) =>
        block.type === 'secret' || block.type === 'note'
          ? { ...block, attrs: { ...block.attrs, documentId: null } }
          : block
      )
    }
    // Por el esquema, que pone los atributos por defecto (start, colspan…) que el Markdown no escribe
    const full = (node: JSONContent, depth = 0) => normalize(schema.nodeFromJSON(node).toJSON(), depth)
    expect(full(read.body)).toEqual(full(expected))
    expect(
      read.separates.map((separate) => ({ ...separate, content: separate.content.map((c) => full(c, 2)) }))
    ).toEqual([
      { id: 'scaaaaaa', kind: 'secret', content: separateContents['doc-secreto']?.map((c) => full(c, 2)) },
      { id: 'ntaaaaaa', kind: 'note', content: separateContents['doc-nota']?.map((c) => full(c, 2)) }
    ])
    // El cuerpo leído vale para el esquema
    expect(() => schema.nodeFromJSON(read.body).check()).not.toThrow()
  })

  it('se escribe como en Obsidian', () => {
    const markdown = pageToMarkdown({
      properties: [],
      body: {
        type: 'doc',
        content: [
          paragraph('aaaaaaaa', text('Hola.')),
          { type: 'callout', attrs: { id: 'bbbbbbbb', kind: 'warning' }, content: [paragraph(null, text('Cuidado.'))] },
          { type: 'secret', attrs: { id: 'cccccccc', documentId: 'd1' } },
          { type: 'note', attrs: { id: 'dddddddd', documentId: 'd2' } }
        ]
      },
      separate: (id) => (id === 'd1' ? [paragraph(null, text('El faro.'))] : [paragraph(null, text('Para mí.'))]),
      ids: true
    })
    expect(markdown).toBe(
      [
        'Hola. ^aaaaaaaa',
        '',
        '> [!aviso]',
        '> Cuidado.',
        '',
        '^bbbbbbbb',
        '',
        '> [!secreto]',
        '> El faro.',
        '',
        '^s-cccccccc',
        '',
        // Una nota de un solo párrafo, en una línea, como se suele escribir
        '%%Para mí.%%',
        '',
        '^dddddddd',
        ''
      ].join('\n')
    )
    // La de varios párrafos, con sus %% en su línea
    expect(
      pageToMarkdown({
        properties: [],
        body: { type: 'doc', content: [{ type: 'note', attrs: { id: null, documentId: 'd2' } }] },
        separate: () => [paragraph(null, text('Uno.')), paragraph(null, text('Dos.'))]
      })
    ).toBe('%%\nUno.\n\nDos.\n%%\n')
    // Sin ids, nada de `^`
    expect(
      pageToMarkdown({
        properties: [],
        body: { type: 'doc', content: [paragraph('aaaaaaaa', text('Hola.'))] },
        separate: () => null
      })
    ).toBe('Hola.\n')
  })

  it('lee lo que escribe una persona: recuadros de Obsidian en inglés, con título, notas en una línea y enlaces peligrosos', () => {
    const read = pageFromMarkdown(
      [
        '> [!warning] Cuidado',
        '> con la marea',
        '',
        '%%Solo para mí%%',
        '',
        '> [!secreto]',
        '> Nadie lo sabe',
        '',
        '[pulsa](javascript:alert(1)) y [mira](https://eana.example)',
        '',
        '> [!raro]',
        '> Esto es una cita'
      ].join('\n')
    )
    const [warning, note, secret, links, quote] = read.body.content ?? []
    expect(warning).toMatchObject({ type: 'callout', attrs: { kind: 'warning' } })
    expect(warning?.content?.map((p) => p.content?.[0]?.text)).toEqual(['Cuidado', 'con la marea'])
    expect(note?.type).toBe('note')
    expect(secret?.type).toBe('secret')
    expect(secret?.attrs?.id).toMatch(/^[a-z0-9]{8}$/)
    expect(read.separates.map((s) => [s.kind, s.content[0]?.content?.[0]?.text])).toEqual([
      ['note', 'Solo para mí'],
      ['secret', 'Nadie lo sabe']
    ])
    expect(links?.content?.filter((t) => t.marks?.some((m) => m.type === 'link')).map((t) => t.text)).toEqual(['mira'])
    expect(quote?.type).toBe('blockquote')
  })

  it('un secreto dentro de otro se deshace en lo suyo; el HTML suelto queda como texto, sin ejecutarse', () => {
    const read = pageFromMarkdown(
      ['> [!secreto]', '> Fuera', '> > [!secreto]', '> > Dentro', '', '<script>alert(1)</script>'].join('\n')
    )
    expect(read.separates).toHaveLength(1)
    expect(JSON.stringify(read.separates[0]?.content)).not.toContain('"secret"')
    expect(JSON.stringify(read.separates[0]?.content)).toContain('Dentro')
    expect(read.body.content?.at(-1)).toEqual({
      type: 'paragraph',
      content: [{ type: 'text', text: '<script>alert(1)</script>' }]
    })
  })

  it('los enlaces a páginas: con el título de ahora, su sección o bloque y su texto; ![[…]] no es un enlace', () => {
    const markdown = pageToMarkdown({
      properties: [],
      body: {
        type: 'doc',
        content: [
          paragraph(
            null,
            text('Ver '),
            { type: 'pageLink', attrs: { pageId: 'p1', title: 'Viejo título', anchor: null, label: null } },
            text(' y '),
            { type: 'pageLink', attrs: { pageId: 'p2', title: 'Notas', anchor: 'Barrios', label: 'aquí' } },
            text(' y '),
            { type: 'pageLink', attrs: { pageId: null, title: 'Por crear', anchor: null, label: null } }
          )
        ]
      },
      separate: () => null,
      pageTitle: (id) => (id === 'p1' ? 'Maela Varn' : 'Personajes/Notas')
    })
    expect(markdown).toBe('Ver [[Maela Varn]] y [[Personajes/Notas#Barrios|aquí]] y [[Por crear]]\n')
    const read = pageFromMarkdown('Mira [[Puerto Ceniza#^abc12345|el puerto]] y ![[Mapa]]')
    const inline = (read.body.content?.[0]?.content ?? []).map((node) => ({ ...node, content: undefined }))
    expect(inline).toMatchObject([
      { type: 'text', text: 'Mira ' },
      { type: 'pageLink', attrs: { pageId: null, title: 'Puerto Ceniza', anchor: '^abc12345', label: 'el puerto' } },
      { type: 'text', text: ' y ![[Mapa]]' }
    ])
  })

  it('sin propiedades, un separador al principio no se confunde con el YAML', () => {
    const markdown = pageToMarkdown({
      properties: [],
      body: {
        type: 'doc',
        content: [{ type: 'horizontalRule', attrs: { id: null } }, paragraph(null, text('Tras la raya.'))]
      },
      separate: () => null
    })
    expect(markdown.startsWith('---\n---\n')).toBe(true)
    const read = pageFromMarkdown(markdown)
    expect(read.properties).toEqual([])
    expect(read.body.content?.map((b) => b.type)).toEqual(['horizontalRule', 'paragraph'])
  })
})
