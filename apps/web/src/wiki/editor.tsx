import type { Page, SheetSettings } from '@crisol/contracts'
import { BODY_FIELD, calloutKindOf, editorExtensions, fillMissingIds } from '@crisol/editor'
import type { HocuspocusProvider } from '@hocuspocus/provider'
import { type Editor, Extension, InputRule } from '@tiptap/core'
import { Collaboration } from '@tiptap/extension-collaboration'
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret'
import { Plugin } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { EditorContent, useEditor } from '@tiptap/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type * as Y from 'yjs'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { AiHighlight, useAiHighlight } from './ai-highlight.ts'
import type { BlockContext } from './blocks.ts'
import { FormatMenu, TableMenu } from './bubble-menu.tsx'
import { caretColor, renderCaret } from './carets.ts'
import { useCollabDocument } from './collab.tsx'
import { ContentView } from './content.tsx'
import { BlockHandle, BlockMenu, type BlockTarget, blockAtCursor } from './drag-handle.tsx'
import styles from './editor.module.css'
import { FileDrop, type FileDropOptions } from './file-embed.tsx'
import find from './find-in-page.module.css'
import { FindBar, FindInPage } from './find-in-page.tsx'
import { GhostLine } from './ghost-line.ts'
import { LinkSuggest, type PageLinks, PageLinksContext, useLinksRef, usePageLinks } from './page-links.tsx'
import { usePageContent } from './preview.tsx'
import {
  CopySeparateOnPaste,
  insertSeparate,
  NestedOptionsContext,
  SeparatePageContext,
  useNestedOptions
} from './separate.tsx'
import { sheetOf } from './sheet/controls.tsx'
import { PagedSheet, SheetLayout } from './sheet/paged.tsx'
import { SlashMenu } from './slash-menu.tsx'
import { withNodeView } from './views.ts'

/**
 * El cuerpo de la página: el editor de bloques sobre su documento de Yjs. Lo que se escribe llega a las demás pestañas
 * al momento y se guarda solo; sin conexión se sigue escribiendo y se sincroniza al volver
 */
export function PageBody({
  page,
  documentId,
  links: given
}: {
  page: Page
  documentId?: string | null
  /** Las páginas que se pueden enlazar, si no son las de toda la wiki (un jugador: las que conoce) */
  links?: PageLinks
}) {
  const { t } = useTranslation()
  const { session, synced, offline } = useCollabDocument(documentId ? `doc:${documentId}` : `page:${page.id}`)
  const nestedOptions = useNestedOptions(caretColor)
  const wikiLinks = usePageLinks(page.worldId, !given)
  const links = given ?? wikiLinks
  const saving = useSaving(session?.provider ?? null)
  // Si el editor tarda en conectarse (más de lo que se nota), el texto guardado se enseña mientras; si no, no cuesta nada
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (synced || offline) return
    const timer = setTimeout(() => setSlow(true), 150)
    return () => clearTimeout(timer)
  }, [synced, offline])
  // (solo del cuerpo: el de una pestaña de texto no se guarda aparte)
  const stored = usePageContent(page.worldId, slow && !synced && !documentId ? page.id : null, null, false)
  // El hueco de «Guardado», a la derecha de las pestañas de la página
  const [saveSlot, setSaveSlot] = useState<Element | null>(null)
  useEffect(() => setSaveSlot(document.querySelector('[data-save-slot]')), [])
  if (!session) return null
  return (
    <section
      aria-label={t('editor.body')}
      className={styles.body}
      // Mientras llega su texto (con conexión), no se enseña vacío
      data-loading={(!synced && !offline) || undefined}
    >
      {offline && (
        <p role="status" className={styles.offline}>
          {t('editor.offline')}
        </p>
      )}
      {/* Se guarda solo: abajo a la derecha, discreto, si aún falta por guardar o ya está (sin anunciarlo a cada letra) */}
      {!offline &&
        synced &&
        !page.locked &&
        saveSlot &&
        createPortal(
          <p className={styles.saveState} aria-hidden="true">
            {t(saving ? 'editor.saving' : 'editor.saved')}
          </p>,
          saveSlot
        )}
      {/* Mientras el editor se conecta, el texto ya se ve (en lectura): cambiar de página no deja un hueco */}
      {!synced && !offline && stored.data && (
        <div className={styles.stored} aria-hidden="true">
          <ContentView blocks={stored.data.blocks} worldId={page.worldId} />
        </div>
      )}
      <SeparatePageContext.Provider value={page.id}>
        <PageLinksContext.Provider value={links}>
          <NestedOptionsContext.Provider value={nestedOptions}>
            {/* El editor, solo cuando ya llegó el texto (o sin conexión): uno creado antes escribiría su línea vacía en
                el documento compartido, y cada vez que se abriera la página (o React lo montara dos veces) sumaría otra */}
            {(synced || offline) && (
              <BodyEditor
                // La escriben jugadores: sin secretos ni notas ocultas (y otro esquema: se vuelve a crear)
                key={`${documentId ?? page.id}${page.editedByPlayers || page.editable ? ':jugadores' : ''}`}
                nested={Boolean(documentId) || Boolean(page.editedByPlayers) || Boolean(page.editable)}
                pageId={page.id}
                document={session.document}
                provider={session.provider}
                editable={!page.locked}
                ready={synced}
                // Un jugador escribe en texto corrido, como lo lee (sin la maqueta de la hoja, que encoge la letra)
                sheet={page.editable ? null : sheetOf(page)}
                // Un jugador no sube archivos al mundo
                uploads={!page.editable}
              />
            )}
          </NestedOptionsContext.Provider>
        </PageLinksContext.Provider>
      </SeparatePageContext.Provider>
    </section>
  )
}

