/**
 * El texto de las reglas de los dos SRD como documentos de tipo «regla»: cada sección de los capítulos de reglas (y su
 * introducción, con el nombre del capítulo) y, en 2024, cada entrada del glosario. Lo de un capítulo se empareja por su
 * orden (la traducción sigue el mismo); el glosario, que va por orden alfabético, por la lista revisada de `pares.ts`
 */
import type { Doc } from './equipo.ts'
import { GLOSSARY_PAIRS, RULE_RENAMES } from './pares.ts'
import { basesOf, cut, type Profile, ruleRows, textOf } from './reglas.ts'
import { type Edition, type Lang, SOURCE, slug } from './texto.ts'

const t = (es: string, en: string) => ({ es, en })

export function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
}

/** Lo que es cada línea de cada PDF, por su alto */
interface PdfProfile {
  chapter: number[]
  section: number[]
  /** Las capitulares de los títulos de los recuadros */
  caps?: number
  text: Profile
}

const PROFILE_2024: PdfProfile = {
  chapter: [31],
  section: [21.5],
  caps: 17,
  text: {
    headings: [[16.7], [14.3]],
    tableTitles: [12.5],
    // Las filas, las de grupo y las cabeceras
    cells: [11, 10.8, 11.3, 11.6],
    sidebar: { title: 11.9, body: 10.4 },
    body: [34.1, 13.5]
  }
}

export const PROFILES: Record<Edition, Record<Lang, PdfProfile>> = {
  '2014': {
    en: {
      chapter: [30.9],
      section: [21.5],
      // Los títulos de los recuadros (12.9), como apartados
      text: { headings: [[16.6, 12.9], [14.3]], tableTitles: [14.7], cells: [10.8], body: [11.5, 9.8, 12.5, 8.9] }
    },
    es: {
      chapter: [34.8],
      section: [24.1, 24.6],
      text: {
        headings: [[18.8, 14.8], [16.1]],
        tableTitles: [16.7],
        cells: [12.5, 12, 11.7],
        body: [34, 12.2, 13.4, 12.1, 13.2]
      }
    }
  },
  '2024': { en: PROFILE_2024, es: PROFILE_2024 }
}

interface Chapter {
  /** Su nombre (el del campo «capítulo»); sin él, sus secciones no son de ningún capítulo */
  name: { es: string; en: string } | null
  pages: Record<Lang, [number, number]>
  /** Su introducción (lo de antes de la primera sección) va, con el nombre del capítulo o este */
  intro?: boolean | { es: string; en: string }
  /** Las secciones que no van: las listas de objetos, que ya son contenido */
  skip?: RegExp
  /** Dónde se para, en cada idioma */
  stop?: RegExp
  /** Las tablas que no van (por su título): las de los objetos, que ya son contenido */
  dropTables?: RegExp
  /** Dónde acaba lo que va de una sección: lo que sigue es contenido de otro tipo (el trasfondo de ejemplo) */
  until?: RegExp
}

/** Las tablas de las armas y las armaduras: ya son contenido y ocupan la página entera */
const ITEM_TABLES = /^(Weapons|Armas|Armor|Armaduras)$/

