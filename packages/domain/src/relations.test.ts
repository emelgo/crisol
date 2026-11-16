import { describe, expect, it } from 'vitest'
import type { PageProperty } from './properties.ts'
import {
  familyTree,
  filterGraph,
  neighborhood,
  orgChart,
  type RelationEdge,
  relationEdges,
  relationKeyOf,
  relationModes
} from './relations.ts'

const pages = (field: string, name: string, value: string[], extra: Partial<PageProperty> = {}) =>
  ({ name, field, type: 'pages', value, ...extra }) as PageProperty

const edge = (source: string, target: string, role?: RelationEdge['role']): RelationEdge => ({
  source,
  target,
  kind: 'field',
  key: `field:${role ?? 'x'}`,
  name: role ?? 'x',
  ...(role ? { role } : {})
})

describe('las aristas del grafo', () => {
  it('una por campo y destino, con su nombre, su papel y su nombre al revés', () => {
    const edges = relationEdges(
      [
        {
          id: 'ilsa',
          properties: [
            pages('faccion', 'Facción', ['liga'], { role: 'member-of', inverseName: 'Miembros' }),
            pages('padres', 'Padres', ['oren', 'mara'], { role: 'parent' }),
            { name: 'Rol', type: 'text', value: 'espía' }
          ]
        },
        { id: 'liga', properties: [] },
        { id: 'oren', properties: [] },
        { id: 'mara', properties: [] }
      ],
      []
    )
    expect(edges).toEqual([
      {
        source: 'ilsa',
        target: 'liga',
        kind: 'field',
        key: 'field:faccion',
        name: 'Facción',
        role: 'member-of',
        inverseName: 'Miembros'
      },
      { source: 'ilsa', target: 'oren', kind: 'field', key: 'field:padres', name: 'Padres', role: 'parent' },
      { source: 'ilsa', target: 'mara', kind: 'field', key: 'field:padres', name: 'Padres', role: 'parent' }
    ])
  })

  it('sin destinos que no están (no se ven) ni enlaces a sí misma', () => {
    const edges = relationEdges(
      [
        { id: 'a', properties: [pages('x', 'Aliados', ['a', 'oculta', 'b'])] },
        { id: 'b', properties: [] }
      ],
      [
        { source: 'a', target: 'oculta', secret: false },
        { source: 'oculta', target: 'b', secret: false },
        { source: 'b', target: 'b', secret: false }
      ]
    )
    expect(edges.map((e) => `${e.source}>${e.target}`)).toEqual(['a>b'])
  })

  it('«menciona», una vez por par; de secreto solo si todos sus enlaces lo son; nada si ya está en un campo', () => {
    const edges = relationEdges(
      [
        { id: 'a', properties: [pages('lugar', 'Lugar', ['c'])] },
        { id: 'b', properties: [] },
        { id: 'c', properties: [] }
      ],
      [
        { source: 'a', target: 'b', secret: true },
        { source: 'a', target: 'b', secret: false },
        { source: 'b', target: 'c', secret: true },
        { source: 'a', target: 'c', secret: false },
        // El otro sentido sí cuenta
        { source: 'c', target: 'a', secret: false }
      ]
    )
    const mentions = edges.filter((e) => e.kind === 'mention')
    expect(mentions).toEqual([
      { source: 'a', target: 'b', kind: 'mention', key: 'mention', name: '' },
      { source: 'b', target: 'c', kind: 'mention', key: 'mention', name: '', secret: true },
      { source: 'c', target: 'a', kind: 'mention', key: 'mention', name: '' }
    ])
  })

  it('la clave de un campo: su id o, sin él, su nombre sin tildes ni mayúsculas', () => {
    expect(relationKeyOf({ name: 'Facción', field: 'f1' })).toBe('field:f1')
    expect(relationKeyOf({ name: ' Facción ' })).toBe('name:faccion')
  })
})

describe('los modos de una página', () => {
  const edges = [edge('ilsa', 'oren', 'parent'), edge('ilsa', 'liga', 'member-of'), edge('x', 'y')]
  it('enlaces si tiene alguna relación; familia y organigrama, con sus papeles', () => {
    expect(relationModes(edges, 'ilsa')).toEqual(['links', 'family', 'org'])
    expect(relationModes(edges, 'oren')).toEqual(['links', 'family'])
    expect(relationModes(edges, 'liga')).toEqual(['links', 'org'])
    expect(relationModes(edges, 'x')).toEqual(['links'])
    expect(relationModes(edges, 'nadie')).toEqual([])
  })
})

describe('el vecindario', () => {
  const edges = [edge('a', 'b'), edge('c', 'b'), edge('c', 'd'), edge('d', 'e')]
  it('hasta depth saltos, en los dos sentidos, con las aristas entre lo que sale', () => {
    expect(neighborhood(edges, 'a', 1).ids).toEqual(['a', 'b'])
    expect(neighborhood(edges, 'a', 2).ids).toEqual(['a', 'b', 'c'])
    const three = neighborhood(edges, 'a', 3)
    expect(three.ids).toEqual(['a', 'b', 'c', 'd'])
    expect(three.edges).toHaveLength(3)
    expect(three.truncated).toBe(false)
  })

  it('se corta en el límite y lo dice', () => {
    const star = Array.from({ length: 10 }, (_, i) => edge('centro', `p${i}`))
    const cut = neighborhood(star, 'centro', 1, 5)
    expect(cut.ids).toHaveLength(5)
    expect(cut.truncated).toBe(true)
  })
})

