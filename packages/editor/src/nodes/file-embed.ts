/**
 * Un archivo del mundo en el texto: una imagen (con su ancho, su texto alternativo y su pie), un PDF (en una página) u
 * otro archivo. Guarda a qué archivo va (por id, y su nombre por si aún no está subido); los bytes se piden a la API.
 * En Markdown, como en Obsidian: `![[mapa.png|Texto alternativo|300]]` o `![[libro.pdf#page=12]]` en su línea, y el
 * pie, si lo hay, en la siguiente en cursiva
 */
import { mergeAttributes, Node } from '@tiptap/core'

/** Lo que se reconoce como archivo (y no como página) en `![[…]]`: por su extensión. `.md` es una nota, no un archivo */
const FILE_NAME =
  /\.(png|jpe?g|gif|webp|avif|svg|pdf|txt|rtf|docx?|odt|xlsx?|ods|csv|pptx?|odp|epub|zip|rar|7z|tar|gz|mp3|ogg|oga|wav|flac|m4a|mp4|m4v|webm|mov|mkv|json|xml)$/i

export const isFileName = (name: string) => FILE_NAME.test(name.trim())

/** Lo que un nombre, un texto alternativo o un pie no pueden llevar en Markdown sin romper el `![[…]]` */
const cleanPart = (text: string) => text.replace(/[[\]|\n]/g, ' ').trim()

const EMBED =
  /^!\[\[([^[\]\n|#]+?)(?:#page=(\d{1,5}))?((?:\|[^[\]\n|]*)*)\]\][ \t]*(?:\n\*((?:[^*\n\\]|\\.)+)\*[ \t]*)?(?:\n|$)/

/** Lo que se lee de un elemento (sin depender de los tipos del DOM, que este paquete no carga) */
type Element = { getAttribute(name: string): string | null }

const textAttribute = (name: string) => ({
  default: null,
  parseHTML: (element: Element) => element.getAttribute(`data-${name}`),
  renderHTML: (attributes: Record<string, unknown>) =>
    attributes[name] != null ? { [`data-${name}`]: String(attributes[name]) } : {}
})

const numberAttribute = (name: string) => ({
  default: null,
  parseHTML: (element: Element) => {
    const value = Number(element.getAttribute(`data-${name}`))
    return Number.isInteger(value) && value > 0 ? value : null
  },
  renderHTML: (attributes: Record<string, unknown>) =>
    attributes[name] != null ? { [`data-${name}`]: String(attributes[name]) } : {}
})

export const FileEmbed = Node.create({
  name: 'fileEmbed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes: () => ({
    fileId: {
      default: null,
      parseHTML: (element: Element) => element.getAttribute('data-file'),
      renderHTML: (attributes: Record<string, unknown>) => (attributes.fileId ? { 'data-file': attributes.fileId } : {})
    },
    name: {
      default: '',
      parseHTML: (element: Element) => element.getAttribute('data-name') ?? '',
      renderHTML: (attributes: Record<string, unknown>) => ({ 'data-name': String(attributes.name ?? '') })
    },
    width: numberAttribute('width'),
    page: numberAttribute('page'),
    alt: textAttribute('alt'),
    caption: textAttribute('caption')
  }),
  parseHTML: () => [{ tag: 'figure[data-file-embed]' }],
  renderHTML: ({ HTMLAttributes }) => ['figure', mergeAttributes({ 'data-file-embed': '' }, HTMLAttributes)],
  markdownTokenizer: {
    name: 'fileEmbed',
    level: 'block',
    start: (src) => src.search(/^!\[\[/m),
    tokenize: (src) => {
      const match = EMBED.exec(src)
      const name = (match?.[1] ?? '').trim()
      if (!match || !isFileName(name)) return undefined
      let width: number | null = null
      let alt: string | null = null
      for (const part of (match[3] ?? '').split('|').slice(1)) {
        const size = /^\s*(\d{1,5})(?:x\d{1,5})?\s*$/.exec(part)
        if (size) width = Number(size[1])
        else if (part.trim()) alt = part.trim()
      }
      return {
        type: 'fileEmbed',
        raw: match[0],
        name,
        page: match[2] ? Number(match[2]) : null,
        width,
        alt,
        caption: match[4] ? match[4].replace(/\\(.)/g, '$1').trim() : null
      }
    }
  },
  parseMarkdown: (token, helpers) =>
    helpers.createNode('fileEmbed', {
      fileId: null,
      name: token.name ?? '',
      page: token.page ?? null,
      width: token.width ?? null,
      alt: token.alt ?? null,
      caption: token.caption ?? null
    }),
  renderMarkdown: (node) => {
    const attrs = node.attrs ?? {}
    const page = attrs.page ? `#page=${attrs.page}` : ''
    const alt = attrs.alt ? `|${cleanPart(String(attrs.alt))}` : ''
    const width = attrs.width ? `|${attrs.width}` : ''
    const caption = attrs.caption ? cleanPart(String(attrs.caption)).replace(/([*\\])/g, '\\$1') : ''
    const embed = `![[${cleanPart(String(attrs.name ?? ''))}${page}${alt}${width}]]`
    return caption ? `${embed}\n*${caption}*` : embed
  }
})
