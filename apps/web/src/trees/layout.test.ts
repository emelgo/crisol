import { describe, expect, it } from 'vitest'
import { roleEdges, topGroups, treeTabLayout } from './layout.ts'

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
  it('pasa las líneas al sentido de los campos con papel', () => {
    expect(
      roleEdges([
        { from: 'p', to: 'h', type: 'parent' },
        { from: 'v', to: 'o', type: 'member' },
        { from: 'v', to: 'o', type: 'leads' }
      ])
    ).toEqual([
      { source: 'h', target: 'p', role: 'parent' },
      { source: 'v', target: 'o', role: 'member-of' },
      { source: 'o', target: 'v', role: 'leads' }
    ])
  })

  it('en el árbol genealógico, cada generación en su fila: los padres encima de los hijos, la pareja al lado', () => {
    const layout = treeTabLayout('family', family.nodes, family.edges)
    const at = new Map(layout.cards.map((card) => [card.id, card]))
    expect(layout.cards).toHaveLength(5)
    expect(at.get('abuela')?.y).toBeLessThan(at.get('madre')?.y ?? 0)
    expect(at.get('madre')?.y).toBeLessThan(at.get('ilsa')?.y ?? 0)
    expect(at.get('madre')?.y).toBe(at.get('padre')?.y)
    expect(layout.wires.some((wire) => wire.kind === 'partner')).toBe(true)
    // Sin nombres de generación: no hay una página en el centro
    expect(layout.rows).toEqual([])
  })

  it('en el organigrama, el grupo arriba y quien lo dirige debajo; lo que no cuelga de nada, en una fila aparte', () => {
    const nodes = [{ id: 'orden' }, { id: 'varn' }, { id: 'ilsa' }, { id: 'nadie' }]
    const edges = [
      { from: 'varn', to: 'orden', type: 'leads' as const },
      { from: 'ilsa', to: 'orden', type: 'member' as const }
    ]
    expect(topGroups(nodes, edges)).toEqual(['orden'])
    const layout = treeTabLayout('org', nodes, edges)
    const at = new Map(layout.cards.map((card) => [card.id, card]))
    expect(at.get('orden')?.kind).toBe('group')
    expect(at.get('varn')?.kind).toBe('leader')
    expect(at.get('orden')?.y).toBeLessThan(at.get('varn')?.y ?? 0)
    // «nadie» no cuelga de ningún grupo: debajo de todo
    const others = layout.cards.filter((card) => card.id !== 'nadie').map((card) => card.y)
    expect(at.get('nadie')?.y).toBeGreaterThan(Math.max(...others))
  })

  it('vacío, sin tarjetas', () => {
    expect(treeTabLayout('family', [], []).cards).toEqual([])
  })
})
