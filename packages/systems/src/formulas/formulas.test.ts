import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cinco } from '../fixtures/cinco.ts'
import { fronteras } from '../fixtures/fronteras.ts'
import type { System } from '../format.ts'
import { validateSystem } from '../validate.ts'
import { type Context, checkFormula, closest, scopeOf } from './check.ts'
import { type Expr, FormulaError, parseFormula, referencesOf } from './parse.ts'

/** El árbol sin posiciones, para compararlo */
const bare = (e: Expr): unknown => {
  const { start: _s, end: _e, ...rest } = e as Expr & Record<string, unknown>
  return Object.fromEntries(
    Object.entries(rest).map(([k, v]) => [
      k,
      Array.isArray(v)
        ? v.map((x) => (typeof x === 'object' && x && 'kind' in x ? bare(x as Expr) : x))
        : typeof v === 'object' && v && 'kind' in v && k !== 'term'
          ? bare(v as Expr)
          : v
    ])
  )
}
const tree = (text: string) => bare(parseFormula(text))
const failure = (text: string) => {
  try {
    parseFormula(text)
  } catch (error) {
    if (error instanceof FormulaError) return { message: error.message, start: error.start }
    throw error
  }
  throw new Error(`«${text}» no falla`)
}

describe('leer una fórmula', () => {
  it('números, referencias con @ y operaciones, con su precedencia', () => {
    expect(tree('10 + @des.mod * 2')).toEqual({
      kind: 'binary',
      op: '+',
      left: { kind: 'number', value: 10 },
      right: {
        kind: 'binary',
        op: '*',
        left: { kind: 'ref', path: ['des', 'mod'] },
        right: { kind: 'number', value: 2 }
      }
    })
    expect(tree('(1 + 2) * 3')).toMatchObject({ op: '*', left: { op: '+' } })
    expect(tree('-@vigor')).toEqual({ kind: 'unary', op: '-', value: { kind: 'ref', path: ['vigor'] } })
    expect(tree('7 % 2')).toMatchObject({ op: '%' })
  })

  it('comparaciones, lógica y «? :»', () => {
    expect(tree('@nivel >= 5 ? 2 : 1')).toMatchObject({
      kind: 'conditional',
      test: { op: '>=' },
      then: { value: 2 },
      else: { value: 1 }
    })
    expect(tree('@a && !@b || @c')).toMatchObject({ op: '||', left: { op: '&&', right: { kind: 'unary', op: '!' } } })
    expect(tree('@objetivo != null')).toMatchObject({ op: '!=', right: { kind: 'null' } })
    expect(tree('@talla == "mediana"')).toMatchObject({ right: { kind: 'string', value: 'mediana' } })
    expect(tree("true == 'x'")).toMatchObject({ left: { kind: 'boolean', value: true } })
  })

  it('los dados, como los entiende @crisol/dice; sus modificadores, pegados', () => {
    expect(tree('1d20 + @fue.mod')).toMatchObject({
      left: { kind: 'dice', text: '1d20', term: { count: 1, sides: 20 } }
    })
    expect(tree('4d6kh3')).toMatchObject({ kind: 'dice', term: { keep: { mode: 'kh', n: 3 } } })
    expect(tree('d%')).toMatchObject({ kind: 'dice', term: { sides: 100 } })
    // Pegado cuenta éxitos; con espacios, compara
    expect(tree('5d10>=8')).toMatchObject({ kind: 'dice', term: { success: { op: '>=', value: 8 } } })
    expect(tree('2d6 >= 10')).toMatchObject({ kind: 'binary', op: '>=', left: { kind: 'dice' } })
    expect(tree('1d20[ataque] + 5')).toMatchObject({ left: { term: { label: 'ataque' } } })
    expect(failure('3d6kh4').message).toBe('No se puede quedar con 4 de 3 dados')
  })

  it('funciones y elementos de un conjunto', () => {
    expect(tree('max(@des.mod, @fue.mod)')).toMatchObject({
      kind: 'call',
      name: 'max',
      args: [{ path: ['des', 'mod'] }, { path: ['fue', 'mod'] }]
    })
    expect(tree('floor((@nivel + 1) / 2)')).toMatchObject({ kind: 'call', name: 'floor' })
    expect(tree('count()')).toMatchObject({ kind: 'call', args: [] })
    expect(tree('@caracteristicas[@este.car].mod')).toMatchObject({
      path: ['caracteristicas', { kind: 'ref', path: ['este', 'car'] }, 'mod']
    })
  })

  it('lo que escribe una persona: ×, ÷ y el menos tipográfico', () => {
    expect(tree('@a × 2 ÷ 3 − 1')).toMatchObject({ op: '-', left: { op: '/', left: { op: '*' } } })
  })

  it('un error dice qué y dónde', () => {
    expect(failure('')).toMatchObject({ message: 'Escribe una fórmula, como 10 + @des.mod' })
    expect(failure('7 +')).toEqual({ message: 'No se entiende «7 +» al final', start: 3 })
    expect(failure('7 + )')).toMatchObject({ message: 'No se entiende «7 + )» cerca de «)»' })
    expect(failure('vigor + 1').message).toBe('«vigor» suelto: los valores van con @ (@vigor)')
    expect(failure('@').message).toBe('Falta el nombre tras «@»')
    expect(failure('@a.').message).toBe('Falta el nombre tras «.»')
    expect(failure('(1 + 2').message).toBe('Falta «)» en «(1 + 2»')
    expect(failure('max(1, 2').message).toBe('Falta «)» al final de max(…)')
    expect(failure('@a ? 1').message).toBe('Falta «:» en «… ? … : …»')
    expect(failure('"hola').message).toBe('Falta cerrar el texto con "')
    expect(failure('@a = 1')).toEqual({ message: 'Para comparar se escribe «==»', start: 3 })
    expect(failure('@a & @b').message).toBe('Para «y» se escribe «&&»')
    expect(failure('@a | @b').message).toBe('Para «o» se escribe «||»')
    expect(failure('1 === 1').message).toMatch(/^No se entiende/)
    expect(failure(`${'('.repeat(70)}1${')'.repeat(70)}`).message).toBe('Demasiados paréntesis unos dentro de otros')
    expect(failure('1'.repeat(2001)).message).toBe('Como mucho, 2000 caracteres')
  })

  it('sus referencias, para el @ del editor y para saber de qué depende', () => {
    expect(referencesOf(parseFormula('@a + max(@b.c, @d[@e]) + (@f ? 1 : -@g)')).map((r) => r.path[0])).toEqual([
      'a',
      'b',
      'd',
      'e',
      'f',
      'g'
    ])
  })
})

