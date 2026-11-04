import { describe, expect, it } from 'vitest'
import { prepareAction } from '../actions.ts'
import { resolveConcept, searchContent, visibleContent } from '../content.ts'
import { type DocumentItem, evaluate } from '../evaluate.ts'
import type { ContentItem } from '../file.ts'
import { validateContent } from '../file.ts'
import * as index from '../index.ts'
import type { Mechanics } from '../mechanics.ts'
import { tryRoll } from '../rolls.ts'
import { MEASURED } from './5e/measured.ts'
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

  it('trae lo medido en los PDF, por tipo y edición', () => {
    const counted: Record<string, Record<string, number>> = {}
    for (const item of catalogContent('5e')) {
      const edition = fiveE.sources?.find((s) => s.key === item.source)?.edition ?? '?'
      counted[item.type] = { ...counted[item.type], [edition]: (counted[item.type]?.[edition] ?? 0) + 1 }
    }
    expect(counted).toEqual(MEASURED)
  })

  it('la mecánica del equipo da lo del SRD: la poción cura 2d4 + 2; el ácido de 2024, con su salvación', () => {
    const carry = (key: string): DocumentItem => {
      const item = catalogContent('5e').find((c) => c.key === key)
      if (!item) throw new Error(key)
      return {
        id: key,
        type: item.type,
        name: (item.data.name as { es: string }).es,
        data: item.data,
        ...(item.mechanics ? { mechanics: item.mechanics } : {})
      }
    }
    const doc = {
      data: { caracteristicas: { des: { puntuacion: 14 } } },
      items: [carry('pocion_de_curacion_2024'), carry('acido_2024'), carry('acido_2014')]
    }
    expect(prepareAction(fiveE, 'personaje', doc, 'pocion_de_curacion_2024', 'beber')).toMatchObject({
      activation: 'bonus',
      heal: { formula: '2d4+2', average: 7 }
    })
    expect(prepareAction(fiveE, 'personaje', doc, 'acido_2024', 'lanzar')).toMatchObject({
      save: { ability: 'des', dc: 12 },
      damage: [{ formula: '2d6', type: 'acido', average: 7 }]
    })
    expect(prepareAction(fiveE, 'personaje', doc, 'acido_2014', 'lanzar')).toMatchObject({ attack: '1d20+2', bonus: 2 })
  })

  it('cada concepto al que apunta algo (lo que concede, lo que se elige) existe en su edición', () => {
    const content = catalogContent('5e')
    const seen = visibleContent(fiveE, content, { sources: ['srd51', 'srd521'], duplicates: 'both' })
    const editionOf = (item: ContentItem) => fiveE.sources?.find((s) => s.key === item.source)?.edition
    const missing: string[] = []
    for (const item of content)
      for (const g of item.mechanics?.grants ?? []) {
        const wanted = [
          ...(g.concept ? [{ concept: g.concept, type: g.type }] : []),
          ...(g.choose?.type ? (g.choose.from ?? []).map((concept) => ({ concept, type: g.choose?.type })) : [])
        ]
        for (const w of wanted) {
          const found = resolveConcept(fiveE, seen, w.concept, {
            ...(w.type ? { type: w.type } : {}),
            edition: editionOf(item)
          })
          if (!found || editionOf(found) !== editionOf(item)) missing.push(`${item.key} → ${w.concept}`)
        }
      }
    expect(missing).toEqual([])
  })

  it('el guerrero de nivel 5 del contenido, con cota de malla y espada larga: CA 16, PG 44 y un ataque de +6', () => {
    const content = catalogContent('5e')
    const carry = (
      key: string,
      extra: Partial<DocumentItem> = {},
      data: Record<string, unknown> = {}
    ): DocumentItem => {
      const item = content.find((c) => c.key === key) as ContentItem
      const name = item.data.name as { es: string }
      return {
        id: item.concept ?? key,
        type: item.type,
        name: name.es,
        data: { ...item.data, ...data },
        ...(item.mechanics ? { mechanics: item.mechanics as Mechanics } : {}),
        ...extra
      }
    }
    // La clase y lo que concede hasta su nivel 5 (como lo pondrá el creador), con su equipo
    const clase = carry(
      'guerrero_2024',
      { choices: { habilidades: ['atletismo', 'percepcion'] } },
      { nivel: 5, inicial: true }
    )
    const granted = (clase.mechanics?.grants ?? [])
      .filter((g) => g.concept && (g.level ?? 0) <= 5)
      .map((g) => carry(`${g.concept}_2024`, { from: clase.id }))
    const doc = {
      data: { caracteristicas: { fue: { puntuacion: 16 }, des: { puntuacion: 12 }, con: { puntuacion: 14 } } },
      items: [
        clase,
        ...granted,
        carry('cota_de_malla_2024', {}, { equipado: true }),
        carry('espada_larga_2024', {}, { equipado: true })
      ]
    }
    const r = evaluate(fiveE, 'personaje', doc)
    expect(r.values).toMatchObject({ nivel: 5, competencia: 3, ca: 16, pg_max: 44, ataques: 2 })
    expect(r.computed.ca?.terms).toEqual([{ label: 'Cota de malla', value: 16, kind: 'base', origin: 'cota_de_malla' }])
    expect(r.items.espada_larga).toMatchObject({ ataque: 6, dano_bono: 3 })
    const hab = r.values.habilidades as Record<string, { total: number }>
    expect([hab.atletismo?.total, hab.percepcion?.total]).toEqual([6, 3])
    expect(r.resources.find((x) => x.item === 'guerrero_tomar_aliento')).toMatchObject({
      max: 3,
      recovery: 'short',
      amount: '1'
    })
    expect(prepareAction(fiveE, 'personaje', doc, 'guerrero_tomar_aliento', 'usar')).toMatchObject({
      heal: { formula: '1d10+5' }
    })
    expect(tryRoll(fiveE, 'personaje', doc, 'ataque', { element: 'espada_larga', roller: () => 10 }).total).toBe(16)
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
    expect(names({ query: 'espada larga' })).toEqual(['Espada larga 2014 (legado)', 'Espada larga 2024'])
    expect(names({ query: 'espada' })).toEqual([
      'Espada corta 2014 (legado)',
      'Espada corta 2024',
      'Espada larga 2014 (legado)',
      'Espada larga 2024'
    ])
    expect(names({ query: 'LONGSWORD', language: 'en' })).toEqual(['Longsword 2014 (legado)', 'Longsword 2024'])
    expect(names({ query: 'cota de malla', duplicates: 'newest' })).toEqual(['Cota de malla 2024'])
    expect(names({ type: 'armadura', editions: ['2014'] })).toHaveLength(13)
    expect(names({ type: 'armadura', editions: ['2014'] })).toContain('Cota de malla 2014')
    expect(searchContent(fiveE, entries, { query: 'cota de malla' }).items[0]).toMatchObject({
      key: 'cota_de_malla_2014',
      type: 'armadura',
      source: 'srd51',
      concept: 'cota_de_malla',
      automation: 'full'
    })
    expect(searchContent(fiveE, entries, { limit: 1, offset: 1 })).toMatchObject({ total: entries.length, items: [{}] })
  })
})
