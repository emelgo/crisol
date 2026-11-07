/**
 * Sala limpia (CONSTRAINTS.md): nada de apps/ ni packages/ importa ni lee research/.
 * Busca cualquier cadena del código que apunte a una carpeta research.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { consoleIo, type Io } from './io.ts'

export interface Violation {
  file: string
  line: number
  text: string
}

const SCANNED_DIRS = ['apps', 'packages']
const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'coverage', '.turbo'])
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?|json|css|html)$/
const STRING_LITERAL = /(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g
const URL = /^[a-z][a-z\d+.-]*:\/\//i
const RESEARCH_PATH = /(?:^|[\\/])research(?:[\\/]|$)/

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) yield* sourceFiles(join(dir, entry.name))
    } else if (SOURCE_FILE.test(entry.name)) {
      yield join(dir, entry.name)
    }
  }
}

function pointsToResearch(line: string): boolean {
  // Sin la palabra no hay nada que mirar (así no se recorren las cadenas de los JSON grandes)
  if (!line.includes('research')) return false
  for (const [, , content = ''] of line.matchAll(STRING_LITERAL)) {
    if (!URL.test(content) && RESEARCH_PATH.test(content)) return true
  }
  return false
}

export function findCleanRoomViolations(root: string): Violation[] {
  const violations: Violation[] = []
  for (const dir of SCANNED_DIRS) {
    const base = join(root, dir)
    if (!existsSync(base)) continue
    for (const file of sourceFiles(base)) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((text, index) => {
          if (pointsToResearch(text)) {
            violations.push({ file: relative(root, file).split(sep).join('/'), line: index + 1, text: text.trim() })
          }
        })
    }
  }
  return violations
}

/** Devuelve el código de salida */
export function checkCleanRoom(root: string, io: Io): number {
  const violations = findCleanRoomViolations(root)
  for (const v of violations) io.err(`${v.file}:${v.line}: ${v.text}`)
  if (violations.length > 0) {
    io.err('El código no puede importar ni leer research/ (sala limpia)')
    return 1
  }
  io.out('Sala limpia en regla')
  return 0
}

if (import.meta.main) process.exitCode = checkCleanRoom(join(import.meta.dirname, '..'), consoleIo)
