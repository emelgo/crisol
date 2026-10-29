import { describe, expect, it } from 'vitest'
import { memoryIo } from './io.ts'
import { checkOsv, highFindings } from './osv-altos.ts'

const report = (groups: Array<{ ids: string[]; max_severity: string }>) => ({
  results: [
    {
      source: { path: '/src/pnpm-lock.yaml', type: 'lockfile' },
      packages: [{ package: { name: 'lodash', version: '4.17.15', ecosystem: 'npm' }, groups }]
    }
  ]
})

describe('highFindings', () => {
  it('devuelve las vulnerabilidades altas o críticas (CVSS ≥ 7)', () => {
    const found = highFindings(
      report([
        { ids: ['GHSA-medio'], max_severity: '5.3' },
        { ids: ['GHSA-alto'], max_severity: '7.2' }
      ])
    )
    expect(found).toEqual([{ package: 'lodash@4.17.15', ids: ['GHSA-alto'], severity: 7.2 }])
  })

  it('no cuenta las que no tienen gravedad conocida', () => {
    expect(highFindings(report([{ ids: ['GHSA-sin-nota'], max_severity: '' }]))).toEqual([])
  })

  it('no encuentra nada en un informe vacío', () => {
    expect(highFindings({ results: [] })).toEqual([])
  })
})

describe('checkOsv', () => {
  it('termina en rojo con las vulnerabilidades altas', () => {
    const { io, err } = memoryIo()
    expect(checkOsv(JSON.stringify(report([{ ids: ['GHSA-alto'], max_severity: '9.8' }])), io)).toBe(1)
    expect(err[0]).toBe('lodash@4.17.15: GHSA-alto (CVSS 9.8)')
  })

  it('termina en verde sin vulnerabilidades altas', () => {
    const { io, out } = memoryIo()
    expect(checkOsv(JSON.stringify({ results: [] }), io)).toBe(0)
    expect(out).toEqual(['Sin vulnerabilidades altas ni críticas'])
  })
})