const CHAPTERS: Record<Edition, Chapter[]> = {
  '2014': [
    {
      name: t('Más allá del nivel 1', 'Beyond 1st Level'),
      pages: { en: [56, 61], es: [56, 62] },
      intro: true,
      until: /^(Acolyte|Acólito)$/
    },
    {
      name: t('Equipo', 'Equipment'),
      pages: { en: [62, 74], es: [63, 77] },
      intro: true,
      skip: /^(Adventuring Gear|Tools|Mounts and Vehicles|Trade Goods)$/,
      dropTables: ITEM_TABLES
    },
    {
      name: t('Uso de las puntuaciones de característica', 'Using Ability Scores'),
      pages: { en: [76, 83], es: [79, 87] },
      intro: true
    },
    { name: t('Aventuras', 'Adventuring'), pages: { en: [84, 89], es: [88, 94] } },
    { name: t('Combate', 'Combat'), pages: { en: [90, 99], es: [95, 105] } },
    {
      name: t('Lanzamiento de conjuros', 'Spellcasting'),
      pages: { en: [100, 104], es: [106, 110] },
      intro: true,
      stop: /^(Spell Lists|Listas de conjuros)$/
    },
    { name: null, pages: { en: [195, 205], es: [209, 220] } },
    {
      name: t('Objetos mágicos', 'Magic Items'),
      pages: { en: [206, 207], es: [221, 222] },
      intro: true,
      stop: /^(Magic Items A-Z|Objetos mágicos de la A a la Z)$/
    },
    {
      name: t('Objetos mágicos', 'Magic Items'),
      pages: { en: [251, 252], es: [271, 272] },
      until: /^(Orb of Dragonkind|Orbe de los Dragones)$/
    },
    {
      name: t('Monstruos', 'Monsters'),
      pages: { en: [254, 260], es: [274, 281] },
      intro: true,
      stop: /^(Monsters \(A\)|Monstruos \(A\))$/
    },
    {
      name: t('Estados', 'Conditions'),
      pages: { en: [358, 358], es: [389, 389] },
      intro: t('Estados', 'Conditions'),
      until: /^(Blinded|Agarrado)$/
    },
    {
      name: t('Panteones histórico-fantásticos', 'Fantasy-Historical Pantheons'),
      pages: { en: [360, 362], es: [391, 393] },
      intro: t('Panteones histórico-fantásticos', 'Fantasy-Historical Pantheons')
    },
    {
      name: t('Los planos de existencia', 'The Planes of Existence'),
      pages: { en: [363, 365], es: [394, 396] },
      intro: t('Los planos de existencia', 'The Planes of Existence')
    }
  ],
  '2024': [
    { name: t('Cómo jugar', 'Playing the Game'), pages: { en: [5, 18], es: [5, 20] }, intro: true },
    { name: t('Creación de personajes', 'Character Creation'), pages: { en: [19, 27], es: [21, 31] }, intro: true },
    {
      name: t('Equipo', 'Equipment'),
      pages: { en: [89, 103], es: [97, 113] },
      intro: true,
      skip: /^(Tools|Adventuring Gear|Mounts and Vehicles)$/,
      dropTables: ITEM_TABLES
    },
    {
      name: t('Conjuros', 'Spells'),
      pages: { en: [104, 106], es: [114, 117] },
      intro: true,
      stop: /^(Spell Descriptions|Descripciones de conjuros)$/
    },
    {
      name: t('Glosario de reglas', 'Rules Glossary'),
      pages: { en: [176, 176], es: [194, 194] },
      stop: /^(Rules Definitions|Definiciones de las reglas)$/
    },
    { name: t('Herramientas del juego', 'Gameplay Toolbox'), pages: { en: [192, 203], es: [211, 222] }, intro: true },
    {
      name: t('Objetos mágicos', 'Magic Items'),
      pages: { en: [204, 208], es: [223, 228] },
      intro: true,
      stop: /^(Magic Items A–Z|Objetos mágicos de la A)/
    },
    {
      name: t('Monstruos', 'Monsters'),
      pages: { en: [254, 257], es: [278, 282] },
      intro: true,
      stop: /^(Monsters A–Z|Monstruos de la A)/
    }
  ]
}

/** Una sección (o la introducción de un capítulo) en un idioma: su nombre, su texto y su página */
export interface RuleText {
  name: string
  text: string
  page: number
  /** La introducción de un capítulo (con el nombre del capítulo) */
  intro?: boolean
}