describe('el árbol genealógico', () => {
  // abuela ← madre ← ilsa ← hija ← nieta ← bisnieta; ilsa y su pareja; la madre y el padre; el tío, hijo de la abuela
  const edges = [
    edge('madre', 'abuela', 'parent'),
    edge('tio', 'abuela', 'parent'),
    edge('primo', 'tio', 'parent'),
    edge('ilsa', 'madre', 'parent'),
    edge('ilsa', 'padre', 'parent'),
    edge('padre', 'madre', 'partner'),
    edge('pareja', 'ilsa', 'partner'),
    edge('pareja', 'suegra', 'parent'),
    edge('hija', 'ilsa', 'parent'),
    edge('nieta', 'hija', 'parent'),
    edge('bisnieta', 'nieta', 'parent'),
    edge('tataranieta', 'bisnieta', 'parent'),
    edge('ilsa', 'liga', 'member-of')
  ]

  it('±3 generaciones por la sangre, con su generación, y la pareja al lado sin su familia', () => {
    const tree = familyTree(edges, 'ilsa')
    expect(Object.fromEntries(tree.generation)).toEqual({
      ilsa: 0,
      madre: -1,
      padre: -1,
      abuela: -2,
      tio: -1,
      primo: 0,
      hija: 1,
      nieta: 2,
      bisnieta: 3,
      pareja: 0
    })
    // Ni la suegra (familia de la pareja), ni la tataranieta (4.ª generación), ni la facción
    expect(tree.ids).not.toContain('suegra')
    expect(tree.ids).not.toContain('tataranieta')
    expect(tree.edges.every((e) => e.role === 'parent' || e.role === 'partner')).toBe(true)
    expect(tree.edges).toContainEqual(edge('padre', 'madre', 'partner'))
  })
})

describe('el organigrama', () => {
  const edges = [
    edge('liga', 'varn', 'leads'),
    edge('ilsa', 'liga', 'member-of'),
    edge('topo', 'liga', 'member-of'),
    edge('celula', 'liga', 'member-of'),
    edge('celula', 'mira', 'leads'),
    edge('bruno', 'celula', 'member-of'),
    edge('ilsa', 'oren', 'parent')
  ]

  it('desde el grupo: quien lo dirige, sus miembros y sus subgrupos con los suyos', () => {
    const chart = orgChart(edges, 'liga')
    expect(chart.groups).toEqual(['liga'])
    expect(new Set(chart.ids)).toEqual(new Set(['liga', 'varn', 'ilsa', 'topo', 'celula', 'mira', 'bruno']))
    expect(chart.edges.every((e) => e.role === 'leads' || e.role === 'member-of')).toBe(true)
  })

  it('desde un miembro o desde quien lo dirige se salta a su grupo', () => {
    expect(orgChart(edges, 'ilsa').groups).toEqual(['liga'])
    expect(orgChart(edges, 'varn').groups).toEqual(['liga'])
    expect(orgChart(edges, 'ilsa').ids).toContain('varn')
  })

  it('con un nivel, sin los miembros de los subgrupos', () => {
    expect(orgChart(edges, 'liga', 1).ids).not.toContain('bruno')
  })
})

describe('el grafo del mundo filtrado', () => {
  const graphPages = [
    { id: 'ilsa', line: ['pnj'], tags: ['Personaje/espía'] },
    { id: 'liga', line: ['faccion-copia', 'faccion'], tags: [] },
    { id: 'aldoria', line: ['lugar'], tags: ['lugar/reino'] },
    { id: 'suelta', line: ['pnj'], tags: [] }
  ]
  const edges: RelationEdge[] = [
    { ...edge('ilsa', 'liga', 'member-of'), key: 'field:faccion', name: 'Facción' },
    { source: 'ilsa', target: 'aldoria', kind: 'mention', key: 'mention', name: '' },
    { source: 'liga', target: 'aldoria', kind: 'mention', key: 'mention', name: '' }
  ]

  it('sin filtros: todo menos las páginas sin relaciones; con orphans, también ellas', () => {
    const all = filterGraph(graphPages, edges, { orphans: false })
    expect(all.pages.map((p) => p.id)).toEqual(['ilsa', 'liga', 'aldoria'])
    expect(all.counts).toEqual([
      { key: 'mention', kind: 'mention', name: '', count: 2 },
      { key: 'field:faccion', kind: 'field', name: 'Facción', role: 'member-of', count: 1 }
    ])
    expect(filterGraph(graphPages, edges, { orphans: true }).pages).toHaveLength(4)
  })

  it('por plantilla (también sus copias), por etiqueta (y sus hijas, sin mayúsculas) y por relación', () => {
    expect(filterGraph(graphPages, edges, { orphans: false, templates: ['faccion', 'lugar'] }).edges).toEqual([
      edges[2]
    ])
    const tagged = filterGraph(graphPages, edges, { orphans: true, tags: ['personaje', 'LUGAR'] })
    expect(tagged.pages.map((p) => p.id)).toEqual(['ilsa', 'aldoria'])
    const fields = filterGraph(graphPages, edges, { orphans: false, relations: ['field:faccion'] })
    expect(fields.pages.map((p) => p.id)).toEqual(['ilsa', 'liga'])
    // Los conteos, antes de filtrar por relación: para elegir
    expect(fields.counts).toHaveLength(2)
  })
})
