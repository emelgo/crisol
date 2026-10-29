import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { changedLines, checkDiffCoverage, diffCoverage, parseLcov, ranges } from './cobertura-diff.ts'
import { memoryIo } from './io.ts'

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

describe('ranges', () => {
  it('agrupa las líneas seguidas en tramos', () => {
    expect(ranges([7, 1, 3, 2])).toEqual([
      [1, 3],
      [7, 7]
    ])
  })
})

describe('checkDiffCoverage', () => {
  // Repo de prueba con el lcov de un paquete: líneas 1 y 2 cubiertas, 3 a 5 sin cubrir
  const withRepo = (test: (root: string) => void) => {
    const root = mkdtempSync(join(tmpdir(), 'cobertura-'))
    try {
      mkdirSync(join(root, 'packages', 'db', 'coverage'), { recursive: true })
      const lcov = ['SF:src/a.ts', 'DA:1,1', 'DA:2,1', 'DA:3,0', 'DA:4,0', 'DA:5,0', 'end_of_record'].join('\n')
      writeFileSync(join(root, 'packages', 'db', 'coverage', 'lcov.info'), lcov)
      test(root)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }
  const diffOf = (start: number, count: number) => () =>
    ['+++ b/packages/db/src/a.ts', `@@ -0,0 +${start},${count} @@`].join('\n')

  it('termina en verde si lo cambiado está cubierto', () => {
    withRepo((root) => {
      const { io, out } = memoryIo()
      expect(checkDiffCoverage(root, 'origin/main', diffOf(1, 2), io)).toBe(0)
      expect(out).toEqual(['Cobertura de lo cambiado: 100.0 % (2/2)'])
    })
  })

  it('termina en rojo por debajo del 80 % y avisa de cada tramo sin cubrir', () => {
    withRepo((root) => {
      const { io, out } = memoryIo()
      expect(checkDiffCoverage(root, 'origin/main', diffOf(1, 5), io)).toBe(1)
      expect(out[0]).toBe('::warning file=packages/db/src/a.ts,line=3,endLine=5::Sin cubrir por las pruebas')
    })
  })

  it('pasa si no cambia ninguna línea ejecutable', () => {
    withRepo((root) => {
      const { io, out } = memoryIo()
      expect(checkDiffCoverage(root, 'origin/main', diffOf(9, 1), io)).toBe(0)
      expect(out).toEqual(['No hay líneas ejecutables cambiadas'])
    })
  })
})
