/**
 * Las propiedades de una página en YAML, al principio del Markdown (como en Obsidian). Un YAML pequeño, hecho a mano
 * para lo que hace falta: texto, número, sí o no, listas y enlaces a páginas («[[Título]]»). Lo que no entiende lo dice
 * con su línea, en vez de adivinar
 */

/** Una propiedad leída del YAML. Las de páginas llevan los títulos: el servidor los resuelve a ids */
export type ReadProperty =
  | { name: string; type: 'text'; value: string }
  | { name: string; type: 'number'; value: number }
  | { name: string; type: 'boolean'; value: boolean }
  | { name: string; type: 'list'; value: string[] }
  | { name: string; type: 'pages'; value: string[] }

export class FrontmatterError extends Error {
  readonly line: number
  constructor(line: number, message: string) {
    super(`YAML, línea ${line}: ${message}`)
    this.line = line
  }
}

const LIST_NAMES = new Set(['alias', 'etiquetas'])
const TEXT_NAMES = new Set(['resumen'])
const LINK = /^\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]$/

const isPlainSafe = (text: string) =>
  text !== '' &&
  text === text.trim() &&
  !/^[-?:,[\]{}#&*!|>'"%@`]/.test(text) &&
  !/: |\s#|\n/.test(text) &&
  !/^(true|false|null|~|yes|no|on|off)$/i.test(text) &&
  !/^[-+]?(\d|\.\d)/.test(text)

/** Un texto en YAML: tal cual si no hay duda, y si no, entre comillas dobles (con los escapes de JSON, que valen) */
const scalar = (text: string) => (isPlainSafe(text) ? text : JSON.stringify(text))

const key = (name: string) =>
  /^[\p{L}\p{N}_][\p{L}\p{N}_ -]*$/u.test(name) && name === name.trim() ? name : JSON.stringify(name)

/** El YAML de unas propiedades, con sus «---», o nada si no hay. pageTitle da el título de cada página enlazada */
export function writeFrontmatter(
  properties: readonly (ReadProperty | { name: string; type: 'pages'; value: string[] })[],
  pageTitle: (id: string) => string = (id) => id
): string {
  if (properties.length === 0) return ''
  const lines = ['---']
  for (const property of properties) {
    const name = key(property.name)
    switch (property.type) {
      case 'text':
        lines.push(`${name}: ${scalar(property.value)}`)
        break
      case 'number':
      case 'boolean':
        lines.push(`${name}: ${String(property.value)}`)
        break
      case 'list':
      case 'pages': {
        const items = property.type === 'pages' ? property.value.map((id) => `[[${pageTitle(id)}]]`) : property.value
        if (items.length === 0) lines.push(`${name}: []`)
        else lines.push(`${name}:`, ...items.map((item) => `  - ${scalar(item)}`))
        break
      }
    }
  }
  lines.push('---', '')
  return lines.join('\n')
}

/** Un texto entre comillas (dobles, con escapes de JSON; o simples, con '' para la comilla), o null si no lo es */
function quoted(text: string, line: number): string | null {
  if (text.startsWith('"')) {
    try {
      return JSON.parse(text) as string
    } catch {
      throw new FrontmatterError(line, `comillas sin cerrar o un escape que no vale: ${text}`)
    }
  }
  if (text.startsWith("'")) {
    if (!/^'(?:[^']|'')*'$/.test(text)) throw new FrontmatterError(line, `comillas sin cerrar: ${text}`)
    return text.slice(1, -1).replaceAll("''", "'")
  }
  return null
}

