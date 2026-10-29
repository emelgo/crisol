import type { Page } from '@crisol/contracts'
import { BODY_FIELD, editorExtensions } from '@crisol/editor'
import type { HocuspocusProvider } from '@hocuspocus/provider'
import { Collaboration } from '@tiptap/extension-collaboration'
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret'
import { EditorContent, useEditor } from '@tiptap/react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type * as Y from 'yjs'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { caretColor, renderCaret } from './carets.ts'
import { useCollabDocument } from './collab.tsx'
import styles from './editor.module.css'
import {
  CopySeparateOnPaste,
  insertSeparate,
  NestedOptionsContext,
  SeparatePageContext,
  useNestedOptions,
  withSeparateView
} from './separate.tsx'

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
  const { account } = useAccounts().useAccount()
  const name = account?.name ?? ''
  const editor = useEditor(
    {
      extensions: [
        ...editorExtensions({
          checkboxLabel: (text, checked) => t(checked ? 'editor.taskDone' : 'editor.task', { text }),
          separate: withSeparateView
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
  const insert = (kind: 'secret' | 'note') => {
    if (!editor) return
    void insertSeparate(
      editor,
      kind,
      async (which) => (await api.call('createPageDocument', { pageId, kind: which })).id
    )
  }
  return (
    <div aria-busy={!ready}>
      {editable && (
        <div role="toolbar" aria-label={t('editor.toolbar')} className={styles.toolbar}>
          <button type="button" className={styles.tool} onClick={() => insert('secret')}>
            {t('separate.makeSecret')}
          </button>
          <button type="button" className={styles.tool} onClick={() => insert('note')}>
            {t('separate.makeNote')}
          </button>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}
