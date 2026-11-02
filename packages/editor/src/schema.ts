/**
 * El esquema del editor de la wiki: las extensiones de TipTap sin sus vistas de React. Lo usan la web (con sus vistas)
 * y el servidor (Markdown, lo que escribe Claude). Cada tarea del módulo 1 añade aquí sus bloques
 */
import { type AnyExtension, type Extensions, getSchema, type Node } from '@tiptap/core'
import { Heading } from '@tiptap/extension-heading'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { TableKit } from '@tiptap/extension-table'
import { StarterKit } from '@tiptap/starter-kit'
import { BlockIds } from './ids.ts'
import { isExternalUrl } from './links.ts'
import { Box } from './nodes/box.ts'
import { Callout } from './nodes/callout.ts'
import { FileEmbed } from './nodes/file-embed.ts'
import { PageEmbed } from './nodes/page-embed.ts'
import { PageLink } from './nodes/page-link.ts'
import { HiddenNote, Secret } from './nodes/separate.ts'
import { ColumnBreak, PageBreak, Sidenote, Statblock, TableOfContents, WideBlock } from './nodes/sheet.ts'

/** El fragmento de Yjs que guarda el cuerpo de una página (el de siempre de la extensión de colaboración) */
export const BODY_FIELD = 'default'

/**
 * Los títulos del cuerpo, del 1 al 6. El título de la página es el h1, así que se pintan como h2 a h6 (el 6, un h6 con
 * su nivel aparte); al pegar se leen al revés (y un h1 de fuera, como 1), para que copiar y pegar no cambie su nivel
 */
const BodyHeading = Heading.extend({
  parseHTML: () => [
    { tag: 'h1', attrs: { level: 1 } },
    { tag: 'h2', attrs: { level: 1 } },
    { tag: 'h3', attrs: { level: 2 } },
    { tag: 'h4', attrs: { level: 3 } },
    { tag: 'h5', attrs: { level: 4 } },
    { tag: 'h6[data-level="6"]', attrs: { level: 6 }, priority: 60 },
    { tag: 'h6', attrs: { level: 5 } }
  ],
  renderHTML: ({ node, HTMLAttributes }) => {
    const level = Number(node.attrs.level)
    return [`h${Math.min(level + 1, 6)}`, level === 6 ? { ...HTMLAttributes, 'data-level': '6' } : HTMLAttributes, 0]
  }
}).configure({ levels: [1, 2, 3, 4, 5, 6] })

export interface EditorOptions {
  /** La etiqueta de cada casilla para los lectores de pantalla, ya traducida (sin ella, la de TipTap, en inglés) */
  checkboxLabel?: (text: string, checked: boolean) => string
  /** El editor de dentro de un secreto o una nota oculta: no lleva otros dentro */
  nested?: boolean
  /** Para darles su vista a los nodos que la tienen: secretos, notas ocultas, recuadros y enlaces (la web, con React) */
  view?: (node: Node) => AnyExtension
}

export function editorExtensions(options: EditorOptions = {}): Extensions {
  const { checkboxLabel, nested = false, view = (node: Node) => node } = options
  return [
    StarterKit.configure({
      heading: false,
      // Deshacer es el de Yjs (por documento y solo lo propio)
      undoRedo: false,
      // Los enlaces externos; los de páginas llegan con la tarea 13
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        isAllowedUri: (url) => isExternalUrl(url),
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' }
      }
    }),
    BodyHeading,
    TaskList,
    TaskItem.configure({
      nested: true,
      ...(checkboxLabel ? { a11y: { checkboxLabel: (node, checked) => checkboxLabel(node.textContent, checked) } } : {})
    }),
    TableKit.configure({ table: { resizable: false } }),
    view(Callout),
    Box,
    view(PageLink),
    view(PageEmbed),
    view(FileEmbed),
    view(PageBreak),
    view(ColumnBreak),
    view(Statblock),
    view(Sidenote),
    view(WideBlock),
    view(TableOfContents),
    ...(nested ? [] : [view(Secret), view(HiddenNote)]),
    BlockIds
  ]
}

/** El esquema de ProseMirror del cuerpo (o de un secreto, nested), para leer y escribir fuera del editor */
export const editorSchema = (options: EditorOptions = {}) => getSchema(editorExtensions(options))
