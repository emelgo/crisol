/**
 * Saca el contenido del 5e de los cuatro PDF del SRD y lo escribe en `packages/systems/src/catalog/5e/content/`. Solo
 * en local (los PDF no están en git): `node scripts/srd/extraer.ts`. Lo sacado se guarda en el repositorio
 */
import { writeFileSync } from 'node:fs'
import { consoleIo, type Io } from '../io.ts'
import { ruleDocs } from './capitulos.ts'
import { classDocs, readingRows } from './clases.ts'
import { spellDocs } from './conjuros.ts'
import { creatureDocs } from './criaturas.ts'
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
import { conditionDocs } from './estados.ts'
import { FIGHTER, FIGHTER_CLASS, FIGHTER_FEATURES } from './guerrero.ts'
import { magicDocs } from './magicos.ts'
import { MECHANICS } from './mecanica.ts'
import { type MountRow, mountDoc, mountRows, mountSignature } from './monturas.ts'
import {
  categoryOf,
  displayName,
  type Entry,
  entries,
  type GearRow,
  gearDoc,
  gearSignature,
  gearTable,
  runInTexts,
  subTables,
  type ToolRow,
  toolRows
} from './objetos.ts'
import { allOriginDocs } from './origenes.ts'
import { GEAR_PAIRS, GEAR_RENAMES, MOUNT_RENAMES } from './pares.ts'
import { allClassDocs } from './rasgos.ts'
import { boxesOf, type Edition, type Lang, pagesOf, widthOf } from './texto.ts'
import { imperialTexts } from './unidades.ts'

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

/** Las tablas de equipo de aventurero (y, en 2014, las herramientas, que van seguidas) */
const GEAR_PAGES: Record<Edition, Record<Lang, number[]>> = {
  '2014': { en: [68, 69, 70], es: [69, 70, 71, 72] },
  '2024': { en: [95], es: [103] }
}

/** En 2024, las herramientas y el texto de cada objeto van en entradas; la munición y los canalizadores, en tablas pequeñas */
const TOOL_PAGES: Record<Lang, number[]> = { en: [93, 94], es: [101, 102] }
const DESCRIPTION_PAGES: Record<Lang, number[]> = {
  en: [94, 95, 96, 97, 98, 99, 100],
  es: [102, 103, 104, 105, 106, 107, 108, 109]
}
const SECTIONS: Record<Lang, RegExp> = {
  en: /^(Artisan’s Tools|Other Tools|Adventuring Gear|Mounts and Vehicles)$/,
  es: /^(Herramientas de artesano|Otras herramientas|Equipo de aventureros|Monturas y vehículos)$/
}

function gear(edition: Edition): [GearRow | ToolRow, GearRow | ToolRow][] {
  const of = (lang: Lang): (GearRow | ToolRow)[] => {
    const table = gearTable(
      GEAR_PAGES[edition][lang].map((p) => ({ boxes: boxesOf(edition, lang, p), width: widthOf(edition, lang, p) })),
      edition,
      lang
    )
    if (edition === '2014') return table
    const tools = toolRows(
      entries(readingRows(edition, lang, TOOL_PAGES[lang]), lang, SECTIONS[lang]).filter(
        (e) => !/Adventuring|aventureros/.test(e.section ?? '')
      ),
      lang
    )
    return [...table, ...subTables(readingRows(edition, lang, DESCRIPTION_PAGES[lang]), lang), ...tools]
  }
  return pair(of('en'), of('es'), gearSignature, GEAR_PAIRS[edition])
}

/** En 2014, el texto de cada objeto empieza con su nombre («Acid. As an action…»), y el de un grupo, con el del grupo */
const RUN_IN_PAGES: Record<Lang, number[]> = { en: [66, 67, 68, 69, 70, 71], es: [67, 68, 69, 70, 71, 72, 73] }
const GROUP_HEADINGS: Record<Lang, Record<string, string>> = {
  en: {
    canalizador_arcano: 'Arcane focus',
    canalizador_druidico: 'Druidic focus',
    simbolo_sagrado: 'Holy symbol',
    herramienta_artesano: 'Artisan’s tools',
    juego: 'Gaming set',
    instrumento: 'Musical instrument'
  },
  es: {
    canalizador_arcano: 'Canalizador arcano',
    canalizador_druidico: 'Canalizador druídico',
    simbolo_sagrado: 'Símbolo sagrado',
    herramienta_artesano: 'Herramientas de artesano',
    juego: 'Juegos',
    instrumento: 'Instrumentos musicales'
  }
}
const bareName = (name: string) => name.replace(/ \(.*\)$/, '')
const RUN_IN_STOPS: Record<Lang, RegExp> = {
  en: /^(Mounts and Vehicles|Equipment Packs|Tools|Trade Goods|Expenses|Container Capacity)$/,
  es: /^(Monturas y vehículos|Paquetes de equipo|Herramientas|Mercancías|Gastos|Capacidad de los contenedores)$/
}

