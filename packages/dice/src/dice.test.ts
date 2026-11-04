import { describe, expect, it } from 'vitest'
import { withAdvantage } from './advantage.ts'
import { describeFormula } from './describe.ts'
import { DiceSyntaxError, formatDice, parseDice, splitComment } from './notation.ts'
import { cryptoRoller, type DieRoller, rollDice } from './roll.ts'

/** Un dado trucado: da los valores en este orden */
const fixed = (...values: number[]): DieRoller => {
  let i = 0
  return () => values[i++ % values.length] ?? 1
}

describe('la notación', () => {
  it('entiende las fórmulas de siempre y las escribe igual', () => {
    expect(formatDice(parseDice('d20'))).toBe('1d20')
    expect(formatDice(parseDice('1d20 + 5'))).toBe('1d20+5')
    expect(formatDice(parseDice('4d6kh3'))).toBe('4d6kh3')
    expect(formatDice(parseDice('4d6dl1'))).toBe('4d6dl1')
    expect(formatDice(parseDice('2d20k'))).toBe('2d20kh1')
    expect(formatDice(parseDice('d%'))).toBe('1d%')
    expect(formatDice(parseDice('4dF'))).toBe('4dF')
    expect(formatDice(parseDice('(1d8+2)*2'))).toBe('(1d8+2)×2')
    expect(formatDice(parseDice('10-(1d4+1)'))).toBe('10-(1d4+1)')
    expect(formatDice(parseDice('2d6r1!'))).toBe('2d6!r1')
    expect(formatDice(parseDice('5d10>=8f1'))).toBe('5d10>=8f1')
    // Lo que escribe una persona o el propio formatDice: ×, ÷ y −
    expect(formatDice(parseDice('(1d8+2)×2'))).toBe('(1d8+2)×2')
    expect(formatDice(parseDice('1d20 − 1'))).toBe('1d20-1')
  })

  it('aparta el comentario y guarda las etiquetas', () => {
    expect(splitComment('1d20+5 # Espada larga')).toEqual({ formula: '1d20+5 ', comment: 'Espada larga' })
    expect(splitComment('1d20')).toEqual({ formula: '1d20', comment: null })
    expect(formatDice(parseDice('1d20[ataque] + 5[Fuerza] # Espada'))).toBe('1d20[ataque]+5[Fuerza]')
  })

  it('un error dice qué no se entiende y dónde', () => {
    expect(() => parseDice('2d')).toThrow(DiceSyntaxError)
    expect(() => parseDice('1d20+')).toThrow('No se entiende «1d20+» al final')
    expect(() => parseDice('1d20+x')).toThrow('No se entiende «1d20+x» cerca de «x»')
    expect(() => parseDice('(1d6')).toThrow('Falta «)» en «(1d6»')
    expect(() => parseDice('  ')).toThrow('Escribe una tirada, como 1d20+5')
  })

  it('con límites: 200 caracteres, 100 dados, 1.000 caras', () => {
    expect(() => parseDice(`1d20+${'1+'.repeat(100)}1`)).toThrow('Como mucho, 200 caracteres')
    expect(() => parseDice('101d6')).toThrow('Como mucho, 100 dados por tirada')
    expect(() => parseDice('60d6+60d6')).toThrow('Como mucho, 100 dados por tirada')
    expect(() => parseDice('1d1001')).toThrow('Como mucho, 1.000 caras')
    expect(() => parseDice('1d1')).toThrow('Un dado tiene al menos 2 caras')
    expect(() => parseDice('3d6kh4')).toThrow('No se puede quedar con 4 de 3 dados')
    expect(formatDice(parseDice('100d6'))).toBe('100d6')
  })

  it('no ejecuta nada: es un intérprete propio', () => {
    expect(() => parseDice('alert(1)')).toThrow(DiceSyntaxError)
    expect(() => parseDice('1d20+constructor')).toThrow(DiceSyntaxError)
  })
})

