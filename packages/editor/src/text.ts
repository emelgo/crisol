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
