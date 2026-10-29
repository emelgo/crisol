/**
 * El esquema del editor de la wiki: las extensiones de TipTap sin sus vistas de React. Lo usan la web (con sus vistas)
 * y el servidor (Markdown, lo que escribe Claude). Cada tarea del módulo 1 añade aquí sus bloques
 */
import { type AnyExtension, type Extensions, getSchema, type Node } from '@tiptap/core'
import { Heading } from '@tiptap/extension-heading'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { StarterKit } from '@tiptap/starter-kit'
import { HiddenNote, Secret } from './separate.ts'

/** El fragmento de Yjs que guarda el cuerpo de una página (el de siempre de la extensión de colaboración) */
export const BODY_FIELD = 'default'

/**
 * Los títulos del cuerpo, del 1 al 3. El título de la página es el h1, así que se pintan como h2 a h4; al pegar se leen
 * al revés (y un h1 de fuera, como 1), para que copiar y pegar dentro del editor no cambie su nivel
 */
const BodyHeading = Heading.extend({
  parseHTML: () => [
    { tag: 'h1', attrs: { level: 1 } },
    { tag: 'h2', attrs: { level: 1 } },
    { tag: 'h3', attrs: { level: 2 } },
    { tag: 'h4', attrs: { level: 3 } }
  ],
  renderHTML: ({ node, HTMLAttributes }) => [`h${Math.min(Number(node.attrs.level) + 1, 6)}`, HTMLAttributes, 0]
}).configure({ levels: [1, 2, 3] })

export interface EditorOptions {
  /** La etiqueta de cada casilla para los lectores de pantalla, ya traducida (sin ella, la de TipTap, en inglés) */
  checkboxLabel?: (text: string, checked: boolean) => string
  /** El editor de dentro de un secreto o una nota oculta: no lleva otros dentro */
  nested?: boolean
  /** Para darles su vista a los secretos y las notas ocultas (la web, con React) */
  separate?: (node: Node) => AnyExtension
}

export function editorExtensions(options: EditorOptions = {}): Extensions {
  const { checkboxLabel, nested = false, separate = (node: Node) => node } = options
  return [
    StarterKit.configure({
      heading: false,
      // Deshacer es el de Yjs (por documento y solo lo propio); los enlaces a páginas llegan con la tarea 13
      undoRedo: false,
      link: false
    }),
    BodyHeading,
    TaskList,
    TaskItem.configure({
      nested: true,
      ...(checkboxLabel ? { a11y: { checkboxLabel: (node, checked) => checkboxLabel(node.textContent, checked) } } : {})
    }),
    ...(nested ? [] : [separate(Secret), separate(HiddenNote)])
  ]
}

/** El esquema de ProseMirror del cuerpo (o de un secreto, nested), para leer y escribir fuera del editor */
export const editorSchema = (options: EditorOptions = {}) => getSchema(editorExtensions(options))
