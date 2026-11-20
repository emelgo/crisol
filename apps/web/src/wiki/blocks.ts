/**
 * Los bloques que se pueden poner en el texto: los del menú «/» y los de «Convertir en» del menú del bloque. Cada uno
 * sabe aplicarse donde está el cursor (o a lo elegido)
 */
import { type CalloutKind, NEW_CHART_YAML, type SeparateKind } from '@crisol/editor'
import type { Editor } from '@tiptap/core'
import type { es } from '../i18n.ts'

/** Los textos de los bloques en i18n (blocks.<clave>) */
export type BlockText = Exclude<keyof typeof es.blocks, 'menu' | 'groups' | 'none' | 'help' | 'inserted'>

export type BlockGroup = 'text' | 'wiki' | 'boxes' | 'sheet' | 'master'

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
  /** «Entrada nueva del compendio», en una ventana; al guardarla, su enlace donde está el cursor (solo en el mundo) */
  newEntry?: (editor: Editor) => void
  /** Si se puede ahora (sus ventanas están montadas) */
  canNewEntry?: () => boolean
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
  ...([1, 2, 3, 4, 5, 6] as const).map(
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
  // Un gráfico (módulo 10): nace con unos datos de ejemplo y su editor visual en el panel
  {
    id: 'chart',
    group: 'text',
    label: 'chart',
    hint: 'chartHint',
    keywords: 'grafico chart barras lineas tarta donut radar area polar diagrama datos',
    convert: false,
    run: (editor) => {
      editor
        .chain()
        .focus()
        .insertContent({ type: 'chart', attrs: { yaml: NEW_CHART_YAML } })
        .run()
      // Elegido, para que salga su editor en el panel
      const { from } = editor.state.selection
      let at: number | null = null
      editor.state.doc.nodesBetween(Math.max(0, from - 4), from, (node, pos) => {
        if (node.type.name === 'chart') at = pos
      })
      if (at !== null) editor.commands.setNodeSelection(at)
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
  // La ficha de una entrada del compendio (revisión, tanda 7): escribe `![[@`, que abre la lista del compendio
  {
    id: 'contentEmbed',
    group: 'wiki',
    label: 'contentEmbed',
    hint: 'contentEmbedHint',
    keywords: 'ficha compendio entrada criatura conjuro objeto incrustar',
    convert: false,
    run: (editor) => {
      editor.chain().focus().insertContent('![[@').run()
    }
  },
  // Una entrada nueva del compendio del mundo, en una ventana, sin dejar la página (revisión, tanda 7)
  {
    id: 'newEntry',
    group: 'wiki',
    label: 'newEntry',
    hint: 'newEntryHint',
    keywords: 'entrada compendio nueva crear criatura objeto conjuro',
    convert: false,
    bodyOnly: true,
    run: (editor, context) => context.newEntry?.(editor)
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
  callout('quote', 'calloutQuote', 'calloutQuoteHint', 'cita frase autor quote'),
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
  // La hoja: saltos, statblock, nota lateral, a lo ancho e índice (en la vista sencilla se ven discretos)
  {
    id: 'pageBreak',
    group: 'sheet',
    label: 'pageBreak',
    hint: 'sheetHint',
    keywords: 'salto pagina hoja',
    convert: false,
    run: (editor) => {
      // Con un párrafo detrás, para seguir escribiendo (si no, Intro cambiaría el bloque recién puesto)
      editor
        .chain()
        .focus()
        .insertContent([{ type: 'pageBreak' }, { type: 'paragraph' }])
        .run()
    }
  },
  {
    id: 'columnBreak',
    group: 'sheet',
    label: 'columnBreak',
    hint: 'sheetHint',
    keywords: 'salto columna hoja',
    convert: false,
    run: (editor) => {
      // Con un párrafo detrás, para seguir escribiendo (si no, Intro cambiaría el bloque recién puesto)
      editor
        .chain()
        .focus()
        .insertContent([{ type: 'columnBreak' }, { type: 'paragraph' }])
        .run()
    }
  },
  // Cambiar de columnas desde aquí, como un salto de sección: lo de debajo, a una o a dos
  ...([1, 2] as const).map(
    (count): BlockChoice => ({
      id: `columns${count}`,
      group: 'sheet',
      label: count === 1 ? 'columnsOne' : 'columnsTwo',
      keywords: `columnas ${count === 1 ? 'una' : 'dos'} seccion hoja`,
      convert: false,
      run: (editor) => {
        editor
          .chain()
          .focus()
          .insertContent([{ type: 'columnsChange', attrs: { count } }, { type: 'paragraph' }])
          .run()
      }
    })
  ),
  {
    id: 'statblock',
    group: 'sheet',
    label: 'statblock',
    hint: 'statblockHint',
    keywords: 'statblock criatura estadisticas monstruo',
    convert: true,
    run: (editor) => {
      editor.chain().focus().wrapIn('statblock').run()
    }
  },
  {
    id: 'sidenote',
    group: 'sheet',
    label: 'sidenote',
    hint: 'sidenoteHint',
    keywords: 'nota lateral margen',
    convert: true,
    run: (editor) => {
      editor.chain().focus().wrapIn('sidenote').run()
    }
  },
  {
    id: 'wideBlock',
    group: 'sheet',
    label: 'wideBlock',
    hint: 'wideBlockHint',
    keywords: 'ancho dos columnas',
    convert: true,
    run: (editor) => {
      editor.chain().focus().wrapIn('wideBlock').run()
    }
  },
  {
    id: 'tableOfContents',
    group: 'sheet',
    label: 'tableOfContents',
    hint: 'tableOfContentsHint',
    keywords: 'indice contenidos toc',
    convert: false,
    run: (editor) => {
      // Con un párrafo detrás, para seguir escribiendo (si no, Intro cambiaría el bloque recién puesto)
      editor
        .chain()
        .focus()
        .insertContent([{ type: 'tableOfContents' }, { type: 'paragraph' }])
        .run()
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
/** Los grupos en los que se ordenan los bloques en los menús («/» y «Convertir en»): cada uno, un desplegable */
export const SECTIONS = [
  {
    key: 'text',
    match: (b: BlockChoice) => ['paragraph', 'blockquote', 'codeBlock', 'horizontalRule', 'table'].includes(b.id)
  },
  { key: 'headings', match: (b: BlockChoice) => b.id.startsWith('heading') },
  { key: 'lists', match: (b: BlockChoice) => ['bulletList', 'orderedList', 'taskList'].includes(b.id) },
  { key: 'wiki', match: (b: BlockChoice) => b.group === 'wiki' },
  // Los secretos y las notas ocultas, también recuadros (sin hablar de «máster»: aquí se hace worldbuilding)
  { key: 'boxes', match: (b: BlockChoice) => b.group === 'boxes' || b.group === 'master' },
  { key: 'sheet', match: (b: BlockChoice) => b.group === 'sheet' }
] as const

export type SectionKey = (typeof SECTIONS)[number]['key']

export function findBlocks(query: string, name: (block: BlockChoice) => string, nested: boolean) {
  const wanted = fold(query.trim())
  return BLOCKS.filter((block) => !(nested && block.bodyOnly)).filter(
    (block) => !wanted || fold(`${name(block)} ${block.keywords}`).includes(wanted)
  )
}
