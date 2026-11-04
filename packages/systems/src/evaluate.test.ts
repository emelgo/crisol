import { describe, expect, it } from 'vitest'
import { type DocumentItem, evaluate } from './evaluate.ts'
import { cinco } from './fixtures/cinco.ts'
import { fronteras } from './fixtures/fronteras.ts'
import type { System } from './format.ts'

const escudo = (equipado: boolean): DocumentItem => ({
  id: 'i1',
  type: 'objeto',
  name: 'Escudo de roble',
  data: { equipado, defensa: 1 }
})

describe('calcular un personaje de Fronteras', () => {
  it('la defensa, con su desglose y el bono del escudo si va equipado', () => {
    const on = evaluate(fronteras, 'personaje', { data: { vigor: 2 }, items: [escudo(true)] })
    expect(on.computed.defensa).toEqual({
      value: 10,
      terms: [
        { label: 'Base', value: 7, kind: 'base' },
        { label: 'Vigor', value: 2, kind: 'field' },
        { label: 'Escudo de roble', value: 1, kind: 'bonus', origin: 'i1' }
      ]
    })
    expect(on.values.defensa).toBe(10)
    const off = evaluate(fronteras, 'personaje', { data: { vigor: 2 }, items: [escudo(false)] })
    expect(off.computed.defensa?.value).toBe(9)
    expect(off.computed.defensa?.terms.map((t) => t.label)).toEqual(['Base', 'Vigor'])
  })

  it('lo que falta, con su valor inicial; lo que no cuadra, marcado y conservado', () => {
    const empty = evaluate(fronteras, 'personaje', { data: {} })
    expect(empty.values).toMatchObject({ vigor: 0, defensa: 7, carga: 3, heridas: { value: 0, max: 6, temp: 0 } })
    expect(empty.problems).toEqual([])
    const wrong = evaluate(fronteras, 'personaje', { data: { vigor: 9, astucia: 'dos', experiencia: 12 } })
    expect(wrong.problems).toEqual([
      { path: 'vigor', message: 'Por encima del máximo (3)' },
      { path: 'astucia', message: 'Tiene que ser un número' },
      { path: 'experiencia', message: 'Por encima del máximo (8)' }
    ])
    // Se conserva: se calcula con lo que hay
    expect(wrong.values.vigor).toBe(9)
    expect(wrong.values.defensa).toBe(16)
    expect(wrong.values.astucia).toBe(0)
  })

  it('el valor fijado a mano manda, y sale en el desglose', () => {
    const fixed = evaluate(fronteras, 'personaje', { data: { vigor: 1 }, overrides: { defensa: 12 } })
    expect(fixed.computed.defensa?.value).toBe(12)
    expect(fixed.computed.defensa?.terms.at(-1)).toEqual({ label: 'Fijado a mano', value: 12, kind: 'override' })
    expect(fixed.values.defensa).toBe(12)
  })

  it('con poco presupuesto, lo calculado dice el error y lo guardado sigue', () => {
    const tight = evaluate(fronteras, 'personaje', { data: { vigor: 2 } }, { budget: 3 })
    expect(tight.computed.carga?.error ?? tight.computed.defensa?.error).toBe('La fórmula tarda demasiado')
    expect(tight.values.vigor).toBe(2)
  })
})

describe('calcular un personaje del 5e de prueba', () => {
  const doc = {
    data: { nivel: 5, caracteristicas: { des: { puntuacion: 14 }, con: { puntuacion: 12 }, fue: { puntuacion: 8 } } },
    items: [
      { id: 'anillo', type: 'objeto', name: 'Anillo de protección', data: { equipado: true, bono_ca: 1 } },
      { id: 'escudo', type: 'objeto', name: 'Escudo', data: { equipado: true, bono_ca: 2, peso: 6 } },
      { id: 'cuerda', type: 'objeto', name: 'Cuerda', data: { equipado: false, peso: 10 } }
    ]
  }

  it('la CA dice de dónde sale cada punto', () => {
    const r = evaluate(cinco, 'personaje', doc)
    expect(r.computed.ca).toEqual({
      value: 15,
      terms: [
        { label: 'Base', value: 10, kind: 'base' },
        { label: 'Destreza', value: 2, kind: 'field' },
        { label: 'Anillo de protección', value: 1, kind: 'bonus', origin: 'anillo' },
        { label: 'Escudo', value: 2, kind: 'bonus', origin: 'escudo' }
      ]
    })
  })

  it('cada elemento de un conjunto con su @este, la competencia y el máximo de un recurso', () => {
    const r = evaluate(cinco, 'personaje', doc)
    const caracteristicas = r.values.caracteristicas as Record<string, Record<string, unknown>>
    expect(caracteristicas.des).toMatchObject({ puntuacion: 14, mod: 2, key: 'des', label: 'Destreza' })
    expect(caracteristicas.fue?.mod).toBe(-1)
    expect(caracteristicas.sab?.mod).toBe(0)
    expect(r.values.competencia).toBe(3)
    expect(r.values.pg).toEqual({ value: 0, max: 35, temp: 0 })
    expect(r.computed['caracteristicas.des.mod']?.value).toBe(2)
    expect(r.computed['pg.max']?.value).toBe(35)
  })

  it('en inglés, los nombres del desglose en inglés', () => {
    const r = evaluate(cinco, 'personaje', doc, { language: 'en' })
    expect(r.computed.ca?.terms[1]?.label).toBe('Dexterity')
  })
})

