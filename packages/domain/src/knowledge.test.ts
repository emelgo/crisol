import { describe, expect, it } from 'vitest'
import { explainPage, type KnowledgeMark, knowledgeFor, type Reader } from './knowledge.ts'

// Valdren
// ├─ Reinos del sur
// │  └─ Aldoria
// │     ├─ La capital
// │     │  └─ La taberna
// │     └─ La ciudad oculta
// └─ Varn
const tree = [
  { id: 'sur', parentId: null },
  { id: 'aldoria', parentId: 'sur' },
  { id: 'capital', parentId: 'aldoria' },
  { id: 'taberna', parentId: 'capital' },
  { id: 'oculta', parentId: 'aldoria' },
  { id: 'varn', parentId: null }
]

const page = (
  campaignId: string | null,
  targetId: string,
  known: boolean,
  characters: string[] | null = null
): KnowledgeMark => ({
  campaignId,
  kind: 'page',
  targetId,
  known,
  characters
})

const player = (campaignId: string, characterIds: string[] = ['lia'], knowsWorld = true): Reader => ({
  kind: 'player',
  campaignId,
  characterIds,
  knowsWorld
})

const visible = (reader: Reader, marks: KnowledgeMark[]) => [...knowledgeFor(reader, tree, marks).visiblePages()].sort()

describe('qué páginas ve un jugador', () => {
  it('sin marcas, ninguna: una página nueva es del máster', () => {
    expect(visible(player('marca'), [])).toEqual([])
  })

  it('el máster las ve todas, con o sin marcas', () => {
    const k = knowledgeFor({ kind: 'master' }, tree, [page('marca', 'aldoria', false)])
    expect([...k.visiblePages()].sort()).toEqual(['aldoria', 'capital', 'oculta', 'sur', 'taberna', 'varn'])
    expect(k.seesPage('oculta')).toBe(true)
  })

  it('marcar una página marca sus subpáginas (herencia viva)', () => {
    expect(visible(player('marca'), [page('marca', 'aldoria', true)])).toEqual([
      'aldoria',
      'capital',
      'oculta',
      'taberna'
    ])
  })

  it('una subpágina con su marca manda sobre la de su madre', () => {
    const marks = [page('marca', 'aldoria', true), page('marca', 'oculta', false)]
    expect(visible(player('marca'), marks)).toEqual(['aldoria', 'capital', 'taberna'])
  })

  it('lo que sabe el mundo lo sabe una campaña que parte de él', () => {
    expect(visible(player('marca'), [page(null, 'sur', true)])).toEqual([
      'aldoria',
      'capital',
      'oculta',
      'sur',
      'taberna'
    ])
  })

  it('una campaña que empieza de cero no mira lo que el mundo conoce', () => {
    expect(visible(player('marca', ['lia'], false), [page(null, 'sur', true)])).toEqual([])
  })

  it('pero sí lo que oculta: lo nuevo bajo una página que conoce nace oculto también para ella', () => {
    const marks = [page('marca', 'aldoria', true), page(null, 'oculta', false)]
    expect(visible(player('marca', ['lia'], false), marks)).toEqual(['aldoria', 'capital', 'taberna'])
  })

  it('en la misma página, la campaña manda sobre el mundo', () => {
    const marks = [page(null, 'aldoria', true), page('marca', 'aldoria', false)]
    expect(visible(player('marca'), marks)).toEqual([])
    expect(visible(player('norte'), marks)).toEqual(['aldoria', 'capital', 'oculta', 'taberna'])
  })

  it('manda la marca más cercana, sea del mundo o de la campaña', () => {
    // La campaña no conoce Aldoria, pero el mundo sabe de su capital
    const marks = [page('marca', 'aldoria', false), page(null, 'capital', true)]
    expect(visible(player('marca'), marks)).toEqual(['capital', 'taberna'])
  })

  it('las marcas de otra campaña no cuentan', () => {
    expect(visible(player('norte'), [page('marca', 'aldoria', true)])).toEqual([])
  })

  it('por personajes: la ve el dueño de alguno de ellos', () => {
    const marks = [page('marca', 'oculta', true, ['lia'])]
    expect(visible(player('marca', ['lia']), marks)).toEqual(['oculta'])
    expect(visible(player('marca', ['bram']), marks)).toEqual([])
    expect(visible(player('marca', ['bram', 'lia']), marks)).toEqual(['oculta'])
    // «La campaña»: un jugador sin excepciones
    expect(visible(player('marca', []), marks)).toEqual([])
  })

  it('lo que se sabe por personajes también se hereda', () => {
    expect(visible(player('marca', ['lia']), [page('marca', 'capital', true, ['lia'])])).toEqual(['capital', 'taberna'])
  })

  it('el público de una marca «no la conocen» no cuenta: no la conoce nadie de la campaña', () => {
    const marks = [page('marca', 'aldoria', true), page('marca', 'oculta', false, ['lia'])]
    expect(visible(player('marca', ['lia']), marks)).toEqual(['aldoria', 'capital', 'taberna'])
  })

  it('las marcas del mundo valen para todos, aunque digan personajes', () => {
    expect(visible(player('marca', []), [page(null, 'varn', true, ['lia'])])).toEqual(['varn'])
  })

  it('una página que no está en el árbol no se ve', () => {
    expect(knowledgeFor(player('marca'), tree, [page('marca', 'sur', true)]).seesPage('otra')).toBe(false)
  })
})

