/**
 * El texto de los cuatro PDF oficiales del SRD (en `datos-locales/srd/`, fuera de git), página a página, como lo deja
 * `pdftotext -layout` (poppler, solo en local): limpio de guiones blandos, rayas raras y tabuladores
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

export type Edition = '2014' | '2024'
export type Lang = 'es' | 'en'

export const SRD_DIR = new URL('../../datos-locales/srd/', import.meta.url)

export const PDFS: Record<Edition, Record<Lang, string>> = {
  '2014': { en: 'SRD_CC_v5.1.pdf', es: 'SRD_CC_v5.1_ES.pdf' },
  '2024': { en: 'SRD_CC_v5.2.1.pdf', es: 'SP_SRD_CC_v5.2.1.pdf' }
}

/** La fuente del 5e de cada edición */
export const SOURCE: Record<Edition, string> = { '2014': 'srd51', '2024': 'srd521' }

/** Una línea limpia: sin guiones blandos, con las rayas de unir como guiones y sin tabuladores */
export const clean = (line: string) =>
  line
    .normalize('NFC')
    .replace(/­/g, '')
    .replace(/[‐‑]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/\t/g, ' ')
    .replace(/\s+$/, '')

/** Con un solo espacio entre palabras */
export const collapse = (line: string) => line.replace(/\s+/g, ' ').trim()

/** Cuánto empieza de dentro una línea (para saber de qué columna es lo que sigue) */
export const indentOf = (line: string) => line.length - line.trimStart().length

/** Una clave a partir de un nombre: en minúsculas, sin tildes ni espacios («Espada larga» → espada_larga) */
export const slug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

export interface Line {
  /** La línea limpia, con sus espacios (para ver sus columnas) */
  raw: string
  /** Con un solo espacio */
  text: string
  page: number
}

const cache = new Map<string, Line[]>()

/** Las líneas de unas páginas de un PDF */
export function pagesOf(edition: Edition, lang: Lang, pages: readonly number[]): Line[] {
  const file = new URL(PDFS[edition][lang], SRD_DIR)
  if (!existsSync(file)) throw new Error(`Falta ${PDFS[edition][lang]} en datos-locales/srd/`)
  return pages.flatMap((page) => {
    const id = `${edition}/${lang}/${page}`
    let lines = cache.get(id)
    if (!lines) {
      const text = execFileSync('pdftotext', ['-layout', '-f', String(page), '-l', String(page), file.pathname, '-'], {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024
      })
      lines = text.split('\n').map((l) => {
        const raw = clean(l)
        return { raw, text: collapse(raw), page }
      })
      cache.set(id, lines)
    }
    return lines
  })
}

/** Una palabra (o una celda, en el 5.1 inglés) con su sitio en la página, en puntos */
export interface Box {
  text: string
  x: number
  y: number
  xMax: number
  page: number
}

const boxCache = new Map<string, Box[]>()
const widths = new Map<string, number>()

/** El ancho de una página, en puntos (después de leer sus palabras) */
export const widthOf = (edition: Edition, lang: Lang, page: number) => {
  boxesOf(edition, lang, page)
  return widths.get(`${edition}/${lang}/${page}`) ?? 612
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'"
}

/** Las palabras de una página con su sitio (`pdftotext -bbox`): para cortar las tablas por sus columnas */
export function boxesOf(edition: Edition, lang: Lang, page: number): Box[] {
  const id = `${edition}/${lang}/${page}`
  const cached = boxCache.get(id)
  if (cached) return cached
  const file = new URL(PDFS[edition][lang], SRD_DIR)
  if (!existsSync(file)) throw new Error(`Falta ${PDFS[edition][lang]} en datos-locales/srd/`)
  const html = execFileSync('pdftotext', ['-bbox', '-f', String(page), '-l', String(page), file.pathname, '-'], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  })
  const width = Number(/<page width="([\d.]+)"/.exec(html)?.[1] ?? 612)
  widths.set(id, width)
  const boxes: Box[] = []
  for (const m of html.matchAll(
    /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="[\d.]+">([^<]*)<\/word>/g
  )) {
    const text = collapse(
      clean((m[4] as string).replace(/&[a-z#0-9]+;/g, (e) => ENTITIES[e] ?? e).replace(/[\r ]/g, ' '))
    )
    if (text) boxes.push({ text, x: Number(m[1]), y: Number(m[2]), xMax: Number(m[3]), page })
  }
  boxCache.set(id, boxes)
  return boxes
}

/** Una línea de una columna: sus palabras, de izquierda a derecha, y dónde empieza */
export interface Row {
  text: string
  x: number
  y: number
  page: number
}

/** Las líneas de un trozo de la página (una columna de una tabla), juntando las palabras de la misma altura */
export function rowsIn(boxes: readonly Box[], area: { x0: number; x1: number; y0?: number; y1?: number }): Row[] {
  const inside = boxes
    .filter((b) => b.x >= area.x0 - 1 && b.x < area.x1 && b.y > (area.y0 ?? -1) && b.y < (area.y1 ?? Infinity))
    .sort((a, b) => a.y - b.y || a.x - b.x)
  const rows: { boxes: Box[]; y: number }[] = []
  for (const b of inside) {
    const last = rows.at(-1)
    if (last && Math.abs(last.y - b.y) < 3) last.boxes.push(b)
    else rows.push({ boxes: [b], y: b.y })
  }
  return rows.map((r) => {
    const sorted = r.boxes.sort((a, b) => a.x - b.x)
    return { text: sorted.map((b) => b.text).join(' '), x: sorted[0]?.x ?? 0, y: r.y, page: sorted[0]?.page ?? 0 }
  })
}
