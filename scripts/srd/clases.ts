/**
 * Las clases de los dos SRD: su texto, leído columna a columna en orden, cortado en secciones (cada rasgo con su nivel,
 * la subclase y los suyos), sin sus tablas
 */
import type { Doc } from './equipo.ts'
import { boxesOf, type Edition, type Lang, type Row, rowsIn, SOURCE, widthOf } from './texto.ts'

export interface Section {
  name: string
  level: number | null
  /** La subclase de la que es, si es de una */
  subclass: string | null
  text: string
  page: number
}

/** Las líneas de unas páginas a dos columnas, en orden de lectura: la izquierda y luego la derecha de cada página */
export function readingRows(edition: Edition, lang: Lang, pages: readonly number[]): Row[] {
  return pages.flatMap((page) => {
    const boxes = boxesOf(edition, lang, page)
    const width = widthOf(edition, lang, page)
    // Sin el pie de página (su número y el nombre del documento)
    const body = boxes.filter((b) => b.y < 740)
    return [
      { x0: 0, x1: width / 2 },
      { x0: width / 2, x1: width }
    ].flatMap((half) => rowsIn(body, half))
  })
}

export interface Shape {
  /** Un rasgo: «Level 1: Second Wind», o uno de estos nombres (en 2014, con su nivel) */
  heading: RegExp | Map<string, number | null>
  /** Donde empieza la subclase («Fighter Subclass: Champion», «Champion») */
  subclass: RegExp
  /** Lo que es de una tabla y no del texto: se salta hasta el siguiente rasgo */
  table: RegExp
  /** Donde acaba la clase (la siguiente) */
  stop: RegExp
}

/** Une una línea al texto: sin el guion de una palabra partida; con un párrafo nuevo si va sangrada */
function append(text: string, raw: string, newParagraph: boolean): string {
  // Una consonante suelta es un trozo de la palabra que sigue, partida en el PDF («d estreza»)
  const line = raw.replace(/(^|[^\d\s] )([b-df-hj-np-tv-xz]) (?=[a-záéíóúñ])/g, '$1$2')
  if (!text) return line
  if (/[a-záéíóúñ]-$/i.test(text) && /^[a-záéíóúñ]/.test(line)) return text.slice(0, -1) + line
  return `${text}${newParagraph ? '\n\n' : ' '}${line}`
}

export function sections(rows: readonly Row[], shape: Shape): Section[] {
  const out: Section[] = []
  let current: Section | null = null
  let subclass: string | null = null
  let skipping = false
  // Dónde empieza cada columna de cada página
  const base = new Map<number, number>()
  for (const row of rows) {
    if (shape.stop.test(row.text)) break
    const sub = shape.subclass.exec(row.text)
    if (sub) {
      subclass = (sub[1] ?? row.text).trim()
      current = { name: subclass, level: null, subclass, text: '', page: row.page }
      out.push(current)
      skipping = false
      continue
    }
    let heading: { name: string; level: number | null } | null = null
    if (shape.heading instanceof RegExp) {
      const m = shape.heading.exec(row.text)
      if (m) heading = { name: (m[2] as string).trim(), level: Number(m[1]) }
    } else if (shape.heading.has(row.text)) heading = { name: row.text, level: shape.heading.get(row.text) ?? null }
    if (heading) {
      current = { ...heading, subclass, text: '', page: row.page }
      out.push(current)
      skipping = false
      continue
    }
    if (shape.table.test(row.text)) {
      skipping = true
      continue
    }
    if (!current || skipping) continue
    // Dónde empieza la columna: un párrafo nuevo va sangrado
    const column = row.page * 10 + Math.round(row.x / 250)
    const left = Math.min(base.get(column) ?? row.x, row.x)
    base.set(column, left)
    current.text = append(current.text, row.text, row.x - left > 3)
  }
  return out
}