describe('la tirada', () => {
  it('suma dados y modificadores, con su desglose', () => {
    const r = rollDice('1d20+5', fixed(14))
    expect(r.total).toBe(19)
    expect(r.detail).toBe('1d20+5 → [14] + 5 = 19')
    expect(rollDice('2d6+3', fixed(4, 5)).total).toBe(12)
    expect(rollDice('1d20-1', fixed(1)).total).toBe(0)
    expect(rollDice('(1d4+1)*2', fixed(3)).total).toBe(8)
    expect(rollDice('7/2', fixed(1)).total).toBe(3)
  })

  it('se queda con los altos o los bajos y descarta', () => {
    expect(rollDice('2d20kh1', fixed(7, 15)).total).toBe(15)
    expect(rollDice('2d20kl1', fixed(7, 15)).total).toBe(7)
    const stats = rollDice('4d6kh3', fixed(1, 6, 3, 5))
    expect(stats.total).toBe(14)
    expect(stats.terms[0]?.dice.filter((d) => !d.kept).map((d) => d.value)).toEqual([1])
    expect(rollDice('4d6dl1', fixed(1, 6, 3, 5)).total).toBe(14)
    expect(rollDice('2d20kh1', fixed(7, 15)).detail).toBe('2d20kh1 → [(7), 15] = 15')
  })

  it('repite y explota', () => {
    expect(rollDice('1d6!', fixed(6, 6, 2)).total).toBe(14)
    expect(rollDice('1d6r1', fixed(1, 1, 1, 5)).total).toBe(5)
    expect(rollDice('1d6ro1', fixed(1, 1, 5)).total).toBe(1)
    expect(rollDice('1d6r<3', fixed(2, 1, 4)).total).toBe(4)
    expect(rollDice('1d6!>4', fixed(5, 6, 2)).total).toBe(13)
    const compound = rollDice('1d6!!', fixed(6, 6, 3))
    expect(compound.total).toBe(15)
    expect(compound.terms[0]?.dice).toHaveLength(1)
    // Como mucho 100 explosiones: un dado trucado que siempre explota acaba
    expect(rollDice('1d6!', fixed(6)).total).toBe(6 * 101)
  })

  it('cuenta éxitos y fallos', () => {
    const r = rollDice('5d10>=8f1', fixed(8, 1, 10, 3, 9))
    expect(r.total).toBe(2)
    expect(r.detail).toBe('5d10>=8f1 → [8, 1, 10, 3, 9] (2 éxitos) = 2')
  })

  it('las etiquetas salen en el desglose y el comentario aparte', () => {
    const r = rollDice('1d20[ataque] + 5[Fuerza] # Espada larga', fixed(14))
    expect(r.formula).toBe('1d20[ataque]+5[Fuerza]')
    expect(r.comment).toBe('Espada larga')
    expect(r.detail).toBe('1d20[ataque]+5[Fuerza] → [14] (ataque) + 5 (Fuerza) = 19')
  })

  it('el 20 natural del d20 es crítico y el 1, pifia; los descartados no cuentan', () => {
    expect(rollDice('1d20+5', fixed(20)).critical).toBe('high')
    expect(rollDice('1d20+5', fixed(1)).critical).toBe('low')
    expect(rollDice('1d20+5', fixed(12)).critical).toBeNull()
    expect(rollDice('2d20kh1', fixed(1, 20)).critical).toBe('high')
    expect(rollDice('2d20kl1', fixed(1, 20)).critical).toBe('low')
    expect(rollDice('2d6', fixed(6, 6)).critical).toBeNull()
  })

  it('cada dado, con sus caras, su valor y si cuenta (lo que necesitan los dados 3D)', () => {
    const r = rollDice('2d20kh1+1d6', fixed(4, 17, 3))
    expect(r.terms.flatMap((t) => t.dice.map((d) => [t.sides, d.value, d.kept]))).toEqual([
      [20, 4, false],
      [20, 17, true],
      [6, 3, true]
    ])
  })

  it('Fate y d% dentro de su rango; el azar criptográfico cubre todas las caras', () => {
    for (let i = 0; i < 200; i++) {
      const fate = rollDice('4dF').total
      expect(fate).toBeGreaterThanOrEqual(-4)
      expect(fate).toBeLessThanOrEqual(4)
      const pct = rollDice('d%').total
      expect(pct).toBeGreaterThanOrEqual(1)
      expect(pct).toBeLessThanOrEqual(100)
    }
    const seen = new Set<number>()
    for (let i = 0; i < 600; i++) seen.add(cryptoRoller(6))
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6])
  })
})

describe('dicha en español', () => {
  it('para quien no lee notación', () => {
    expect(describeFormula('2d20kh1')).toBe('Ventaja (2d20, se queda el mayor)')
    expect(describeFormula('2d20kl1+5')).toBe('Desventaja (2d20, se queda el menor) + 5')
    expect(describeFormula('4d6kh3')).toBe('4d6, se quedan los 3 mayores')
    expect(describeFormula('1d20-1')).toBe('1d20 − 1')
    expect(describeFormula('1d6!')).toBe('1d6 explosivo')
    expect(describeFormula('2d6r1')).toBe('2d6, se repiten los 1')
    expect(describeFormula('5d10>=8f1')).toBe('5d10, éxitos con 8 o más, fallos con 1')
    expect(describeFormula('4dF')).toBe('4dF (Fate)')
    expect(describeFormula('d%')).toBe('1d100')
    expect(describeFormula('(1d8+2)*2')).toBe('(1d8 + 2) × 2')
    expect(describeFormula('1d20[ataque]+5 # Espada')).toBe('1d20 (ataque) + 5')
  })

  it('lo que no se entiende lo devuelve tal cual', () => {
    expect(describeFormula('hola')).toBe('hola')
  })
})

describe('con ventaja o desventaja', () => {
  it('a un d20 suelto, y cambia la que ya había', () => {
    expect(withAdvantage('1d20+5', 'advantage')).toBe('2d20kh1+5')
    expect(withAdvantage('2d20kh1+5', 'disadvantage')).toBe('2d20kl1+5')
    expect(withAdvantage('1d20[ataque]+3 # Espada', 'disadvantage')).toBe('2d20kl1[ataque]+3 # Espada')
  })

  it('sin ella vuelve a un d20; sin d20, no hay a qué dársela', () => {
    expect(withAdvantage('2d20kh1+5', 'none')).toBe('1d20+5')
    expect(withAdvantage('2d6+3', 'advantage')).toBeNull()
    expect(withAdvantage('no es una tirada', 'advantage')).toBeNull()
  })
})
