/**
 * El HTML de los textos de un sistema de Foundry VTT, a Markdown: párrafos, negrita, cursiva, listas, tablas,
 * encabezados y enlaces. Antes, sus enriquecedores (`@UUID[…]{Etiqueta}`, `[[/r 1d6]]`, `&Reference[…]`) se quedan en
 * lo que se lee. Formato de los enriquecedores: Foundry VTT y dnd5e (MIT), leídos de sus textos (ADR-0014)
 */

type Node = string | Element
interface Element {
  tag: string
  attrs: Record<string, string>
  children: Node[]
}

/** Un enriquecedor de tirada ([[/attack extended]]): su orden, sus opciones (dc=15) y lo demás, por palabras */
export interface InlineRoll {
  command: string
  named: Record<string, string>
  words: string[]
}

/**
 * Lo que ayuda a leer los enriquecedores: el nombre de un documento por su id, el del propio documento (@name), los
 * valores de sus datos ([[lookup @level]]) y, para un sistema concreto, sus tiradas ([[/attack]])
 */
export interface HtmlContext {
  nameOf?: (id: string) => string | undefined
  self?: string
  lookup?: (path: string) => string | undefined
  roll?: (roll: InlineRoll) => string | undefined
}

const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'wbr', 'col', 'source', 'area', 'base', 'embed'])
const BLOCK = new Set([
  'p',
  'div',
  'section',
  'article',
  'header',
  'footer',
  'aside',
  'main',
  'nav',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'caption',
  'hr',
  'pre',
  'figure',
  'figcaption',
  'dl',
  'dt',
  'dd',
  'details',
  'summary'
])
/** Lo que no se lee */
const DROP = new Set(['script', 'style', 'template', 'iframe', 'object', 'svg', 'img', 'video', 'audio', 'button'])

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  times: '×',
  minus: '−',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  deg: '°',
  copy: '©',
  reg: '®',
  trade: '™',
  bull: '•',
  middot: '·',
  shy: ''
}

/** Las entidades de un texto (&amp;, &#8212;, &#x2014;) */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (all, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1))
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : all
    }
    return ENTITIES[name.toLowerCase()] ?? all
  })
}

