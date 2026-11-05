/**
 * Copia los compendios del sistema dnd5e de Foundry (MIT; su contenido, SRD con CC BY 4.0) a JSON en
 * `datos-locales/dnd5e/`, para cruzarlos con lo nuestro (ADR-0014). Solo en local, como los PDF del SRD:
 * `node scripts/srd/dnd5e-exportar.ts`. Lee sus bases LevelDB (copiadas, para no tocar las de Foundry) con el
 * classic-level que trae Foundry
 */
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const FOUNDRY = process.env.FOUNDRY_APP ?? '/opt/rea-targets/foundry/app'
const PACKS = process.env.DND5E_PACKS ?? '/opt/rea-targets/foundry/data/Data/systems/dnd5e/packs'
const OUT = join(import.meta.dirname, '../../datos-locales/dnd5e')
/** Los que se cruzan con lo nuestro: criaturas, objetos y conjuros de las dos ediciones */
const WANTED = ['monsters', 'actors24', 'items', 'equipment24', 'spells', 'spells24'] as const

interface Leveled {
  iterator(): AsyncIterable<[string, unknown]>
  close(): Promise<void>
}
const { ClassicLevel } = createRequire(join(FOUNDRY, 'package.json'))('classic-level') as {
  ClassicLevel: new (path: string, options: { valueEncoding: 'json' }) => Leveled
}

const scratch = mkdtempSync(join(tmpdir(), 'dnd5e-'))
mkdirSync(OUT, { recursive: true })
for (const pack of WANTED) {
  // Una copia: la base de Foundry puede estar abierta (y bloqueada) mientras se lee
  cpSync(join(PACKS, pack), join(scratch, pack), { recursive: true })
  const db = new ClassicLevel(join(scratch, pack), { valueEncoding: 'json' })
  const docs: Record<string, unknown> = {}
  for await (const [key, value] of db.iterator()) docs[key] = value
  await db.close()
  writeFileSync(join(OUT, `${pack}.json`), JSON.stringify(docs))
  console.log(`${pack}: ${Object.keys(docs).length}`)
}
