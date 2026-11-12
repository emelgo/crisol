/**
 * Una página entera en Markdown y de vuelta: las propiedades en YAML, el cuerpo y, dentro, sus secretos y notas
 * ocultas. Lo mismo para exportar, para que Claude lea y para que Claude escriba (ADR-0003)
 */
import type { JSONContent } from '@tiptap/core'
import { MarkdownManager } from '@tiptap/markdown'
import { BLOCK_TYPES, newBlockId } from '../ids.ts'
import { isExternalUrl } from '../links.ts'
import type { SeparateKind } from '../nodes/separate.ts'
import { editorExtensions } from '../schema.ts'
import { type ReadProperty, readFrontmatter, type WritableProperty, writeFrontmatter } from './frontmatter.ts'

/** Lo de dentro de un secreto o una nota oculta leído del Markdown, con el id de su bloque en el cuerpo */
export interface ReadSeparate {
  id: string
  kind: SeparateKind
  content: JSONContent[]
}

export interface ReadPage {
  properties: ReadProperty[]
  /** El cuerpo, con los secretos sin su contenido (va en separates) y con su id de bloque */
  body: JSONContent
  separates: ReadSeparate[]
}

export interface WritePage {
  properties: readonly WritableProperty[]
  body: JSONContent
  /** Lo de dentro de cada secreto o nota oculta, por el id de su documento (null: no se puede leer) */
  separate: (documentId: string) => JSONContent[] | null
  /** Cómo se escribe una página enlazada (en las propiedades y en el texto): su título, o su ruta si se repite */
  pageTitle?: (pageId: string) => string
  /** El nombre de ahora de un archivo (renombrarlo no rompe lo que lo usa) */
  fileName?: (fileId: string) => string | undefined
  /** Los ids de bloque de primer nivel (`^id`), para que Claude pueda señalar bloques */
  ids?: boolean
}

let manager: MarkdownManager | null = null
const markdown = () => {
  manager ??= new MarkdownManager({ extensions: editorExtensions() })
  return manager
}

const SEPARATE = new Set(['secret', 'note'])
/** Un `^id` solo en su línea (o `^s-id`, el de los secretos) */
const ID_LINE = /^\^(?:s-)?([A-Za-z0-9-]{1,64})$/
/** Un `^id` al final de un párrafo o un título */
const ID_END = /\s\^(?:s-)?([A-Za-z0-9-]{1,64})$/

/** El cuerpo con lo de dentro de sus secretos puesto, para escribirlo */
function withSeparates(node: JSONContent, separate: WritePage['separate']): JSONContent {
  if (node.type && SEPARATE.has(node.type)) {
    const documentId = node.attrs?.documentId as string | null | undefined
    const content = (documentId ? separate(documentId) : null) ?? []
    return { ...node, content }
  }
  return node.content ? { ...node, content: node.content.map((child) => withSeparates(child, separate)) } : node
}

/**
 * Los enlaces con el nombre de ahora de su página, y los archivos con el suyo (los que no se encuentran se quedan con
 * el último conocido)
 */
function withLinkTitles(node: JSONContent, page: Pick<WritePage, 'pageTitle' | 'fileName'>): JSONContent {
  if (
    page.pageTitle &&
    (node.type === 'pageLink' || node.type === 'pageEmbed') &&
    typeof node.attrs?.pageId === 'string'
  ) {
    return { ...node, attrs: { ...node.attrs, title: page.pageTitle(node.attrs.pageId) || node.attrs.title } }
  }
  if (page.fileName && node.type === 'fileEmbed' && typeof node.attrs?.fileId === 'string') {
    return { ...node, attrs: { ...node.attrs, name: page.fileName(node.attrs.fileId) || node.attrs.name } }
  }
  return node.content ? { ...node, content: node.content.map((child) => withLinkTitles(child, page)) } : node
}

/** Un bloque de primer nivel en Markdown, con su id si se pide */
function blockMarkdown(block: JSONContent, ids: boolean) {
  const text = markdown()
    .serialize({ type: 'doc', content: [block] })
    .replace(/\s+$/, '')
  const id = block.attrs?.id as string | null | undefined
  if (!ids || !id) return text
  const marker = block.type === 'secret' ? `^s-${id}` : `^${id}`
  // En el texto, al final de su línea; en lo demás (listas, tablas, recuadros…), en su propia línea
  if ((block.type === 'paragraph' || block.type === 'heading') && text !== '') return `${text} ${marker}`
  return `${text}\n\n${marker}`
}

