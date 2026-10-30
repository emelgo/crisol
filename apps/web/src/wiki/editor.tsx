import type { Page } from '@crisol/contracts'
import { BODY_FIELD, editorExtensions, fillMissingIds } from '@crisol/editor'
import type { HocuspocusProvider } from '@hocuspocus/provider'
import { Collaboration } from '@tiptap/extension-collaboration'
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret'
import { EditorContent, useEditor } from '@tiptap/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type * as Y from 'yjs'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useAnnounce } from '../components/announcer.tsx'
import type { BlockContext } from './blocks.ts'
import { FormatMenu, TableMenu } from './bubble-menu.tsx'
import { caretColor, renderCaret } from './carets.ts'
import { useCollabDocument } from './collab.tsx'
import { BlockHandle, BlockMenu, type BlockTarget, blockAtCursor } from './drag-handle.tsx'
import styles from './editor.module.css'
import {
  CopySeparateOnPaste,
  insertSeparate,
  NestedOptionsContext,
  SeparatePageContext,
  useNestedOptions
} from './separate.tsx'
import { SlashMenu } from './slash-menu.tsx'
import { withNodeView } from './views.ts'

/**
 * El cuerpo de la página: el editor de bloques sobre su documento de Yjs. Lo que se escribe llega a las demás pestañas
 * al momento y se guarda solo; sin conexión se sigue escribiendo y se sincroniza al volver
 */
export function PageBody({ page }: { page: Page }) {
  const { t } = useTranslation()
  const { session, synced, offline } = useCollabDocument(`page:${page.id}`)
  const nestedOptions = useNestedOptions(caretColor)
  if (!session) return null
  return (
    <section aria-label={t('editor.body')} className={styles.body}>
      {offline && (
        <p role="status" className={styles.offline}>
          {t('editor.offline')}
        </p>
      )}
      <SeparatePageContext.Provider value={page.id}>
        <NestedOptionsContext.Provider value={nestedOptions}>
          <BodyEditor
            key={page.id}
            pageId={page.id}
            document={session.document}
            provider={session.provider}
            editable={!page.locked}
            ready={synced}
          />
        </NestedOptionsContext.Provider>
      </SeparatePageContext.Provider>
    </section>
  )
}

function BodyEditor({
  pageId,
  document,
  provider,
  editable,
  ready
}: {
  pageId: string
  document: Y.Doc
  provider: HocuspocusProvider
  editable: boolean
  ready: boolean
}) {
  const { t } = useTranslation()
  const api = useApi()
  const announce = useAnnounce()
  const { account } = useAccounts().useAccount()
  const name = account?.name ?? ''
  // Hacer secreto lo elegido: su documento nuevo se crea en el servidor
  const context = useMemo<BlockContext>(
    () => ({
      makeSeparate: (editor, kind) =>
        insertSeparate(
          editor,
          kind,
          async (which) => (await api.call('createPageDocument', { pageId, kind: which })).id
        )
    }),
    [api, pageId]
  )
  const editor = useEditor(
    {
      extensions: [
        ...editorExtensions({
          checkboxLabel: (text, checked) => t(checked ? 'editor.taskDone' : 'editor.task', { text }),
          view: withNodeView
        }),
        SlashMenu.configure({
          nested: false,
          name: (block) => t(`blocks.${block.label}`),
          context,
          announce: (block) => announce(t('blocks.inserted', { block: t(`blocks.${block.label}`).toLowerCase() }))
        }),
        CopySeparateOnPaste,
        Collaboration.configure({ document, field: BODY_FIELD }),
        CollaborationCaret.configure({ provider, user: { name, color: caretColor(name) }, render: renderCaret })
      ],
      editable,
      editorProps: {
        attributes: {
          class: styles.prose ?? '',
          'aria-label': t('editor.label'),
          'aria-multiline': 'true',
          role: 'textbox',
          spellcheck: 'true'
        }
      }
    },
    [document, provider]
  )
  // El candado cambia sin volver a abrir el documento
  useEffect(() => {
    editor?.setEditable(editable)
  }, [editor, editable])
  // Los bloques de antes de tener ids reciben el suyo al abrirse
  useEffect(() => {
    if (!editor || !ready || !editable) return
    const tr = fillMissingIds(editor.state)
    if (tr) editor.view.dispatch(tr)
  }, [editor, ready, editable])
  // El menú del bloque del cursor, desde la barra
  const blockButton = useRef<HTMLButtonElement>(null)
  const [blockMenu, setBlockMenu] = useState<BlockTarget | null>(null)
  return (
    <div aria-busy={!ready}>
      {editable && editor && (
        <div role="toolbar" aria-label={t('editor.toolbar')} className={styles.toolbar}>
          <button type="button" className={styles.tool} onClick={() => void context.makeSeparate(editor, 'secret')}>
            {t('separate.makeSecret')}
          </button>
          <button type="button" className={styles.tool} onClick={() => void context.makeSeparate(editor, 'note')}>
            {t('separate.makeNote')}
          </button>
          <button
            ref={blockButton}
            type="button"
            className={styles.tool}
            aria-haspopup="menu"
            aria-expanded={Boolean(blockMenu)}
            onClick={() => setBlockMenu(blockAtCursor(editor))}
          >
            {t('blockMenu.button')}
          </button>
        </div>
      )}
      <EditorContent editor={editor} />
      {editable && editor && (
        <>
          <FormatMenu editor={editor} />
          <TableMenu editor={editor} />
          <BlockHandle editor={editor} context={context} />
        </>
      )}
      {editor && blockMenu && (
        <BlockMenu
          editor={editor}
          target={blockMenu}
          anchor={blockButton.current}
          context={context}
          onClose={(returnFocus) => {
            setBlockMenu(null)
            if (returnFocus) blockButton.current?.focus()
          }}
        />
      )}
    </div>
  )
}
