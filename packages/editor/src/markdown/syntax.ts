/**
 * La forma en Markdown (la de Obsidian) de los bloques propios: los recuadros `> [!aviso]`, la caja `> [!caja]`, el
 * secreto `> [!secreto]` y la nota oculta entre `%%`. Los usan los nodos en su markdownTokenizer y su renderMarkdown
 */
import type { JSONContent, MarkdownRendererHelpers, MarkdownTokenizer } from '@tiptap/core'
import type { CalloutKind } from '../nodes/callout.ts'

/** El nombre de cada recuadro en Markdown, en español */
export const CALLOUT_MARKDOWN: Record<CalloutKind, string> = {
  note: 'nota',
  tip: 'consejo',
  warning: 'aviso',
  danger: 'peligro',
  'read-aloud': 'leer'
}

/** Lo que se lee como recuadro: los nombres en español y los de Obsidian en inglés */
const CALLOUT_READ: Record<string, CalloutKind> = {
  nota: 'note',
  info: 'note',
  note: 'note',
  abstract: 'note',
  summary: 'note',
  tldr: 'note',
  todo: 'note',
  example: 'note',
  question: 'note',
  help: 'note',
  faq: 'note',
  consejo: 'tip',
  tip: 'tip',
  hint: 'tip',
  important: 'tip',
  success: 'tip',
  check: 'tip',
  done: 'tip',
  aviso: 'warning',
  warning: 'warning',
  caution: 'warning',
  attention: 'warning',
  peligro: 'danger',
  danger: 'danger',
  error: 'danger',
  failure: 'danger',
  fail: 'danger',
  missing: 'danger',
  bug: 'danger',
  leer: 'read-aloud',
  'leer-en-voz-alta': 'read-aloud'
}

export const calloutKindOf = (name: string): CalloutKind | null => CALLOUT_READ[name] ?? null

/**
 * Un tokenizador de bloque para `> [!tipo]` y las líneas `>` que lo siguen. accept dice si el tipo es suyo (y qué
 * atributos lleva). Lo de dentro se lee como bloques; un título tras `[!tipo]` pasa a ser el primer párrafo
 */
export function calloutTokenizer(
  name: string,
  accept: (type: string) => Record<string, unknown> | null
): MarkdownTokenizer {
  return {
    name,
    level: 'block',
    start: (src) => src.search(/^ {0,3}> ?\[!/m),
    tokenize: (src, _tokens, lexer) => {
      const head = /^ {0,3}> ?\[!([^\]|]+)((?:\|[^\]]*)?)\][+-]?[ \t]*([^\n]*)(?:\n|$)/.exec(src)
      if (!head) return undefined
      const attrs = accept((head[1] ?? '').trim().toLocaleLowerCase('es'))
      if (!attrs) return undefined
      let raw = head[0]
      const lines: string[] = []
      const title = (head[3] ?? '').trim()
      if (title) lines.push(title, '')
      let rest = src.slice(raw.length)
      for (
        let line = /^ {0,3}> ?([^\n]*)(?:\n|$)/.exec(rest);
        line?.[0];
        line = /^ {0,3}> ?([^\n]*)(?:\n|$)/.exec(rest)
      ) {
        lines.push(line[1] ?? '')
        raw += line[0]
        rest = rest.slice(line[0].length)
      }
      return { type: name, raw, attrs, tokens: lexer.blockTokens(lines.join('\n')) }
    }
  }
}

/** `> [!tipo]` y cada línea de lo de dentro tras `> ` (las vacías, `>`) */
export function renderCallout(type: string, node: JSONContent, h: MarkdownRendererHelpers) {
  const inner = (node.content ?? []).map((child, index) => h.renderChild?.(child, index) ?? h.renderChildren([child]))
  const lines = inner
    .join('\n\n')
    .split('\n')
    .map((line) => (line.trim() === '' ? '>' : `> ${line}`))
  return [`> [!${type}]`, ...(lines.length > 0 && inner.join('') !== '' ? lines : [])].join('\n')
}

/** La nota oculta: `%%` en su línea, lo de dentro, y `%%` en la suya. También `%%texto%%` en una sola línea */
export const hiddenNoteTokenizer: MarkdownTokenizer = {
  name: 'note',
  level: 'block',
  start: (src) => src.search(/^%%/m),
  tokenize: (src, _tokens, lexer) => {
    const match = /^%%[ \t]*\n(?:([\s\S]*?)\n)?%%[ \t]*(?:\n|$)/.exec(src) ?? /^%%([^\n]+?)%%[ \t]*(?:\n|$)/.exec(src)
    if (!match) return undefined
    return { type: 'note', raw: match[0], tokens: lexer.blockTokens((match[1] ?? '').trim()) }
  }
}

export function renderHiddenNote(node: JSONContent, h: MarkdownRendererHelpers) {
  const inner = (node.content ?? []).map((child, index) => h.renderChild?.(child, index) ?? h.renderChildren([child]))
  return ['%%', ...(inner.join('') === '' ? [] : [inner.join('\n\n')]), '%%'].join('\n')
}