/** Un rasgo de una clase o de su subclase: su nombre en los dos idiomas, su clave y su nivel (sin nivel, una opción) */
export interface Feature {
  en: string
  es: string
  key: string
  level: number | null
  /** Otros niveles en los que se vuelve a obtener (la mejora de característica) */
  also?: number[]
}

export interface ClassConfig {
  concept: string
  name: { es: string; en: string }
  edition: Edition
  pages: Record<Lang, number[]>
  shape: Record<Lang, Shape>
  data: Record<string, unknown>
  features: Feature[]
  subclass: { concept: string; name: { es: string; en: string }; features: Feature[] }
}

/** Las secciones de una clase en los dos idiomas, emparejadas por su nombre (la lista revisada) */
export function classSections(config: ClassConfig) {
  const of = (lang: Lang) => sections(readingRows(config.edition, lang, config.pages[lang]), config.shape[lang])
  const en = of('en')
  const es = of('es')
  const find = (list: Section[], name: string, subclass: boolean) => {
    const found = list.find((s) => s.name === name && (s.subclass !== null) === subclass)
    if (!found) throw new Error(`No está «${name}» en ${config.concept} ${config.edition}`)
    return found
  }
  return {
    features: config.features.map((f) => ({ feature: f, en: find(en, f.en, false), es: find(es, f.es, false) })),
    subclass: {
      en: find(en, config.subclass.name.en, true),
      es: find(es, config.subclass.name.es, true),
      features: config.subclass.features.map((f) => ({
        feature: f,
        en: find(en, f.en, true),
        es: find(es, f.es, true)
      }))
    }
  }
}

type Mechanics = Record<string, unknown> & { grants?: unknown[] }

/**
 * Los documentos de una clase: ella (con lo que concede en cada nivel), su subclase (con lo suyo) y cada rasgo, con su
 * texto en los dos idiomas y su página
 */
export function classDocs(
  config: ClassConfig,
  classMechanics: Mechanics,
  featureMechanics: Record<string, Record<string, unknown>>
): Doc[] {
  const found = classSections(config)
  const edition = config.edition
  const source = SOURCE[edition]
  const byLevel = (features: Feature[]) =>
    features
      .filter((f) => f.level !== null)
      .flatMap((f) => [f.level as number, ...(f.also ?? [])].map((level) => ({ level, concept: f.key, type: 'rasgo' })))
  const feature = (f: Feature, en: Section, es: Section, origin: { es: string; en: string }): Doc => ({
    type: 'rasgo',
    key: `${f.key}_${edition}`,
    source,
    concept: f.key,
    data: {
      name: { es: f.es, en: f.en },
      procedencia: origin,
      nivel: f.level ?? 0,
      descripcion: { es: es.text, en: en.text }
    },
    mechanics: featureMechanics[f.key] ?? { automation: 'text' },
    ref: { pages: { en: en.page, es: es.page } }
  })
  const sub = config.subclass
  return [
    {
      type: 'clase',
      key: `${config.concept}_${edition}`,
      source,
      concept: config.concept,
      data: { name: config.name, ...config.data },
      mechanics: { ...classMechanics, grants: [...(classMechanics.grants ?? []), ...byLevel(config.features)] },
      ref: { pages: { en: config.pages.en[0] as number, es: config.pages.es[0] as number } }
    },
    {
      type: 'subclase',
      key: `${sub.concept}_${edition}`,
      source,
      concept: sub.concept,
      data: {
        name: sub.name,
        clase: config.concept,
        descripcion: { es: found.subclass.es.text, en: found.subclass.en.text }
      },
      mechanics: { grants: byLevel(sub.features), automation: 'full' },
      ref: { pages: { en: found.subclass.en.page, es: found.subclass.es.page } }
    },
    ...found.features.map(({ feature: f, en, es }) => feature(f, en, es, config.name)),
    ...found.subclass.features.map(({ feature: f, en, es }) => feature(f, en, es, sub.name))
  ]
}
