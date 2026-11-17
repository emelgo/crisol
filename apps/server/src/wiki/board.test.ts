import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { BOARD_ELEMENTS, type BoardElement, boardElements, boardForPlayer, boardJson, isBoard } from './board.ts'

const DORAN = '00000000-0000-4000-8000-000000000001'
const MADRE = '00000000-0000-4000-8000-000000000002'
const RETRATO = '00000000-0000-4000-8000-000000000003'

const card = (id: string, pageId: string, extra: Partial<BoardElement> = {}): BoardElement => ({
  id,
  type: 'embeddable',
  customData: { pageId, title: id },
  ...extra
})

describe('la pizarra, en el servidor (módulo 9)', () => {
  it('es pizarra el documento con su mapa de elementos; se leen los vivos (sin las lápidas)', () => {
    const doc = new Y.Doc()
    expect(isBoard(doc)).toBe(false)
    const map = doc.getMap<BoardElement>(BOARD_ELEMENTS)
    map.set('a', { id: 'a', type: 'rectangle' })
    map.set('b', { id: 'b', type: 'ellipse', isDeleted: true })
    expect(isBoard(doc)).toBe(true)
    expect(boardElements(doc).map((e) => e.id)).toEqual(['a'])
  })

  it('como texto: las tarjetas, enlaces a su página; las imágenes, archivos; las notas, su texto', () => {
    const json = boardJson([
      card('Doran', DORAN),
      { id: 'r', type: 'image', fileId: RETRATO, customData: { name: 'retrato.png' } },
      { id: 't', type: 'text', text: ' le debe dinero ' },
      { id: 'vacía', type: 'text', text: '  ' }
    ])
    expect(json).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'pageLink', attrs: { pageId: DORAN, title: 'Doran' } }] },
        { type: 'fileEmbed', attrs: { fileId: RETRATO, name: 'retrato.png' } },
        { type: 'paragraph', content: [{ type: 'text', text: 'le debe dinero' }] }
      ]
    })
  })

  it('la jugadora: sin lo oculto ni las tarjetas de lo que no conoce, ni lo atado a ello (en cadena)', () => {
    const elements: BoardElement[] = [
      card('doran', DORAN, { boundElements: [{ id: 'flecha', type: 'arrow' }] }),
      card('madre', MADRE),
      { id: 'flecha', type: 'arrow', startBinding: { elementId: 'doran' }, endBinding: { elementId: 'madre' } },
      { id: 'rótulo', type: 'text', text: '¿la culpable?', containerId: 'flecha' },
      { id: 'nota', type: 'text', text: 'Sesión 4', customData: { hidden: true } },
      { id: 'caja', type: 'rectangle' }
    ]
    const seen = boardForPlayer(elements, (pageId) => pageId === DORAN)
    expect(seen.map((e) => e.id)).toEqual(['doran', 'caja'])
    // Doran ya no sabe que tenía una flecha
    expect(seen[0]?.boundElements).toEqual([])
    expect(JSON.stringify(seen)).not.toMatch(/madre|culpable|Sesión/)
  })
})