/** Los atributos de una etiqueta: href="…", class='…' */
function attributesOf(text: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const m of text.matchAll(/([a-z_:][-a-z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/gi))
    attrs[(m[1] as string).toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '')
  return attrs
}

/** El árbol de un HTML, tolerante: una etiqueta sin cerrar se cierra con la de fuera */
function parse(html: string): Element {
  const root: Element = { tag: '#root', attrs: {}, children: [] }
  const stack: Element[] = [root]
  const top = () => stack[stack.length - 1] as Element
  const tokens =
    /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\/\s*([a-z][a-z0-9-]*)\s*>|<([a-z][a-z0-9-]*)([^>]*)>/gi
  let at = 0
  for (const m of html.matchAll(tokens)) {
    if (m.index > at) top().children.push(decodeEntities(html.slice(at, m.index)))
    at = m.index + m[0].length
    const closing = m[1]?.toLowerCase()
    const opening = m[2]?.toLowerCase()
    if (closing) {
      const index = stack.findLastIndex((e) => e.tag === closing)
      if (index > 0) stack.length = index
    } else if (opening) {
      // Un párrafo no lleva bloques dentro: uno nuevo lo cierra
      if (BLOCK.has(opening) && top().tag === 'p') stack.pop()
      if (opening === 'li') {
        const open = stack.findLastIndex((e) => e.tag === 'li' || e.tag === 'ul' || e.tag === 'ol')
        if (open > 0 && stack[open]?.tag === 'li') stack.length = open
      }
      const element: Element = { tag: opening, attrs: attributesOf(m[3] ?? ''), children: [] }
      top().children.push(element)
      if (!VOID.has(opening) && !(m[3] ?? '').trim().endsWith('/')) stack.push(element)
    }
  }
  if (at < html.length) top().children.push(decodeEntities(html.slice(at)))
  return root
}

/** Un valor de los datos del documento ([[lookup @name lowercase]]{si no}), con su forma: lowercase, uppercase, capitalize */
function lookup(body: string, context: HtmlContext): string {
  const [path = '', ...options] = body.trim().split(/\s+/).slice(1)
  const key = path.replace(/^@/, '')
  const value = key === 'name' ? (context.self ?? '') : (context.lookup?.(key) ?? '')
  if (options.includes('lowercase')) return value.toLowerCase()
  if (options.includes('uppercase')) return value.toUpperCase()
  if (options.includes('capitalize')) return value.charAt(0).toUpperCase() + value.slice(1)
  return value
}

/** Lo que se tira o se comprueba de un enriquecedor en línea: [[/r 1d6]], [[/damage 2d6 fire]], [[/save dex dc=15]] */
function inlineRoll(body: string, context: HtmlContext): string {
  const text = body.trim()
  const command = /^\/([a-z]+)\s*([\s\S]*)$/i.exec(text)
  if (!command) return text
  const name = (command[1] as string).toLowerCase()
  const rest = (command[2] as string).replace(/#.*$/, '').trim()
  if (['r', 'roll', 'gmr', 'gmroll', 'br', 'broll', 'blindroll', 'sr', 'selfroll', 'pr', 'publicroll'].includes(name))
    return rest
  const tokens = rest.split(/\s+/).filter(Boolean)
  const named = Object.fromEntries(
    tokens.filter((w) => w.includes('=')).map((w) => w.split('=', 2) as [string, string])
  ) as Record<string, string>
  const words = tokens.filter((w) => !w.includes('='))
  const own = context.roll?.({ command: name, named, words })
  if (own !== undefined) return own
  const flags = new Set(['average', 'extended', 'passive', 'format', 'activity'])
  const plain = words.filter((w) => !flags.has(w.toLowerCase()))
  switch (name) {
    case 'damage':
    case 'heal':
    case 'healing': {
      const formula = named.formula ?? plain.join(' ')
      return [formula, named.type?.replaceAll('|', '/')].filter(Boolean).join(' ')
    }
    case 'attack':
      return named.formula ?? plain.join(' ')
    case 'check':
    case 'save':
    case 'skill':
    case 'tool':
    case 'ability': {
      const loose = plain.filter((w) => !/^\d+$/.test(w))
      const what = [named.ability ?? loose[0], named.skill ?? named.tool ?? loose[1]].filter(Boolean)
      const dc = named.dc ?? plain.find((w) => /^\d+$/.test(w))
      const label = what.length > 1 ? `${what[0]} (${what.slice(1).join(', ')})` : (what[0] ?? '')
      return [/^\d+$/.test(dc ?? '') ? `DC ${dc}` : '', label].filter(Boolean).join(' ')
    }
    default:
      return plain.join(' ')
  }
}

/** Los enriquecedores de Foundry, a lo que se lee */
export function plainEnrichers(html: string, context: HtmlContext = {}): string {
  return (
    html
      // Los valores, antes: pueden ir dentro de la etiqueta de otro ([[2 + @level]]{Nivel [[lookup @level]]})
      .replace(/\[\[(lookup\b[^\]]*)\]\](?:\{([^}]*)\})?/gi, (_, body: string, fallback?: string) => {
        return lookup(body, context) || (fallback ?? '')
      })
      // Lo incrustado (una tabla, otra página) no se trae
      .replace(/@Embed\[[^\]]*\](?:\{[^}]*\})?/g, '')
      .replace(/@([A-Za-z]+)\[([^\]]*)\]\{([^}]*)\}/g, (_, _kind, _target, label: string) => label)
      .replace(/@([A-Za-z]+)\[([^\]]*)\]/g, (_, _kind, target: string) => {
        const id = target.split('.').at(-1) ?? target
        return context.nameOf?.(id) ?? id
      })
      .replace(/&(?:amp;)?Reference\[([^\]]*)\](?:\{([^}]*)\})?/g, (_, target: string, label?: string) => {
        if (label) return label
        const first = target.trim().split(/\s+/)[0] ?? ''
        return first.includes('=') ? (first.split('=')[1] ?? '') : first
      })
      .replace(
        /\[\[([\s\S]*?)\]\](?:\{([^}]*)\})?/g,
        (_, body: string, label?: string) => label ?? inlineRoll(body, context)
      )
  )
}

/** Lo de un elemento en línea */
function inline(node: Node, context: Rendering): string {
  if (typeof node === 'string') return node.replace(/\s+/g, ' ')
  if (DROP.has(node.tag)) return ''
  if (BLOCK.has(node.tag)) return blocks(node.children, context).join('\n\n')
  const inner = () => node.children.map((c) => inline(c, context)).join('')
  switch (node.tag) {
    case 'br':
      return '\n'
    case 'strong':
    case 'b':
      return wrap('**', inner())
    case 'em':
    case 'i':
      return wrap('*', inner())
    case 's':
    case 'del':
    case 'strike':
      return wrap('~~', inner())
    case 'code': {
      const code = textOf(node).replace(/\s+/g, ' ')
      return code.trim() ? `\`${code}\`` : code
    }
    case 'a': {
      const text = inner()
      const href = node.attrs.href ?? ''
      return /^https?:\/\//i.test(href) && text.trim() ? `[${text.trim()}](${href})` : text
    }
    default:
      return inner()
  }
}

/** La marca alrededor de un texto, con los espacios de los lados fuera (`<b> x </b>` → ` **x** `) */
function wrap(mark: string, text: string): string {
  const core = text.trim()
  if (!core) return text
  const lead = /^\s*/.exec(text)?.[0] ? ' ' : ''
  const trail = /\s*$/.exec(text)?.[0] ? ' ' : ''
  return `${lead}${mark}${core}${mark}${trail}`
}

