import { describe, expect, it } from 'vitest'
import { CARD, familyLayout, forceLayout, orgLayout } from './layout.ts'

describe('Enlaces, por fuerzas', () => {
  it('la página del centro, quieta en el origen; las demás, alrededor y sin pisarse', () => {
    const ids = ['ilsa', 'a', 'b', 'c', 'd']
    const placed = forceLayout(
      ids,
      ids.slice(1).map((id) => ({ source: 'ilsa', target: id })),
      { center: 'ilsa' }
    )
    expect(placed.get('ilsa')).toEqual({ x: 0, y: 0 })
    for (const id of ids.slice(1)) {
      const { x, y } = placed.get(id) ?? { x: 0, y: 0 }
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true)
      expect(Math.hypot(x, y)).toBeGreaterThan(40)
    }
  })

  it('las aristas a páginas que no están no cuentan', () => {
    const placed = forceLayout(['a'], [{ source: 'a', target: 'fuera' }])
    expect(placed.size).toBe(1)
  })
})

describe('Familia, en filas', () => {
  // Aldren y Mirela, pareja, padres de Ilsa; Ilsa y Corwen, pareja, padres de Lia; Aldren V, hermano de Ilsa
  const nodes = [
    { id: 'aldren', generation: -1 },
    { id: 'mirela', generation: -1 },
    { id: 'ilsa', generation: 0 },
    { id: 'corwen', generation: 0 },
    { id: 'aldren5', generation: 0 },
    { id: 'lia', generation: 1 },
    { id: 'abuelo', generation: -2 }
  ]
  const edges = [
    { source: 'aldren', target: 'mirela', role: 'partner' as const },
    { source: 'ilsa', target: 'aldren', role: 'parent' as const },
    { source: 'ilsa', target: 'mirela', role: 'parent' as const },
    { source: 'aldren5', target: 'aldren', role: 'parent' as const },
    { source: 'aldren5', target: 'mirela', role: 'parent' as const },
    { source: 'ilsa', target: 'corwen', role: 'partner' as const },
    { source: 'lia', target: 'ilsa', role: 'parent' as const },
    { source: 'lia', target: 'corwen', role: 'parent' as const },
    { source: 'aldren', target: 'abuelo', role: 'parent' as const }
  ]
  const tree = familyLayout(nodes, edges, 3)
  const y = (id: string) => tree.cards.find((card) => card.id === id)?.y ?? Number.NaN
  const x = (id: string) => tree.cards.find((card) => card.id === id)?.x ?? Number.NaN

  it('cada generación en su fila: los padres arriba, la pareja al lado, los hijos abajo', () => {
    expect(y('aldren')).toBeLessThan(y('ilsa'))
    expect(y('mirela')).toBe(y('aldren'))
    expect(y('corwen')).toBe(y('ilsa'))
    expect(y('aldren5')).toBe(y('ilsa'))
    expect(y('lia')).toBeGreaterThan(y('ilsa'))
    expect(y('abuelo')).toBeLessThan(y('aldren'))
    expect(tree.rows.map((row) => row.generation)).toEqual([-2, -1, 0, 1])
  })

  it('una raya entre cada pareja y las líneas a los hijos, sin pisar tarjetas de la misma fila', () => {
    expect(tree.wires.filter((wire) => wire.kind === 'partner')).toHaveLength(2)
    const sameRow = tree.cards.filter((card) => card.y === y('ilsa')).sort((a, b) => a.x - b.x)
    for (let i = 1; i < sameRow.length; i++)
      expect((sameRow[i]?.x ?? 0) - (sameRow[i - 1]?.x ?? 0)).toBeGreaterThanOrEqual(CARD.width)
    expect(Math.abs(x('ilsa') - x('corwen'))).toBeLessThan(CARD.width * 2)
  })

  it('las generaciones que no caben no salen (±1)', () => {
    const near = familyLayout(nodes, edges, 1)
    expect(near.cards.map((card) => card.id).sort()).toEqual(['aldren', 'aldren5', 'corwen', 'ilsa', 'lia', 'mirela'])
  })
})

describe('Organigrama, en columnas', () => {
  const nodes = ['orden', 'oriel', 'ilsa', 'doran', 'capitulo', 'vael', 'tamsin'].map((id) => ({ id }))
  const edges = [
    { source: 'orden', target: 'oriel', role: 'leads' as const },
    { source: 'ilsa', target: 'orden', role: 'member-of' as const },
    { source: 'doran', target: 'orden', role: 'member-of' as const },
    { source: 'capitulo', target: 'orden', role: 'member-of' as const },
    { source: 'capitulo', target: 'vael', role: 'leads' as const },
    { source: 'tamsin', target: 'capitulo', role: 'member-of' as const }
  ]
  const tree = orgLayout(nodes, edges, ['orden'])
  const card = (id: string) => tree.cards.find((each) => each.id === id)

  it('el grupo arriba, quien lo dirige debajo y los miembros en una columna, uno bajo otro', () => {
    expect(card('orden')?.kind).toBe('group')
    expect(card('orden')?.members).toBe(3)
    expect(card('oriel')?.kind).toBe('leader')
    expect(card('oriel')?.y).toBeGreaterThan(card('orden')?.y ?? 0)
    expect(card('ilsa')?.kind).toBe('member')
    expect(card('ilsa')?.x).toBe(card('doran')?.x)
    expect(card('doran')?.y).toBeGreaterThan(card('ilsa')?.y ?? 0)
  })

  it('cada subgrupo, en su columna con su líder y sus miembros', () => {
    expect(card('capitulo')?.kind).toBe('group')
    expect(card('vael')?.kind).toBe('leader')
    expect(card('tamsin')?.kind).toBe('member')
    expect(card('capitulo')?.x).not.toBe(card('ilsa')?.x)
    expect(tree.cards).toHaveLength(7)
  })
})
