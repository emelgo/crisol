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
