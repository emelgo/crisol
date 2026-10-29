import { describe, expect, it } from 'vitest'
import { MAX_PAGE_DEPTH, moveBlocker } from './tree.ts'

describe('mover una página en el árbol', () => {
  it('a la raíz o bajo otra rama, sin problema', () => {
    expect(moveBlocker({ pageId: 'p', parentPath: [], subtreeHeight: 3 })).toBeNull()
    expect(moveBlocker({ pageId: 'p', parentPath: ['a', 'b'], subtreeHeight: 1 })).toBeNull()
  })

  it('nunca dentro de sí misma', () => {
    expect(moveBlocker({ pageId: 'p', parentPath: ['p'], subtreeHeight: 1 })).toBe('CYCLE')
  })

  it('nunca dentro de una de sus subpáginas', () => {
    expect(moveBlocker({ pageId: 'p', parentPath: ['a', 'p', 'c'], subtreeHeight: 2 })).toBe('CYCLE')
  })

  it('hasta 32 niveles contando su rama', () => {
    const path = (n: number) => Array.from({ length: n }, (_, i) => `n${i}`)
    expect(moveBlocker({ pageId: 'p', parentPath: path(MAX_PAGE_DEPTH - 1), subtreeHeight: 1 })).toBeNull()
    expect(moveBlocker({ pageId: 'p', parentPath: path(MAX_PAGE_DEPTH - 1), subtreeHeight: 2 })).toBe('TOO_DEEP')
    expect(moveBlocker({ pageId: 'p', parentPath: path(MAX_PAGE_DEPTH), subtreeHeight: 1 })).toBe('TOO_DEEP')
  })
})
