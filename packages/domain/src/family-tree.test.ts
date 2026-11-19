import { describe, expect, it } from 'vitest'
import { type FamilyTreeEdge, type FamilyTreeNode, treeProblem, treeRelationEdges, visibleTree } from './family-tree.ts'
import type { RelationEdge } from './relations.ts'

const nodes: FamilyTreeNode[] = [
  { id: 'abuela', pageId: 'p-abuela', name: 'Abuela' },
  { id: 'madre', pageId: 'p-madre', name: 'Madre' },
  { id: 'padre', name: 'Padre (sin página)' },
  { id: 'ilsa', pageId: 'p-ilsa', name: 'Ilsa' }
]
const edges: FamilyTreeEdge[] = [
  { from: 'abuela', to: 'madre', type: 'parent' },
  { from: 'madre', to: 'padre', type: 'partner' },
  { from: 'madre', to: 'ilsa', type: 'parent' },
  { from: 'padre', to: 'ilsa', type: 'parent' }
]

describe('treeProblem', () => {
  it('acepta un árbol bien hecho', () => {
    expect(treeProblem(nodes, edges)).toBeNull()
  })

  it('dice qué falla: ids repetidos, nodos que no están, a sí mismo, repetidas y la misma página dos veces', () => {
    expect(treeProblem([...nodes, { id: 'ilsa', name: 'Otra' }], edges)).toMatch(/repetido/)
    expect(treeProblem(nodes, [{ from: 'abuela', to: 'nadie', type: 'parent' }])).toMatch(/nadie/)
    expect(treeProblem(nodes, [{ from: 'ilsa', to: 'ilsa', type: 'partner' }])).toMatch(/consigo mismo/)
    expect(
      treeProblem(nodes, [
        { from: 'madre', to: 'padre', type: 'partner' },
        { from: 'padre', to: 'madre', type: 'partner' }
      ])
    ).toMatch(/repetida/)
    expect(treeProblem([...nodes, { id: 'otra', pageId: 'p-ilsa', name: 'Ilsa' }], [])).toMatch(/otro nodo/)
  })

  it('no deja que nadie sea antepasado de sí mismo ni pertenezca a sí mismo', () => {
    expect(treeProblem(nodes, [...edges, { from: 'ilsa', to: 'abuela', type: 'parent' }])).toMatch(/antepasado/)
    const groups: FamilyTreeNode[] = [
      { id: 'a', name: 'Orden' },
      { id: 'b', name: 'Círculo' }
    ]
    expect(
      treeProblem(groups, [
        { from: 'a', to: 'b', type: 'member' },
        { from: 'b', to: 'a', type: 'member' }
      ])
    ).toMatch(/pertenece a sí mismo/)
    // Dirigir un grupo y pertenecer a él a la vez sí vale
    expect(
      treeProblem(groups, [
        { from: 'a', to: 'b', type: 'member' },
        { from: 'a', to: 'b', type: 'leads' }
      ])
    ).toBeNull()
  })
})

describe('treeRelationEdges', () => {
  const present = new Set(['p-abuela', 'p-madre', 'p-ilsa', 'p-orden', 'p-varn'])

  it('las líneas entre dos páginas son relaciones, con el sentido de los campos con papel', () => {
    const out = treeRelationEdges([{ nodes, edges }], present)
    // El nodo sin página no cuenta: quedan abuela → madre y madre → Ilsa
    expect(out.map(({ source, target, role, kind, key }) => ({ source, target, role, kind, key }))).toEqual([
      { source: 'p-madre', target: 'p-abuela', role: 'parent', kind: 'tree', key: 'tree:parent' },
      { source: 'p-ilsa', target: 'p-madre', role: 'parent', kind: 'tree', key: 'tree:parent' }
    ])
  })

  it('en un organigrama, el miembro apunta al grupo y el grupo a quien lo dirige', () => {
    const org = {
      nodes: [
        { id: 'o', pageId: 'p-orden', name: 'Orden' },
        { id: 'v', pageId: 'p-varn', name: 'Varn' }
      ],
      edges: [
        { from: 'v', to: 'o', type: 'member' as const },
        { from: 'v', to: 'o', type: 'leads' as const }
      ]
    }
    expect(treeRelationEdges([org], present).map((e) => [e.source, e.target, e.role])).toEqual([
      ['p-varn', 'p-orden', 'member-of'],
      ['p-orden', 'p-varn', 'leads']
    ])
  })

  it('no repite lo que ya dice un campo ni lo de otro árbol, y no va a páginas que no están', () => {
    const field: RelationEdge = {
      source: 'p-madre',
      target: 'p-abuela',
      kind: 'field',
      key: 'field:padres',
      name: 'Padres',
      role: 'parent'
    }
    const out = treeRelationEdges(
      [
        { nodes, edges },
        { nodes, edges }
      ],
      new Set(['p-madre', 'p-abuela']),
      [field]
    )
    expect(out).toEqual([])
  })
})

describe('visibleTree', () => {
  it('quita los nodos de páginas que no ve, con sus líneas; los sueltos se quedan', () => {
    const seen = visibleTree(nodes, edges, (id) => id !== 'p-abuela')
    expect(seen.nodes.map((node) => node.id)).toEqual(['madre', 'padre', 'ilsa'])
    expect(seen.edges).toHaveLength(3)
    expect(seen.edges.some((edge) => edge.from === 'abuela')).toBe(false)
  })
})
