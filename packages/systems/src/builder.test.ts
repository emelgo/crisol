import { describe, expect, it } from 'vitest'
import { applyChoices, type Build, buildCharacter, stepOptions, summarize } from './builder.ts'
import { referenceCharacter } from './catalog/5e/referencia.ts'
import { catalogContent } from './catalog/content.ts'
import { CATALOG } from './catalog/index.ts'
import { evaluate } from './evaluate.ts'
import type { ContentItem } from './file.ts'

const fiveE = CATALOG.find((s) => s.id === '5e')
if (!fiveE) throw new Error('Falta el 5e')
const content = catalogContent('5e')
const campaign = { sources: ['srd51', 'srd521'], duplicates: 'both' as const }
const scores = { fue: 15, des: 14, con: 13, int: 12, sab: 10, car: 8 }
const build = (b: Build) => buildCharacter(fiveE, content, campaign, b)

/** Un valor de la hoja calculada, por su ruta («habilidades.atletismo.grado») */
const valueAt = (values: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), values)

describe('el creador: montar un personaje de sus elecciones', () => {
  it('sin nada, todo pendiente y en creación; los pasos del 5e en su orden', () => {
    const empty = build({})
    expect(empty.steps.map((s) => [s.key, s.pending])).toEqual([
      ['clase', 1],
      ['especie', 1],
      ['trasfondo', 1],
      ['caracteristicas', 1],
      ['detalles', 0],
      ['resumen', 0]
    ])
    expect(empty).toMatchObject({ type: 'personaje', level: 0, complete: false, decisions: [] })
  })

  it('un guerrero de nivel 1: lo que concede entra solo y lo que se elige sale como decisión, con sus opciones', () => {
    const built = build({ picks: [{ id: 'c1', step: 'clase', key: 'guerrero_2014', level: 1 }] })
    expect(built.level).toBe(1)
    const ids = built.decisions.map((d) => d.id)
    expect(ids).toEqual(expect.arrayContaining(['c1>habilidades', 'c1>guerrero_estilo_de_combate@1>estilo']))
    const skills = built.decisions.find((d) => d.id === 'c1>habilidades')
    expect(skills).toMatchObject({ step: 'clase', count: 2, pending: true, chosen: [] })
    expect(skills?.options.map((o) => o.value)).toContain('atletismo')
    const style = built.decisions.find((d) => d.id === 'c1>guerrero_estilo_de_combate@1>estilo')
    expect(style?.options.map((o) => o.label)).toContainEqual({ es: 'Defensa', en: 'Defense' })
    // Su rasgo de nivel 1 está; el de nivel 2, aún no
    const names = built.document.items?.map((i) => i.name) ?? []
    expect(names).toContain('Tomar Aliento')
    expect(names).not.toContain('Acción Súbita')
  })

  it('lo elegido entra: el estilo (con su efecto en la CA) y las habilidades (con su grado)', () => {
    const b: Build = {
      scores: { base: scores },
      picks: [
        { id: 'c1', step: 'clase', key: 'guerrero_2014', level: 1 },
        { id: 'e1', step: 'especie', key: 'enano_de_las_colinas_2014' },
        { id: 't1', step: 'trasfondo', key: 'acolito_2014' }
      ],
      decisions: {
        'c1>habilidades': ['atletismo', 'intimidacion'],
        'c1>guerrero_estilo_de_combate@1>estilo': ['estilo_de_combate_defensa']
      }
    }
    const built = build(b)
    expect(built.decisions.filter((d) => d.pending)).toEqual([])
    expect(built.complete).toBe(true)
    expect(built.steps.every((s) => s.pending === 0)).toBe(true)
    const sheet = evaluate(fiveE, built.type, built.document).values
    expect(valueAt(sheet, 'habilidades.atletismo.grado')).toBe(1)
    expect(valueAt(sheet, 'habilidades.perspicacia.grado')).toBe(1) // del acólito
    // Enano de las colinas: +2 Con (enano) y +1 Sab (colinas); su PG por nivel
    expect(valueAt(sheet, 'caracteristicas.con.puntuacion')).toBe(15)
    expect(valueAt(sheet, 'caracteristicas.sab.puntuacion')).toBe(11)
    expect(valueAt(sheet, 'pg_max')).toBe(10 + 2 + 1)
    expect(valueAt(sheet, 'velocidad')).toBe(25)
  })

  it('lo de un nivel más alto entra al subir: la subclase a nivel 3; a nivel 5, igual que el de referencia', () => {
    const at = (level: number) =>
      build({
        scores: { base: scores },
        picks: [{ id: 'c1', step: 'clase', key: 'guerrero_2014', level }],
        decisions: { 'c1>subclase@3': ['campeon'] }
      })
    expect(at(2).decisions.map((d) => d.id)).not.toContain('c1>subclase@3')
    const five = at(5)
    expect(five.decisions.find((d) => d.id === 'c1>subclase@3')).toMatchObject({ pending: false, chosen: ['campeon'] })
    const mine = evaluate(fiveE, 'personaje', five.document).values
    const reference = evaluate(
      fiveE,
      'personaje',
      referenceCharacter(content, { klass: 'guerrero', edition: '2014', level: 5, scores })
    ).values
    for (const key of ['nivel', 'competencia', 'pg_max', 'ca', 'ataques', 'critico_desde'])
      expect([key, valueAt(mine, key)]).toEqual([key, valueAt(reference, key)])
  })

  it('una elección que ya no vale se quita; lo que ya no está en el contenido de la campaña sale como pendiente', () => {
    const built = build({
      picks: [
        { id: 'c1', step: 'clase', key: 'guerrero_2014', level: 1 },
        { id: 'e1', step: 'especie', key: 'no_existe_2014' }
      ],
      decisions: { 'c1>habilidades': ['atletismo', 'volar'] }
    })
    expect(built.decisions.find((d) => d.id === 'c1>habilidades')?.chosen).toEqual(['atletismo'])
    expect(built.missing).toEqual(['no_existe_2014'])
    expect(built.steps.find((s) => s.key === 'especie')?.pending).toBe(2)
    // Con solo la de 2014, lo de 2024 no está
    const only2014 = buildCharacter(
      fiveE,
      content,
      { sources: ['srd51'], duplicates: 'both' },
      {
        picks: [{ id: 'c1', step: 'clase', key: 'guerrero_2024', level: 1 }]
      }
    )
    expect(only2014.missing).toEqual(['guerrero_2024'])
    expect(only2014.level).toBe(0)
  })

  it('las opciones de un paso: la subraza, no la raza que concede; la que ya tiene, no; y su motivo', () => {
    const species = stepOptions(fiveE, content, campaign, {}, 'especie', {})
    const keys = species.map((o) => o.value)
    expect(keys).toContain('enano_de_las_colinas_2014')
    expect(keys).not.toContain('enano_2014')
    expect(keys).toContain('humano_2014')
    const classes = stepOptions(
      fiveE,
      content,
      campaign,
      { picks: [{ id: 'c1', step: 'clase', key: 'guerrero_2014', level: 1 }] },
      'clase',
      {}
    )
    expect(classes.find((o) => o.value === 'guerrero_2014')).toMatchObject({
      available: false,
      reason: { es: 'Ya la tienes' }
    })
    expect(stepOptions(fiveE, content, campaign, {}, 'caracteristicas', {})).toEqual([])
  })

  it('su resumen: la especie y las clases con su nivel, y los campos de la tarjeta', () => {
    const b: Build = {
      scores: { base: scores },
      picks: [
        { id: 'c1', step: 'clase', key: 'guerrero_2014', level: 4 },
        { id: 'c2', step: 'clase', key: 'mago_2014', level: 1 },
        { id: 'e1', step: 'especie', key: 'enano_de_las_colinas_2014' },
        { id: 't1', step: 'trasfondo', key: 'acolito_2014' }
      ]
    }
    const built = build(b)
    expect(built.level).toBe(5)
    const values = evaluate(fiveE, built.type, built.document).values
    expect(summarize(fiveE, content, campaign, b, built, values)).toEqual({
      line: 'Enano de las colinas · Guerrero 4 · Mago 1',
      level: 5,
      stats: [
        { key: 'nivel', label: 'Nivel', value: '5' },
        { key: 'pg_max', label: 'Puntos de golpe máximos', value: expect.any(String) },
        { key: 'ca', label: 'Clase de armadura', value: '12' }
      ]
    })
    // El mago, la segunda: no es la inicial (sus salvaciones no cuentan)
    expect(built.document.items?.find((i) => i.id === 'c2')?.data).toMatchObject({ nivel: 1, inicial: false })
  })

  it('cuántos se eligen sale de una fórmula sobre lo que lo concede: las maestrías del guerrero, por su nivel', () => {
    const masteries = (level: number) =>
      build({ picks: [{ id: 'c1', step: 'clase', key: 'guerrero_2024', level }] }).decisions.find((d) =>
        d.id.endsWith('>maestrias')
      )
    expect(masteries(1)?.count).toBe(3)
    expect(masteries(4)?.count).toBe(4)
    expect(masteries(1)?.options.length).toBeGreaterThan(10)
  })

  it('la multiclase: la primera clase no pide nada; añadir otra pide lo suyo y lo de las que tiene, con su motivo', () => {
    const first = stepOptions(fiveE, content, campaign, {}, 'clase', { caracteristicas: { int: { puntuacion: 8 } } })
    expect(first.find((o) => o.value === 'mago_2014')?.available).toBe(true)
    const withFighter: Build = { picks: [{ id: 'c1', step: 'clase', key: 'guerrero_2014', level: 4 }] }
    const low = { caracteristicas: { fue: { puntuacion: 15 }, int: { puntuacion: 12 }, des: { puntuacion: 10 } } }
    expect(
      stepOptions(fiveE, content, campaign, withFighter, 'clase', low).find((o) => o.value === 'mago_2014')
    ).toEqual({
      value: 'mago_2014',
      label: { es: 'Mago', en: 'Wizard' },
      available: false,
      reason: { es: 'Necesitas Inteligencia 13', en: 'Requires Intelligence 13' }
    })
    const high = { caracteristicas: { ...low.caracteristicas, int: { puntuacion: 13 } } }
    expect(
      stepOptions(fiveE, content, campaign, withFighter, 'clase', high).find((o) => o.value === 'mago_2014')?.available
    ).toBe(true)
  })

  it('la mejora de característica (2014): +2 a una o +1 a dos, como mucho dos veces la misma', () => {
    const b = (chosen: string[]): Build => ({
      scores: { base: scores },
      picks: [{ id: 'c1', step: 'clase', key: 'barbaro_2014', level: 4 }],
      decisions: { 'c1>barbaro_mejora_de_caracteristica@4>mejora': chosen }
    })
    const built = build(b(['fue', 'fue', 'fue']))
    const asi = built.decisions.find((d) => d.id === 'c1>barbaro_mejora_de_caracteristica@4>mejora')
    expect(asi).toMatchObject({ count: 2, repeat: true, most: 2, chosen: ['fue', 'fue'], pending: false })
    const sheet = evaluate(fiveE, 'personaje', built.document).values
    expect(valueAt(sheet, 'caracteristicas.fue.puntuacion')).toBe(17)
  })

  it('los aumentos de un trasfondo de 2024: de sus tres características, +2 y +1 o +1 a las tres', () => {
    const b = (chosen: string[]): Build => ({
      scores: { base: scores },
      picks: [{ id: 't1', step: 'trasfondo', key: 'acolito_2024' }],
      decisions: { 't1>aumentos': chosen }
    })
    const built = build(b(['int', 'int', 'sab']))
    const increases = built.decisions.find((d) => d.id === 't1>aumentos')
    expect(increases?.options.map((o) => o.value)).toEqual(['int', 'sab', 'car'])
    expect(increases).toMatchObject({ count: 3, most: 2, pending: false })
    const sheet = evaluate(fiveE, 'personaje', built.document).values
    expect([
      valueAt(sheet, 'caracteristicas.int.puntuacion'),
      valueAt(sheet, 'caracteristicas.sab.puntuacion')
    ]).toEqual([14, 11])
  })

  it('lo elegido que sobra (al bajar de nivel) o no vale no entra en la hoja, aunque siga en sus elecciones', () => {
    const level4 = build({ picks: [{ id: 'c1', step: 'clase', key: 'guerrero_2024', level: 4 }] })
    const masteries = level4.decisions.find((d) => d.id.endsWith('>maestrias'))
    const weapons = masteries?.options.map((o) => o.value) ?? []
    const at = (level: number, chosen: string[]) =>
      build({
        picks: [{ id: 'c1', step: 'clase', key: 'guerrero_2024', level }],
        decisions: { [masteries?.id ?? '']: chosen }
      })
    const carried = (b: ReturnType<typeof build>) =>
      (b.document.items ?? []).filter((i) => i.id.includes('>maestrias=')).length
    expect(carried(at(4, weapons.slice(0, 4)))).toBe(4)
    expect(carried(at(3, weapons.slice(0, 4)))).toBe(3)
    expect(carried(at(1, weapons.slice(0, 12)))).toBe(3)
    // Una clave de otro tipo no vale aunque exista
    expect(carried(at(1, ['bola_de_fuego_2024']))).toBe(0)
  })

  it('a nivel 20, lo pendiente se calcula en menos de 20 ms', () => {
    const b: Build = {
      scores: { base: scores },
      picks: [{ id: 'c1', step: 'clase', key: 'mago_2024', level: 20 }],
      decisions: { 'c1>subclase@3': ['evocador'] }
    }
    build(b)
    const start = performance.now()
    for (let i = 0; i < 5; i++) build(b)
    expect((performance.now() - start) / 5).toBeLessThan(20)
  })
})