describe('comprobar una fórmula en su sitio', () => {
  const personaje = fronteras.types.personaje as System['types'][string]
  const context = (dice = false): Context => ({
    scope: scopeOf(personaje.fields, '', 'Personaje', fronteras),
    dice,
    owner: 'Personaje'
  })
  const problems = (formula: string, dice = false) =>
    checkFormula(formula, context(dice)).problems.map((p) => p.message)

  it('lo que existe pasa, con su tipo', () => {
    expect(checkFormula('7 + @vigor', context())).toMatchObject({ type: 'number', problems: [] })
    expect(checkFormula('@heridas >= @heridas.max', context()).type).toBe('boolean')
    expect(checkFormula('sum(@lleva.peso)', context()).problems).toEqual([])
    expect(checkFormula('2d6 + @vigor', context(true)).type).toBe('dice')
  })

  it('una errata, con su sugerencia y dónde está', () => {
    const checked = checkFormula('7 + @vigr', context())
    expect(checked.problems).toEqual([
      { message: 'No existe «@vigr» en Personaje. ¿Quizás «@vigor»?', start: 4, end: 9 }
    ])
    expect(problems('@zzz')).toEqual(['No existe «@zzz» en Personaje'])
    expect(problems('@heridas.maximo')).toEqual(['«maximo» no existe en «@heridas». ¿Quizás «max»?'])
    expect(problems('@vigor.mod')).toEqual(['«@vigor» es un número: no tiene «mod»'])
    expect(problems('flor(1.5)')).toEqual(['No existe la función «flor». ¿Quizás «floor»?'])
    expect(closest('xyz', ['vigor', 'astucia'])).toBeNull()
  })

  it('los tipos que no casan', () => {
    expect(problems('@vigor + "uno"')).toEqual(['No se puede sumar un texto'])
    expect(problems('@lleva * 2')).toEqual(['No se puede multiplicar una lista'])
    expect(problems('@vigor ? 1 : 2')).toEqual(['Aquí va sí o no (una comparación), no un número'])
    expect(problems('@vigor > 1 ? 1 : "no"')).toEqual([
      'Las dos ramas de «? :» dan cosas distintas: un número y un texto'
    ])
    expect(problems('floor(1, 2)')).toEqual(['floor lleva 1 valor'])
    expect(problems('clamp(1)')).toEqual(['clamp lleva 3 valores'])
    expect(problems('sum(@vigor)')).toEqual(['sum va con una lista, no con un número'])
    expect(problems('-"a"')).toEqual(['No se puede cambiar de signo un texto'])
  })

  it('un valor calculado no lleva dados; una tirada, sí', () => {
    expect(problems('1d6 + @vigor')).toEqual(['Un valor calculado no lleva dados: los dados van en las tiradas'])
    expect(problems('1d6 + @vigor', true)).toEqual([])
    const dnd = structuredClone(cinco)
    ;(dnd.types.personaje?.fields as Record<string, unknown>).golpe = {
      kind: 'dice',
      label: 'Dado de golpe',
      default: '1d8'
    }
    const scope = scopeOf(dnd.types.personaje?.fields ?? {}, '', 'Personaje', dnd)
    expect(
      checkFormula('@golpe + 1', { scope, dice: false, owner: 'Personaje' }).problems.map((p) => p.message)
    ).toEqual(['Un valor calculado no lleva dados: los dados van en las tiradas'])
    expect(checkFormula('@golpe + 1', { scope, dice: true, owner: 'Personaje' }).type).toBe('dice')
  })

  it('un error de sintaxis sale como un problema más', () => {
    expect(checkFormula('7 +', context())).toMatchObject({
      expr: null,
      problems: [{ message: 'No se entiende «7 +» al final' }]
    })
  })
})