function runIn2014(lang: Lang, rows: readonly (GearRow | ToolRow)[]): (row: GearRow | ToolRow) => string {
  const groups = GROUP_HEADINGS[lang]
  const texts = runInTexts(
    readingRows('2014', lang, RUN_IN_PAGES[lang]),
    [...rows.map((r) => bareName(r.name)), ...Object.values(groups)],
    RUN_IN_STOPS[lang]
  )
  return (row) => {
    const own = texts.get(bareName(row.name).toLowerCase())
    if (own) return own
    const heading = groups[categoryOf(row)]
    return heading ? (texts.get(heading.toLowerCase()) ?? '') : ''
  }
}

/** Las monturas, los arreos, los vehículos y (en 2014) las mercancías */
const MOUNT_PAGES: Record<Edition, Record<Lang, number[]>> = {
  '2014': { en: [71, 72], es: [73, 74, 75] },
  '2024': { en: [100, 101], es: [109, 110] }
}

function mounts(edition: Edition): [MountRow, MountRow][] {
  const of = (lang: Lang) => mountRows(readingRows(edition, lang, MOUNT_PAGES[edition][lang]), edition, lang)
  return pair(of('en'), of('es'), mountSignature)
}

/** El pergamino de conjuro de 2024: su título va partido en dos líneas («Spell Scroll (Cantrip, 30 GP;» / «Level 1…») */
function scrollText(lang: Lang): string {
  const rows = readingRows('2024', lang, DESCRIPTION_PAGES[lang])
  const start = rows.findIndex((r) => /^(Spell Scroll|Pergamino de conjuro) \(/.test(r.text) && r.text.endsWith(';'))
  if (start < 0) return ''
  const lines: string[] = []
  for (const row of rows.slice(start + 2)) {
    if (/^[A-ZÁÉÍÓÚÑ][^()]* \((?:[\d,.]+ (?:GP|SP|CP|po|pp|pc)|Varies|variable)\)$/.test(row.text)) break
    lines.push(row.text)
  }
  return lines.join(' ').replace(/([a-záéíóúñ])- ([a-záéíóúñ])/gi, '$1$2')
}

/** El texto de un grupo de 2024 («Arcane Focus (Varies)»), por su categoría */
const GROUP_ENTRIES: Record<string, RegExp> = {
  municion: /^(Ammunition|Munición)$/,
  canalizador_arcano: /^(Arcane Focus|Canalizador arcano)$/,
  canalizador_druidico: /^(Druidic Focus|Canalizador druídico)$/,
  simbolo_sagrado: /^(Holy Symbol|Símbolo sagrado)$/
}
const groupTexts = new Map<string, string | undefined>()
function groupText(lang: Lang, category: string) {
  const id = `${lang}/${category}`
  if (!groupTexts.has(id)) {
    const re = GROUP_ENTRIES[category]
    groupTexts.set(id, re ? [...descriptions(lang).values()].find((e) => re.test(e.name))?.text : undefined)
  }
  return groupTexts.get(id)
}

/** El texto de cada objeto de 2024, por su nombre en cada idioma */
const described = new Map<Lang, Map<string, Entry>>()
function descriptions(lang: Lang): Map<string, Entry> {
  let found = described.get(lang)
  if (!found) {
    const all = entries(readingRows('2024', lang, DESCRIPTION_PAGES[lang]), lang, SECTIONS[lang])
    found = new Map(all.filter((e) => /Adventuring|aventureros/.test(e.section ?? '')).map((e) => [e.name, e]))
    described.set(lang, found)
  }
  return found
}

/** Todo lo sacado, por archivo */
export function extract(): Record<string, Doc[]> {
  const w24 = weapons('2024')
  const w14 = weapons('2014')
  const wc = concepts(w24, w14)
  const a24 = armor('2024')
  const a14 = armor('2014')
  const ac = concepts(a24, a14)
  const g24 = gear('2024')
  const g14 = gear('2014')
  const gc = concepts(g24, g14, GEAR_RENAMES, (es) => displayName(es, 'es'))
  const text14 = {
    en: runIn2014(
      'en',
      g14.map(([en]) => en)
    ),
    es: runIn2014(
      'es',
      g14.map(([, es]) => es)
    )
  }
  const gearOf = (edition: Edition) => (concept: string) => MECHANICS[`${concept}_${edition}`]
  const texts = { en: descriptions('en'), es: descriptions('es') }
  const m24 = mounts('2024')
  const m14 = mounts('2014')
  const mc = concepts(m24, m14, MOUNT_RENAMES)
  /** Lo de más de un objeto de 2024: su texto (el de su entrada o, en una herramienta, el suyo) y su característica */
  const extra2024 = (en: GearRow | ToolRow, es: GearRow | ToolRow) => {
    // Lo de un grupo (una flecha, un canalizador) lleva el texto de su grupo
    const text = (row: GearRow | ToolRow, lang: Lang) =>
      'text' in row
        ? row.text
        : (texts[lang].get(row.name)?.text ??
          (/^(Spell Scroll|Pergamino de conjuro) /.test(row.name) ? scrollText(lang) : undefined) ??
          (row.group ? (groupText(lang, categoryOf(row)) ?? '') : ''))
    return {
      descripcion: { es: text(es, 'es'), en: text(en, 'en') },
      ...('ability' in en ? { caracteristica: en.ability } : {})
    }
  }
  const files: Record<string, Doc[]> = {
    'equipo.json': [
      ...g14.map(([en, es], i) => {
        const c = gc.older[i] as string
        return gearDoc('2014', en, es, c, gearOf('2014')(c), { descripcion: { es: text14.es(es), en: text14.en(en) } })
      }),
      ...g24.map(([en, es], i) => {
        const c = gc.newer[i] as string
        return gearDoc('2024', en, es, c, gearOf('2024')(c), extra2024(en, es))
      })
    ],
    'monturas.json': [
      ...m14.map(([en, es], i) => mountDoc('2014', en, es, mc.older[i] as string)),
      ...m24.map(([en, es], i) => mountDoc('2024', en, es, mc.newer[i] as string))
    ],
    'clases.json': [
      ...(['2014', '2024'] as const).flatMap((edition) =>
        classDocs(FIGHTER[edition], FIGHTER_CLASS[edition], FIGHTER_FEATURES[edition])
      ),
      ...allClassDocs()
    ],
    'armas.json': [
      ...w14.map(([en, es], i) => weaponDoc('2014', en, es, wc.older[i] as string)),
      ...w24.map(([en, es], i) => weaponDoc('2024', en, es, wc.newer[i] as string))
    ],
    'estados.json': [...conditionDocs('2014'), ...conditionDocs('2024')],
    'reglas.json': ruleDocs(),
    'armaduras.json': [
      ...a14.map(([en, es], i) => armorDoc('2014', en, es, ac.older[i] as string)),
      ...a24.map(([en, es], i) => armorDoc('2024', en, es, ac.newer[i] as string))
    ]
  }
  // Los conjuros y los objetos mágicos, con un concepto que no sea ya de otro tipo
  const taken = () => new Set(Object.values(files).flatMap((docs) => docs.map((d) => d.concept)))
  files['conjuros.json'] = spellDocs(taken())
  files['objetos_magicos.json'] = magicDocs(taken())
  files['criaturas.json'] = creatureDocs(taken())
  files['origenes.json'] = allOriginDocs(taken())
  return files
}

export function main(io: Io = consoleIo) {
  const files = extract()
  for (const [name, docs] of Object.entries(files)) {
    // Las medidas, en las de D&D (pies, millas, libras), también en español
    writeFileSync(new URL(name, CONTENT_DIR), `${JSON.stringify(imperialTexts(docs), null, 2)}\n`)
    io.out(`${name}: ${docs.length} documentos`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main()
