import type { DieRoller } from '@crisol/dice'
import { describe, expect, it } from 'vitest'
import { evaluate } from './evaluate.ts'
import { FORMAT, type System } from './format.ts'
import { RollError, tryRoll } from './rolls.ts'
import { validateSystem } from './validate.ts'

/** Un dado trucado: da los valores en este orden */
const fixed = (...values: number[]): DieRoller => {
  let i = 0
  return () => values[i++ % values.length] ?? 1
}

/**
 * Un juego propio, para las pruebas de lo que piden otros juegos: dos d12 (Luz y Sombra) que se leen por separado en
 * su resultado, una ventaja que suma 1d6, un daño de tantos d8 como su pericia y una reserva de d6 que lee el mayor
 */
const dualidad: System = {
  format: FORMAT,
  id: 'dualidad',
  name: 'Dualidad',
  version: '1',
  languages: ['es'],
  types: {
    heroe: {
      document: 'actor',
      label: 'Héroe',
      icon: 'user',
      fields: {
        agilidad: { kind: 'number', label: 'Agilidad', default: 0, integer: true },
        pericia: { kind: 'number', label: 'Pericia', default: 1, min: 0, integer: true },
        reserva: { kind: 'number', label: 'Reserva', default: 0, min: 0, max: 6, integer: true },
        marcas: { kind: 'list', label: 'Marcas', default: ['vieja', 'nueva'] },
        primera: { kind: 'derived', label: 'Primera marca', formula: '@marcas[0]' }
      }
    }
  },
  rolls: {
    accion: {
      label: 'Acción',
      formula: '1d12[luz] + 1d12[sombra] + @agilidad',
      bands: [
        { if: '@dados[0] == @dados[1]', label: 'Crítico', tone: 'critical' },
        { if: '@total >= @objetivo && @dados[0] > @dados[1]', label: 'Éxito con Luz', tone: 'success' },
        { if: '@total >= @objetivo', label: 'Éxito con Sombra', tone: 'partial' },
        { if: '@dados[0] > @dados[1]', label: 'Fallo con Luz', tone: 'failure' },
        { if: 'true', label: 'Fallo con Sombra', tone: 'failure' }
      ],
      modes: [
        { key: 'ventaja', label: 'Con ventaja', add: '1d6', gives: 'advantage' },
        { key: 'desventaja', label: 'Con desventaja', add: '-1d6', gives: 'disadvantage' }
      ]
    },
    dano: { label: 'Daño', formula: 'dados(@pericia, 8) + 2' },
    reserva: {
      label: 'Reserva',
      formula: '@reserva > 0 ? dados(@reserva, 6) : 2d6kl1',
      bands: [
        { if: 'count(@dados, 6) >= 2', label: 'Crítico', tone: 'critical' },
        { if: 'max(@dados) == 6', label: 'Éxito', tone: 'success' },
        { if: 'max(@dados) >= 4', label: 'Con coste', tone: 'partial' },
        { if: 'true', label: 'Fallo', tone: 'failure' }
      ]
    }
  },
  dice: { default: '2d12', critical: 'none' }
}

const hero = (data: Record<string, unknown>) => ({ data })

describe('lo que piden otros juegos a los dados', () => {
  it('el sistema de prueba vale', () => {
    expect(validateSystem(dualidad).problems.filter((p) => p.severity === 'error')).toEqual([])
  })

  it('cada dado se lee en las franjas (@dados): cuál de los dos d12 es mayor, o si son iguales', () => {
    const roll = (roller: DieRoller, target = 12) =>
      tryRoll(dualidad, 'heroe', hero({ agilidad: 2 }), 'accion', { roller, target })
    expect(roll(fixed(9, 4))).toMatchObject({ total: 15, band: { label: 'Éxito con Luz' } })
    expect(roll(fixed(3, 8))).toMatchObject({ total: 13, band: { label: 'Éxito con Sombra' } })
    expect(roll(fixed(5, 5))).toMatchObject({ band: { label: 'Crítico', tone: 'critical' } })
    expect(roll(fixed(4, 1), 20).band?.label).toBe('Fallo con Luz')
  })

  it('un modo que suma dados (la ventaja, +1d6) o los resta (la desventaja, −1d6)', () => {
    const up = tryRoll(dualidad, 'heroe', hero({ agilidad: 2 }), 'accion', {
      mode: 'ventaja',
      roller: fixed(9, 4, 6),
      target: 12
    })
    expect(up).toMatchObject({ formula: '1d12[luz]+1d12[sombra]+2[Agilidad]+1d6', total: 21, modeApplied: true })
    // Los dos d12 siguen siendo los primeros
    expect(up.band?.label).toBe('Éxito con Luz')
    const down = tryRoll(dualidad, 'heroe', hero({ agilidad: 2 }), 'accion', {
      mode: 'desventaja',
      roller: fixed(9, 4, 6)
    })
    expect(down).toMatchObject({ formula: '1d12[luz]+1d12[sombra]+2[Agilidad]-1d6', total: 9 })
  })

  it('tantos dados como diga un campo: dados(@pericia, 8); sin ninguno, no se puede tirar', () => {
    expect(tryRoll(dualidad, 'heroe', hero({ pericia: 3 }), 'dano', { roller: fixed(1, 2, 3) })).toMatchObject({
      formula: '3d8+2',
      total: 8
    })
    expect(() => tryRoll(dualidad, 'heroe', hero({ pericia: 0 }), 'dano')).toThrow(RollError)
    expect(() => tryRoll(dualidad, 'heroe', hero({ pericia: 500 }), 'dano')).toThrow(RollError)
  })

  it('una reserva de d6: se lee el mayor y cuántos seises; sin dados, 2d6 y el menor', () => {
    const pool = (reserva: number, roller: DieRoller) =>
      tryRoll(dualidad, 'heroe', hero({ reserva }), 'reserva', { roller })
    expect(pool(3, fixed(6, 2, 6))).toMatchObject({ formula: '3d6', band: { label: 'Crítico' } })
    expect(pool(3, fixed(6, 2, 3)).band?.label).toBe('Éxito')
    expect(pool(2, fixed(4, 1)).band?.label).toBe('Con coste')
    expect(pool(0, fixed(6, 2))).toMatchObject({ formula: '2d6kl1', band: { label: 'Fallo' } })
  })

  it('un elemento de una lista, por su posición (desde 0)', () => {
    expect(evaluate(dualidad, 'heroe', hero({})).values.primera).toBe('vieja')
  })

  it('lo que no vale: dados() fuera de una tirada, un modo sin dados y uno con @', () => {
    const broken = structuredClone(dualidad)
    const heroe = broken.types.heroe
    if (!heroe) throw new Error('Sin héroe')
    heroe.fields.malo = { kind: 'derived', label: 'Malo', formula: 'dados(2, 6)' }
    const roll = broken.rolls?.accion
    if (!roll?.modes) throw new Error('Sin modos')
    roll.modes.push({ key: 'nada', label: 'Nada' }, { key: 'arroba', label: 'Arroba', add: '@agilidad' })
    const paths = validateSystem(broken)
      .problems.filter((p) => p.severity === 'error')
      .map((p) => p.path)
    expect(paths).toEqual(
      expect.arrayContaining(['types.heroe.fields.malo.formula', 'rolls.accion.modes[2]', 'rolls.accion.modes[3].add'])
    )
  })
})
