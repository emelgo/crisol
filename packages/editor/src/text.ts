/**
 * El texto de un documento sin formato: para buscar, para las menciones sin enlazar y para los fragmentos de los
 * entrantes. Un bloque de texto (párrafo, título, código) por línea; un enlace cuenta con lo que enseña
 */
import type { JSONContent } from '@tiptap/core'

const TEXT_BLOCKS = new Set(['paragraph', 'heading', 'codeBlock'])

/** Lo que se lee de un nodo en línea */
function inlineText(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return ' '
  if (node.type === 'pageLink') return String(node.attrs?.label || node.attrs?.title || '')
  if (node.type === 'diceRoll') return [node.attrs?.label, node.attrs?.formula].filter(Boolean).join(' ')
  return (node.content ?? []).map(inlineText).join('')
}

/** Los bloques de texto, con su texto y las páginas a las que enlazan */
export function textBlocks(node: JSONContent, found: { text: string; links: string[] }[] = []) {
  if (node.type && TEXT_BLOCKS.has(node.type)) {
    const links: string[] = []
    const collect = (child: JSONContent) => {
      if (child.type === 'pageLink' && typeof child.attrs?.pageId === 'string') links.push(child.attrs.pageId)
      for (const inner of child.content ?? []) collect(inner)
    }
    for (const child of node.content ?? []) collect(child)
    found.push({ text: (node.content ?? []).map(inlineText).join(''), links })
    return found
  }
  // El pie de una imagen se busca como un texto más
  if (node.type === 'fileEmbed' && node.attrs?.caption) {
    found.push({ text: String(node.attrs.caption), links: [] })
    return found
  }
  for (const child of node.content ?? []) textBlocks(child, found)
  return found
}

/** Todo el texto de un documento, un bloque por línea */
export const plainText = (node: JSONContent) =>
  textBlocks(node)
    .map((block) => block.text)
    .filter((text) => text.trim() !== '')
    .join('\n')

/** Un trozo de un texto alrededor de una posición, de unos 160 caracteres, con «…» si corta */
export function fragmentAround(text: string, index: number, length = 0, size = 160) {
  const start = Math.max(0, index - Math.floor((size - length) / 2))
  const end = Math.min(text.length, start + size)
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`
}

/**
 * Dónde aparece un nombre como palabra entera (sin mayúsculas ni tildes de más: tal cual, salvo mayúsculas), o -1. Un
 * nombre dentro de otra palabra («Mar» en «Marea») no cuenta
 */
export function findName(text: string, name: string, from = 0): number {
  const haystack = text.toLocaleLowerCase('es')
  const needle = name.trim().toLocaleLowerCase('es')
  if (!needle) return -1
  for (let index = haystack.indexOf(needle, from); index !== -1; index = haystack.indexOf(needle, index + 1)) {
    const before = haystack[index - 1] ?? ' '
    const after = haystack[index + needle.length] ?? ' '
    if (!/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after)) return index
  }
  return -1
}

/** Una sección de un documento, para buscar: lo de debajo de un título (o lo de antes del primero), en texto plano */
export interface TextSection {
  heading: string | null
  headingId: string | null
  body: string
}

/** Las secciones de un documento: se corta en cada título de primer nivel del documento (de cualquier nivel) */
export function sectionsOf(doc: JSONContent): TextSection[] {
  const sections: TextSection[] = []
  let current: TextSection & { lines: string[] } = { heading: null, headingId: null, body: '', lines: [] }
  const close = () => {
    const body = current.lines.filter((line) => line.trim() !== '').join('\n')
    if (current.heading !== null || body !== '')
      sections.push({ heading: current.heading, headingId: current.headingId, body })
  }
  for (const block of doc.content ?? []) {
    if (block.type === 'heading') {
      close()
      current = {
        heading: (block.content ?? []).map(inlineText).join(''),
        headingId: (block.attrs?.id as string | null | undefined) ?? null,
        body: '',
        lines: []
      }
      continue
    }
    current.lines.push(...textBlocks(block).map((found) => found.text))
  }
  close()
  return sections
}

const SEPARATE_TYPES = new Set(['secret', 'note'])

/** Los secretos y notas ocultas de un cuerpo (por su documento), con el título de la sección del cuerpo donde están */
export function separateHeadings(doc: JSONContent): Map<string, { heading: string | null; headingId: string | null }> {
  const found = new Map<string, { heading: string | null; headingId: string | null }>()
  let current = { heading: null as string | null, headingId: null as string | null }
  const visit = (node: JSONContent) => {
    const documentId = node.attrs?.documentId
    if (node.type && SEPARATE_TYPES.has(node.type) && typeof documentId === 'string') found.set(documentId, current)
    for (const child of node.content ?? []) visit(child)
  }
  for (const block of doc.content ?? []) {
    if (block.type === 'heading') {
      current = {
        heading: (block.content ?? []).map(inlineText).join(''),
        headingId: (block.attrs?.id as string | null | undefined) ?? null
      }
      continue
    }
    visit(block)
  }
  return found
}