describe('dónde cuelga una página en el árbol del jugador', () => {
  it('de la primera antecesora que ve, o arriba del todo', () => {
    const k = knowledgeFor(player('marca'), tree, [
      page('marca', 'sur', true),
      page('marca', 'aldoria', false),
      page('marca', 'taberna', true)
    ])
    expect(k.visibleParent('taberna')).toBe('sur')
    expect(k.visibleParent('sur')).toBeNull()
    const solo = knowledgeFor(player('marca'), tree, [page('marca', 'taberna', true)])
    expect(solo.visibleParent('taberna')).toBeNull()
  })

  it('para el máster, su madre de verdad', () => {
    expect(knowledgeFor({ kind: 'master' }, tree, []).visibleParent('taberna')).toBe('capital')
  })

  it('si le cuelga alguna en su árbol (también una nieta que ve bajo una hija que no ve)', () => {
    const k = knowledgeFor(player('marca'), tree, [
      page('marca', 'sur', true),
      page('marca', 'aldoria', false),
      page('marca', 'taberna', true)
    ])
    expect(k.hasVisibleChildren('sur')).toBe(true)
    expect(k.hasVisibleChildren('taberna')).toBe(false)
    const master = knowledgeFor({ kind: 'master' }, tree, [])
    expect(master.hasVisibleChildren('aldoria')).toBe(true)
    expect(master.hasVisibleChildren('varn')).toBe(false)
  })
})

