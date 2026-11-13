import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { boardMap, mergeScene, type SceneElement, sceneChanged, wins, writeScene } from './sync.ts'

const el = (id: string, version: number, extra: Partial<SceneElement> & Record<string, unknown> = {}) => ({
  id,
  version,
  versionNonce: 10,
  index: `a${id}`,
  ...extra
})

describe('el enlace de la pizarra con su documento (módulo 9)', () => {
  it('gana la versión más alta; a la par, el nonce más bajo', () => {
    expect(wins(el('1', 2), el('1', 1))).toBe(true)
    expect(wins(el('1', 1), el('1', 2))).toBe(false)
    expect(wins(el('1', 2, { versionNonce: 5 }), el('1', 2))).toBe(true)
    expect(wins(el('1', 2, { versionNonce: 50 }), el('1', 2))).toBe(false)
    expect(wins(el('1', 1), undefined)).toBe(true)
  })

  it('a la escritura solo va lo que gana, con su origen; lo mismo otra vez no escribe nada', () => {
    const doc = new Y.Doc()
    const origins: unknown[] = []
    doc.on('afterTransaction', (tr: Y.Transaction) => origins.push(tr.origin))
    expect(writeScene(doc, [el('1', 1), el('2', 1)], 'yo')).toBe(2)
    expect(writeScene(doc, [el('1', 1), el('2', 1)], 'yo')).toBe(0)
    expect(writeScene(doc, [el('1', 2), el('2', 1)], 'yo')).toBe(1)
    expect(origins).toEqual(['yo', 'yo'])
    expect(boardMap(doc).get('1')?.version).toBe(2)
  })

  it('dos pantallas a la vez: cada una recibe lo de la otra y se quedan iguales', () => {
    const a = new Y.Doc()
    const b = new Y.Doc()
    a.on('update', (update: Uint8Array, origin: unknown) => origin !== 'red' && Y.applyUpdate(b, update, 'red'))
    b.on('update', (update: Uint8Array, origin: unknown) => origin !== 'red' && Y.applyUpdate(a, update, 'red'))
    writeScene(a, [el('caja', 1)], 'a')
    writeScene(b, [el('flecha', 1)], 'b')
    // La caja se mueve en a y se borra en b a la vez: gana lo de más versión (la lápida)
    writeScene(a, [el('caja', 2)], 'a')
    writeScene(b, [el('caja', 3, { isDeleted: true })], 'b')
    const sceneA = mergeScene([], boardMap(a).values())
    const sceneB = mergeScene([], boardMap(b).values())
    expect(sceneA).toEqual(sceneB)
    expect(sceneA.find((e) => e.id === 'caja')?.isDeleted).toBe(true)
  })

  it('juntar: por id el que gane, en el orden de sus índices, con las lápidas', () => {
    const local = [el('1', 3), el('2', 1)]
    const stored = [el('1', 2), el('2', 4, { isDeleted: true }), el('0', 1, { index: 'a0' })]
    const merged = mergeScene(local, stored)
    expect(merged.map((e) => [e.id, e.version])).toEqual([
      ['0', 1],
      ['1', 3],
      ['2', 4]
    ])
    expect(sceneChanged(local, merged)).toBe(true)
    expect(sceneChanged(merged, mergeScene(merged, stored))).toBe(false)
  })
})
