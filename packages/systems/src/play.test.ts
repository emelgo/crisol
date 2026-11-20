import { describe, expect, it } from 'vitest'
import { buildCharacter } from './builder.ts'
import { visibleContent } from './content.ts'
import { evaluate } from './evaluate.ts'
import { fiveE } from './examples/5e/system.ts'
import { exampleContent } from './examples/content.ts'
import {
  carriedTypes,
  changeResource,
  fillResources,
  type Play,
  playValues,
  resourceIn,
  resourcePaths,
  rest,
  spend,
  withPlay
} from './play.ts'

const content = exampleContent('5e')
const campaign = { sources: ['srd521'], duplicates: 'newest' as const }
const byKey = new Map(visibleContent(fiveE, content, campaign).map((s) => [s.item.key, s.item]))
const base = buildCharacter(fiveE, content, campaign, {
  scores: { base: { fue: 15, des: 14, con: 14, int: 10, sab: 10, car: 8 } },
  picks: [{ id: 'c1', step: 'clase', key: 'barbaro_2024', level: 2 }]
})
const sheetOf = (play: Play) => {
  const { document } = withPlay(fiveE, 'personaje', base.document, play, byKey)
  const evaluated = evaluate(fiveE, 'personaje', document)
  fillResources(fiveE.types.personaje?.fields ?? {}, evaluated.values, play)
  return evaluated
}
const pg = (values: Record<string, unknown>) => values.pg as { value: number; max: number; temp: number }
const fields = fiveE.types.personaje?.fields ?? {}