/** Las secciones de un capítulo en un idioma, en su orden */
export function chapterTexts(edition: Edition, lang: Lang, chapter: Chapter): RuleText[] {
  const profile = PROFILES[edition][lang]
  const [from, to] = chapter.pages[lang]
  const rows = ruleRows(edition, lang, range(from, to), profile.caps)
  const bases = basesOf(rows, profile.text)
  const heading = (h: number) => profile.chapter.includes(h) || profile.section.includes(h)
  const entries = cut(rows, (r) => heading(r.h), chapter.stop)
  const out: RuleText[] = []
  for (const entry of entries) {
    const intro = profile.chapter.includes(entry.h)
    const end = chapter.until ? entry.rows.findIndex((r) => chapter.until?.test(r.text)) : -1
    const own = end < 0 ? entry.rows : entry.rows.slice(0, end)
    if (intro && (!chapter.intro || own.length === 0)) continue
    const name = intro
      ? typeof chapter.intro === 'object'
        ? chapter.intro[lang]
        : (chapter.name?.[lang] ?? entry.name)
      : entry.name
    const text = textOf(own, {
      bases,
      profile: profile.text,
      ...(chapter.dropTables ? { dropTables: chapter.dropTables } : {})
    })
    out.push({ name, text, page: entry.page, intro })
  }
  return out
}

/** El glosario de reglas de 2024 */
const GLOSSARY_PAGES: Record<Lang, [number, number]> = { en: [176, 191], es: [194, 210] }

/** Las entradas del glosario de 2024 en un idioma (también los estados), con su texto */
export function glossaryTexts(lang: Lang): RuleText[] {
  const profile = PROFILES['2024'][lang]
  const rows = ruleRows('2024', lang, range(...GLOSSARY_PAGES[lang]), profile.caps)
  const bases = basesOf(rows, profile.text)
  // Las entradas tienen el alto de los apartados de segundo nivel; lo de antes de la primera (las convenciones), no
  const entry = profile.text.headings[1] ?? []
  return cut(rows, (r) => entry.includes(r.h) || profile.section.includes(r.h) || profile.chapter.includes(r.h))
    .filter((e) => entry.includes(e.h))
    .map((e) => ({
      name: e.name,
      text: textOf(e.rows, { bases, profile: { ...profile.text, headings: [profile.text.headings[0] ?? []] } }),
      page: e.page
    }))
}

/** Un nombre sin su etiqueta («Atacar [acción]» → «Atacar») */
const untagged = (name: string) => name.replace(/\s*\[[^\]]*\]$/, '')
/** Para comparar nombres en inglés */
const norm = (name: string) =>
  untagged(name)
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .trim()

/** El concepto de una regla por su nombre en español (cabe en una clave con su edición) */
function conceptOf(es: string): string {
  let base = slug(untagged(es))
  while (base.length > 47 && base.includes('_')) base = base.slice(0, base.lastIndexOf('_'))
  return `regla_${base}`
}

export type Pair = { en: RuleText; es: RuleText; chapter: Chapter['name'] }

/** Lo que cabe en el texto de un documento (sus campos de texto, en cada idioma) */
const MAX_TEXT = 20000

/**
 * Una sección demasiado larga, en trozos: lo de antes de su primer apartado y cada apartado («Monstruos: Tamaño»),
 * emparejados por su orden
 */
