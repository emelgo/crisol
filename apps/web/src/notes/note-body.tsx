/**
 * El texto de una nota (docs/specs/notas-jugador.md): el editor de la wiki sin edición compartida (con su propio
 * deshacer), sin secretos, panel, plantillas ni pestañas, que se guarda solo como Markdown un momento después de dejar
 * de escribir. Los enlaces `[[` y «@» ofrecen solo las páginas que conoce su campaña
 */
import { editorExtensions } from '@crisol/editor'
import { pageFromMarkdown, pageToMarkdown } from '@crisol/editor/markdown'
import { EditorContent, useEditor } from '@tiptap/react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAnnounce } from '../components/announcer.tsx'
import { FormatMenu } from '../wiki/bubble-menu.tsx'
import editorStyles from '../wiki/editor.module.css'
import { EmptyHint } from '../wiki/editor.tsx'
import { GhostLine } from '../wiki/ghost-line.ts'
import { LinkSuggest, useLinksRef } from '../wiki/page-links.tsx'
import { SlashMenu } from '../wiki/slash-menu.tsx'
import { withNodeView } from '../wiki/views.ts'

/** Cuánto se espera tras la última tecla para guardar */
export const SAVE_DELAY_MS = 800

/** Lo escrito, como Markdown: sin propiedades ni ids de bloque */
export const noteMarkdown = (body: Parameters<typeof pageToMarkdown>[0]['body']) =>
  pageToMarkdown({ properties: [], body, separate: () => null })

export function NoteBody({
  markdown,
  editable,
  label,
  onChange,
  onDirty
}: {
  markdown: string
  editable: boolean
  label: string
  /** Lo escrito, ya en Markdown, cuando toca guardarlo */
  onChange: (markdown: string) => void
  /** Hay algo escrito que aún no se ha mandado a guardar */
  onDirty?: () => void
}) {
  const { t } = useTranslation()
  const announce = useAnnounce()
  const links = useLinksRef()
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const last = useRef(markdown)
  const save = useRef(onChange)
  save.current = onChange
  const dirty = useRef(onDirty)
  dirty.current = onDirty
  // Lo escrito que aún no se ha guardado (el editor puede irse antes que este componente)
  const pending = useRef<Parameters<typeof noteMarkdown>[0] | null>(null)
  const editor = useEditor(
    {
      extensions: [
        ...editorExtensions({
          checkboxLabel: (text, checked) => t(checked ? 'editor.taskDone' : 'editor.task', { text }),
          view: withNodeView,
          nested: true,
          history: true
        }),
        EmptyHint.configure({ text: t('notes.placeholder') }),
        GhostLine.configure({ className: editorStyles.ghostLine ?? '' }),
        SlashMenu.configure({
          nested: true,
          sheet: () => false,
          context: null,
          name: (block) => t(`blocks.${block.label}`),
          announce: (block) => announce(t('blocks.inserted', { block: t(`blocks.${block.label}`).toLowerCase() }))
        }),
        LinkSuggest.configure({
          links: () => links.current,
          announce: (title) => announce(t('links.inserted', { title }))
        })
      ],
      content: pageFromMarkdown(markdown).body,
      editable,
      editorProps: {
        attributes: {
          class: editorStyles.prose ?? '',
          'aria-label': label,
          'aria-multiline': 'true',
          role: 'textbox',
          spellcheck: 'true'
        }
      },
      onUpdate: ({ editor: changed }) => {
        clearTimeout(timer.current)
        dirty.current?.()
        pending.current = changed.getJSON()
        timer.current = setTimeout(() => {
          pending.current = null
          const text = noteMarkdown(changed.getJSON())
          if (text === last.current) return
          last.current = text
          save.current(text)
        }, SAVE_DELAY_MS)
      }
    },
    []
  )
  useEffect(() => {
    editor?.setEditable(editable)
  }, [editor, editable])
  // Al salir (otra nota, cerrar la ventana), lo que quedara por guardar
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      if (!pending.current) return
      const text = noteMarkdown(pending.current)
      pending.current = null
      if (text !== last.current) save.current(text)
    },
    []
  )
  return (
    <div className={editorStyles.body}>
      <EditorContent editor={editor} />
      {editable && editor && <FormatMenu editor={editor} />}
    </div>
  )
}
