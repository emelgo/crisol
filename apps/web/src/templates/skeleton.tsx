/**
 * El texto de una plantilla (su esqueleto, ADR-0009): se escribe con el editor de la wiki, sin edición compartida (tiene
 * su propio deshacer) y sin secretos ni notas ocultas (no hay documento aparte), y se guarda como Markdown. Al crear una
 * página, sale igual que se escribió
 */
import { editorExtensions } from '@crisol/editor'
import { pageFromMarkdown, pageToMarkdown } from '@crisol/editor/markdown'
import { EditorContent, useEditor } from '@tiptap/react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import editorStyles from '../wiki/editor.module.css'
import { EmptyHint } from '../wiki/editor.tsx'
import { SlashMenu } from '../wiki/slash-menu.tsx'
import { withNodeView } from '../wiki/views.ts'

/** Lo escrito, como Markdown: sin propiedades ni ids de bloque */
export const skeletonOf = (body: Parameters<typeof pageToMarkdown>[0]['body']) =>
  pageToMarkdown({ properties: [], body, separate: () => null })

export function SkeletonEditor({
  skeleton,
  readOnly,
  onChange
}: {
  skeleton: string
  readOnly: boolean
  onChange: (skeleton: string) => void
}) {
  const { t } = useTranslation()
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const last = useRef(skeleton)
  const save = useRef(onChange)
  save.current = onChange
  const editor = useEditor(
    {
      extensions: [
        ...editorExtensions({
          checkboxLabel: (text, checked) => t(checked ? 'editor.taskDone' : 'editor.task', { text }),
          view: withNodeView,
          nested: true,
          history: true
        }),
        EmptyHint.configure({ text: t('templateEditor.skeletonHint') }),
        SlashMenu.configure({
          nested: true,
          sheet: () => false,
          context: null,
          name: (block) => t(`blocks.${block.label}`),
          announce: () => undefined
        })
      ],
      content: pageFromMarkdown(skeleton).body,
      editable: !readOnly,
      editorProps: {
        attributes: {
          class: editorStyles.prose ?? '',
          'aria-label': t('templateEditor.skeleton'),
          'aria-multiline': 'true',
          role: 'textbox'
        }
      },
      // Se guarda un poco después de dejar de escribir
      onUpdate: ({ editor: changed }) => {
        clearTimeout(timer.current)
        timer.current = setTimeout(() => {
          const markdown = skeletonOf(changed.getJSON())
          if (markdown === last.current) return
          last.current = markdown
          save.current(markdown)
        }, 600)
      }
    },
    []
  )
  // Al salir, lo que quedara por guardar
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      if (!editor) return
      const markdown = skeletonOf(editor.getJSON())
      if (markdown !== last.current) save.current(markdown)
    },
    [editor]
  )
  return <EditorContent editor={editor} />
}
