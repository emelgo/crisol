/**
 * Vulnerabilidades altas o críticas (CVSS ≥ 7) en el informe JSON de osv-scanner (CONSTRAINTS.md).
 * Uso: node scripts/osv-altos.ts informe.json
 */
import { readFileSync } from 'node:fs'
import { consoleIo, type Io } from './io.ts'

interface OsvReport {
  results: Array<{
    packages?: Array<{
      package: { name: string; version: string }
      groups?: Array<{ ids: string[]; max_severity?: string }>
    }>
  }>
}

export interface Finding {
  package: string
  ids: string[]
  severity: number
}

const HIGH = 7

export function highFindings(report: OsvReport): Finding[] {
  return report.results.flatMap(({ packages = [] }) =>
    packages.flatMap(({ package: pkg, groups = [] }) =>
      groups
        .map(({ ids, max_severity }) => ({
          package: `${pkg.name}@${pkg.version}`,
          ids,
          severity: Number(max_severity)
        }))
        // Sin gravedad conocida, Number('') es 0: no cuenta como alta
        .filter(({ severity }) => severity >= HIGH)
    )
  )
}

/** Revisa el informe JSON de osv-scanner; devuelve el código de salida */
export function checkOsv(json: string, io: Io): number {
  const findings = highFindings(JSON.parse(json) as OsvReport)
  for (const f of findings) io.err(`${f.package}: ${f.ids.join(', ')} (CVSS ${f.severity})`)
  if (findings.length > 0) {
    io.err('Hay vulnerabilidades altas o críticas en las dependencias')
    return 1
  }
  io.out('Sin vulnerabilidades altas ni críticas')
  return 0
}

if (import.meta.main) {
  const [file] = process.argv.slice(2)
  if (!file) throw new Error('Uso: node scripts/osv-altos.ts informe.json')
  process.exitCode = checkOsv(readFileSync(file, 'utf8'), consoleIo)
}
