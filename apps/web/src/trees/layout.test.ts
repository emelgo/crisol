import { describe, expect, it } from 'vitest'
import { treeTabLayout } from './layout.ts'

const family = {
  nodes: [{ id: 'abuela' }, { id: 'madre' }, { id: 'padre' }, { id: 'ilsa' }, { id: 'suelta' }],
  edges: [
    { from: 'abuela', to: 'madre', type: 'parent' as const },
    { from: 'madre', to: 'padre', type: 'partner' as const },
    { from: 'madre', to: 'ilsa', type: 'parent' as const },
    { from: 'padre', to: 'ilsa', type: 'parent' as const }
  ]
}

describe('la pestaña de árbol', () => {
  it('cada generación en su fila: los padres encima de los hijos, la pareja al lado; lo suelto, debajo', () => {
    const layout = treeTabLayout(family.nodes, family.edges)
    const at = new Map(layout.cards.map((card) => [card.id, card]))
    expect(layout.cards).toHaveLength(5)
    expect(at.get('abuela')?.y).toBeLessThan(at.get('madre')?.y ?? 0)
    expect(at.get('madre')?.y).toBeLessThan(at.get('ilsa')?.y ?? 0)
    expect(at.get('madre')?.y).toBe(at.get('padre')?.y)
    expect(layout.wires.some((wire) => wire.kind === 'partner')).toBe(true)
    expect(at.get('suelta')?.y).toBeGreaterThan(at.get('ilsa')?.y ?? 0)
    expect(layout.rows).toEqual([])
  })

  it('dos que comparten un hijo no salen como pareja si nadie lo ha dicho: cada uno baja por su cuenta', () => {
    const layout = treeTabLayout(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      [
        { from: 'a', to: 'c', type: 'parent' },
        { from: 'b', to: 'c', type: 'parent' }
      ]
    )
    expect(layout.wires.some((wire) => wire.kind === 'partner')).toBe(false)
    // Dos bajadas (una por cada uno), la barra y la subida al hijo
    expect(layout.wires).toHaveLength(4)
  })

  it('las que no son de sangre ni de pareja, con raya discontinua y su nombre; el organigrama, de arriba abajo', () => {
    const layout = treeTabLayout(
      [{ id: 'orden' }, { id: 'varn' }, { id: 'ilsa' }, { id: 'kael' }],
      [
        { from: 'varn', to: 'orden', type: 'leads' },
        { from: 'ilsa', to: 'orden', type: 'member' },
        { from: 'varn', to: 'kael', type: 'stepparent' },
        { from: 'ilsa', to: 'kael', type: 'other', label: 'Rival', beside: true }
      ],
      (edge) => (edge.type === 'other' ? (edge.label ?? null) : edge.type === 'stepparent' ? 'Padrastro' : null)
    )
    const at = new Map(layout.cards.map((card) => [card.id, card]))
    expect(at.get('varn')?.y).toBeLessThan(at.get('orden')?.y ?? 0)
    expect(at.get('orden')?.y).toBeLessThan(at.get('ilsa')?.y ?? 0)
    expect(layout.wires.some((wire) => wire.dashed)).toBe(true)
    expect(layout.labels?.map((label) => label.text).sort()).toEqual(['Padrastro', 'Rival'])
  })

  it('vacío, sin tarjetas', () => {
    expect(treeTabLayout([], []).cards).toEqual([])
  })
})
