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

  it('los estados: envenenado da desventaja; el cansancio, lo de cada nivel con las reglas que elige la campaña', () => {
    const content = catalogContent('5e')
    const carry = (key: string, data: Record<string, unknown> = {}): DocumentItem => {
      const item = content.find((c) => c.key === key) as ContentItem
      return {
        id: item.concept ?? key,
        type: item.type,
        name: (item.data.name as { es: string }).es,
        data: { ...item.data, ...data },
        ...(item.mechanics ? { mechanics: item.mechanics as Mechanics } : {})
      }
    }
    const data = { caracteristicas: { des: { puntuacion: 14 }, con: { puntuacion: 14 } } }
    const clase = carry('guerrero_2024', { nivel: 1, inicial: true })
    const poisoned = evaluate(fiveE, 'personaje', { data, items: [carry('envenenado_2024')] })
    expect(Object.keys(poisoned.advantages).sort()).toEqual(['ataque', 'habilidad', 'iniciativa', 'prueba'])
    expect(poisoned.advantages.ataque).toEqual([{ mode: 'disadvantage', label: 'Envenenado', origin: 'envenenado' }])
    // Desactivado, nada
    const off = evaluate(fiveE, 'personaje', { data, items: [carry('envenenado_2024', { activo: false })] })
    expect(off.advantages).toEqual({})

    const tired = (reglas: string) =>
      evaluate(
        fiveE,
        'personaje',
        { data, items: [clase, carry('cansancio_2024', { nivel: 3 })] },
        { settings: { reglas } }
      )
    // 2014: velocidad a la mitad, desventaja en pruebas, ataques y salvaciones (también contra la muerte)
    const old = tired('e2014')
    expect(old.values).toMatchObject({ cansancio: 3, velocidad: 15, pg_max: 12 })
    expect(Object.keys(old.advantages).sort()).toEqual([
      'ataque',
      'habilidad',
      'iniciativa',
      'prueba',
      'salvacion',
      'salvacion_muerte'
    ])
    expect(
      evaluate(
        fiveE,
        'personaje',
        { data, items: [clase, carry('cansancio_2014', { nivel: 4 })] },
        {
          settings: { reglas: 'e2014' }
        }
      ).values
    ).toMatchObject({ pg_max: 6, velocidad: 15 })
    // 2024: 1,5 m menos por nivel y −2 por nivel a las pruebas d20, sin desventajas
    const now = tired('e2024')
    expect(now.values).toMatchObject({ cansancio: 3, velocidad: 15, pg_max: 12 })
    expect(now.advantages).toEqual({})
    const doc = { data, items: [clase, carry('cansancio_2024', { nivel: 3 })] }
    const roll = (key: string) =>
      tryRoll(fiveE, 'personaje', doc, key, { element: 'des', roller: () => 10, settings: { reglas: 'e2024' } }).total
    expect([roll('prueba'), roll('salvacion_muerte')]).toEqual([6, 4])

    const stone = evaluate(fiveE, 'personaje', { data, items: [carry('petrificado_2014')] })
    expect(stone.values).toMatchObject({ velocidad: 0, inmunidades: ['veneno'], inmunidades_estados: ['envenenado'] })
    expect(stone.values.resistencias).toHaveLength(13)
  })

  it('los conjuros: su salvación, su daño y su escalado; la curación con su modificador; Armadura de mago', () => {
    const content = catalogContent('5e')
    const carry = (key: string, data: Record<string, unknown> = {}): DocumentItem => {
      const item = content.find((c) => c.key === key) as ContentItem
      return {
        id: item.concept ?? key,
        type: item.type,
        name: (item.data.name as { es: string }).es,
        data: { ...item.data, ...data },
        ...(item.mechanics ? { mechanics: item.mechanics as Mechanics } : {})
      }
    }
    const data = { caracteristicas: { des: { puntuacion: 14 }, int: { puntuacion: 16 }, sab: { puntuacion: 16 } } }
    const fireball = { data, items: [carry('bola_de_fuego_2014', { caracteristica: 'int' })] }
    expect(prepareAction(fiveE, 'personaje', fireball, 'bola_de_fuego', 'lanzar', { level: 3 })).toMatchObject({
      save: { ability: 'des', dc: 13, success: 'half' },
      damage: [{ formula: '8d6', type: 'fuego' }]
    })
    expect(
      prepareAction(fiveE, 'personaje', fireball, 'bola_de_fuego', 'lanzar', { level: 5 }).damage[0]?.formula
    ).toBe('10d6')
    expect(content.find((c) => c.key === 'bola_de_fuego_2014')?.data.clases).toEqual(['hechicero', 'mago'])
    // Un truco escala con el nivel del personaje
    const bolt = { data, items: [carry('guerrero_2024', { nivel: 5 }), carry('descarga_de_fuego_2024')] }
    expect(prepareAction(fiveE, 'personaje', bolt, 'descarga_de_fuego', 'lanzar')).toMatchObject({
      attack: expect.stringMatching(/^1d20/),
      damage: [{ formula: '2d10', type: 'fuego' }]
    })
    const cure = { data, items: [carry('curar_heridas_2024', { caracteristica: 'sab' })] }
    expect(prepareAction(fiveE, 'personaje', cure, 'curar_heridas', 'lanzar', { level: 2 }).heal).toMatchObject({
      formula: '4d8+3'
    })
    // Sin armadura, 13 + Des; con armadura, la de la armadura
    const mage = (armor: boolean) =>
      evaluate(fiveE, 'personaje', {
        data,
        items: [
          carry('armadura_de_mago_2024', { activo: true }),
          ...(armor ? [carry('cota_de_malla_2024', { equipado: true })] : [])
        ]
      }).values.ca
    expect([mage(false), mage(true)]).toEqual([15, 16])
  })

  it('el texto de las reglas: lo de 2014 con versión de 2024 se esconde con lo más nuevo; se busca en los dos idiomas', () => {
    const content = catalogContent('5e')
    const cover = (duplicates: 'newest' | 'both') =>
      visibleContent(fiveE, content, { sources: ['srd51', 'srd521'], duplicates })
        .filter((s) => s.item.concept === 'regla_cobertura')
        .map((s) => [s.item.key, s.legacy])
    expect(cover('newest')).toEqual([['regla_cobertura_2024', false]])
    expect(cover('both')).toEqual([
      ['regla_cobertura_2024', false],
      ['regla_cobertura_2014', true]
    ])
    const entries = content.map((c) => ({ ...c, name: c.data.name }))
    const found = searchContent(fiveE, entries, { query: 'opportunity attacks', type: 'regla' })
    expect(found.items[0]).toMatchObject({ key: 'regla_ataques_de_oportunidad_2024', name: 'Ataques de oportunidad' })
    const glossary = content.find((c) => c.key === 'regla_ataques_de_oportunidad_2024')
    expect(glossary?.data).toMatchObject({ capitulo: { es: 'Glosario de reglas', en: 'Rules Glossary' } })
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
    expect(names({ query: 'espada', type: 'arma' })).toEqual([
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
