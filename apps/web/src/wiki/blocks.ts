/**
 * Los bloques que se pueden poner en el texto: los del menú «/» y los de «Convertir en» del menú del bloque. Cada uno
 * sabe aplicarse donde está el cursor (o a lo elegido)
 */
import type { CalloutKind, SeparateKind } from '@crisol/editor'
import type { Editor } from '@tiptap/core'
import type { es } from '../i18n.ts'

/** Los textos de los bloques en i18n (blocks.<clave>) */
export type BlockText = Exclude<keyof typeof es.blocks, 'menu' | 'groups' | 'none' | 'help' | 'inserted'>

export type BlockGroup = 'text' | 'wiki' | 'boxes' | 'master'

export interface BlockChoice {
  id: string
  group: BlockGroup
  /** Su nombre y su pista, en i18n (blocks.<clave>) */
  label: BlockText
  hint?: BlockText
  /** Más palabras con las que encontrarlo, sin tildes */
  keywords: string
  /** Se puede convertir otro bloque en este (la tabla y el separador, no) */
  convert: boolean
  /** Solo en el cuerpo: dentro de un secreto no hay otros */
  bodyOnly?: boolean
  run: (editor: Editor, context: BlockContext) => void | Promise<void>
}

export interface BlockContext {
  /** Hace secreto (o nota oculta) lo elegido, con su documento nuevo */
  makeSeparate: (editor: Editor, kind: SeparateKind) => Promise<void>
  /** Elige un archivo del equipo, lo sube y lo pone donde está el cursor */
  pickFile?: (editor: Editor) => void
}

const callout = (kind: CalloutKind, label: BlockText, hint: BlockText, keywords: string): BlockChoice => ({
  id: `callout-${kind}`,
  group: 'boxes',
  label,
  hint,
  keywords: `recuadro callout ${keywords}`,
  convert: true,
  run: (editor) => {
    editor.chain().focus().setCallout(kind).run()
  }
})

export const BLOCKS: readonly BlockChoice[] = [
  {
    id: 'paragraph',
    group: 'text',
    label: 'paragraph',
    hint: 'paragraphHint',
    keywords: 'parrafo normal',
    convert: true,
    run: (editor) => {
      editor.chain().focus().setParagraph().run()
    }
  },
  ...([1, 2, 3] as const).map(
    (level): BlockChoice => ({
      id: `heading${level}`,
      group: 'text',
      label: `heading${level}`,
      keywords: `titulo encabezado h${level}`,
      convert: true,
      run: (editor) => {
        editor.chain().focus().setHeading({ level }).run()
      }
    })
  ),
  {
    id: 'bulletList',
    group: 'text',
    label: 'bulletList',
    keywords: 'lista vinetas puntos',
    convert: true,
    run: (editor) => {
      editor.chain().focus().toggleBulletList().run()
    }
  },
  {
    id: 'orderedList',
    group: 'text',
    label: 'orderedList',
    keywords: 'lista numerada numeros',
    convert: true,
    run: (editor) => {
      editor.chain().focus().toggleOrderedList().run()
    }
  },
  {
    id: 'taskList',
    group: 'text',
    label: 'taskList',
    hint: 'taskListHint',
    keywords: 'casillas tareas pendientes lista',
    convert: true,
    run: (editor) => {
      editor.chain().focus().toggleTaskList().run()
    }
  },
  {
    id: 'blockquote',
    group: 'text',
    label: 'blockquote',
    keywords: 'cita',
    convert: true,
    run: (editor) => {
      editor.chain().focus().setBlockquote().run()
    }
  },
  {
    id: 'codeBlock',
    group: 'text',
    label: 'codeBlock',
    keywords: 'codigo',
    convert: true,
    run: (editor) => {
      editor.chain().focus().setCodeBlock().run()
    }
  },
  {
    id: 'table',
    group: 'text',
    label: 'table',
    hint: 'tableHint',
    keywords: 'tabla',
    convert: false,
    run: (editor) => {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    }
  },
  {
    id: 'horizontalRule',
    group: 'text',
    label: 'horizontalRule',
    keywords: 'separador linea',
    convert: false,
    run: (editor) => {
      editor.chain().focus().setHorizontalRule().run()
    }
  },
  // Enlazar e incrustar: escriben `[[` o `![[`, que abren la lista de páginas
  {
    id: 'pageLink',
    group: 'wiki',
    label: 'pageLink',
    hint: 'pageLinkHint',
    keywords: 'enlace pagina vincular',
    convert: false,
    run: (editor) => {
      editor.chain().focus().insertContent('[[').run()
    }
  },
  {
    id: 'pageEmbed',
    group: 'wiki',
    label: 'pageEmbed',
    hint: 'pageEmbedHint',
    keywords: 'incrustar pagina seccion',
    convert: false,
    run: (editor) => {
      editor.chain().focus().insertContent('![[').run()
    }
  },
  // Una imagen o un archivo: uno del equipo (se sube); los del mundo, con `![[`
  {
    id: 'fileEmbed',
    group: 'wiki',
    label: 'fileEmbed',
    hint: 'fileEmbedHint',
    keywords: 'imagen foto archivo pdf subir',
    convert: false,
    run: (editor, context) => {
      context.pickFile?.(editor)
    }
  },
  callout('note', 'calloutNote', 'calloutHint', 'nota'),
  callout('tip', 'calloutTip', 'calloutHint', 'consejo'),
  callout('warning', 'calloutWarning', 'calloutHint', 'aviso'),
  callout('danger', 'calloutDanger', 'calloutHint', 'peligro'),
  callout('read-aloud', 'calloutReadAloud', 'calloutReadAloudHint', 'leer voz alta mesa'),
  {
    id: 'box',
    group: 'boxes',
    label: 'box',
    hint: 'boxHint',
    keywords: 'caja marco',
    convert: true,
    run: (editor) => {
      editor.chain().focus().setBox().run()
    }
  },
  {
    id: 'secret',
    group: 'master',
    label: 'secret',
    hint: 'secretHint',
    keywords: 'secreto',
    convert: true,
    bodyOnly: true,
    run: (editor, context) => context.makeSeparate(editor, 'secret')
  },
  {
    id: 'note',
    group: 'master',
    label: 'note',
    hint: 'noteHint',
    keywords: 'nota oculta',
    convert: true,
    bodyOnly: true,
    run: (editor, context) => context.makeSeparate(editor, 'note')
  }
]

/** Sin tildes ni mayúsculas, para comparar lo que se escribe con los nombres */
export const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** Los bloques que valen en este editor y coinciden con lo escrito tras «/» (name: su nombre ya traducido) */
export function findBlocks(query: string, name: (block: BlockChoice) => string, nested: boolean) {
  const wanted = fold(query.trim())
  return BLOCKS.filter((block) => !(nested && block.bodyOnly)).filter(
    (block) => !wanted || fold(`${name(block)} ${block.keywords}`).includes(wanted)
  )
}