describe('el creador de otro juego: el de 2d6, con sus pasos', () => {
  it('sus atributos a mano y dos movimientos; su tarjeta, con la defensa', async () => {
    const { fronteras } = await import('./fixtures/fronteras.ts')
    const move = (key: string, name: string): ContentItem => ({
      type: 'movimiento',
      key,
      source: null,
      data: { name, atributo: 'vigor', descripcion: name }
    })
    const content = [move('cargar', 'Cargar'), move('esquivar', 'Esquivar'), move('enganar', 'Engañar')]
    const choices = { sources: [], duplicates: 'both' as const }
    const empty = buildCharacter(fronteras, content, choices, {})
    expect(empty.steps.map((s) => [s.key, s.pending])).toEqual([
      ['atributos', 0],
      ['movimientos', 1],
      ['resumen', 0]
    ])
    let b: Build = { values: { vigor: 2, astucia: 1, presencia: 0 } }
    b = applyChoices(fronteras, b, { add: [{ step: 'movimientos', key: 'cargar' }] }, () => 'm1')
    b = applyChoices(fronteras, b, { add: [{ step: 'movimientos', key: 'esquivar' }] }, () => 'm2')
    expect(() => applyChoices(fronteras, b, { add: [{ step: 'movimientos', key: 'enganar' }] }, () => 'm3')).toThrow(
      'como mucho 2'
    )
    const built = buildCharacter(fronteras, content, choices, b)
    expect(built.complete).toBe(true)
    const values = evaluate(fronteras, built.type, built.document).values
    expect(values.defensa).toBe(9)
    expect(summarize(fronteras, content, choices, b, built, values).stats).toEqual([
      { key: 'defensa', label: 'Defensa', value: '9' }
    ])
  })
})
