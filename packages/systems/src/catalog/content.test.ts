import { describe, expect, it } from 'vitest'
import { searchContent } from '../content.ts'
import { validateContent } from '../file.ts'
import * as index from '../index.ts'
import { fiveE } from './5e/system.ts'
import { catalogContent } from './content.ts'

describe('el contenido de los sistemas de serie', () => {
  it('el del 5e valida, con sus dos idiomas y su página en cada documento', () => {
    const content = catalogContent('5e')
    expect(content.length).toBeGreaterThan(0)
    expect(validateContent(fiveE, content)).toEqual([])
    for (const item of content) {
      expect(item.data.name).toMatchObject({ es: expect.any(String), en: expect.any(String) })
      expect(item.ref?.pages).toMatchObject({ es: expect.any(Number), en: expect.any(Number) })
    }
  })

  it('se lee una vez; sin contenido, ninguno; no sale en la entrada del paquete (la web no lo lleva)', () => {
    expect(catalogContent('5e')).toBe(catalogContent('5e'))
    expect(catalogContent('blank')).toEqual([])
    expect(catalogContent('nada')).toEqual([])
    expect(Object.keys(index)).not.toContain('catalogContent')
  })

  it('se busca por su nombre en los dos idiomas, sin tildes, por tipo, por edición y con lo que está en las dos', () => {
    const entries = catalogContent('5e').map(({ key, type, source, concept, data, mechanics }) => ({
      key,
      type,
      source,
      concept,
      name: data.name,
      automation: mechanics?.automation ?? null
    }))
    const names = (options: Parameters<typeof searchContent>[2]) =>
      searchContent(fiveE, entries, options).items.map((h) => `${h.name} ${h.edition}${h.legacy ? ' (legado)' : ''}`)
    expect(names({ query: 'espada' })).toEqual(['Espada larga 2014 (legado)', 'Espada larga 2024'])
    expect(names({ query: 'LONGSWORD', language: 'en' })).toEqual(['Longsword 2014 (legado)', 'Longsword 2024'])
    expect(names({ query: 'cota', duplicates: 'newest' })).toEqual(['Cota de malla 2024'])
    expect(names({ type: 'armadura', editions: ['2014'] })).toEqual(['Cota de malla 2014'])
    expect(searchContent(fiveE, entries, { query: 'malla' }).items[0]).toMatchObject({
      key: 'cota_de_malla_2014',
      type: 'armadura',
      source: 'srd51',
      concept: 'cota_de_malla',
      automation: 'full'
    })
    expect(searchContent(fiveE, entries, { limit: 1, offset: 1 })).toMatchObject({ total: 4, items: [{}] })
  })
})
