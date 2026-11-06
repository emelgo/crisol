/** Zips de Foundry hechos en las pruebas: un manifiesto, un idioma y paquetes LevelDB o NeDB */
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ClassicLevel } from 'classic-level'
import { zipSync } from 'fflate'

const encode = (value: unknown) => new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value))

/** Los archivos de una base LevelDB con estas entradas (!items!id → documento) */
export async function levelFiles(entries: Record<string, unknown>): Promise<Record<string, Uint8Array>> {
  const dir = await mkdtemp(join(tmpdir(), 'crisol-foundry-test-'))
  try {
    const db = new ClassicLevel<string, unknown>(dir, { valueEncoding: 'json' })
    await db.batch(Object.entries(entries).map(([key, value]) => ({ type: 'put' as const, key, value })))
    await db.close()
    const files: Record<string, Uint8Array> = {}
    for (const name of await readdir(dir)) files[name] = new Uint8Array(await readFile(join(dir, name)))
    return files
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** Un paquete NeDB: una línea JSON por documento */
export const nedbFile = (docs: readonly unknown[]) => encode(docs.map((d) => JSON.stringify(d)).join('\n'))

/** El zip: cada ruta con su contenido (un objeto, en JSON) o sus bytes */
export function foundryZip(files: Record<string, unknown>): Uint8Array {
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([path, value]) => [path, value instanceof Uint8Array ? value : encode(value)])
    )
  )
}

/** Una base LevelDB dentro del zip, en su carpeta */
export const inFolder = (folder: string, files: Record<string, Uint8Array>) =>
  Object.fromEntries(Object.entries(files).map(([name, bytes]) => [`${folder}/${name}`, bytes]))
