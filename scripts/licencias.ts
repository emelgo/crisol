/**
 * Licencias de las dependencias frente a la lista permitida de CONSTRAINTS.md.
 * Producción: solo permisivas. Desarrollo: además copyleft débil (MPL, LGPL), nunca GPL ni AGPL.
 */
import { execFileSync } from 'node:child_process'
import { consoleIo, type Io } from './io.ts'

export type Policy = ReadonlySet<string>

export interface Violation {
  name: string
  versions: string[]
  license: string
}

/** Lo que devuelve `pnpm licenses list --json`: licencia → paquetes */
export type Report = Record<string, Array<{ name: string; versions: string[] }>>

const PERMISSIVE = [
  'MIT',
  'MIT-0',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  '0BSD',
  'CC0-1.0',
  'Unlicense',
  'BlueOak-1.0.0',
  'CC-BY-4.0',
  // Permisiva como MIT (pako, dentro de Excalidraw: «MIT AND Zlib»; aprobada por Enrique el 2026-11-13)
  'Zlib'
]
const WEAK_COPYLEFT = ['MPL-2.0', 'LGPL-2.1-only', 'LGPL-2.1-or-later', 'LGPL-3.0-only', 'LGPL-3.0-or-later']

export const PROD_POLICY: Policy = new Set(PERMISSIVE)
export const DEV_POLICY: Policy = new Set([...PERMISSIVE, ...WEAK_COPYLEFT])

// Tipografías: además OFL-1.1, que solo obliga sobre los archivos de la fuente (aprobada por Enrique el 2026-10-29)
const FONT_LICENSES = ['OFL-1.1']
const isFontPackage = (name: string) => /^@fontsource(-variable)?\//.test(name)

/** Evalúa una expresión SPDX: alternativas OR de conjunciones AND, con paréntesis y excepciones WITH */
export function isAllowed(expression: string, policy: Policy): boolean {
  const tokens = expression.replace(/[()]/g, ' $& ').split(/\s+/).filter(Boolean)
  let pos = 0
  let malformed = false

  const parseAtom = (): boolean => {
    const token = tokens[pos++]
    if (token === '(') {
      const allowed = parseOr()
      if (tokens[pos++] !== ')') malformed = true
      return allowed
    }
    if (token === undefined) {
      malformed = true
      return false
    }
    // La excepción no cambia el carácter de la licencia base
    if (tokens[pos] === 'WITH') pos += 2
    return policy.has(token)
  }
  const parseAnd = (): boolean => {
    let allowed = parseAtom()
    while (tokens[pos] === 'AND') {
      pos++
      const next = parseAtom()
      allowed = allowed && next
    }
    return allowed
  }
  const parseOr = (): boolean => {
    let allowed = parseAnd()
    while (tokens[pos] === 'OR') {
      pos++
      const next = parseAnd()
      allowed = allowed || next
    }
    return allowed
  }

  if (tokens.length === 0) return false
  const allowed = parseOr()
  return allowed && !malformed && pos === tokens.length
}

/**
 * Paquetes cuyo package.json no dice su licencia y la llevan en su archivo de licencia, mirado a mano (por versión
 * exacta: otra versión se vuelve a mirar)
 */
export const CHECKED_BY_HAND: Record<string, string> = {
  // De mermaid, dentro de Excalidraw: su archivo «license» es MIT (2026-11-13)
  'khroma@2.1.0': 'MIT'
}

/** Paquetes del informe con licencia no permitida (los del propio monorepo no cuentan) */
export function findViolations(report: Report, policy: Policy): Violation[] {
  const fonts: Policy = new Set([...policy, ...FONT_LICENSES])
  const licenseOf = (license: string, name: string, versions: string[]) => {
    const checked = versions.map((version) => CHECKED_BY_HAND[`${name}@${version}`])
    return checked.length > 0 && checked.every(Boolean) ? (checked[0] as string) : license
  }
  return Object.entries(report).flatMap(([license, packages]) =>
    packages
      .filter(({ name }) => name !== 'crisol' && !name.startsWith('@crisol/'))
      .filter(
        ({ name, versions }) => !isAllowed(licenseOf(license, name, versions), isFontPackage(name) ? fonts : policy)
      )
      .map(({ name, versions }) => ({ name, versions, license }))
  )
}

export type ReadReport = (scope: '--prod' | '--dev') => Report

/** Revisa producción y desarrollo; devuelve el código de salida */
export function checkLicenses(read: ReadReport, io: Io): number {
  const problems = [
    ...findViolations(read('--prod'), PROD_POLICY).map((v) => ({ ...v, scope: 'producción' })),
    ...findViolations(read('--dev'), DEV_POLICY).map((v) => ({ ...v, scope: 'desarrollo' }))
  ]
  for (const p of problems) io.err(`${p.scope}: ${p.name}@${p.versions.join(', ')} tiene licencia ${p.license}`)
  if (problems.length > 0) {
    io.err('Hay licencias fuera de la lista permitida (CONSTRAINTS.md)')
    return 1
  }
  io.out('Licencias en regla')
  return 0
}

const readReport: ReadReport = (scope) =>
  JSON.parse(execFileSync('pnpm', ['licenses', 'list', '--json', scope], { encoding: 'utf8' })) as Report

if (import.meta.main) process.exitCode = checkLicenses(readReport, consoleIo)
