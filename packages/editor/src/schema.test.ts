import { getSchema } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { editorExtensions } from './schema.ts'

describe('el esquema del editor', () => {
  const schema = getSchema(editorExtensions())

  it('tiene los bloques de la base, y los secretos y las notas ocultas', () => {
    expect(Object.keys(schema.nodes).sort()).toEqual(
      [
        'blockquote',
        'bulletList',
        'codeBlock',
        'doc',
        'hardBreak',
        'heading',
        'horizontalRule',
        'listItem',
        'note',
        'orderedList',
        'paragraph',
        'secret',
        'taskItem',
        'taskList',
        'text'
      ].sort()
    )
  })

  it('y las marcas: negrita, cursiva, subrayado, tachado y código (los enlaces llegan con la tarea 13)', () => {
    expect(Object.keys(schema.marks).sort()).toEqual(['bold', 'code', 'italic', 'strike', 'underline'])
  })

  it('los títulos del cuerpo van del 1 al 3: el título de la página va aparte', () => {
    expect(schema.nodes.heading?.spec.attrs?.level).toBeDefined()
    const doc = schema.nodeFromJSON({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Historia' }] },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: true },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hablar con Maela' }] }]
            }
          ]
        }
      ]
    })
    expect(doc.toJSON()).toMatchObject({ content: [{ attrs: { level: 2 } }, { type: 'taskList' }] })
    expect(() => doc.check()).not.toThrow()
  })

  it('un título de nivel 1 se pinta como h2 y un h2 pegado vuelve a ser de nivel 1', () => {
    const heading = schema.nodes.heading
    if (!heading) throw new Error('sin títulos')
    const node = heading.create({ level: 1 })
    expect(heading.spec.toDOM?.(node)).toEqual(['h2', {}, 0])
    const rule = heading.spec.parseDOM?.find((r) => 'tag' in r && r.tag === 'h2')
    expect(rule?.attrs).toEqual({ level: 1 })
  })

  it('un secreto solo lleva el id de su documento, nunca su texto', () => {
    const secret = schema.nodes.secret
    if (!secret) throw new Error('sin secretos')
    expect(secret.isAtom).toBe(true)
    const node = secret.create({ documentId: 'd1' })
    expect(secret.spec.toDOM?.(node)).toEqual(['div', { 'data-type': 'secret', 'data-document': 'd1' }])
  })

  it('dentro de un secreto no hay otros secretos', () => {
    const nested = getSchema(editorExtensions({ nested: true }))
    expect(nested.nodes.secret).toBeUndefined()
    expect(nested.nodes.note).toBeUndefined()
  })
})
