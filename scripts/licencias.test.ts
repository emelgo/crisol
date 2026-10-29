import { describe, expect, it } from 'vitest'
import { DEV_POLICY, findViolations, isAllowed, PROD_POLICY } from './licencias.ts'

describe('isAllowed', () => {
  it('admite una licencia permisiva de la lista', () => {
    expect(isAllowed('MIT', PROD_POLICY)).toBe(true)
  })

  it('rechaza una licencia copyleft', () => {
    expect(isAllowed('GPL-3.0-only', PROD_POLICY)).toBe(false)
  })

  it('admite una alternativa OR si alguna rama está permitida', () => {
    expect(isAllowed('(GPL-3.0-only OR MIT)', PROD_POLICY)).toBe(true)
  })

  it('rechaza una conjunción AND si alguna parte no está permitida', () => {
    expect(isAllowed('MIT AND GPL-2.0-only', PROD_POLICY)).toBe(false)
  })

  it('juzga una excepción WITH por su licencia base', () => {
    expect(isAllowed('Apache-2.0 WITH LLVM-exception', PROD_POLICY)).toBe(true)
  })

  it('rechaza una licencia desconocida o vacía', () => {
    expect(isAllowed('UNKNOWN', PROD_POLICY)).toBe(false)
    expect(isAllowed('', PROD_POLICY)).toBe(false)
  })

  it('admite copyleft débil solo en las herramientas de desarrollo', () => {
    expect(isAllowed('MPL-2.0', PROD_POLICY)).toBe(false)
    expect(isAllowed('MPL-2.0', DEV_POLICY)).toBe(true)
  })

  it('nunca admite GPL ni AGPL, ni siquiera en desarrollo', () => {
    expect(isAllowed('GPL-3.0-or-later', DEV_POLICY)).toBe(false)
    expect(isAllowed('AGPL-3.0-only', DEV_POLICY)).toBe(false)
  })
})

describe('findViolations', () => {
  it('devuelve los paquetes cuya licencia no está permitida', () => {
    const report = {
      MIT: [{ name: 'bueno', versions: ['1.0.0'] }],
      'GPL-3.0-only': [{ name: 'malo', versions: ['2.0.0', '2.1.0'] }]
    }
    expect(findViolations(report, PROD_POLICY)).toEqual([
      { name: 'malo', versions: ['2.0.0', '2.1.0'], license: 'GPL-3.0-only' }
    ])
  })

  it('ignora los paquetes propios del monorepo', () => {
    const report = { UNLICENSED: [{ name: '@crisol/db', versions: ['0.0.0'] }] }
    expect(findViolations(report, PROD_POLICY)).toEqual([])
  })
})
