import { describe, expect, it } from 'vitest'
import { buildCharacter } from './builder.ts'
import { catalogContent } from './catalog/content.ts'
import { CATALOG } from './catalog/index.ts'
import { visibleContent } from './content.ts'
import { evaluate } from './evaluate.ts'
import { changeResource, fillResources, type Play, resourcePaths, rest, spend, withPlay } from './play.ts'

const fiveE = CATALOG.find((s) => s.id === '5e')
if (!fiveE) throw new Error('Falta el 5e')
const content = catalogContent('5e')
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

  it('daño (primero lo temporal), curación hasta el máximo y temporales (los mayores)', () => {
    const max = pg(sheetOf({}).values).max
    let play: Play = changeResource({}, 'pg', { value: max, max, temp: 0 }, { temp: 5 })
    play = changeResource(play, 'pg', { value: max, max, temp: 5 }, { damage: 8 })
    expect(pg(sheetOf(play).values)).toMatchObject({ value: max - 3, temp: 0 })
    play = changeResource(play, 'pg', { value: max - 3, max, temp: 0 }, { damage: 999 })
    expect(pg(sheetOf(play).values).value).toBe(0)
    play = changeResource(play, 'pg', { value: 0, max, temp: 0 }, { heal: 999 })
    expect(pg(sheetOf(play).values).value).toBe(max)
    expect(changeResource({}, 'pg', { value: 5, max: 10, temp: 7 }, { temp: 3 }).values?.pg).toEqual({
      value: 5,
      temp: 7
    })
  })

  it('gastar usos (la Furia) y descansar: el corto recupera lo suyo; el largo, todo y los PG', () => {
    const fresh = sheetOf({})
    const rages = fresh.resources.find((r) => r.key === 'furias')
    if (!rages) throw new Error('Sin furias')
    let play = spend({}, rages, 1)
    play = changeResource(play, 'pg', { ...pg(fresh.values), temp: 0 }, { damage: 5 })
    const spent = sheetOf(play)
    expect(spent.resources.find((r) => r.key === 'furias')).toMatchObject({ used: 1 })
    expect(spend(play, { ...rages, used: rages.max }, 5).uses?.[rages.item ?? '']?.furias).toBe(rages.max)
    // La Furia se recupera con un descanso corto (una) o largo (todas): aquí, el largo
    const afterLong = sheetOf(rest(play, spent.resources, 'long', resourcePaths(fiveE.types.personaje?.fields ?? {})))
    expect(afterLong.resources.find((r) => r.key === 'furias')?.used).toBe(0)
    expect(pg(afterLong.values).value).toBe(pg(afterLong.values).max)
    // El corto no llena los PG
    const afterShort = sheetOf(rest(play, spent.resources, 'short', resourcePaths(fiveE.types.personaje?.fields ?? {})))
    expect(pg(afterShort.values).value).toBe(pg(fresh.values).max - 5)
    expect(resourcePaths(fiveE.types.personaje?.fields ?? {})).toEqual(
      expect.arrayContaining(['pg', 'pacto', 'espacios.n1', 'espacios.n9'])
    )
  })
})