describe('secretos, pestañas, pines y entradas del mundo', () => {
  const marks: KnowledgeMark[] = [
    page('marca', 'aldoria', true),
    { campaignId: 'marca', kind: 'secret', targetId: 's1', known: true, characters: ['lia'] },
    { campaignId: 'marca', kind: 'secret', targetId: 's2', known: true, characters: null },
    { campaignId: 'marca', kind: 'tab', targetId: 'mapa-oculto', known: true, characters: null },
    { campaignId: 'marca', kind: 'pin', targetId: 'pin-oculto', known: true, characters: ['bram'] },
    { campaignId: 'marca', kind: 'tab', targetId: 'mapa-visible', known: false, characters: null },
    { campaignId: null, kind: 'content', targetId: 'espada', known: true, characters: null },
    { campaignId: 'marca', kind: 'content', targetId: 'anillo', known: true, characters: ['lia'] }
  ]

  it('un secreto, solo revelado y en una página que ve', () => {
    const lia = knowledgeFor(player('marca', ['lia']), tree, marks)
    const bram = knowledgeFor(player('marca', ['bram']), tree, marks)
    expect(lia.seesSecret('s1', 'aldoria')).toBe(true)
    expect(bram.seesSecret('s1', 'aldoria')).toBe(false)
    expect(bram.seesSecret('s2', 'capital')).toBe(true)
    expect(lia.seesSecret('s3', 'aldoria')).toBe(false)
    // Revelado, pero su página no la ve
    expect(lia.seesSecret('s2', 'varn')).toBe(false)
  })

  it('una marca del mundo en una pestaña o un pin también cuenta', () => {
    const withWorld: KnowledgeMark[] = [
      ...marks,
      { campaignId: null, kind: 'tab', targetId: 'diario', known: false, characters: null },
      { campaignId: null, kind: 'pin', targetId: 'torre', known: true, characters: null }
    ]
    const k = knowledgeFor(player('marca'), tree, withWorld)
    expect(k.seesTab({ id: 'diario', pageId: 'aldoria', hidden: false })).toBe(false)
    expect(k.seesMapItem({ kind: 'pin', id: 'torre', pageId: 'aldoria', hidden: true })).toBe(true)
  })

  it('una pestaña sigue a su página, salvo que tenga su marca o esté oculta', () => {
    const k = knowledgeFor(player('marca'), tree, marks)
    expect(k.seesTab({ id: 'texto', pageId: 'aldoria', hidden: false })).toBe(true)
    expect(k.seesTab({ id: 'otra', pageId: 'aldoria', hidden: true })).toBe(false)
    expect(k.seesTab({ id: 'mapa-oculto', pageId: 'aldoria', hidden: true })).toBe(true)
    expect(k.seesTab({ id: 'mapa-visible', pageId: 'aldoria', hidden: false })).toBe(false)
    expect(k.seesTab({ id: 'mapa-oculto', pageId: 'varn', hidden: true })).toBe(false)
  })

  it('un pin o una región, igual, por personajes', () => {
    const lia = knowledgeFor(player('marca', ['lia']), tree, marks)
    const bram = knowledgeFor(player('marca', ['bram']), tree, marks)
    expect(lia.seesMapItem({ kind: 'pin', id: 'pin', pageId: 'aldoria', hidden: false })).toBe(true)
    expect(lia.seesMapItem({ kind: 'pin', id: 'pin-oculto', pageId: 'aldoria', hidden: true })).toBe(false)
    expect(bram.seesMapItem({ kind: 'pin', id: 'pin-oculto', pageId: 'aldoria', hidden: true })).toBe(true)
    expect(bram.seesMapItem({ kind: 'element', id: 'region', pageId: 'varn', hidden: false })).toBe(false)
  })

  it('una entrada del mundo, solo con su marca', () => {
    const lia = knowledgeFor(player('marca', ['lia']), tree, marks)
    const bram = knowledgeFor(player('marca', ['bram']), tree, marks)
    const deCero = knowledgeFor(player('marca', ['lia'], false), tree, marks)
    expect(lia.seesContent('espada')).toBe(true)
    expect(lia.seesContent('anillo')).toBe(true)
    expect(bram.seesContent('anillo')).toBe(false)
    expect(lia.seesContent('escudo')).toBe(false)
    expect(deCero.seesContent('espada')).toBe(false)
  })

  it('una cronología, solo con su marca; un evento, visible salvo oculto o con su marca', () => {
    const own = (kind: KnowledgeMark['kind'], targetId: string, known: boolean): KnowledgeMark => ({
      campaignId: 'marca',
      kind,
      targetId,
      known,
      characters: null
    })
    const extra = [
      own('chronology', 'historia', true),
      own('event', 'boda', true),
      own('event', 'coronacion', false),
      { ...own('chronology', 'todos', true), campaignId: null }
    ]
    const k = knowledgeFor(player('marca'), tree, [...marks, ...extra])
    expect(k.seesChronology('historia')).toBe(true)
    expect(k.seesChronology('otra')).toBe(false)
    expect(k.seesChronology('todos')).toBe(true)
    expect(knowledgeFor(player('marca', ['lia'], false), tree, extra).seesChronology('todos')).toBe(false)
    expect(k.seesEvent({ id: 'suelto', hidden: false })).toBe(true)
    expect(k.seesEvent({ id: 'oculto', hidden: true })).toBe(false)
    expect(k.seesEvent({ id: 'boda', hidden: true })).toBe(true)
    expect(k.seesEvent({ id: 'coronacion', hidden: false })).toBe(false)
    const master = knowledgeFor({ kind: 'master' }, tree, [])
    expect(master.seesChronology('x')).toBe(true)
    expect(master.seesEvent({ id: 'x', hidden: true })).toBe(true)
  })

  it('el máster lo ve todo', () => {
    const k = knowledgeFor({ kind: 'master' }, tree, marks)
    expect(k.seesSecret('s3', 'varn')).toBe(true)
    expect(k.seesTab({ id: 'x', pageId: 'varn', hidden: true })).toBe(true)
    expect(k.seesMapItem({ kind: 'pin', id: 'x', pageId: 'varn', hidden: true })).toBe(true)
    expect(k.seesContent('escudo')).toBe(true)
  })
})

describe('por qué la ve cada campaña (para el máster)', () => {
  const campaigns = [
    { id: 'marca', knowsWorld: true },
    { id: 'norte', knowsWorld: true },
    { id: 'cero', knowsWorld: false }
  ]

  it('sin marcas: nadie la conoce, y no hay de dónde venga', () => {
    const e = explainPage('taberna', tree, [], campaigns)
    expect(e.world).toEqual({ own: null, known: false, from: null })
    expect(e.campaigns.map((c) => c.audience)).toEqual(['none', 'none', 'none'])
  })

  it('dice su marca propia y de dónde viene lo que ve cada campaña', () => {
    const marks = [page(null, 'sur', true), page('marca', 'capital', true, ['lia']), page('norte', 'taberna', false)]
    const e = explainPage('taberna', tree, marks, campaigns)
    expect(e.world).toEqual({ own: null, known: true, from: { pageId: 'sur', layer: 'world' } })
    expect(e.campaigns).toEqual([
      { campaignId: 'marca', own: null, audience: ['lia'], from: { pageId: 'capital', layer: 'campaign' } },
      {
        campaignId: 'norte',
        own: { known: false, characters: null },
        audience: 'none',
        from: { pageId: 'taberna', layer: 'campaign' }
      },
      { campaignId: 'cero', own: null, audience: 'none', from: null }
    ])
  })

  it('la marca propia del mundo, en la página', () => {
    const e = explainPage('varn', tree, [page(null, 'varn', true)], campaigns)
    expect(e.world).toEqual({ own: { known: true }, known: true, from: { pageId: 'varn', layer: 'world' } })
    expect(e.campaigns[0]).toEqual({
      campaignId: 'marca',
      own: null,
      audience: 'all',
      from: { pageId: 'varn', layer: 'world' }
    })
  })
})
