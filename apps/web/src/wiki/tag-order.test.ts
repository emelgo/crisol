import type { TagView } from '@crisol/contracts'
import { describe, expect, it } from 'vitest'
import { moveInTagList } from './tag-order.ts'

const tag = (name: string): TagView => ({
  id: null,
  name,
  depth: name.split('/').length - 1,
  color: null,
  pages: 0,
  files: 0,
  worlds: []
})
const list = ['lugar', 'lugar/ciudad', 'lugar/ciudad/barrio', 'lugar/costa', 'pnj'].map(tag)
const names = (tags: TagView[]) => tags.map((t) => `${t.name}:${t.depth}`)

describe('mover una etiqueta en la lista cargada', () => {
  it('delante o detrás de una hermana, con sus hijas', () => {
    expect(names(moveInTagList(list, 'pnj', { parentId: null, before: 'lugar' }))).toEqual([
      'pnj:0',
      'lugar:0',
      'lugar/ciudad:1',
      'lugar/ciudad/barrio:2',
      'lugar/costa:1'
    ])
    expect(names(moveInTagList(list, 'lugar/ciudad', { parentId: 'lugar', after: 'lugar/costa' }))).toEqual([
      'lugar:0',
      'lugar/costa:1',
      'lugar/ciudad:1',
      'lugar/ciudad/barrio:2',
      'pnj:0'
    ])
  })

  it('a otra madre: renombrada con sus hijas, al final de la nueva o fuera de todo', () => {
    expect(names(moveInTagList(list, 'lugar/ciudad', { parentId: 'pnj' }))).toEqual([
      'lugar:0',
      'lugar/costa:1',
      'pnj:0',
      'pnj/ciudad:1',
      'pnj/ciudad/barrio:2'
    ])
    expect(names(moveInTagList(list, 'lugar/ciudad', { parentId: null, after: 'pnj' }))).toEqual([
      'lugar:0',
      'lugar/costa:1',
      'pnj:0',
      'ciudad:0',
      'ciudad/barrio:1'
    ])
  })
})
