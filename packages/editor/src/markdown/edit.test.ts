import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { fillJsonIds } from '../ids.ts'
import { EditTargetError, editBody } from './edit.ts'

const p = (id: string | null, text: string): JSONContent => ({
  type: 'paragraph',
  attrs: { id },
  content: [{ type: 'text', text }]
})
const h = (id: string, level: number, text: string): JSONContent => ({
  type: 'heading',
  attrs: { id, level },
  content: [{ type: 'text', text }]
})
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })
const texts = (body: JSONContent) => (body.content ?? []).map((b) => b.content?.[0]?.text ?? b.type)
const current = doc(
  p('aaaaaaaa', 'Intro'),
  h('hhhhhhh1', 1, 'Historia'),
  p('bbbbbbbb', 'El faro'),
  h('hhhhhhh2', 2, 'El incendio'),
  p('cccccccc', 'Ardió'),
  h('hhhhhhh3', 1, 'Barrios'),
  p('dddddddd', 'Los Muelles')
)

describe('cambiar el cuerpo', () => {
  it('añadir al final; en un cuerpo vacío, sin el párrafo en blanco delante', () => {
    const { body, changed } = editBody(current, { mode: 'append' }, [p(null, 'Nuevo')])
    expect(texts(body)).toEqual([
      'Intro',
      'Historia',
      'El faro',
      'El incendio',
      'Ardió',
      'Barrios',
      'Los Muelles',
      'Nuevo'
    ])
    expect(changed).toHaveLength(1)
    expect(body.content?.at(-1)?.attrs?.id).toBe(changed[0])
    const empty = editBody(doc({ type: 'paragraph', attrs: { id: 'eeeeeeee' } }), { mode: 'append' }, [p(null, 'Solo')])
    expect(texts(empty.body)).toEqual(['Solo'])
  })

  it('cambiar todo', () => {
    expect(texts(editBody(current, { mode: 'replace' }, [p(null, 'Otro')]).body)).toEqual(['Otro'])
    expect(editBody(current, { mode: 'replace' }, []).body.content).toEqual([
      { type: 'paragraph', attrs: { id: expect.stringMatching(/^[a-z0-9]{8}$/) } }
    ])
  })

  it('cambiar un bloque por su id: los demás conservan los suyos, y el nuevo puede quedarse con el id del cambiado', () => {
    const { body, changed } = editBody(current, { mode: 'block', blockId: 'bbbbbbbb' }, [
      p('bbbbbbbb', 'El faro nuevo'),
      p(null, 'Y más')
    ])
    expect(texts(body)).toEqual([
      'Intro',
      'Historia',
      'El faro nuevo',
      'Y más',
      'El incendio',
      'Ardió',
      'Barrios',
      'Los Muelles'
    ])
    expect(body.content?.map((b) => b.attrs?.id).slice(0, 3)).toEqual(['aaaaaaaa', 'hhhhhhh1', 'bbbbbbbb'])
    expect(changed[0]).toBe('bbbbbbbb')
    expect(() => editBody(current, { mode: 'block', blockId: 'zzzzzzzz' }, [])).toThrow(EditTargetError)
  })

  it('lo que cambia un bloque se queda con su id si no trae otro', () => {
    const { body } = editBody(current, { mode: 'block', blockId: 'bbbbbbbb' }, [p(null, 'Otro faro'), p(null, 'Más')])
    expect(body.content?.[2]).toMatchObject({ attrs: { id: 'bbbbbbbb' }, content: [{ text: 'Otro faro' }] })
    expect(body.content?.[3]?.attrs?.id).not.toBe('bbbbbbbb')
  })

  it('un bloque nuevo que repite el id de otro que se queda recibe uno nuevo', () => {
    const { body } = editBody(current, { mode: 'block', blockId: 'bbbbbbbb' }, [p('aaaaaaaa', 'Copia')])
    const ids = body.content?.map((b) => b.attrs?.id)
    expect(new Set(ids).size).toBe(ids?.length)
    expect(ids?.[0]).toBe('aaaaaaaa')
  })

  it('cambiar una sección: lo de debajo del título, hasta el siguiente de su nivel; por texto o por id', () => {
    const byText = editBody(current, { mode: 'section', section: '  historia ' }, [p(null, 'Nueva historia')])
    expect(texts(byText.body)).toEqual(['Intro', 'Historia', 'Nueva historia', 'Barrios', 'Los Muelles'])
    const byId = editBody(current, { mode: 'section', section: 'hhhhhhh2' }, [p(null, 'Fue la Hermandad')])
    expect(texts(byId.body)).toEqual([
      'Intro',
      'Historia',
      'El faro',
      'El incendio',
      'Fue la Hermandad',
      'Barrios',
      'Los Muelles'
    ])
    expect(() => editBody(current, { mode: 'section', section: 'Nada' }, [])).toThrow('SECTION_NOT_FOUND')
    const twice = doc(h('x1xxxxxx', 1, 'Notas'), p(null, 'a'), h('x2xxxxxx', 1, 'Notas'))
    expect(() => editBody(twice, { mode: 'section', section: 'notas' }, [])).toThrow('AMBIGUOUS_SECTION')
  })

  it('los ids en JSON: a los que faltan, uno; los repetidos, otro; los de dentro también', () => {
    const filled = fillJsonIds(
      doc(p('aaaaaaaa', 'a'), p('aaaaaaaa', 'b'), {
        type: 'bulletList',
        content: [{ type: 'listItem', content: [p(null, 'c')] }]
      })
    )
    const ids: string[] = []
    const walk = (node: JSONContent) => {
      if (node.attrs?.id) ids.push(node.attrs.id)
      for (const child of node.content ?? []) walk(child)
    }
    walk(filled)
    expect(ids).toHaveLength(5)
    expect(new Set(ids).size).toBe(5)
    expect(ids[0]).toBe('aaaaaaaa')
  })
})
