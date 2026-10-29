import { describe, expect, it } from 'vitest'
import { changedLines, diffCoverage, parseLcov } from './cobertura-diff.ts'

describe('parseLcov', () => {
  it('lee las líneas ejecutables y sus pasadas, con rutas relativas al repo', () => {
    const lcov = ['SF:/repo/packages/db/src/a.ts', 'DA:1,3', 'DA:2,0', 'end_of_record', ''].join('\n')
    const coverage = parseLcov(lcov, '/repo/packages/db', '/repo')
    expect(coverage.get('packages/db/src/a.ts')).toEqual(
      new Map([
        [1, 3],
        [2, 0]
      ])
    )
  })

  it('resuelve las rutas relativas desde la carpeta del paquete', () => {
    const lcov = ['SF:src/b.ts', 'DA:5,1', 'end_of_record'].join('\n')
    expect([...parseLcov(lcov, '/repo/apps/web', '/repo').keys()]).toEqual(['apps/web/src/b.ts'])
  })
})

describe('changedLines', () => {
  it('saca las líneas añadidas de un diff sin contexto', () => {
    const diff = [
      'diff --git a/packages/db/src/a.ts b/packages/db/src/a.ts',
      '--- a/packages/db/src/a.ts',
      '+++ b/packages/db/src/a.ts',
      '@@ -1,0 +2,2 @@',
      '+uno',
      '+dos',
      '@@ -10 +12 @@',
      '-viejo',
      '+nuevo'
    ].join('\n')
    expect(changedLines(diff).get('packages/db/src/a.ts')).toEqual(new Set([2, 3, 12]))
  })

  it('ignora los archivos borrados y los tramos que solo quitan líneas', () => {
    const diff = ['--- a/x.ts', '+++ /dev/null', '@@ -1,2 +0,0 @@', '--- a/y.ts', '+++ b/y.ts', '@@ -3,2 +2,0 @@'].join(
      '\n'
    )
    expect(changedLines(diff)).toEqual(new Map([['y.ts', new Set()]]))
  })
})

describe('diffCoverage', () => {
  const coverage = new Map([
    [
      'a.ts',
      new Map([
        [1, 1],
        [2, 0],
        [3, 4]
      ])
    ]
  ])

  it('cuenta solo las líneas cambiadas que son ejecutables', () => {
    const result = diffCoverage(coverage, new Map([['a.ts', new Set([2, 3, 9])]]))
    expect(result).toEqual({ covered: 1, total: 2, uncovered: [{ file: 'a.ts', line: 2 }] })
  })

  it('no cuenta los archivos que no están en el informe (pruebas, configuración)', () => {
    const result = diffCoverage(coverage, new Map([['a.test.ts', new Set([1])]]))
    expect(result.total).toBe(0)
  })
})
