import type { DieRoller } from '@crisol/dice'
import { describe, expect, it } from 'vitest'
import { cinco } from './fixtures/cinco.ts'
import { fronteras } from './fixtures/fronteras.ts'
import type { System } from './format.ts'
import { prepareRoll, RollError, rollsOf, tryRoll } from './rolls.ts'

/** Un dado trucado: da los valores en este orden */
const fixed = (...values: number[]): DieRoller => {
  let i = 0
  return () => values[i++ % values.length] ?? 1
}
const vigor2 = { data: { vigor: 2, astucia: 1 } }

describe('las tiradas de Fronteras', () => {
  it('una por atributo, con el valor puesto y su nombre, y su franja', () => {
    const r = tryRoll(fronteras, 'personaje', vigor2, 'atributo', { element: 'vigor', roller: fixed(4, 5) })
    expect(r).toMatchObject({
      label: 'Atributo · Vigor',
      formula: '2d6+2[Vigor]',
      total: 11,
      detail: '2d6+2[Vigor] → [4, 5] + 2 (Vigor) = 11',
      band: { label: 'Éxito total', tone: 'success' },
      critical: null,
      modeApplied: false
    })
    expect(
      tryRoll(fronteras, 'personaje', vigor2, 'atributo', { element: 'astucia', roller: fixed(3, 4) }).band
    ).toEqual({
      label: 'Éxito con coste',
      tone: 'partial'
    })
    expect(
      tryRoll(fronteras, 'personaje', vigor2, 'atributo', { element: 'vigor', roller: fixed(1, 2) }).band?.label
    ).toBe('Fallo')
  })

  it('con ventaja, los dados cambian en el árbol: 3d6, se quedan los 2 mayores', () => {
    const r = tryRoll(fronteras, 'personaje', vigor2, 'atributo', {
      element: 'vigor',
      mode: 'ventaja',
      roller: fixed(6, 4, 1)
    })
    expect(r).toMatchObject({ formula: '3d6kh2+2[Vigor]', total: 12, modeApplied: true })
  })

  it('sin críticos en este juego, aunque salgan dobles', () => {
    expect(
      tryRoll(fronteras, 'personaje', vigor2, 'atributo', { element: 'vigor', roller: fixed(6, 6) }).critical
    ).toBeNull()
  })

  it('hay que decir por qué se tira, y la tirada y el modo tienen que existir', () => {
    expect(() => tryRoll(fronteras, 'personaje', vigor2, 'atributo')).toThrow(
      'Elige por qué se tira: Vigor, Astucia, Presencia'
    )
    expect(() => tryRoll(fronteras, 'personaje', vigor2, 'nada')).toThrow(RollError)
    expect(() => tryRoll(fronteras, 'personaje', vigor2, 'atributo', { element: 'vigor', mode: 'furia' })).toThrow(
      'No existe el modo «furia»'
    )
  })

  it('la variante que se cumpla manda', () => {
    const system: System = structuredClone(fronteras)
    Object.assign(system.rolls?.atributo as object, { variants: [{ if: '@este >= 3', formula: '3d6kh2 + @este' }] })
    const strong = { data: { vigor: 3 } }
    expect(prepareRoll(system, 'personaje', strong, 'atributo', { element: 'vigor' }).tree).toMatchObject({
      kind: 'binary',
      left: { count: 3 }
    })
    expect(prepareRoll(system, 'personaje', vigor2, 'atributo', { element: 'vigor' }).tree).toMatchObject({
      kind: 'binary',
      left: { count: 2 }
    })
  })

  it('las tiradas de un tipo, con sus elementos y sus modos', () => {
    expect(rollsOf(fronteras, 'personaje')).toEqual([
      {
        key: 'atributo',
        label: 'Atributo',
        formula: '2d6 + @este',
        elements: [
          { key: 'vigor', label: 'Vigor' },
          { key: 'astucia', label: 'Astucia' },
          { key: 'presencia', label: 'Presencia' }
        ],
        modes: [
          { key: 'ventaja', label: 'Con ventaja' },
          { key: 'desventaja', label: 'Con desventaja' }
        ],
        target: 'none'
      }
    ])
    expect(rollsOf(fronteras, 'objeto')).toEqual([])
    expect(rollsOf(fronteras, 'nada')).toEqual([])
  })
})

