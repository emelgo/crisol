/**
 * El texto de un capítulo (ADR-0025): el editor de bloques, sin edición compartida (con su propio deshacer), que se
 * guarda solo como Markdown un momento después de dejar de escribir, como las notas del jugador. Sus secretos y notas
 * ocultas no son documentos aparte (como en las páginas): van dentro del Markdown, en `> [!secreto]` y `%%`, y aquí
 * se escriben en un editor anidado que guarda en memoria
 */
import { editorExtensions, type SeparateKind } from '@crisol/editor'
import { pageFromMarkdown, pageToMarkdown } from '@crisol/editor/markdown'
import { useNavigate } from '@tanstack/react-router'
import type { Editor, JSONContent, Node } from '@tiptap/core'
import type { Transaction } from '@tiptap/pm/state'
import { EditorContent, type NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react'
import { createContext, type MouseEvent, useContext, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useAnnounce } from '../components/announcer.tsx'
import { FormatMenu, TableMenu } from '../wiki/bubble-menu.tsx'
import { withCalloutView } from '../wiki/callout.tsx'
import { withContentEmbedView } from '../wiki/content-embed.tsx'
import { withContentLinkView } from '../wiki/content-link.tsx'
import editorStyles from '../wiki/editor.module.css'
import { EmptyHint } from '../wiki/editor.tsx'
import { withDiceRollView } from '../wiki/dice-roll.tsx'
import { SystemImagesContext, withFileEmbedView } from '../wiki/file-embed.tsx'
import { FloatingCard } from '../wiki/floating-card.tsx'
import { GhostLine } from '../wiki/ghost-line.ts'
import type { PageLinks } from '../wiki/links-context.ts'
import linkStyles from '../wiki/page-links.module.css'
import { LinkSuggest } from '../wiki/page-links.tsx'
import { SectionPreview } from '../wiki/preview-card.tsx'
import separateStyles from '../wiki/separate.module.css'
import { withSheetView } from '../wiki/sheet-blocks.tsx'
import { SlashMenu } from '../wiki/slash-menu.tsx'

/** Cuánto se espera tras la última tecla para guardar */
export const SAVE_DELAY_MS = 800

type Body = JSONContent

/** Lo de dentro de cada secreto o nota oculta, por su id, y el aviso de que algo cambió dentro */
interface LocalSeparates {
  content: Map<string, JSONContent[]>
  changed: () => void
}
const LocalSeparatesContext = createContext<LocalSeparates | null>(null)

/** El cuerpo con cada secreto apuntando a lo suyo en memoria (su id de bloque hace de documento) */
function withLocalIds(node: Body): Body {
  if ((node.type === 'secret' || node.type === 'note') && node.attrs?.id) {
    return { ...node, attrs: { ...node.attrs, documentId: node.attrs.id } }
  }
  return node.content ? { ...node, content: node.content.map(withLocalIds) } : node
}

/** Lee el Markdown de un capítulo: su cuerpo y lo de dentro de sus secretos */
export function readChapter(markdown: string) {
  const page = pageFromMarkdown(markdown)
  return {
    body: withLocalIds(page.body),
    separates: new Map(page.separates.map((each) => [each.id, each.content]))
  }
}

/** El capítulo en Markdown, con sus secretos dentro */
export function writeChapter(body: Body, separates: ReadonlyMap<string, JSONContent[]>) {
  return pageToMarkdown({ properties: [], body, separate: (id) => separates.get(id) ?? [] })
}

/**
 * Si es algo que ha escrito quien edita: no lo es activar la edición (TipTap avisa sin cambiar nada) ni los ids de los
 * bloques que se ponen solos al abrir (no van al deshacer ni al Markdown)
 */
const byUser = (transaction: Transaction) => transaction.docChanged && transaction.getMeta('addToHistory') !== false

/** Las vistas de los bloques: los secretos, en memoria; lo demás, como en la wiki */
function chapterView(node: Node) {
  if (node.name === 'secret' || node.name === 'note') return withLocalSeparateView(node)
  if (node.name === 'callout') return withCalloutView(node)
  if (node.name === 'contentLink') return withContentLinkView(node)
  if (node.name === 'contentEmbed') return withContentEmbedView(node)
  if (node.name === 'fileEmbed') return withFileEmbedView(node)
  if (node.name === 'pageLink') return withChapterLinkView(node)
  // Una tirada escrita (`dice: 2d6+3`): se pulsa y tira en la bandeja de dados (ADR-0033)
  if (node.name === 'diceRoll') return withDiceRollView(node)
  return withSheetView(node)
}

export function ChapterText({
  markdown,
  editable,
  label,
  onChange,
  onDirty,
  onClean,
  onEditor,
  systemId,
  imagesOf,
  credits = {},
  linkTo,
  onSection
}: {
  markdown: string
  editable: boolean
  label: string
  /** Lo escrito, ya en Markdown, cuando toca guardarlo */
  onChange: (markdown: string) => void
  /** Hay algo escrito que aún no se ha mandado a guardar */
  onDirty?: () => void
  /** Al final no había nada que guardar (lo escrito se deshizo, o no cambiaba el texto) */
  onClean?: () => void
  /** El editor, para sacar sus títulos (el índice que sigue la lectura) */
  onEditor?: (editor: Editor | null) => void
  /** Su sistema: lo que se enlaza o se incrusta con `[[@` y `![[@` sale de su compendio */
  systemId?: string
  /** El sistema de sus imágenes: `![[ruta]]` es una de ellas (también al leerlo) */
  imagesOf?: string
  /** El crédito de cada una, por su ruta */
  credits?: Record<string, string>
  /** A dónde lleva un `[[…]]` de su texto (otro capítulo, otro libro, una sección), tal como se escribió; si a ninguno, null */
  linkTo?: (target: string) => ChapterLinkTarget | null
  /** Ir a una sección de este capítulo, por su nombre */
  onSection?: (name: string) => boolean
}) {
  const { t } = useTranslation()
  const announce = useAnnounce()
  const api = useApi()
  // Para `[[@`: el compendio de su sistema (sin páginas: un capítulo no es de ningún mundo)
  const links = useRef<PageLinks | null>(null)
  links.current = systemId
    ? {
        worldId: '',
        names: [],
        byId: new Map(),
        create: async () => '',
        files: [],
        canCreate: false,
        searchContent: async (query) =>
          (await api.call('searchSystemCompendium', { systemId, query, limit: 8 })).items.map((hit) => ({
            key: hit.key,
            name: hit.name,
            type: hit.type,
            typeLabel: hit.type,
            world: false,
            systemId,
            systemName: ''
          }))
      }
    : null
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const save = useRef(onChange)
  save.current = onChange
  const dirty = useRef(onDirty)
  dirty.current = onDirty
  const clean = useRef(onClean)
  clean.current = onClean
  const read = useRef<ReturnType<typeof readChapter> | null>(null)
  read.current ??= readChapter(markdown)
  const separates = read.current.separates
  // Lo guardado, como lo escribe el editor (el Markdown que llega puede venir escrito de otra manera): abrirlo no lo
  // cambia
  const last = useRef<string | null>(null)
  last.current ??= writeChapter(read.current.body, separates)
  // Lo que queda por guardar (el editor puede irse antes que este componente)
  const pending = useRef(false)
  const editorRef = useRef<Editor | null>(null)
  const flush = () => {
    clearTimeout(timer.current)
    pending.current = false
    const editor = editorRef.current
    if (!editor || editor.isDestroyed) return
    const text = writeChapter(editor.getJSON(), separates)
    if (text === last.current) {
      clean.current?.()
      return
    }
    last.current = text
    save.current(text)
  }
  const flushRef = useRef(flush)
  flushRef.current = flush
  const schedule = () => {
    clearTimeout(timer.current)
    dirty.current?.()
    pending.current = true
    timer.current = setTimeout(() => flushRef.current(), SAVE_DELAY_MS)
  }
  const scheduleRef = useRef(schedule)
  scheduleRef.current = schedule
  const local = useRef<LocalSeparates>({ content: separates, changed: () => scheduleRef.current() })

  const editor = useEditor(
    {
      extensions: [
        ...editorExtensions({
          checkboxLabel: (text, checked) => t(checked ? 'editor.taskDone' : 'editor.task', { text }),
          view: chapterView,
          history: true
        }),
        EmptyHint.configure({ text: t('chapters.placeholder') }),
        GhostLine.configure({ className: editorStyles.ghostLine ?? '' }),
        LinkSuggest.configure({
          links: () => links.current,
          announce: (title) => announce(t('links.inserted', { title }))
        }),
        SlashMenu.configure({
          sheet: () => false,
          context: {
            makeSeparate: async (target, kind) => makeLocalSeparate(target, kind, local.current)
          },
          name: (block) => t(`blocks.${block.label}`),
          announce: (block) => announce(t('blocks.inserted', { block: t(`blocks.${block.label}`).toLowerCase() }))
        })
      ],
      content: read.current.body,
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
      onUpdate: ({ transaction }) => {
        if (byUser(transaction)) scheduleRef.current()
      }
    },
    []
  )
  editorRef.current = editor
  useEffect(() => {
    editor?.setEditable(editable)
  }, [editor, editable])
  const reportEditor = useRef(onEditor)
  reportEditor.current = onEditor
  useEffect(() => {
    reportEditor.current?.(editor)
    return () => reportEditor.current?.(null)
  }, [editor])
  // Al salir (otro capítulo, otra vista), lo que quedara por guardar
  useEffect(
    () => () => {
      if (pending.current) flushRef.current()
    },
    []
  )
  return (
    <LocalSeparatesContext.Provider value={local.current}>
      <SystemImagesContext.Provider value={imagesOf ? { systemId: imagesOf, credits } : null}>
        <ChapterLinksContext.Provider value={linkTo ? { linkTo, onSection: onSection ?? (() => false) } : null}>
          <div className={editorStyles.body}>
            <EditorContent editor={editor} />
            {editable && editor && (
              <>
                <FormatMenu editor={editor} onSecret={() => makeLocalSeparate(editor, 'secret', local.current)} />
                <TableMenu editor={editor} />
              </>
            )}
          </div>
        </ChapterLinksContext.Provider>
      </SystemImagesContext.Provider>
    </LocalSeparatesContext.Provider>
  )
}

/** Hace secreto (o nota oculta) lo elegido: su contenido pasa dentro; sin nada elegido, uno vacío donde está el cursor */
function makeLocalSeparate(editor: Editor, kind: SeparateKind, local: LocalSeparates) {
  const { from, to, empty } = editor.state.selection
  const start = empty ? null : editor.state.doc.resolve(from).before(1)
  const end = empty ? null : editor.state.doc.resolve(to).after(1)
  const content =
    start === null || end === null ? [] : (editor.state.doc.slice(start, end).content.toJSON() as JSONContent[])
  const id = crypto.randomUUID()
  local.content.set(id, content.length > 0 ? content : [{ type: 'paragraph' }])
  const block = { type: kind, attrs: { id, documentId: id } }
  if (start !== null && end !== null) editor.chain().focus().insertContentAt({ from: start, to: end }, block).run()
  else editor.chain().focus().insertContent(block).run()
}

function withLocalSeparateView(node: Node) {
  return node.extend({
    addNodeView() {
      return ReactNodeViewRenderer(LocalSeparateView, {
        // Lo que pasa dentro del editor anidado es suyo: el de fuera ni se entera
        stopEvent: ({ event }) => event.target instanceof Element && Boolean(event.target.closest('[data-nested]')),
        ignoreMutation: () => true
      })
    }
  })
}

/** Las vistas de dentro de un secreto: los recuadros y los enlaces al compendio */
const nestedView = (node: Node) => (node.name === 'contentLink' ? withContentLinkView(node) : withCalloutView(node))

function LocalSeparateView({ node, editor, getPos, selected }: NodeViewProps) {
  const { t } = useTranslation()
  const local = useContext(LocalSeparatesContext)
  const kind = node.type.name as SeparateKind
  const documentId = String(node.attrs.documentId ?? node.attrs.id ?? '')
  // Si se escribe en el de fuera: al pasar de leer a escribir («Editar») cambia sin que esta vista se pinte de nuevo
  const [writable, setWritable] = useState(editor.isEditable)
  useEffect(() => {
    const sync = () => setWritable(editor.isEditable)
    editor.on('update', sync)
    editor.on('transaction', sync)
    return () => {
      editor.off('update', sync)
      editor.off('transaction', sync)
    }
  }, [editor])
  const nested = useEditor(
    {
      extensions: [
        ...editorExtensions({ nested: true, view: nestedView, history: true }),
        SlashMenu.configure({
          nested: true,
          sheet: () => false,
          context: null,
          name: (block) => t(`blocks.${block.label}`)
        })
      ],
      content: { type: 'doc', content: local?.content.get(documentId) ?? [{ type: 'paragraph' }] },
      editable: editor.isEditable,
      editorProps: {
        attributes: {
          class: separateStyles.prose ?? '',
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': t(kind === 'secret' ? 'separate.secretText' : 'separate.noteText')
        }
      },
      onUpdate: ({ editor: changed, transaction }) => {
        if (!byUser(transaction)) return
        local?.content.set(documentId, changed.getJSON().content ?? [])
        local?.changed()
      }
    },
    [documentId]
  )
  useEffect(() => {
    nested?.setEditable(writable)
  }, [nested, writable])

  /** Convierte el bloque en texto normal: su contenido vuelve al cuerpo, en su sitio */
  const unwrap = () => {
    const position = typeof getPos === 'function' ? getPos() : undefined
    if (position === undefined || !nested) return
    const content = (nested.getJSON().content ?? []).filter((block) => block.type !== 'paragraph' || block.content)
    local?.content.delete(documentId)
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
      className={kind === 'secret' ? separateStyles.secret : separateStyles.note}
      data-selected={selected || undefined}
    >
      <div className={separateStyles.header} contentEditable={false}>
        <span className={separateStyles.label}>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M3 3l18 18M10.6 6.1A9.6 9.6 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-3.1 3.6M6.3 7.8C4.2 9.4 3 12 3 12s4 6 9 6c1.4 0 2.7-.4 3.9-1" />
          </svg>
          {t(kind === 'secret' ? 'chapters.secretHint' : 'separate.noteHint')}
        </span>
        {writable && (
          <button type="button" className={separateStyles.unwrap} onClick={unwrap}>
            {t('separate.unwrap')}
          </button>
        )}
      </div>
      <div data-nested="">
        <EditorContent editor={nested} />
        {nested && writable && (
          <>
            <FormatMenu editor={nested} />
            <TableMenu editor={nested} />
          </>
        )}
      </div>
    </NodeViewWrapper>
  )
}

/** A dónde lleva un enlace de un capítulo: su dirección y, si es una sección de este mismo, su nombre */
export interface ChapterLinkTarget {
  href: string
  here: string | null
  /** Lo que se enseña al pasar el ratón: ese capítulo, en ese apartado */
  preview: { chapterId: string; section: string | null; campaignId: string | null }
}

const ChapterLinksContext = createContext<{
  linkTo: (target: string) => ChapterLinkTarget | null
  onSection: (name: string) => boolean
} | null>(null)

function withChapterLinkView(node: Node) {
  return node.extend({
    addNodeView() {
      return ReactNodeViewRenderer(ChapterLinkView, { as: 'span' })
    }
  })
}

/**
 * Un `[[…]]` en un capítulo (ADR-0033): a otro capítulo, a otro libro o a una sección. Si no lleva a ninguno que se vea,
 * su texto, sin enlace
 */
function ChapterLinkView({ node }: NodeViewProps) {
  const links = useContext(ChapterLinksContext)
  const navigate = useNavigate()
  const cardId = useId()
  const anchor = useRef<HTMLAnchorElement>(null)
  const [shown, setShown] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const hover = (inside: boolean) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setShown(inside), inside ? 300 : 200)
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  const title = String(node.attrs.title ?? '').trim()
  const section = (node.attrs.anchor as string | null)?.trim() || null
  const label = (node.attrs.label as string | null) || null
  const text = label ?? (title || section || '')
  const target = links?.linkTo(section ? `${title}#${section}` : title) ?? null
  return (
    <NodeViewWrapper as="span">
      {target ? (
        <a
          ref={anchor}
          href={target.href}
          className={linkStyles.link}
          aria-describedby={shown ? cardId : undefined}
          onMouseEnter={() => hover(true)}
          onMouseLeave={() => hover(false)}
          onFocus={() => setShown(true)}
          onBlur={() => setShown(false)}
          onClick={(event: MouseEvent<HTMLAnchorElement>) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
            event.preventDefault()
            if (target.here && links?.onSection(target.here)) return
            void navigate({ href: target.href })
          }}
        >
          {text}
        </a>
      ) : (
        <span>{text}</span>
      )}
      {target && shown && (
        <FloatingCard anchor={anchor.current} id={cardId} onEnter={() => hover(true)} onLeave={() => hover(false)}>
          <SectionPreview {...target.preview} />
        </FloatingCard>
      )}
    </NodeViewWrapper>
  )
}
