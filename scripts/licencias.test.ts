import { describe, expect, it } from 'vitest'
import { memoryIo } from './io.ts'
import { checkLicenses, DEV_POLICY, findViolations, isAllowed, PROD_POLICY, type Report } from './licencias.ts'

describe('isAllowed', () => {
  it('admite una licencia permisiva de la lista', () => {
    expect(isAllowed('MIT', PROD_POLICY)).toBe(true)
  })

  it('admite MIT-0 (MIT sin obligación de atribución; aprobada por Enrique el 2026-10-29)', () => {
    expect(isAllowed('MIT-0', PROD_POLICY)).toBe(true)
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

  it('admite OFL-1.1 solo en los paquetes de tipografías (aprobada por Enrique el 2026-10-29)', () => {
    const report = {
      'OFL-1.1': [
        { name: '@fontsource/barlow', versions: ['5.3.0'] },
        { name: '@fontsource-variable/una-variable', versions: ['5.3.0'] },
        { name: 'libreria-cualquiera', versions: ['1.0.0'] }
      ]
    }
    expect(findViolations(report, PROD_POLICY)).toEqual([
      { name: 'libreria-cualquiera', versions: ['1.0.0'], license: 'OFL-1.1' }
    ])
  })

  it('una tipografía sigue sin poder ser GPL', () => {
    const report = { 'GPL-3.0-only': [{ name: '@fontsource/una-fuente', versions: ['1.0.0'] }] }
    expect(findViolations(report, PROD_POLICY)).toHaveLength(1)
  })

  it('ignora los paquetes propios del monorepo', () => {
    const report = { UNLICENSED: [{ name: '@crisol/db', versions: ['0.0.0'] }] }
    expect(findViolations(report, PROD_POLICY)).toEqual([])
  })
})

describe('checkLicenses', () => {
  const clean: Report = { MIT: [{ name: 'bueno', versions: ['1.0.0'] }] }

  it('termina en verde si producción y desarrollo están en regla', () => {
    const { io, out } = memoryIo()
    expect(checkLicenses(() => clean, io)).toBe(0)
    expect(out).toEqual(['Licencias en regla'])
  })

  it('termina en rojo y dice qué paquete y de qué ámbito falla', () => {
    const { io, err } = memoryIo()
    const read = (scope: '--prod' | '--dev'): Report =>
      scope === '--dev' ? { 'GPL-3.0-only': [{ name: 'malo', versions: ['1.0.0'] }] } : clean
    expect(checkLicenses(read, io)).toBe(1)
    expect(err[0]).toBe('desarrollo: malo@1.0.0 tiene licencia GPL-3.0-only')
  })
})
