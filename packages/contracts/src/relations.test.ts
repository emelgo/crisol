import { describe, expect, it } from 'vitest'
import { pageProperty } from './pages.ts'
import { getRelations, getWorldGraph } from './relations.ts'
import { updateTemplate } from './templates.ts'

const padres = { name: 'Padres', field: 'padres', type: 'pages', value: [] }

describe('el papel de un campo de enlace (módulo 10)', () => {
  it('un campo de páginas lleva un papel y un nombre al revés, y no se pierden', () => {
    const parsed = pageProperty.parse({ ...padres, role: 'parent', inverseName: 'Hijos' })
    expect(parsed).toMatchObject({ role: 'parent', inverseName: 'Hijos' })
    for (const role of ['parent', 'partner', 'member-of', 'leads'])
      expect(pageProperty.safeParse({ ...padres, role }).success).toBe(true)
    expect(pageProperty.safeParse({ ...padres, role: 'enemy' }).success).toBe(false)
    expect(pageProperty.safeParse({ ...padres, inverseName: '  ' }).success).toBe(false)
  })

  it('cambiar_plantilla los acepta en sus campos', () => {
    const input = updateTemplate.input.parse({
      templateId: crypto.randomUUID(),
      fields: [{ ...padres, role: 'parent', inverseName: 'Hijos' }]
    })
    expect(input.fields?.[0]).toMatchObject({ role: 'parent', inverseName: 'Hijos' })
  })
})

describe('las relaciones de una página y el grafo del mundo', () => {
  const pageId = crypto.randomUUID()

  it('profundidad de 1 a 3 (1 si no se dice) y tres modos (enlaces si no se dice)', () => {
    expect(getRelations.input.parse({ pageId })).toMatchObject({ depth: 1, mode: 'links' })
    expect(getRelations.input.safeParse({ pageId, depth: 4 }).success).toBe(false)
    expect(getRelations.input.safeParse({ pageId, depth: 0 }).success).toBe(false)
    expect(getRelations.input.safeParse({ pageId, mode: 'org' }).success).toBe(true)
    expect(getRelations.input.safeParse({ pageId, mode: 'family' }).success).toBe(true)
    expect(getRelations.input.safeParse({ pageId, mode: 'tree' }).success).toBe(false)
  })

  it('el grafo del mundo: sin páginas sueltas si no se piden, con sus filtros', () => {
    const worldId = crypto.randomUUID()
    expect(getWorldGraph.input.parse({ worldId })).toMatchObject({ orphans: false })
    expect(
      getWorldGraph.input.safeParse({ worldId, templates: ['pnj'], relations: ['mention'], tags: ['lugar/ciudad'] })
        .success
    ).toBe(true)
  })
})