describe('las fórmulas al calcular', () => {
  const withField = (key: string, field: unknown, items: DocumentItem[] = []) => {
    const system: System = structuredClone(cinco)
    ;(system.types.personaje?.fields as Record<string, unknown>)[key] = field
    return (data: Record<string, unknown> = {}) => evaluate(system, 'personaje', { data, items })
  }

  it('sumar una lista de lo que lleva, contar y elegir un elemento por su clave', () => {
    const items: DocumentItem[] = [
      { id: 'a', type: 'objeto', name: 'A', data: { peso: 6 } },
      { id: 'b', type: 'objeto', name: 'B', data: { peso: 10 } }
    ]
    expect(
      withField('carga', { kind: 'derived', label: 'Carga', formula: 'sum(@lleva.peso)' }, items)().values.carga
    ).toBe(16)
    expect(
      withField('cuantos', { kind: 'derived', label: 'Cuántos', formula: 'count(@lleva)' }, items)().values.cuantos
    ).toBe(2)
    const pick = withField('mejor', { kind: 'derived', label: 'Mejor', formula: '@caracteristicas[@favorita].mod' })
    const system = structuredClone(cinco)
    ;(system.types.personaje?.fields as Record<string, unknown>).favorita = { kind: 'text', label: 'Favorita' }
    ;(system.types.personaje?.fields as Record<string, unknown>).mejor = {
      kind: 'derived',
      label: 'Mejor',
      formula: '@caracteristicas[@favorita].mod'
    }
    const r = evaluate(system, 'personaje', { data: { favorita: 'des', caracteristicas: { des: { puntuacion: 18 } } } })
    expect(r.values.mejor).toBe(4)
    expect(pick().values.mejor).toBeNull()
  })

  it('un recurso se usa como su valor; condiciones, comparaciones con nada y lógica', () => {
    const f = withField('herido', {
      kind: 'derived',
      label: 'Herido',
      formula: '@pg < @pg.max / 2 && @nivel != null ? "sí" : "no"'
    })
    expect(f({ nivel: 2, pg: { value: 3 } }).values.herido).toBe('sí')
    expect(f({ nivel: 2, pg: { value: 30 } }).values.herido).toBe('no')
    const g = withField('x', {
      kind: 'derived',
      label: 'X',
      formula: '!(@nivel > 3) || false ? -@nivel % 3 : max(1, 2, 3)'
    })
    expect(g({ nivel: 2 }).values.x).toBe(-2)
    expect(g({ nivel: 5 }).values.x).toBe(3)
  })

  it('dividir entre cero dice el error en ese valor, y los demás siguen', () => {
    const r = withField('roto', { kind: 'derived', label: 'Roto', formula: '10 / (@nivel - 1)' })({ nivel: 1 })
    expect(r.computed.roto).toEqual({ value: null, terms: [], error: 'División entre cero' })
    expect(r.values.competencia).toBe(2)
  })

  it('un bono a un número guardado: lo guardado más el bono, con su desglose', () => {
    const system: System = structuredClone(fronteras)
    ;((system.types.objeto?.modifiers ?? []) as unknown[]).push({ target: 'vigor', value: '1', when: '@equipado' })
    const r = evaluate(system, 'personaje', { data: { vigor: 1 }, items: [escudo(true)] })
    expect(r.computed.vigor).toEqual({
      value: 2,
      terms: [
        { label: 'Vigor', value: 1, kind: 'field' },
        { label: 'Escudo de roble', value: 1, kind: 'bonus', origin: 'i1' }
      ]
    })
    // Y lo que depende de él lo usa
    expect(r.values.defensa).toBe(10)
  })

  it('un valor que no es un número, sin desglose; un tipo que no existe, un error', () => {
    const r = withField('nombre_largo', { kind: 'derived', label: 'Nombre', formula: '@nivel > 3' })({ nivel: 5 })
    expect(r.computed.nombre_largo).toEqual({ value: true, terms: [] })
    expect(() => evaluate(cinco, 'nada', { data: {} })).toThrow('No existe el tipo «nada»')
  })
})
