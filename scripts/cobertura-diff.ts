/**
 * Cobertura de las líneas nuevas o cambiadas frente a la rama base (CONSTRAINTS.md: ≥ 80 %).
 * Lee los lcov de cada paquete (`pnpm test:coverage`) y el diff sin contexto.
 * Uso: node scripts/cobertura-diff.ts [rama-base]
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

/** archivo (relativo al repo) → línea → veces que se ejecutó */
export type Coverage = Map<string, Map<number, number>>
/** archivo (relativo al repo) → líneas añadidas o cambiadas */
export type Changes = Map<string, Set<number>>

const MINIMUM = 0.8
const toRepoPath = (path: string) => path.split(sep).join('/')

export function parseLcov(text: string, packageDir: string, repoRoot: string): Coverage {
  const coverage: Coverage = new Map()
  let lines: Map<number, number> | undefined
  for (const record of text.split('\n')) {
    if (record.startsWith('SF:')) {
      const source = record.slice(3)
      const file = toRepoPath(relative(repoRoot, isAbsolute(source) ? source : resolve(packageDir, source)))
      lines = new Map()
      coverage.set(file, lines)
    } else if (record.startsWith('DA:') && lines) {
      const [line = '', hits = ''] = record.slice(3).split(',')
      lines.set(Number(line), Number(hits))
    }
  }
  return coverage
}

export function changedLines(diff: string): Changes {
  const changes: Changes = new Map()
  let current: Set<number> | undefined
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      const target = line.slice(4)
      current = target === '/dev/null' ? undefined : new Set()
      if (current) changes.set(target.replace(/^b\//, ''), current)
    } else if (line.startsWith('@@') && current) {
      // @@ -a,b +inicio,cuántas @@ (sin «,cuántas» es una línea)
      const match = /\+(\d+)(?:,(\d+))? @@/.exec(line)
      if (!match) continue
      const start = Number(match[1])
      const count = match[2] === undefined ? 1 : Number(match[2])
      for (let n = start; n < start + count; n++) current.add(n)
    }
  }
  return changes
}

export function diffCoverage(coverage: Coverage, changes: Changes) {
  let covered = 0
  let total = 0
  const uncovered: Array<{ file: string; line: number }> = []
  for (const [file, lines] of changes) {
    const fileCoverage = coverage.get(file)
    if (!fileCoverage) continue
    for (const line of lines) {
      const hits = fileCoverage.get(line)
      if (hits === undefined) continue
      total++
      if (hits > 0) covered++
      else uncovered.push({ file, line })
    }
  }
  return { covered, total, uncovered }
}

/** Los lcov de cada paquete del monorepo, con la carpeta del paquete */
function* lcovFiles(repoRoot: string): Generator<{ packageDir: string; file: string }> {
  const candidates = ['scripts']
  for (const group of ['apps', 'packages']) {
    const dir = join(repoRoot, group)
    if (existsSync(dir)) for (const name of readdirSync(dir)) candidates.push(join(group, name))
  }
  for (const candidate of candidates) {
    const file = join(repoRoot, candidate, 'coverage', 'lcov.info')
    if (existsSync(file)) yield { packageDir: join(repoRoot, candidate), file }
  }
}

if (import.meta.main) {
  const base = process.argv[2] ?? 'origin/main'
  const repoRoot = resolve(import.meta.dirname, '..')
  const coverage: Coverage = new Map()
  for (const { packageDir, file } of lcovFiles(repoRoot)) {
    for (const [path, lines] of parseLcov(readFileSync(file, 'utf8'), packageDir, repoRoot)) coverage.set(path, lines)
  }
  const diff = execFileSync('git', ['diff', '--unified=0', '--no-color', `${base}...HEAD`], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  })
  const { covered, total, uncovered } = diffCoverage(coverage, changedLines(diff))
  for (const { file, line } of uncovered) console.log(`::warning file=${file},line=${line}::Línea sin cubrir`)
  if (total === 0) {
    console.log('No hay líneas ejecutables cambiadas')
  } else {
    const ratio = covered / total
    console.log(`Cobertura de lo cambiado: ${(ratio * 100).toFixed(1)} % (${covered}/${total})`)
    if (ratio < MINIMUM) {
      console.error(`Por debajo del ${MINIMUM * 100} % (CONSTRAINTS.md)`)
      process.exitCode = 1
    }
  }
}
