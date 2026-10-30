import { getSchema } from '@tiptap/core'
import { Fragment } from '@tiptap/pm/model'
import { EditorState } from '@tiptap/pm/state'
import { describe, expect, it } from 'vitest'
import { BLOCK_TYPES, fillMissingIds, newBlockId, withoutBlockIds } from './ids.ts'
import { isExternalUrl } from './links.ts'
import { CALLOUT_KINDS } from './nodes/callout.ts'
import { editorExtensions } from './schema.ts'

describe('el esquema del editor', () => {
  const schema = getSchema(editorExtensions())

  it('tiene los bloques de la base, las tablas, los recuadros, la caja, y los secretos y las notas ocultas', () => {
    expect(Object.keys(schema.nodes).sort()).toEqual(
      [
        'blockquote',
        'box',
        'bulletList',
        'callout',
        'codeBlock',
        'doc',
        'hardBreak',
        'heading',
        'horizontalRule',
        'listItem',
        'note',
        'orderedList',
        'pageEmbed',
        'pageLink',
        'paragraph',
        'secret',
        'table',
        'tableCell',
        'tableHeader',
        'tableRow',
        'taskItem',
        'taskList',
        'text'
      ].sort()
    )
  })

  it('y las marcas: negrita, cursiva, subrayado, tachado, código y enlace externo', () => {
    expect(Object.keys(schema.marks).sort()).toEqual(['bold', 'code', 'italic', 'link', 'strike', 'underline'])
  })

  it('cada bloque lleva su id, que se pinta en data-id; las filas y las celdas de las tablas, no', () => {
    for (const type of BLOCK_TYPES) expect(schema.nodes[type]?.spec.attrs?.id, type).toBeDefined()
    expect(schema.nodes.tableRow?.spec.attrs?.id).toBeUndefined()
    expect(schema.nodes.tableCell?.spec.attrs?.id).toBeUndefined()
    const paragraph = schema.nodes.paragraph?.create({ id: 'k3x9a1b2' })
    expect(paragraph && schema.nodes.paragraph?.spec.toDOM?.(paragraph)).toEqual(['p', { 'data-id': 'k3x9a1b2' }, 0])
  })

  it('los ids nuevos son cortos y no se repiten', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newBlockId()))
    expect(ids.size).toBe(1000)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]{8}$/)
  })

  it('un recuadro es de uno de los cinco tipos, y lleva bloques dentro', () => {
    expect(CALLOUT_KINDS).toEqual(['note', 'tip', 'warning', 'danger', 'read-aloud'])
    const doc = schema.nodeFromJSON({
      type: 'doc',
      content: [
        {
          type: 'callout',
          attrs: { kind: 'warning' },
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Cuidado con la marea.' }] },
            { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] }
          ]
        },
        { type: 'box', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Dentro de la caja.' }] }] }
      ]
    })
    expect(() => doc.check()).not.toThrow()
    const callout = doc.child(0)
    expect(schema.nodes.callout?.spec.toDOM?.(callout)).toEqual(['div', { 'data-callout': 'warning' }, 0])
  })

  it('una copia para duplicar va sin ids, también los de dentro, y con lo demás igual', () => {
    const callout = schema.nodeFromJSON({
      type: 'callout',
      attrs: { id: 'cccccccc', kind: 'tip' },
      content: [
        {
          type: 'paragraph',
          attrs: { id: 'pppppppp' },
          content: [{ type: 'text', text: 'Ojo', marks: [{ type: 'bold' }] }]
        }
      ]
    })
    const copy = withoutBlockIds(Fragment.from(callout)).firstChild
    expect(copy?.toJSON()).toEqual({
      type: 'callout',
      attrs: { id: null, kind: 'tip' },
      content: [
        { type: 'paragraph', attrs: { id: null }, content: [{ type: 'text', text: 'Ojo', marks: [{ type: 'bold' }] }] }
      ]
    })
  })

  it('solo hay enlaces externos http, https y mailto', () => {
    expect(isExternalUrl('https://eana.example/mapa')).toBe(true)
    expect(isExternalUrl('http://eana.example')).toBe(true)
    expect(isExternalUrl('mailto:master@eana.example')).toBe(true)
    expect(isExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isExternalUrl('data:text/html,<b>hola</b>')).toBe(false)
    expect(isExternalUrl('/mundos/eana')).toBe(false)
    expect(isExternalUrl('ftp://eana.example')).toBe(false)
  })

  it('a un documento abierto sin ids (de antes de tenerlos) se le ponen los que faltan, y los repetidos cambian', () => {
    const doc = schema.nodeFromJSON({
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { id: 'aaaaaaaa' }, content: [{ type: 'text', text: 'Uno' }] },
        { type: 'paragraph', attrs: { id: 'aaaaaaaa' }, content: [{ type: 'text', text: 'Dos' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Tres' }] }
      ]
    })
    const state = EditorState.create({ schema, doc })
    const tr = fillMissingIds(state)
    if (!tr) throw new Error('debían faltar ids')
    const ids = tr.doc.children.map((child) => child.attrs.id)
    expect(ids[0]).toBe('aaaaaaaa')
    expect(new Set(ids).size).toBe(3)
    expect(tr.getMeta('addToHistory')).toBe(false)
    expect(fillMissingIds(state.apply(tr))).toBeNull()
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
    expect(Object.keys(secret.spec.attrs ?? {}).sort()).toEqual(['copyBy', 'copyOf', 'documentId', 'id'])
  })

  it('dentro de un secreto no hay otros secretos', () => {
    const nested = getSchema(editorExtensions({ nested: true }))
    expect(nested.nodes.secret).toBeUndefined()
    expect(nested.nodes.note).toBeUndefined()
  })
})
