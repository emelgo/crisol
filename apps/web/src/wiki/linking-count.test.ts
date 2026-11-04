import { describe, expect, it } from 'vitest'
import { linkingCount } from './backlinks.tsx'

describe('el aviso al borrar una página', () => {
  it('cuenta las páginas que la enlazan desde su texto y desde un campo, cada una una vez', () => {
    expect(linkingCount({ incoming: [], fields: [] })).toBe(0)
    expect(linkingCount({ incoming: [{ pageId: 'a' }], fields: [{ pageId: 'b' }, { pageId: 'a' }] })).toBe(2)
  })
})
