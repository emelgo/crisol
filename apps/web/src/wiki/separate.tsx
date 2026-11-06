/**
 * Los secretos y las notas ocultas en el editor (ADR-0003): cada uno es un bloque del cuerpo que solo guarda el id de
 * su documento, y aquí se pinta con un editor anidado conectado a ese documento por el mismo WebSocket.
 */
import { editorExtensions, fillMissingIds, type SeparateKind } from '@crisol/editor'
import { useParams } from '@tanstack/react-router'
import { type Editor, Extension, type JSONContent, type Node } from '@tiptap/core'
import { Collaboration } from '@tiptap/extension-collaboration'
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret'
import { Fragment, type Node as PMNode, Slice } from '@tiptap/pm/model'
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state'
import { EditorContent, type NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react'
import { createContext, useContext, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useAnnounce } from '../components/announcer.tsx'
import { FormatMenu, TableMenu } from './bubble-menu.tsx'
import { withCalloutView } from './callout.tsx'
import { renderCaret } from './carets.ts'
import { useCollabDocument } from './collab.tsx'
import { withContentLinkView } from './content-link.tsx'
import { withPageEmbedView } from './embed.tsx'
import find from './find-in-page.module.css'
import { FindInPage, nestedFinds } from './find-in-page.tsx'
import { LinkSuggest, useLinksRef, withPageLinkView } from './page-links.tsx'
import { SecretReveal } from './reveal.tsx'
import styles from './separate.module.css'
import { SlashMenu } from './slash-menu.tsx'

/** Las vistas de dentro de un secreto: los recuadros y los enlaces */
const nestedView = (node: Node) =>
  node.name === 'pageLink'
    ? withPageLinkView(node)
    : node.name === 'contentLink'
      ? withContentLinkView(node)
      : node.name === 'pageEmbed'
        ? withPageEmbedView(node)
        : withCalloutView(node)

/** Esta pestaña: la que pega es la que hace la copia (las demás ven el bloque y esperan) */
const TAB_ID = crypto.randomUUID()

/** Lo que va dentro de un secreto recién hecho de un trozo del cuerpo: se pone al abrir su documento */
// En globalThis: al recargar el módulo en caliente (desarrollo), lo pendiente no se pierde entre la copia vieja y la nueva
const PENDING = '__crisolPendingSeparate'
const store = globalThis as unknown as Record<string, Map<string, JSONContent[]> | undefined>
store[PENDING] ??= new Map<string, JSONContent[]>()
const pendingContent = store[PENDING]

/** La página del editor: para crear y copiar los documentos de sus secretos */
export const SeparatePageContext = createContext<string | null>(null)

/** Lo que necesitan los editores de dentro: el nombre del cursor y la etiqueta de las casillas */
export const NestedOptionsContext = createContext<{
  caret: { name: string; color: string }
  checkboxLabel: (text: string, checked: boolean) => string
} | null>(null)

/** Los secretos y las notas ocultas con su vista, para el editor del cuerpo */
export function withSeparateView(node: Node) {
  return node.extend({
    addNodeView() {
      return ReactNodeViewRenderer(SeparateView, {
        // Lo que pasa dentro del editor anidado es suyo: el de fuera ni se entera
        stopEvent: ({ event }) => event.target instanceof Element && Boolean(event.target.closest('[data-nested]')),
        ignoreMutation: () => true
      })
    },
    addKeyboardShortcuts() {
      return {
        // Con el bloque elegido (al llegar con las flechas), Intro entra a escribir en él
        Enter: ({ editor }) => {
          const { selection } = editor.state
          if (!(selection instanceof NodeSelection) || selection.node.type.name !== this.name) return false
          const dom = editor.view.nodeDOM(selection.from)
          const inner = dom instanceof HTMLElement ? dom.querySelector<HTMLElement>('[data-nested] .ProseMirror') : null
          inner?.focus()
          return Boolean(inner)
        }
      }
    }
  })
}

/** Cambia en un trozo pegado los secretos por copias: el pegado de otra página (o duplicado) no comparte documento */
export function copiesOf(fragment: Fragment): Fragment {
  const nodes: PMNode[] = []
  fragment.forEach((child) => {
    if ((child.type.name === 'secret' || child.type.name === 'note') && child.attrs.documentId) {
      nodes.push(
        child.type.create({ ...child.attrs, documentId: null, copyOf: child.attrs.documentId, copyBy: TAB_ID })
      )
    } else nodes.push(child.copy(copiesOf(child.content)))
  })
  return Fragment.fromArray(nodes)
}

/** Al pegar (no al mover arrastrando dentro del mismo editor), los secretos se copian */
export const CopySeparateOnPaste = Extension.create({
  name: 'copySeparateOnPaste',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('copySeparateOnPaste'),
        props: {
          transformPasted: (slice, view) =>
            view.dragging?.move ? slice : new Slice(copiesOf(slice.content), slice.openStart, slice.openEnd)
        }
      })
    ]
  }
})