describe('las tiradas del 5e de prueba', () => {
  const doc = { data: { nivel: 5, caracteristicas: { fue: { puntuacion: 16 }, des: { puntuacion: 14 } } } }

  it('un ataque: el 20 natural del d20 es crítico, con su franja', () => {
    const crit = tryRoll(cinco, 'personaje', doc, 'ataque', { target: 15, roller: fixed(20) })
    expect(crit).toMatchObject({ total: 26, critical: 'high', band: { label: 'Crítico', tone: 'critical' } })
    expect(crit.detail).toBe(
      '1d20+3[Fuerza]+3[Bonificador por competencia] → [20] + 3 (Fuerza) + 3 (Bonificador por competencia) = 26'
    )
    expect(tryRoll(cinco, 'personaje', doc, 'ataque', { target: 15, roller: fixed(10) }).band?.label).toBe('Impacta')
    expect(tryRoll(cinco, 'personaje', doc, 'ataque', { target: 15, roller: fixed(5) }).band?.label).toBe('Falla')
    expect(tryRoll(cinco, 'personaje', doc, 'ataque', { target: 15, roller: fixed(1) })).toMatchObject({
      critical: 'low',
      band: { label: 'Pifia' }
    })
  })

  it('por cada característica, con @este; sin objetivo, sin franja', () => {
    const r = tryRoll(cinco, 'personaje', doc, 'caracteristica', { element: 'des', roller: fixed(12) })
    expect(r).toMatchObject({
      label: 'Prueba de característica · Destreza',
      formula: '1d20+2[Destreza]',
      total: 14,
      band: null
    })
    expect(
      tryRoll(cinco, 'personaje', doc, 'caracteristica', { element: 'des', target: 13, roller: fixed(12) }).band?.label
    ).toBe('Éxito')
  })

  it('con ventaja: el d20 suelto pasa a 2d20kh1; en inglés, sus nombres', () => {
    const r = tryRoll(cinco, 'personaje', doc, 'caracteristica', {
      element: 'des',
      mode: 'ventaja',
      roller: fixed(3, 17),
      language: 'en'
    })
    expect(r).toMatchObject({ formula: '2d20kh1+2[Dexterity]', total: 19, label: 'Ability check · Dexterity' })
  })

  it('el modo cambia los dados del árbol, no el texto: 1d20 dentro de 11d20 no se toca', () => {
    const system: System = structuredClone(cinco)
    Object.assign(system.rolls?.ataque as object, {
      formula: '11d20 + 1d20',
      modes: [{ key: 'ventaja', label: 'Con ventaja', from: '1d20', to: '2d20kh1' }]
    })
    const r = prepareRoll(system, 'personaje', doc, 'ataque', { mode: 'ventaja' })
    expect(r.tree).toMatchObject({ left: { count: 11, keep: null }, right: { count: 2, keep: { mode: 'kh', n: 1 } } })
  })

  it('un campo de dados entra con sus dados; un texto no es un número', () => {
    const system: System = structuredClone(cinco)
    const fields = system.types.personaje?.fields as Record<string, unknown>
    fields.golpe = { kind: 'dice', label: 'Dado de golpe', default: '1d8' }
    fields.apodo = { kind: 'text', label: 'Apodo' }
    ;(system.rolls as Record<string, unknown>).curar = { label: 'Curar', formula: '@golpe + @caracteristicas.con.mod' }
    ;(system.rolls as Record<string, unknown>).raro = { label: 'Raro', formula: '1d20 + @apodo' }
    ;(system.rolls as Record<string, unknown>).max = { label: 'Max', formula: 'max(1d20, 5)' }
    expect(tryRoll(system, 'personaje', doc, 'curar', { roller: fixed(5) })).toMatchObject({
      formula: '1d8+0[Constitución]',
      total: 5
    })
    expect(() => tryRoll(system, 'personaje', { data: { apodo: 'Rata' } }, 'raro')).toThrow('«@apodo» no es un número')
    expect(() => tryRoll(system, 'personaje', doc, 'max')).toThrow(
      'Los dados solo se suman, se restan, se multiplican o se dividen'
    )
  })
})
