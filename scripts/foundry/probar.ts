/**
 * Prueba el importador de Foundry con un sistema de verdad (el dnd5e instalado; solo se lee): arma su zip en memoria
 * con su manifiesto, su idioma y los paquetes que se piden, lo lee como el servidor, lo convierte y lo valida, y dice
 * los tipos, sus campos, cuántos documentos y los problemas. Solo en local:
 * `node scripts/foundry/probar.ts [paquete…]` (sin paquetes, los de 2024). FOUNDRY_SYSTEM cambia la carpeta
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { zipSync } from 'fflate'
import { readFoundryZip } from '../../apps/server/src/foundry/read.ts'
import { validateFile } from '../../packages/systems/src/file.ts'
import { convertFoundry } from '../../packages/systems/src/foundry/convert.ts'
import { textOf } from '../../packages/systems/src/text.ts'

const DIR = process.env.FOUNDRY_SYSTEM ?? '/opt/rea-targets/foundry/data/Data/systems/dnd5e'
const PACKS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['content24', 'classes24', 'origins24', 'feats24', 'spells24', 'tables24', 'actors24', 'equipment24']

/** Los archivos de una carpeta, para el zip: { 'dnd5e/packs/spells24/CURRENT': bytes } */
function folder(path: string, prefix: string, out: Record<string, Uint8Array>) {
  for (const name of readdirSync(path)) {
    const full = join(path, name)
    if (statSync(full).isDirectory()) folder(full, `${prefix}${name}/`, out)
    else out[`${prefix}${name}`] = new Uint8Array(readFileSync(full))
  }
}

const files: Record<string, Uint8Array> = {
  'dnd5e/system.json': new Uint8Array(readFileSync(join(DIR, 'system.json'))),
  'dnd5e/lang/en.json': new Uint8Array(readFileSync(join(DIR, 'lang/en.json')))
}
for (const pack of PACKS) folder(join(DIR, 'packs', pack), `dnd5e/packs/${pack}/`, files)
const zip = zipSync(files)
console.log(`Zip: ${(zip.length / 1024 / 1024).toFixed(1)} MB`)

let began = performance.now()
const read = await readFoundryZip(zip, { packs: PACKS, language: 'en' })
console.log(`Leído en ${Math.round(performance.now() - began)} ms`)
for (const p of read.packs) console.log(`  ${p.name} (${p.type}): ${p.documents.length} documentos`)

began = performance.now()
const { file, notes } = convertFoundry({ ...read, language: 'en' })
console.log(`Convertido en ${Math.round(performance.now() - began)} ms`)
const size = new TextEncoder().encode(JSON.stringify(file)).length
console.log(`Archivo: ${(size / 1024 / 1024).toFixed(2)} MB, ${file.content.length} documentos`)
const systemSize = new TextEncoder().encode(JSON.stringify(file.system)).length
console.log(`Sistema: ${(systemSize / 1024).toFixed(0)} KB`)

for (const [key, type] of Object.entries(file.system.types)) {
  const count = file.content.filter((c) => c.type === key).length
  const fields = Object.entries(type.fields).map(([k, f]) => `${k}:${f.kind}`)
  console.log(`\n${key} (${type.document}, «${textOf(type.label)}»): ${count} documentos, ${fields.length} campos`)
  console.log(`  ${fields.join(', ')}`)
}
console.log('\nCompendio:')
for (const s of file.system.compendium?.sections ?? []) console.log(`  ${textOf(s.label)}: ${s.types.join(', ')}`)
console.log(`Fuentes: ${(file.system.sources ?? []).map((s) => s.key).join(', ')}`)
for (const n of notes) console.log(`Nota: ${n}`)

const { file: valid, problems } = validateFile(file)
console.log(`\nValida: ${valid ? 'sí' : 'no'}`)
for (const p of problems.slice(0, 30)) console.log(`  ${p.severity}: ${p.path} (${p.where}): ${p.message}`)
if (problems.length > 30) console.log(`  y ${problems.length - 30} más`)