/** Un valor suelto: texto, número o sí/no. Sin comentarios al final (« #…») */
function value(raw: string, line: number): string | number | boolean | null {
  const text = raw.trim()
  const string = quoted(text, line)
  if (string !== null) return string
  const plain = text.replace(/\s+#.*$/, '')
  if (plain === '' || plain === '~' || plain === 'null') return null
  if (plain === 'true') return true
  if (plain === 'false') return false
  if (/^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(plain)) return Number(plain)
  return plain
}

/** Los elementos de una lista en línea: [a, "b, c", 'd'] */
function flowList(raw: string, line: number): string[] {
  const inner = raw.trim().slice(1, -1).trim()
  if (inner === '') return []
  const items: string[] = []
  let current = ''
  let quote: string | null = null
  for (let i = 0; i < inner.length; i++) {
    const char = inner[i] as string
    if (quote) {
      current += char
      if (char === '\\' && quote === '"') current += inner[++i] ?? ''
      else if (char === quote) quote = null
    } else if (char === '"' || char === "'") {
      quote = char
      current += char
    } else if (char === ',') {
      items.push(current)
      current = ''
    } else current += char
  }
  if (quote) throw new FrontmatterError(line, 'comillas sin cerrar en la lista')
  items.push(current)
  return items.map((item) => String(value(item, line) ?? ''))
}

/** Qué tipo de propiedad es un valor leído, según su nombre y su forma */
function toProperty(name: string, raw: string | number | boolean | string[] | null): ReadProperty {
  const lower = name.trim().toLocaleLowerCase('es')
  if (LIST_NAMES.has(lower)) {
    const items = Array.isArray(raw) ? raw : raw === null || raw === '' ? [] : [String(raw)]
    return { name, type: 'list', value: items }
  }
  if (TEXT_NAMES.has(lower)) return { name, type: 'text', value: raw === null ? '' : String(raw) }
  if (typeof raw === 'number') return { name, type: 'number', value: raw }
  if (typeof raw === 'boolean') return { name, type: 'boolean', value: raw }
  if (Array.isArray(raw)) {
    const titles = raw.map((item) => LINK.exec(item.trim())?.[1]?.trim())
    if (raw.length > 0 && titles.every(Boolean)) return { name, type: 'pages', value: titles as string[] }
    return { name, type: 'list', value: raw }
  }
  const text = raw ?? ''
  const link = LINK.exec(text.trim())
  if (link?.[1]) return { name, type: 'pages', value: [link[1].trim()] }
  return { name, type: 'text', value: text }
}

/** Separa el YAML del principio (si lo hay) del resto del Markdown */
export function readFrontmatter(markdown: string): { properties: ReadProperty[]; body: string } {
  const text = markdown.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  if (!text.startsWith('---\n')) return { properties: [], body: text }
  const end = text.indexOf('\n---', 3)
  const closing = end === -1 ? null : /^[ \t]*(\n|$)/.exec(text.slice(end + 4))
  if (!closing) throw new FrontmatterError(1, 'el YAML del principio no se cierra con «---»')
  const yaml = text.slice(4, end + 1)
  const body = text.slice(end + 4 + closing[0].length).replace(/^\n/, '')
  const lines = yaml.split('\n')
  const properties: ReadProperty[] = []
  const seen = new Set<string>()
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string
    const number = i + 2
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue
    if (/^\s/.test(line)) throw new FrontmatterError(number, `sangría que no se esperaba: «${line.trim()}»`)
    const match = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^:]+?):(?:\s+(.*))?$/.exec(line)
    if (!match) throw new FrontmatterError(number, `se esperaba «nombre: valor»: «${line}»`)
    const name = quoted(match[1] as string, number) ?? (match[1] as string).trim()
    const rest = (match[2] ?? '').trim()
    if (seen.has(name.toLocaleLowerCase('es'))) throw new FrontmatterError(number, `«${name}» está repetida`)
    seen.add(name.toLocaleLowerCase('es'))
    let raw: string | number | boolean | string[] | null
    if (rest === '' || rest.startsWith('#')) {
      // Una lista en bloque («  - …»), o nada
      const items: string[] = []
      while (i + 1 < lines.length && /^\s*-(\s|$)/.test(lines[i + 1] as string)) {
        i++
        items.push(String(value((lines[i] as string).replace(/^\s*-\s?/, ''), i + 2) ?? ''))
      }
      raw = items.length > 0 ? items : null
    } else if (rest === '|' || rest === '>' || rest === '|-' || rest === '>-') {
      // Un texto de varias líneas
      const block: string[] = []
      while (
        i + 1 < lines.length &&
        (/^\s+\S/.test(lines[i + 1] as string) || (lines[i + 1] as string).trim() === '')
      ) {
        i++
        block.push((lines[i] as string).trim())
      }
      while (block.at(-1) === '') block.pop()
      raw = rest.startsWith('|') ? block.join('\n') : block.join(' ').replace(/\s+/g, ' ')
    } else if (rest.startsWith('[')) {
      if (!rest.endsWith(']')) throw new FrontmatterError(number, `la lista no se cierra con «]»: «${rest}»`)
      raw = flowList(rest, number)
    } else if (rest.startsWith('{')) {
      throw new FrontmatterError(number, `«${name}» no puede ser un objeto: usa texto, número, true/false o una lista`)
    } else raw = value(rest, number)
    properties.push(toProperty(name, raw))
  }
  return { properties, body }
}