/** El texto vacío dice qué hacer: escribir, «/» o «@» (en la primera línea, mientras no haya nada) */
export const EmptyHint = Extension.create<{ text: string }>({
  name: 'emptyHint',
  addOptions: () => ({ text: '' }),
  addProseMirrorPlugins() {
    const { text } = this.options
    return [
      new Plugin({
        props: {
          decorations: ({ doc }) => {
            const first = doc.firstChild
            if (doc.childCount !== 1 || !first?.isTextblock || first.content.size > 0) return null
            return DecorationSet.create(doc, [
              Decoration.node(0, first.nodeSize, { class: styles.emptyHint ?? '', 'data-placeholder': text })
            ])
          }
        }
      })
    ]
  }
})

/**
 * Los recuadros escritos como en el Markdown: `[!secreto] ` (o `> [!secreto] `, que antes hace la cita) al empezar
 * una línea crea un secreto; `[!aviso] `, `[!consejo] `… su recuadro
 */
const CalloutShortcut = Extension.create<{ makeSecret: (editor: Editor) => void }>({
  name: 'calloutShortcut',
  addOptions: () => ({ makeSecret: () => {} }),
  addInputRules() {
    const { makeSecret } = this.options
    const editor = this.editor
    return [
      new InputRule({
        find: /^\[!([\p{L}-]+)\]\s$/u,
        handler: ({ state, range, match, chain }) => {
          const name = (match[1] ?? '').toLocaleLowerCase('es')
          const secret = name === 'secreto' || name === 'secret'
          const kind = secret ? null : calloutKindOf(name)
          if (!secret && !kind) return null
          chain().deleteRange(range).run()
          // Dentro de la cita que hizo «> », fuera de ella
          if (state.doc.resolve(range.from).node(-1)?.type.name === 'blockquote') chain().lift('blockquote').run()
          if (secret) makeSecret(editor)
          else if (kind) chain().setCallout(kind).run()
        }
      })
    ]
  }
})

/** Si el texto tiene cambios que aún no ha recibido el servidor */
function useSaving(provider: HocuspocusProvider | null) {
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!provider) return
    const update = () => setSaving(provider.hasUnsyncedChanges)
    provider.on('unsyncedChanges', update)
    update()
    return () => {
      provider.off('unsyncedChanges', update)
    }
  }, [provider])
  return saving
}

