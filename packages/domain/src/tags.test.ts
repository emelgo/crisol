import { describe, expect, it } from 'vitest'
import { isTagOrChild, placeAmongSiblings, removeTagIn, renameTagIn, tagTree, uniqueTags } from './tags.ts'

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
  it('entre hermanas manda su puesto; sin él, detrás y por nombre, y cada una sigue justo tras su madre', () => {
    const tree = tagTree<string>({
      rows: [
        { id: '1', name: 'lugar', color: null, position: 'a1' },
        { id: '2', name: 'pnj', color: null, position: 'a0' },
        { id: '3', name: 'lugar/puerto', color: null, position: 'a0' },
        { id: '4', name: 'lugar/ciudad', color: null, position: 'a1' },
        { id: '5', name: 'facción', color: null }
      ],
      pages: [],
      files: []
    })
    expect(tree.map((t) => t.name)).toEqual(['pnj', 'lugar', 'lugar/puerto', 'lugar/ciudad', 'facción'])
  })

  it('al poner una entre sus hermanas: si todas tenían puesto, solo el suyo; si no, se rellenan todas en el orden nuevo', () => {
    const placed = [
      { name: 'pnj', position: 'a0' },
      { name: 'lugar', position: 'a1' },
      { name: 'facción', position: 'a2' }
    ]
    const [only] = placeAmongSiblings(placed, 'facción', { before: 'lugar' })
    expect(only?.name).toBe('facción')
    expect((only?.position ?? '') > 'a0' && (only?.position ?? '') < 'a1').toBe(true)
    const filled = placeAmongSiblings(
      [
        { name: 'lugar', position: null },
        { name: 'pnj', position: null },
        { name: 'facción', position: null }
      ],
      'facción',
      { after: 'lugar' }
    )
    expect(filled.map((f) => f.name)).toEqual(['lugar', 'facción', 'pnj'])
    expect([...filled].sort((a, b) => (a.position < b.position ? -1 : 1)).map((f) => f.name)).toEqual([
      'lugar',
      'facción',
      'pnj'
    ])
  })
})