export function split(pair: Pair, max = MAX_TEXT): Pair[] {
  if (pair.en.text.length <= max && pair.es.text.length <= max) return [pair]
  const parts = (r: RuleText) =>
    r.text.split(/\n\n(?=### )/).map((part, i) => {
      const title = i === 0 ? null : /^### (.*)/.exec(part)?.[1]
      return {
        ...r,
        name: title ? `${r.name}: ${title}` : r.name,
        text: title ? part.replace(/^### .*\n*/, '') : part,
        intro: i === 0 && r.intro === true
      }
    })
  const en = parts(pair.en)
  const es = parts(pair.es)
  if (en.length !== es.length)
    throw new Error(`«${pair.en.name}»: ${en.length} apartados en inglés y ${es.length} en español`)
  return en.map((e, i) => ({ en: e, es: es[i] as RuleText, chapter: pair.chapter }))
}

/** Las secciones de un capítulo en los dos idiomas, emparejadas por su orden (sin las que no van ni las vacías) */
export function pairChapter(chapter: Pick<Chapter, 'name' | 'skip'>, en: RuleText[], es: RuleText[]): Pair[] {
  if (en.length !== es.length)
    throw new Error(
      `«${chapter.name?.en ?? '?'}»: ${en.length} secciones en inglés y ${es.length} en español\n${en.map((e) => e.name).join(' | ')}\n${es.map((e) => e.name).join(' | ')}`
    )
  return en
    .map((e, i) => ({ en: e, es: es[i] as RuleText, chapter: chapter.name }))
    .filter((p) => !chapter.skip?.test(p.en.name) && (p.en.text || p.es.text))
    .flatMap((p) => split(p))
}

/** Las entradas del glosario (sin los estados), emparejadas por la lista revisada: todas, y cada una una vez */
export function pairGlossary(en: RuleText[], es: RuleText[], pairs: Record<string, string> = GLOSSARY_PAIRS): Pair[] {
  const left = new Map(es.filter((e) => !e.name.endsWith(' [estado]')).map((e) => [e.name, e]))
  const chapter = t('Glosario de reglas', 'Rules Glossary')
  const out = en
    .filter((e) => !e.name.endsWith(' [Condition]'))
    .map((e) => {
      const wanted = pairs[e.name]
      const found = wanted ? left.get(wanted) : undefined
      if (!found) throw new Error(`Glosario: «${e.name}» no tiene pareja («${wanted ?? '?'}»)`)
      left.delete(found.name)
      return { en: e, es: found, chapter }
    })
  if (left.size > 0) throw new Error(`Glosario: sin pareja en inglés: ${[...left.keys()].join(', ')}`)
  return out
}

/**
 * Los documentos de las reglas de las dos ediciones. Lo de 2014 que tiene versión en 2024 (el mismo nombre en inglés, o
 * el de `RULE_RENAMES`, y las dos introducciones o las dos no) lleva su concepto; lo demás, uno que no tenga 2024
 */
export function ruleDocsOf(pairs: Record<Edition, Pair[]>): Doc[] {
  const byEnglish = new Map<string, string>()
  const newer = new Set<string>()
  const docs: Doc[] = []
  for (const edition of ['2024', '2014'] as const) {
    const taken = new Set<string>()
    for (const { en, es, chapter } of pairs[edition]) {
      const english = `${en.intro ? 'intro:' : ''}${norm(RULE_RENAMES[en.name] ?? en.name)}`
      const same = edition === '2014' ? byEnglish.get(english) : undefined
      let concept = same ?? conceptOf(es.name)
      const busy = (c: string) => taken.has(c) || (!same && edition === '2014' && newer.has(c))
      for (let n = 2; busy(concept); n++) concept = `${conceptOf(es.name)}_${n}`
      taken.add(concept)
      if (edition === '2024') {
        newer.add(concept)
        if (!byEnglish.has(english)) byEnglish.set(english, concept)
      }
      docs.push({
        type: 'regla',
        key: `${concept}_${edition}`,
        source: SOURCE[edition],
        concept,
        data: {
          name: t(es.name, en.name),
          ...(chapter ? { capitulo: chapter } : {}),
          descripcion: t(es.text, en.text)
        },
        mechanics: { automation: 'text' },
        ref: { pages: { en: en.page, es: es.page } }
      })
    }
  }
  return docs
}

/** Las reglas de los dos SRD, sacadas de los PDF */
export function ruleDocs(): Doc[] {
  const chapters = (edition: Edition) =>
    CHAPTERS[edition].flatMap((chapter) =>
      pairChapter(chapter, chapterTexts(edition, 'en', chapter), chapterTexts(edition, 'es', chapter))
    )
  return ruleDocsOf({
    '2024': [...chapters('2024'), ...pairGlossary(glossaryTexts('en'), glossaryTexts('es'))],
    '2014': chapters('2014')
  })
}