describe('lo de la partida', () => {
  it('sin nada guardado, los recursos están llenos; lo que lleva y su estado entran en el cálculo', () => {
    const fresh = sheetOf({})
    expect(pg(fresh.values)).toMatchObject({ value: pg(fresh.values).max })
    const shielded = sheetOf({ items: [{ id: 'e1', key: 'escudo_2024', equipped: true }] })
    expect(shielded.values.ca).toBe((fresh.values.ca as number) + 2)
    const carried = sheetOf({ items: [{ id: 'e1', key: 'escudo_2024', equipped: false }] })
    expect(carried.values.ca).toBe(fresh.values.ca)
    expect(withPlay(fiveE, 'personaje', base.document, { items: [{ id: 'x', key: 'nada' }] }, byKey).missing).toEqual([
      'nada'
    ])
    // Lo calculado no se escribe jugando
    expect(sheetOf({ values: { pg_max: 999 } }).values.pg_max).toBe(fresh.values.pg_max)
  })

  it('daño (primero lo temporal), curación hasta el máximo y temporales (los mayores), de lo guardado', () => {
    const max = pg(sheetOf({}).values).max
    let play: Play = changeResource({}, 'pg', max, { temp: 5 })
    play = changeResource(play, 'pg', max, { damage: 8 })
    expect(pg(sheetOf(play).values)).toMatchObject({ value: max - 3, temp: 0 })
    // Dos cambios seguidos se suman: cada uno parte de lo guardado
    play = changeResource(changeResource(play, 'pg', max, { damage: 1 }), 'pg', max, { damage: 1 })
    expect(pg(sheetOf(play).values).value).toBe(max - 5)
    play = changeResource(play, 'pg', max, { damage: 999 })
    expect(pg(sheetOf(play).values).value).toBe(0)
    play = changeResource(play, 'pg', max, { heal: 999 })
    expect(pg(sheetOf(play).values).value).toBe(max)
    expect(changeResource({ values: { pg: { value: 5, temp: 7 } } }, 'pg', 10, { temp: 3 }).values?.pg).toEqual({
      value: 5,
      temp: 7
    })
    // Lo guardado no pasa del máximo (si bajó de nivel)
    expect(resourceIn({ values: { pg: { value: 50 } } }, 'pg', 20)).toEqual({ value: 20, max: 20, temp: 0 })
    expect(pg(sheetOf({ values: { pg: { value: 999 } } }).values).value).toBe(max)
  })

  it('gastar usos (la Furia) y descansar: el corto recupera lo suyo; el largo, todo y los PG', () => {
    const fresh = sheetOf({})
    const rages = fresh.resources.find((r) => r.key === 'furias')
    if (!rages) throw new Error('Sin furias')
    let play = spend(spend({}, rages, 1), rages, 1)
    expect(sheetOf(play).resources.find((r) => r.key === 'furias')).toMatchObject({ used: 2 })
    play = spend(play, rages, -1)
    play = changeResource(play, 'pg', pg(fresh.values).max, { damage: 5 })
    const spent = sheetOf(play)
    expect(spent.resources.find((r) => r.key === 'furias')).toMatchObject({ used: 1 })
    expect(spend(play, rages, 50).uses?.[rages.item ?? '']?.furias).toBe(rages.max)
    expect(spend(play, rages, -50).uses?.[rages.item ?? '']?.furias).toBe(0)
    // La Furia se recupera con un descanso corto (una) o largo (todas): aquí, el largo
    const afterLong = sheetOf(rest(play, spent.resources, 'long', resourcePaths(fields)))
    expect(afterLong.resources.find((r) => r.key === 'furias')?.used).toBe(0)
    expect(pg(afterLong.values).value).toBe(pg(afterLong.values).max)
    // El corto no llena los PG
    const afterShort = sheetOf(rest(play, spent.resources, 'short', resourcePaths(fields)))
    expect(pg(afterShort.values).value).toBe(pg(fresh.values).max - 5)
    expect(resourcePaths(fields).map((r) => r.path)).toEqual(
      expect.arrayContaining(['pg', 'pacto', 'espacios.n1', 'espacios.n9'])
    )
  })

  it('el descanso corto llena la magia de pacto; lo que vuelve con dados, con lo que sale', () => {
    const paths = resourcePaths(fields)
    expect(paths).toContainEqual({ path: 'pacto', recovery: 'short' })
    const tired: Play = { values: { pacto: { value: 0 }, pg: { value: 1 }, espacios: { n1: { value: 0 } } } }
    const short = rest(tired, [], 'short', paths)
    expect(short.values).toEqual({ pg: { value: 1 }, espacios: { n1: { value: 0 } } })
    expect(rest(tired, [], 'long', paths).values).toEqual({ espacios: {} })
    // Las cargas de una varita: vuelven 1d6+1 al amanecer (aquí salen 3), y si sale más de lo gastado, todas
    const wand = { item: 'v1', key: 'cargas', recovery: 'dawn', amount: '1d6+1' }
    const used: Play = { uses: { v1: { cargas: 5 } } }
    expect(rest(used, [wand], 'long', [], () => 3).uses).toEqual({ v1: { cargas: 2 } })
    expect(rest(used, [wand], 'long', [], () => 9).uses).toEqual({ v1: {} })
    expect(rest(used, [wand], 'short', [], () => 9).uses).toEqual({ v1: { cargas: 5 } })
    // Sin con qué tirar, vuelven todas
    expect(rest(used, [wand], 'long', []).uses).toEqual({ v1: {} })
  })

  it('solo se escribe jugando lo que se cambia jugando, con su forma', () => {
    const good = {
      pg: { value: 3, temp: 2 },
      pg_temporales: 4,
      inspiracion: true,
      cansancio: 2,
      monedas: { po: 12 },
      notas: 'Le debe 10 po a Brom',
      espacios: { n1: { value: 1 } }
    }
    expect(playValues(fields, good)).toEqual({ values: good, problems: [] })
    const bad = playValues(fields, {
      pg_max: 999,
      nada: 1,
      cansancio: 9,
      inspiracion: 'sí',
      pg: { value: 2.5 },
      espacios: { n1: { value: 1, max: 9 } },
      notas: 7
    })
    expect(bad.values).toEqual({})
    expect(bad.problems.map((p) => p.key)).toEqual([
      'pg_max',
      'nada',
      'cansancio',
      'inspiracion',
      'pg',
      'espacios',
      'notas'
    ])
    // Lo que no vale no entra en el cálculo; lo que vale, sí (sobre lo de sus elecciones)
    const fresh = sheetOf({})
    expect(sheetOf({ values: { pg_max: 999 } }).values.pg_max).toBe(fresh.values.pg_max)
    expect((sheetOf({ values: { monedas: { po: 12 } } }).values.monedas as Record<string, unknown>).po).toBe(12)
  })

  it('lo que lleva: solo lo del inventario; lo que no es de él no se lleva', () => {
    expect(carriedTypes(fields)).toEqual(new Set(['arma', 'armadura', 'equipo', 'objeto_magico', 'estado']))
    const played = withPlay(
      fiveE,
      'personaje',
      base.document,
      {
        items: [
          { id: 'g', key: 'guerrero_2024' },
          { id: 'e', key: 'escudo_2024' }
        ]
      },
      byKey
    )
    expect(played.refused).toEqual(['guerrero_2024'])
    expect(played.document.items?.some((it) => it.id === 'p:e')).toBe(true)
    expect(played.document.items?.some((it) => it.id === 'p:g')).toBe(false)
  })

  it('lo gastado de lo suyo (sin objeto) va a su documento', () => {
    const played = withPlay(fiveE, 'personaje', base.document, { uses: { '': { suerte: 1 } } }, byKey)
    expect(played.document.uses).toEqual({ suerte: 1 })
  })
})

describe('una lista en dos idiomas (ADR-0033)', () => {
  it('cada texto, una cadena o { es, en }; nada más', () => {
    const fields = { idiomas: { kind: 'list', label: 'Idiomas', play: true } } as const
    const ok = playValues(fields as never, { idiomas: ['Común', { es: 'Élfico', en: 'Elvish' }] })
    expect(ok.problems).toEqual([])
    expect(playValues(fields as never, { idiomas: [{ fr: 'Elfique' }] }).problems).toHaveLength(1)
    expect(playValues(fields as never, { idiomas: [{ es: 'x'.repeat(201) }] }).problems).toHaveLength(1)
  })
})