function BodyEditor({
  pageId,
  document,
  provider,
  editable,
  ready,
  sheet,
  nested = false,
  uploads = true
}: {
  pageId: string
  document: Y.Doc
  provider: HocuspocusProvider
  editable: boolean
  ready: boolean
  /** Si se pueden soltar o pegar archivos (se suben al mundo) */
  uploads?: boolean
  /** Con hoja: el texto, maquetado en sus páginas; y los bloques de hoja en el menú «/» */
  sheet: SheetSettings | null
  /** El de una pestaña de texto: sin secretos dentro */
  nested?: boolean
}) {
  // El editor se crea una vez: lo de la hoja se lee al momento
  const isSheet = useRef(sheet !== null)
  isSheet.current = sheet !== null
  const { t } = useTranslation()
  const api = useApi()
  const announce = useAnnounce()
  const { account } = useAccounts().useAccount()
  const name = account?.name ?? ''
  // Las páginas del mundo, para `[[`: el editor se crea una vez y las lee al momento
  const links = useLinksRef()
  // Hacer secreto lo elegido: su documento nuevo se crea en el servidor
  // Subir un archivo al mundo de la página (pegado, soltado o elegido con «/»)
  const upload = useCallback(
    (file: File) => {
      const worldId = links.current?.worldId
      if (!worldId) return Promise.reject(new Error('sin mundo'))
      return api.uploadFile({ worldId, name: file.name }, file)
    },
    [api, links]
  )
  const errorText = useErrorText()
  const announceFile = useCallback<FileDropOptions['announce']>(
    (message) =>
      announce(
        message.kind === 'failed'
          ? t('fileEmbed.failed', { name: message.name, error: errorText(message.error) })
          : t(`fileEmbed.${message.kind}`, { name: message.name })
      ),
    [announce, t, errorText]
  )
  const filePicker = useRef<HTMLInputElement>(null)
  const pickingFor = useRef<Editor | null>(null)
  const context = useMemo<BlockContext>(
    () => ({
      makeSeparate: (editor, kind) =>
        insertSeparate(
          editor,
          kind,
          async (which) => (await api.call('createPageDocument', { pageId, kind: which })).id
        ),
      pickFile: (editor) => {
        pickingFor.current = editor
        filePicker.current?.click()
      }
    }),
    [api, pageId]
  )
  const editor = useEditor(
    {
      extensions: [
        // Una pestaña de texto, como dentro de un secreto: sin secretos ni notas ocultas (su documento es aparte)
        ...editorExtensions({
          checkboxLabel: (text, checked) => t(checked ? 'editor.taskDone' : 'editor.task', { text }),
          view: withNodeView,
          nested
        }),
        EmptyHint.configure({ text: t('editor.placeholder') }),
        GhostLine.configure({ className: styles.ghostLine ?? '' }),
        ...(nested
          ? []
          : [CalloutShortcut.configure({ makeSecret: (editor) => void context.makeSeparate(editor, 'secret') })]),
        SheetLayout,
        SlashMenu.configure({
          nested,
          sheet: () => isSheet.current,
          name: (block) => t(`blocks.${block.label}`),
          context,
          announce: (block) => announce(t('blocks.inserted', { block: t(`blocks.${block.label}`).toLowerCase() }))
        }),
        LinkSuggest.configure({
          links: () => links.current,
          announce: (title) => announce(t('links.inserted', { title }))
        }),
        ...(nested ? [] : [CopySeparateOnPaste]),
        ...(uploads ? [FileDrop.configure({ upload, announce: announceFile })] : []),
        FindInPage.configure({ match: find.match ?? '', current: find.current ?? '' }),
        AiHighlight.configure({ className: styles.aiFlash ?? '' }),
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
  // Lo que escribe Claude se resalta un instante
  const announceAi = useCallback(() => announce(t('editor.aiChanged')), [announce, t])
  useAiHighlight(editor, provider, announceAi)
  // El menú del bloque del cursor, con el teclado (Ctrl+Alt+B): el asa es para el ratón
  const blockAnchor = useRef<HTMLElement | null>(null)
  const [blockMenu, setBlockMenu] = useState<BlockTarget | null>(null)
  useEffect(() => {
    if (!editor || !editable) return
    const dom = editor.view.dom
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !event.altKey || event.code !== 'KeyB') return
      event.preventDefault()
      const at = editor.view.domAtPos(editor.state.selection.from).node
      blockAnchor.current = (at instanceof HTMLElement ? at : at.parentElement)?.closest('.ProseMirror > *') ?? dom
      setBlockMenu(blockAtCursor(editor))
    }
    dom.addEventListener('keydown', onKey)
    return () => dom.removeEventListener('keydown', onKey)
  }, [editor, editable])
  return (
    <div aria-busy={!ready}>
      {/* Sin barra de botones encima: los bloques, con «/»; buscar en la página, con Ctrl+Alt+F */}
      {editor && <FindBar editor={editor} />}
      <PagedSheet editor={editor} settings={sheet} ready={ready}>
        <EditorContent editor={editor} />
      </PagedSheet>
      <input
        ref={filePicker}
        type="file"
        hidden
        onChange={(event) => {
          const chosen = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          const target = pickingFor.current
          if (!chosen || !target) return
          announceFile({ kind: 'uploading', name: chosen.name })
          upload(chosen).then(
            (stored) => {
              target
                .chain()
                .focus()
                .insertContent({ type: 'fileEmbed', attrs: { fileId: stored.id, name: stored.name } })
                .run()
              announceFile({ kind: 'uploaded', name: stored.name })
            },
            (error: unknown) => announceFile({ kind: 'failed', name: chosen.name, error })
          )
        }}
      />
      {editable && editor && (
        <>
          <FormatMenu editor={editor} onSecret={() => void context.makeSeparate(editor, 'secret')} />
          <TableMenu editor={editor} />
          <BlockHandle editor={editor} context={context} nested={nested} />
        </>
      )}
      {editor && blockMenu && (
        <BlockMenu
          editor={editor}
          target={blockMenu}
          anchor={blockAnchor.current}
          context={context}
          onClose={(returnFocus) => {
            setBlockMenu(null)
            if (returnFocus) editor.commands.focus()
          }}
        />
      )}
    </div>
  )
}