/**
 * Hace secreto (o nota oculta) lo elegido: su contenido pasa a un documento nuevo y en el cuerpo queda el bloque con su
 * id. Sin nada elegido, uno vacío donde está el cursor
 */
export async function insertSeparate(
  editor: Editor,
  kind: SeparateKind,
  create: (kind: SeparateKind) => Promise<string>
) {
  const { from, to, empty } = editor.state.selection
  const $from = editor.state.doc.resolve(from)
  const $to = editor.state.doc.resolve(to)
  // Del principio del primer bloque al final del último (de primer nivel)
  const start = empty ? null : $from.before(1)
  const end = empty ? null : $to.after(1)
  const content =
    start === null || end === null ? [] : (editor.state.doc.slice(start, end).content.toJSON() as JSONContent[])
  const id = await create(kind)
  if (content.length > 0) pendingContent.set(id, content)
  const block = { type: kind, attrs: { documentId: id } }
  if (start !== null && end !== null) editor.chain().focus().insertContentAt({ from: start, to: end }, block).run()
  else editor.chain().focus().insertContent(block).run()
}

function SeparateView({ node, editor, getPos, updateAttributes, selected }: NodeViewProps) {
  const { t } = useTranslation()
  const api = useApi()
  const announce = useAnnounce()
  const links = useLinksRef()
  const pageId = useContext(SeparatePageContext)
  const options = useContext(NestedOptionsContext)
  const worldId = (useParams({ strict: false }) as { worldId?: string }).worldId
  const kind = node.type.name as SeparateKind
  const documentId: string | null = node.attrs.documentId
  const copying = useRef(false)

  // Una copia que pegó esta pestaña: se crea su documento y el bloque pasa a apuntar a él
  useEffect(() => {
    if (documentId || !node.attrs.copyOf || node.attrs.copyBy !== TAB_ID || !pageId || copying.current) return
    copying.current = true
    void api.call('createPageDocument', { pageId, kind, copyOf: node.attrs.copyOf }).then(({ id }) => {
      updateAttributes({ documentId: id, copyOf: null, copyBy: null })
    })
  }, [api, documentId, kind, node.attrs.copyBy, node.attrs.copyOf, pageId, updateAttributes])

  const { session, synced } = useCollabDocument(documentId ? `doc:${documentId}` : null)
  const nested = useEditor(
    {
      extensions: session
        ? [
            ...editorExtensions({
              nested: true,
              view: nestedView,
              ...(options ? { checkboxLabel: options.checkboxLabel } : {})
            }),
            SlashMenu.configure({
              nested: true,
              name: (block) => t(`blocks.${block.label}`),
              context: null,
              announce: (block) => announce(t('blocks.inserted', { block: t(`blocks.${block.label}`).toLowerCase() }))
            }),
            LinkSuggest.configure({
              links: () => links.current,
              announce: (title) => announce(t('links.inserted', { title }))
            }),
            // Buscar en la página también mira aquí dentro
            FindInPage.configure({ match: find.match ?? '', current: find.current ?? '' }),
            Collaboration.configure({ document: session.document }),
            ...(options
              ? [CollaborationCaret.configure({ provider: session.provider, user: options.caret, render: renderCaret })]
              : [])
          ]
        : editorExtensions({ nested: true, view: nestedView }),
      editable: editor.isEditable && Boolean(session),
      editorProps: {
        attributes: {
          class: styles.prose ?? '',
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': t(kind === 'secret' ? 'separate.secretText' : 'separate.noteText')
        },
        // Las flechas salen del bloque por sus bordes, y Escape vuelve al cuerpo con el bloque elegido
        handleKeyDown: (view, event) => {
          const position = typeof getPos === 'function' ? getPos() : undefined
          // Con el menú «/» abierto, las flechas y Escape son suyos
          if (position === undefined || view.dom.hasAttribute('aria-controls')) return false
          const { from, to, empty } = view.state.selection
          const atStart = empty && from <= 1
          const atEnd = empty && to >= view.state.doc.content.size - 1
          // El foco pasa al cuerpo al momento (focus() de TipTap espera un fotograma): un Ctrl+C justo después copia
          // el bloque, no la nada de dentro
          const leave = (select: () => void) => {
            editor.view.focus()
            select()
            return true
          }
          if ((event.key === 'ArrowUp' || event.key === 'ArrowLeft') && atStart) {
            return leave(() => editor.commands.setTextSelection(position))
          }
          if ((event.key === 'ArrowDown' || event.key === 'ArrowRight') && atEnd) {
            return leave(() => editor.commands.setTextSelection(position + node.nodeSize))
          }
          if (event.key === 'Escape') return leave(() => editor.commands.setNodeSelection(position))
          return false
        }
      }
    },
    [session]
  )

  // Lo que se hizo secreto desde el cuerpo: se pone en cuanto su documento (vacío) está al día
  useEffect(() => {
    if (!nested || !synced || !documentId) return
    const content = pendingContent.get(documentId)
    if (!content) return
    pendingContent.delete(documentId)
    if (nested.isEmpty) nested.commands.setContent({ type: 'doc', content })
  }, [nested, synced, documentId])

  useEffect(() => {
    nested?.setEditable(editor.isEditable && Boolean(session))
  }, [nested, editor.isEditable, session])

  // Para buscar en la página: este editor, con el sitio de su bloque en el cuerpo
  useEffect(() => {
    if (!nested || !session) return
    return nestedFinds(editor).add({ editor: nested, at: () => (typeof getPos === 'function' ? getPos() : undefined) })
  }, [nested, session, editor, getPos])

  // Los bloques de antes de tener ids reciben el suyo al abrirse
  useEffect(() => {
    if (!nested || !synced || !editor.isEditable) return
    const tr = fillMissingIds(nested.state)
    if (tr) nested.view.dispatch(tr)
  }, [nested, synced, editor.isEditable])

  /** Convierte el bloque en texto normal: su contenido vuelve al cuerpo, en su sitio */
  const unwrap = () => {
    const position = typeof getPos === 'function' ? getPos() : undefined
    if (position === undefined || !nested) return
    const content = (nested.getJSON().content ?? []).filter((block) => block.type !== 'paragraph' || block.content)
    editor
      .chain()
      .focus()
      .insertContentAt(
        { from: position, to: position + node.nodeSize },
        content.length > 0 ? content : [{ type: 'paragraph' }]
      )
      .run()
  }

  const label = t(kind === 'secret' ? 'separate.secret' : 'separate.note')
  return (
    <NodeViewWrapper
      as="section"
      aria-label={label}
      className={kind === 'secret' ? styles.secret : styles.note}
      data-selected={selected || undefined}
    >
      <div className={styles.header} contentEditable={false}>
        <span className={styles.label}>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M3 3l18 18M10.6 6.1A9.6 9.6 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-3.1 3.6M6.3 7.8C4.2 9.4 3 12 3 12s4 6 9 6c1.4 0 2.7-.4 3.9-1" />
          </svg>
          {t(kind === 'secret' ? 'separate.secretHint' : 'separate.noteHint')}
        </span>
        {/* A quién se le ha revelado, y «Revelar» (docs/specs/revelar.md) */}
        {kind === 'secret' && documentId && pageId && worldId && editor.isEditable && (
          <SecretReveal worldId={worldId} pageId={pageId} documentId={documentId} />
        )}
        {editor.isEditable && (
          <button
            type="button"
            className={styles.unwrap}
            aria-disabled={!synced || undefined}
            onClick={() => synced && unwrap()}
          >
            {t('separate.unwrap')}
          </button>
        )}
      </div>
      <div data-nested="" aria-busy={!synced}>
        {documentId ? <EditorContent editor={nested} /> : <p className={styles.copying}>{t('separate.copying')}</p>}
        {nested && editor.isEditable && (
          <>
            <FormatMenu editor={nested} />
            <TableMenu editor={nested} />
          </>
        )}
      </div>
    </NodeViewWrapper>
  )
}

/** Los datos de las vistas de los secretos, a partir de la cuenta y los textos */
export function useNestedOptions(caretColor: (name: string) => string) {
  const { t } = useTranslation()
  const { account } = useAccounts().useAccount()
  const name = account?.name ?? ''
  return {
    caret: { name, color: caretColor(name) },
    checkboxLabel: (text: string, checked: boolean) => t(checked ? 'editor.taskDone' : 'editor.task', { text })
  }
}
