import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { memoryIo } from './io.ts'
import { checkCleanRoom, findCleanRoomViolations } from './sala-limpia.ts'

describe('findCleanRoomViolations', () => {
  let root: string

  // Escribe un archivo del repo de prueba
  const write = (path: string, content: string) => {
    const file = join(root, path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, content)
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'sala-limpia-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('detecta un import de research/ en apps/', () => {
    write('apps/web/src/a.ts', "const x = 1\nimport notas from '../../../research/foundry/notas.md'\n")
    expect(findCleanRoomViolations(root)).toEqual([
      { file: 'apps/web/src/a.ts', line: 2, text: "import notas from '../../../research/foundry/notas.md'" }
    ])
  })

  it('detecta una lectura de research/ en packages/', () => {
    write('packages/db/src/b.ts', "readFileSync(join(root, 'research', 'x.md'))\n")
    expect(findCleanRoomViolations(root)).toHaveLength(1)
  })

  it('no confunde una URL con la carpeta research/', () => {
    write('apps/web/src/c.ts', "const url = 'https://example.com/research/paper'\n")
    expect(findCleanRoomViolations(root)).toEqual([])
  })

  it('no mira node_modules ni lo que está fuera de apps/ y packages/', () => {
    write('apps/web/node_modules/x/index.js', "require('../../research/a')\n")
    write('scripts/d.ts', "import '../research/a.md'\n")
    expect(findCleanRoomViolations(root)).toEqual([])
  })

  it('el repo real cumple la sala limpia', () => {
    expect(findCleanRoomViolations(join(import.meta.dirname, '..'))).toEqual([])
  })
})

describe('checkCleanRoom', () => {
  it('termina en rojo con cada violación y en verde sin ninguna', () => {
    const root = mkdtempSync(join(tmpdir(), 'sala-limpia-'))
    try {
      const clean = memoryIo()
      expect(checkCleanRoom(root, clean.io)).toBe(0)
      expect(clean.out).toEqual(['Sala limpia en regla'])

      mkdirSync(join(root, 'apps', 'web'), { recursive: true })
      writeFileSync(join(root, 'apps', 'web', 'a.ts'), "import '../../research/x.md'\n")
      const dirty = memoryIo()
      expect(checkCleanRoom(root, dirty.io)).toBe(1)
      expect(dirty.err[0]).toBe("apps/web/a.ts:1: import '../../research/x.md'")
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
