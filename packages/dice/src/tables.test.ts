import { describe, expect, it } from 'vitest'
import { boundsOf, rowFor, tableFormula, tableProblems } from './tables.ts'

const row = (from: number, to: number) => ({ id: `${from}`, from, to })

describe('las tablas aleatorias', () => {
  it('sin fórmula, 1dN por la última fila; lo menos y lo más de una fórmula', () => {
    expect(tableFormula(null, [row(1, 4), row(5, 10)])).toBe('1d10')
    expect(tableFormula(' 2d6 ', [])).toBe('2d6')
    expect(tableFormula(null, [row(1, 1)])).toBe('1')
    expect(tableProblems(null, [row(1, 1)])).toEqual([])
    expect(boundsOf('2d6')).toEqual({ min: 2, max: 12 })
    expect(boundsOf('d%')).toEqual({ min: 1, max: 100 })
    expect(boundsOf('10-1d6')).toEqual({ min: 4, max: 9 })
    expect(tableProblems('10-1d6', [row(4, 9)])).toEqual([])
    expect(boundsOf('esto no')).toBeNull()
  })

  it('la fila de un total', () => {
    const rows = [row(1, 3), row(4, 6)]
    expect(rowFor(rows, 4)?.id).toBe('4')
    expect(rowFor(rows, 7)).toBeNull()
  })

  it('sus problemas: filas al revés, que se pisan, huecos y lo que se sale de la fórmula', () => {
    expect(tableProblems(null, [row(1, 5), row(6, 10)])).toEqual([])
    expect(tableProblems('2d6', [row(2, 6), row(7, 12)])).toEqual([])
    expect(tableProblems(null, [row(3, 1)])).toContain('La fila 3–1 empieza después de acabar')
    expect(tableProblems(null, [row(1, 5), row(5, 10)])).toContain('Las filas 1–5 y 5–10 se pisan')
    expect(tableProblems(null, [row(1, 3), row(6, 10)])).toContain('Falta del 4 al 5')
    expect(tableProblems('1d6', [row(1, 4)])).toContain('Con 1d6 puede salir 6, y la última fila acaba en 4')
    expect(tableProblems('1d6', [row(1, 8)])).toContain('Con 1d6 solo sale del 1 al 6')
  })
})
