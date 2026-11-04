/**
 * Saca el contenido del 5e de los cuatro PDF del SRD y lo escribe en `packages/systems/src/catalog/5e/content/`. Solo
 * en local (los PDF no están en git): `node scripts/srd/extraer.ts`. Lo sacado se guarda en el repositorio
 */
import { writeFileSync } from 'node:fs'
import { consoleIo, type Io } from '../io.ts'
import {
  type ArmorGroup,
  armorDoc,
  armorRows,
  armorSignature,
  concepts,
  type Doc,
  type Group,
  pair,
  weaponDoc,
  weaponRows,
  weaponSignature
} from './equipo.ts'
import { type Edition, type Lang, pagesOf } from './texto.ts'

export const CONTENT_DIR = new URL('../../packages/systems/src/catalog/5e/content/', import.meta.url)

/** Dónde está cada tabla y con qué grupo empieza (en el 5.1 inglés, la cabecera del primero no sale en el texto) */
const TABLES = {
  weapons: {
    '2014': { en: { pages: [65, 66], first: 'simple_melee' }, es: { pages: [67, 68], first: 'simple_melee' } },
    '2024': { en: { pages: [91], first: 'simple_melee' }, es: { pages: [99], first: 'simple_melee' } }
  },
  armor: {
    '2014': { en: { pages: [63, 64], first: 'ligera' }, es: { pages: [65], first: 'ligera' } },
    '2024': { en: { pages: [92], first: 'ligera' }, es: { pages: [100], first: 'ligera' } }
  }
} as const

/** Dos armas de 2014 dicen lo mismo en sus columnas: estas van por su nombre (revisado a mano) */
const WEAPON_PAIRS: Record<Edition, Record<string, string>> = {
  '2014': { Glaive: 'Guja', Halberd: 'Alabarda' },
  '2024': { Glaive: 'Guja', Halberd: 'Alabarda' }
}

function weapons(edition: Edition) {
  const of = (lang: Lang) => {
    const t = TABLES.weapons[edition][lang]
    return weaponRows(pagesOf(edition, lang, t.pages), edition, lang, t.first as Group)
  }
  return pair(of('en'), of('es'), weaponSignature, WEAPON_PAIRS[edition])
}

function armor(edition: Edition) {
  const of = (lang: Lang) => {
    const t = TABLES.armor[edition][lang]
    return armorRows(pagesOf(edition, lang, t.pages), edition, lang, t.first as ArmorGroup)
  }
  return pair(of('en'), of('es'), armorSignature)
}

/** Todo lo sacado, por archivo */
export function extract(): Record<string, Doc[]> {
  const w24 = weapons('2024')
  const w14 = weapons('2014')
  const wc = concepts(w24, w14)
  const a24 = armor('2024')
  const a14 = armor('2014')
  const ac = concepts(a24, a14)
  return {
    'armas.json': [
      ...w14.map(([en, es], i) => weaponDoc('2014', en, es, wc.older[i] as string)),
      ...w24.map(([en, es], i) => weaponDoc('2024', en, es, wc.newer[i] as string))
    ],
    'armaduras.json': [
      ...a14.map(([en, es], i) => armorDoc('2014', en, es, ac.older[i] as string)),
      ...a24.map(([en, es], i) => armorDoc('2024', en, es, ac.newer[i] as string))
    ]
  }
}

export function main(io: Io = consoleIo) {
  const files = extract()
  for (const [name, docs] of Object.entries(files)) {
    writeFileSync(new URL(name, CONTENT_DIR), `${JSON.stringify(docs, null, 2)}\n`)
    io.out(`${name}: ${docs.length} documentos`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main()