/** El texto de dentro, sin etiquetas */
function textOf(node: Node): string {
  return typeof node === 'string' ? node : node.children.map(textOf).join('')
}

/** Un párrafo: cada línea sin espacios de más */
const tidy = (text: string) =>
  text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim()

type Rendering = HtmlContext

/** Los bloques de unos nodos: lo que va en línea se junta en párrafos */
function blocks(children: readonly Node[], context: Rendering): string[] {
  const out: string[] = []
  let line = ''
  const flush = () => {
    const text = tidy(line)
    if (text) out.push(text)
    line = ''
  }
  for (const child of children) {
    if (typeof child !== 'string' && BLOCK.has(child.tag)) {
      flush()
      out.push(...block(child, context))
    } else line += inline(child, context)
  }
  flush()
  return out
}

function block(node: Element, context: Rendering): string[] {
  const heading = /^h([1-6])$/.exec(node.tag)
  if (heading) {
    const text = tidy(node.children.map((c) => inline(c, context)).join('')).replace(/\n/g, ' ')
    return text ? [`${'#'.repeat(Number(heading[1]))} ${text}`] : []
  }
  switch (node.tag) {
    case 'hr':
      return ['---']
    case 'blockquote': {
      const inner = blocks(node.children, context).join('\n\n')
      return inner
        ? [
            inner
              .split('\n')
              .map((l) => (l ? `> ${l}` : '>'))
              .join('\n')
          ]
        : []
    }
    case 'ul':
    case 'ol':
      return listOf(node, context)
    case 'table':
      return tableOf(node, context)
    case 'pre': {
      const code = textOf(node).replace(/^\n+|\s+$/g, '')
      return code ? [`\`\`\`\n${code}\n\`\`\``] : []
    }
    case 'dt':
    case 'caption':
    case 'summary': {
      const text = blocks(node.children, context).join(' ')
      return text ? [`**${text}**`] : []
    }
    default:
      return blocks(node.children, context)
  }
}

/** Una lista, con sus listas dentro sangradas */
function listOf(node: Element, context: Rendering): string[] {
  const ordered = node.tag === 'ol'
  const start = Number(node.attrs.start ?? 1) || 1
  const items = node.children.filter((c): c is Element => typeof c !== 'string' && c.tag === 'li')
  // Sin <li> (texto suelto dentro de la lista): sus bloques tal cual
  if (items.length === 0) return blocks(node.children, context)
  const lines = items.flatMap((li, i) => {
    const marker = ordered ? `${start + i}.` : '-'
    const pad = ' '.repeat(marker.length + 1)
    const parts = blocks(li.children, context)
    if (parts.length === 0) return []
    return [
      parts
        .join('\n')
        .split('\n')
        .map((l, j) => (j === 0 ? `${marker} ${l}` : l ? `${pad}${l}` : l))
        .join('\n')
    ]
  })
  return lines.length > 0 ? [lines.join('\n')] : []
}

/** Una tabla de Markdown: la primera fila, de cabecera */
function tableOf(node: Element, context: Rendering): string[] {
  const rows: Element[] = []
  let caption = ''
  const collect = (el: Element) => {
    for (const c of el.children) {
      if (typeof c === 'string') continue
      if (c.tag === 'tr') rows.push(c)
      else if (c.tag === 'caption') caption = blocks(c.children, context).join(' ')
      else if (c.tag === 'thead' || c.tag === 'tbody' || c.tag === 'tfoot') collect(c)
    }
  }
  collect(node)
  const cells = rows
    .map((row) =>
      row.children
        .filter((c): c is Element => typeof c !== 'string' && (c.tag === 'td' || c.tag === 'th'))
        .flatMap((c) => {
          const text = blocks(c.children, context).join(' ').replace(/\n+/g, ' ').replace(/\|/g, '\\|')
          const span = Math.min(20, Math.max(1, Number(c.attrs.colspan ?? 1) || 1))
          return [text, ...Array.from({ length: span - 1 }, () => '')]
        })
    )
    .filter((r) => r.length > 0)
  if (cells.length === 0) return caption ? [`**${caption}**`] : []
  const width = Math.max(...cells.map((r) => r.length))
  const line = (r: string[]) => `| ${Array.from({ length: width }, (_, i) => r[i] ?? '').join(' | ')} |`
  const [head, ...body] = cells
  const table = [line(head as string[]), `|${' --- |'.repeat(width)}`, ...body.map(line)].join('\n')
  return caption ? [`**${caption}**`, table] : [table]
}

/** Un texto de Foundry (HTML con sus enriquecedores) en Markdown */
export function htmlToMarkdown(html: string, context: HtmlContext = {}): string {
  if (!html.trim()) return ''
  const root = parse(plainEnrichers(html, context))
  return blocks(root.children, context)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** En una línea (una celda, un resumen) */
export const htmlToLine = (html: string, context: HtmlContext = {}) =>
  htmlToMarkdown(html, context)
    .replace(/\s*\n+\s*/g, ' ')
    .trim()