describe('las fórmulas de un sistema, al validarlo', () => {
  const copy = (system: System): System => structuredClone(system)
  const errors = (system: System) => validateSystem(system).problems.filter((p) => p.severity === 'error')

  it('Fronteras y el 5e de prueba, sin problemas (también @este en un conjunto y el máximo de un recurso)', () => {
    expect(errors(fronteras)).toEqual([])
    expect(errors(cinco)).toEqual([])
  })

  it('una errata en un valor calculado, con su ruta, dónde y qué parte', () => {
    const system = copy(fronteras)
    Object.assign(system.types.personaje?.fields.defensa as object, { formula: '7 + @vigr' })
    expect(errors(system)).toEqual([
      {
        path: 'types.personaje.fields.defensa.formula',
        where: 'Personaje › Defensa › Fórmula',
        message: 'No existe «@vigr» en Personaje. ¿Quizás «@vigor»?',
        severity: 'error',
        range: { start: 4, end: 9 }
      }
    ])
  })

  it('un valor que depende de sí mismo, directa o indirectamente, con la ruta de cada paso', () => {
    const self = copy(fronteras)
    Object.assign(self.types.personaje?.fields.defensa as object, { formula: '@defensa + 1' })
    expect(errors(self).map((p) => p.message)).toEqual(['«Defensa» depende de su propio valor: defensa → defensa'])
    const loop = copy(fronteras)
    Object.assign(loop.types.personaje?.fields.carga as object, { formula: '3 + @peso' })
    ;(loop.types.personaje?.fields as Record<string, unknown>).peso = {
      kind: 'derived',
      label: 'Peso',
      formula: '@carga - 1'
    }
    expect(errors(loop).map((p) => [p.path, p.message])).toEqual([
      ['types.personaje.fields.carga.formula', '«Carga» depende de su propio valor: carga → peso → carga'],
      ['types.personaje.fields.peso.formula', '«Peso» depende de su propio valor: peso → carga → peso']
    ])
    const set = copy(cinco)
    const fields = (set.types.personaje?.fields.caracteristicas as { fields: Record<string, { formula?: string }> })
      .fields
    ;(fields.mod as { formula: string }).formula = '@este.mod + 1'
    expect(errors(set).map((p) => p.message)).toEqual([
      '«Modificador» depende de su propio valor: caracteristicas.mod → caracteristicas.mod'
    ])
  })

  it('el tipo de un valor calculado se sabe al usarlo en otro', () => {
    const system = copy(fronteras)
    ;(system.types.personaje?.fields as Record<string, unknown>).titulo = {
      kind: 'derived',
      label: 'Título',
      formula: '@vigor > 2 ? "Fuerte" : "Normal"'
    }
    Object.assign(system.types.personaje?.fields.carga as object, { formula: '3 + @titulo' })
    expect(errors(system).map((p) => p.message)).toEqual(['No se puede sumar un texto'])
  })

  it('las tiradas, sus franjas, sus variantes y sus modos', () => {
    const system = copy(fronteras)
    const roll = system.rolls?.atributo as NonNullable<System['rolls']>[string]
    roll.formula = '2d6 + @este + @suerte'
    ;(roll.bands as { if: string }[])[0] = { if: '@total', label: 'Éxito total', tone: 'success' } as never
    roll.variants = [
      { if: '@vigor > 2', formula: '3d6kh2 + @este' },
      { if: '1', formula: '2d6' }
    ]
    ;(roll.modes as { to: string }[])[0] = {
      key: 'ventaja',
      label: 'Con ventaja',
      from: '2d6',
      to: '3d6kh2 + @este'
    } as never
    expect(errors(system).map((p) => [p.path, p.message])).toEqual([
      ['rolls.atributo.formula', 'No existe «@suerte» en Personaje'],
      ['rolls.atributo.variants[1].if', 'Aquí va sí o no: una comparación, como @total >= 10'],
      ['rolls.atributo.bands[0].if', 'Aquí va sí o no: una comparación, como @total >= 10'],
      ['rolls.atributo.modes[0].to', 'Un modo cambia dados por dados, sin @']
    ])
  })

  it('los bonos de un objeto, con sus campos', () => {
    const system = copy(fronteras)
    ;(system.types.objeto?.modifiers as { value: string; when?: string }[])[0] = {
      target: 'defensa',
      value: '@defensaa',
      when: '@peso'
    } as never
    expect(errors(system).map((p) => [p.path, p.message])).toEqual([
      ['types.objeto.modifiers[0].value', 'No existe «@defensaa» en Objeto. ¿Quizás «@defensa»?'],
      ['types.objeto.modifiers[0].when', 'Aquí va sí o no: una comparación, como @total >= 10']
    ])
  })

  it('los nombres que ponen las fórmulas no pueden ser campos, y la tirada por defecto va sin @', () => {
    const system = copy(fronteras)
    ;(system.types.personaje?.fields as Record<string, unknown>).total = { kind: 'number', label: 'Total' }
    Object.assign(system.dice as object, { default: '2d6 + @vigor' })
    expect(errors(system).map((p) => p.message)).toEqual([
      '«total» es un nombre que ponen las fórmulas: usa otro',
      'La tirada por defecto va sin @: solo dados'
    ])
  })

  it('el máximo de un recurso tiene que ser un número', () => {
    const system = copy(cinco)
    Object.assign(system.types.personaje?.fields.pg as object, { max: '@nivel > 1' })
    expect(errors(system).map((p) => p.message)).toEqual(['El máximo tiene que ser un número'])
  })
})

describe('sin ejecutar código', () => {
  it('ni eval ni new Function en el paquete', () => {
    const dir = join(import.meta.dirname, '..')
    const files = (readdirSync(dir, { recursive: true }) as string[]).filter(
      (f) => f.endsWith('.ts') && !f.endsWith('.test.ts')
    )
    expect(files.length).toBeGreaterThan(5)
    for (const file of files) {
      const text = readFileSync(join(dir, file), 'utf8')
      expect(/\beval\s*\(|new\s+Function\s*\(/.test(text), file).toBe(false)
    }
  })
})
