/**
 * Vulnerabilidades altas o críticas (CVSS ≥ 7) en el informe JSON de osv-scanner (CONSTRAINTS.md).
 * Uso: node scripts/osv-altos.ts informe.json
 */
import { readFileSync } from 'node:fs'

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

if (import.meta.main) {
  const [file] = process.argv.slice(2)
  if (!file) throw new Error('Uso: node scripts/osv-altos.ts informe.json')
  const findings = highFindings(JSON.parse(readFileSync(file, 'utf8')) as OsvReport)
  for (const f of findings) console.error(`${f.package}: ${f.ids.join(', ')} (CVSS ${f.severity})`)
  if (findings.length > 0) {
    console.error('Hay vulnerabilidades altas o críticas en las dependencias')
    process.exitCode = 1
  } else {
    console.log('Sin vulnerabilidades altas ni críticas')
  }
}