/** La página en Markdown: YAML (si hay propiedades) y el cuerpo, con sus secretos dentro */
export function pageToMarkdown(page: WritePage): string {
  const body = withLinkTitles(withSeparates(page.body, page.separate), page)
  const blocks = (body.content ?? [])
    .map((block) => blockMarkdown(block, page.ids ?? false))
    .filter((text) => text !== '')
  const text = blocks.join('\n\n')
  let yaml = writeFrontmatter(page.properties, page.pageTitle)
  // Sin propiedades, un cuerpo que empieza por un separador («---») se leería como YAML: va uno vacío delante
  if (yaml === '' && /^---[ \t]*(\n|$)/.test(text)) yaml = '---\n---\n'
  return `${yaml}${text}\n`
}

/** El último texto de un bloque, para ver si acaba en `^id` */
function lastText(block: JSONContent): JSONContent | null {
  const last = block.content?.at(-1)
  return last?.type === 'text' ? last : null
}

/** Quita lo que no es un enlace externo válido (javascript:, data:…): el texto se queda */
function safeLinks(node: JSONContent): JSONContent {
  const marks = node.marks?.filter((mark) => mark.type !== 'link' || isExternalUrl(String(mark.attrs?.href ?? '')))
  const clean: JSONContent = { ...node }
  if (node.marks) {
    if (marks && marks.length > 0) clean.marks = marks
    else delete clean.marks
  }
  if (node.content) clean.content = node.content.map(safeLinks)
  return clean
}

/** Dentro de un secreto no hay otros: los que vengan dentro se deshacen en lo suyo */
const flatten = (content: JSONContent[]): JSONContent[] =>
  content.flatMap((node) =>
    node.type && SEPARATE.has(node.type)
      ? flatten(node.content ?? [])
      : [node.content ? { ...node, content: flatten(node.content) } : node]
  )

/** Aparta lo de dentro de los secretos y las notas ocultas (con su id de bloque, que se crea si no lo tiene) */
function takeSeparates(node: JSONContent, found: ReadSeparate[]): JSONContent {
  if (node.type && SEPARATE.has(node.type)) {
    const id = (node.attrs?.id as string | undefined) ?? newBlockId()
    found.push({ id, kind: node.type as SeparateKind, content: flatten(node.content ?? []) })
    const { content: _content, ...rest } = node
    return { ...rest, attrs: { ...node.attrs, id, documentId: null } }
  }
  return node.content ? { ...node, content: node.content.map((child) => takeSeparates(child, found)) } : node
}

/** Lee una página en Markdown: sus propiedades, su cuerpo y, aparte, lo de dentro de sus secretos */
export function pageFromMarkdown(text: string): ReadPage {
  const { properties, body: bodyText } = readFrontmatter(text)
  const parsed = markdown().parse(bodyText)
  const blocks: JSONContent[] = []
  for (const block of parsed.content ?? []) {
    // `^id` solo en su línea: el id del bloque de antes
    const only = block.type === 'paragraph' && block.content?.length === 1 ? lastText(block) : null
    const onlyId = only ? ID_LINE.exec((only.text ?? '').trim()) : null
    const previous = blocks.at(-1)
    if (onlyId && previous && BLOCK_TYPES.includes(previous.type ?? '')) {
      previous.attrs = { ...previous.attrs, id: onlyId[1] }
      continue
    }
    // `^id` al final de un párrafo o un título
    const last = block.type === 'paragraph' || block.type === 'heading' ? lastText(block) : null
    const endId = last ? ID_END.exec(last.text ?? '') : null
    if (last && endId) {
      last.text = (last.text ?? '').slice(0, endId.index).replace(/\s+$/, '')
      if (last.text === '') block.content = block.content?.slice(0, -1)
      block.attrs = { ...block.attrs, id: endId[1] }
    }
    blocks.push(block)
  }
  const separates: ReadSeparate[] = []
  const body = takeSeparates(safeLinks({ type: 'doc', content: blocks }), separates)
  return {
    properties,
    body,
    separates: separates.map((found) => ({ ...found, content: found.content.map(safeLinks) }))
  }
}

/** Quita los secretos y las notas ocultas de un cuerpo, a cualquier profundidad */
const withoutSeparates = (node: JSONContent): JSONContent =>
  node.content
    ? { ...node, content: node.content.filter((child) => !SEPARATE.has(child.type ?? '')).map(withoutSeparates) }
    : node

/**
 * Un texto sin sus secretos (`> [!secreto]`) ni sus notas ocultas (`%%`): lo que lee quien no dirige (los capítulos de
 * los libros, ADR-0025). Con el mismo analizador que el editor, no con una expresión regular, para que no se escape
 * ninguno
 */
export function markdownWithoutSecrets(text: string): string {
  const { body } = pageFromMarkdown(text)
  return pageToMarkdown({ properties: [], body: withoutSeparates(body), separate: () => null }).trimEnd()
}
