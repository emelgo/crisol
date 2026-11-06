/**
 * El archivo del 5e de ejemplo (con el SRD 5.1 y 5.2.1), para subirlo en Sistemas como cualquier otro (ADR-0015):
 * `pnpm sistema-5e` lo deja en `datos-locales/sistemas/`
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { exampleFile } from '../../packages/systems/src/examples/index.ts'
import { fileName } from '../../packages/systems/src/file.ts'

const out = join(import.meta.dirname, '../../datos-locales/sistemas')
mkdirSync(out, { recursive: true })
const file = exampleFile('5e')
const path = join(out, fileName(file.system))
writeFileSync(path, JSON.stringify(file))
console.log(`${path}: ${file.content.length} documentos`)
