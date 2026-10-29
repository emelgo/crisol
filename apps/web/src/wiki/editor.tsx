import type { Page } from '@crisol/contracts'
import { BODY_FIELD, editorExtensions } from '@crisol/editor'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { Collaboration } from '@tiptap/extension-collaboration'
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret'
import { EditorContent, useEditor } from '@tiptap/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as Y from 'yjs'
import { useAccounts } from '../account/context.tsx'
import { useCollabSocket } from './collab.tsx'
import styles from './editor.module.css'

/** Colores de los cursores ajenos: con contraste sobre los dos temas, distintos también en luminosidad */
const CARET_COLORS = ['#b8282a', '#1f6e99', '#6b5494', '#2f6b3a', '#8a5a00', '#a3366f']

function caretColor(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0
  return CARET_COLORS[hash % CARET_COLORS.length] ?? '#b8282a'
}

/** El documento del cuerpo de una página, abierto por el WebSocket de la wiki mientras se ve */
function useBodyDocument(pageId: string) {
  const socket = useCollabSocket()
  const [session, setSession] = useState<{ document: Y.Doc; provider: HocuspocusProvider } | null>(null)
  const [state, setState] = useState({ synced: false, offline: false })
  useEffect(() => {
    if (!socket) return
    const document = new Y.Doc()
    const provider = new HocuspocusProvider({
      websocketProvider: socket,
      name: `page:${pageId}`,
      document,
      // La sesión va en la cookie; el servidor pide un token para comprobar cada documento
      token: 'sesion',
      onSynced: () => setState((current) => ({ ...current, synced: true }))
    })
    const onStatus = ({ status }: { status: string }) =>
      setState((current) => ({ ...current, offline: status === 'disconnected' }))
    socket.on('status', onStatus)
    provider.attach()
    setSession({ document, provider })
    return () => {
      socket.off('status', onStatus)
      provider.destroy()
      document.destroy()
      setSession(null)
      setState({ synced: false, offline: false })
    }
  }, [socket, pageId])
  return { session, ...state }
}

/**
 * El cuerpo de la página: el editor de bloques sobre su documento de Yjs. Lo que se escribe llega a las demás pestañas
 * al momento y se guarda solo; sin conexión se sigue escribiendo y se sincroniza al volver
 */
export function PageBody({ page }: { page: Page }) {
  const { t } = useTranslation()
  const { session, synced, offline } = useBodyDocument(page.id)
  if (!session) return null
  return (
    <section aria-label={t('editor.body')} className={styles.body}>
      {offline && (
        <p role="status" className={styles.offline}>
          {t('editor.offline')}
        </p>
      )}
      <BodyEditor
        key={page.id}
        document={session.document}
        provider={session.provider}
        editable={!page.locked}
        ready={synced}
      />
    </section>
  )
}

function BodyEditor({
  document,
  provider,
  editable,
  ready
}: {
  document: Y.Doc
  provider: HocuspocusProvider
  editable: boolean
  ready: boolean
}) {
  const { t } = useTranslation()
  const { account } = useAccounts().useAccount()
  const name = account?.name ?? ''
  const editor = useEditor(
    {
      extensions: [
        ...editorExtensions({
          checkboxLabel: (text, checked) => t(checked ? 'editor.taskDone' : 'editor.task', { text })
        }),
        Collaboration.configure({ document, field: BODY_FIELD }),
        CollaborationCaret.configure({ provider, user: { name, color: caretColor(name) } })
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
  return (
    <div aria-busy={!ready}>
      <EditorContent editor={editor} />
    </div>
  )
}
