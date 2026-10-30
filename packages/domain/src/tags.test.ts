import { describe, expect, it } from 'vitest'
import { isTagOrChild, removeTagIn, renameTagIn, tagTree, uniqueTags } from './tags.ts'

describe('las etiquetas de la cuenta', () => {
  it('una hija está dentro de su madre, sin mirar mayúsculas; un nombre que empieza igual, no', () => {
    expect(isTagOrChild('Lugar/Ciudad', 'lugar')).toBe(true)
    expect(isTagOrChild('lugar', 'LUGAR')).toBe(true)
    expect(isTagOrChild('lugares', 'lugar')).toBe(false)
  })

  it('sin repetidas: se queda la primera forma', () => {
    expect(uniqueTags(['Costa', 'costa', 'lugar'])).toEqual(['Costa', 'lugar'])
  })

  it('renombrar cambia la etiqueta y sus hijas; si ya llevaba la nueva, no la repite', () => {
    expect(renameTagIn(['lugar/ciudad', 'costa', 'Lugar'], 'lugar', 'sitio')).toEqual([
      'sitio/ciudad',
      'costa',
      'sitio'
    ])
    expect(renameTagIn(['costa', 'playa'], 'playa', 'costa')).toEqual(['costa'])
    expect(renameTagIn(['costa'], 'lugar', 'sitio')).toBeNull()
  })

  it('quitar se lleva sus hijas; si no la lleva, nada', () => {
    expect(removeTagIn(['lugar/ciudad', 'costa', 'lugar'], 'lugar')).toEqual(['costa'])
    expect(removeTagIn(['costa'], 'lugar')).toBeNull()
  })

  it('el árbol: guardadas y usadas, con sus madres, las hijas tras su madre, y cada cosa cuenta una vez', () => {
    const tree = tagTree({
      rows: [
        { id: 't1', name: 'facción', color: 'wine' },
        { id: 't2', name: 'Lugar/Puerto', color: null }
      ],
      pages: [
        { worldId: 'eana', tags: ['lugar/ciudad', 'lugar/puerto'] },
        { worldId: 'eana', tags: ['costa'] },
        { worldId: 'otro', tags: ['lugar/ciudad'] }
      ],
      files: [{ tags: ['costa', 'lugares'] }]
    })
    expect(tree.map((t) => [t.name, t.depth, t.pages, t.files])).toEqual([
      ['costa', 0, 1, 1],
      ['facción', 0, 0, 0],
      ['Lugar', 0, 2, 0],
      ['lugar/ciudad', 1, 2, 0],
      ['Lugar/Puerto', 1, 1, 0],
      ['lugares', 0, 0, 1]
    ])
    const place = tree.find((t) => t.name === 'Lugar')
    expect(place?.id).toBeNull()
    expect([...(place?.worlds ?? [])]).toEqual([
      ['eana', 1],
      ['otro', 1]
    ])
    expect(tree.find((t) => t.name === 'facción')?.color).toBe('wine')
  })
})
