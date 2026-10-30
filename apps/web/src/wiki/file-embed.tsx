/**
 * Un archivo del mundo en el texto: una imagen (con su ancho, su texto alternativo, su pie y la caja de luz) o, si no
 * es imagen, una tarjeta con su nombre y «Abrir». El nombre que se enseña es el de ahora (renombrar no rompe nada).
 * Pegar o soltar archivos en el editor los sube y los pone aquí
 */
import { Extension, type JSONContent, type Node } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { type NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { createContext, useContext, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import styles from './file-embed.module.css'
import { PageLinksContext, type WorldFile } from './links-context.ts'
import { PdfViewer } from './pdf-viewer.tsx'

/** Cómo se cargan las imágenes: al acercarse (lo normal) o ya (en la hoja, que las mide antes de enseñarlas) */
export const ImageLoading = createContext<'lazy' | 'eager'>('lazy')

export function withFileEmbedView(node: Node) {
  return node.extend({
    addNodeView() {
      return ReactNodeViewRenderer(FileEmbedView)
    }
  })
}

type FileState = { state: 'ok'; file: WorldFile } | { state: 'pending' } | { state: 'trashed' } | { state: 'loading' }

/** Qué archivo es: por su id; sin id, por su nombre (el servidor le pondrá el id en cuanto lo vea) */
function useFileState(fileId: string | null, name: string): FileState {
  const links = useContext(PageLinksContext)
  const files = links?.files ?? []
  if (fileId) {
    const file = files.find((f) => f.id === fileId)
    if (file) return { state: 'ok', file }
    // Con id y sin archivo: en la papelera. Mientras carga la lista, aún no se sabe
    return files.length > 0 ? { state: 'trashed' } : { state: 'loading' }
  }
  const key = name.trim().toLocaleLowerCase('es')
  const file = files.find((f) => f.name.toLocaleLowerCase('es') === key)
  return file ? { state: 'ok', file } : { state: 'pending' }
}

const WIDTHS = { auto: null, small: 300, medium: 500, large: 800 } as const
type WidthName = keyof typeof WIDTHS

const widthName = (width: number | null): WidthName =>
  (Object.entries(WIDTHS).find(([, value]) => value === width)?.[0] as WidthName | undefined) ?? 'auto'

interface Attrs {
  fileId: string | null
  name: string
  width: number | null
  page: number | null
  alt: string | null
  caption: string | null
}

const attrsOf = (node: { attrs?: Record<string, unknown> }): Attrs => ({
  fileId: (node.attrs?.fileId as string | null) ?? null,
  name: String(node.attrs?.name ?? ''),
  width: (node.attrs?.width as number | null) ?? null,
  page: (node.attrs?.page as number | null) ?? null,
  alt: (node.attrs?.alt as string | null) ?? null,
  caption: (node.attrs?.caption as string | null) ?? null
})

function FileEmbedView({ node, selected, editor, updateAttributes }: NodeViewProps) {
  const { t } = useTranslation()
  const attrs = attrsOf(node)
  const editable = editor.isEditable
  return (
    <NodeViewWrapper
      as="figure"
      aria-label={t('fileEmbed.of', { name: attrs.name })}
      className={styles.figure}
      data-selected={selected || undefined}
      contentEditable={false}
    >
      <FileFigure attrs={attrs} edit={editable ? { selected, update: updateAttributes } : null} />
    </NodeViewWrapper>
  )
}

/** Lo de dentro de lo que se enseña en solo lectura (vista previa, incrustados, versiones) */
export function FileEmbedBlock({ node }: { node: JSONContent }) {
  const { t } = useTranslation()
  const attrs = attrsOf(node)
  return (
    <figure aria-label={t('fileEmbed.of', { name: attrs.name })} className={styles.figure}>
      <FileFigure attrs={attrs} edit={null} />
    </figure>
  )
}

function FileFigure({
  attrs,
  edit
}: {
  attrs: Attrs
  edit: { selected: boolean; update: (attrs: Partial<Attrs>) => void } | null
}) {
  const { t, i18n } = useTranslation()
  const target = useFileState(attrs.fileId, attrs.name)
  if (target.state === 'loading') return <p className={styles.note}>{attrs.name}</p>
  if (target.state === 'trashed') return <p className={styles.note}>{t('fileEmbed.trashed', { name: attrs.name })}</p>
  if (target.state === 'pending') return <PendingFile name={attrs.name} editable={Boolean(edit)} />
  const { file } = target
  if (file.kind === 'pdf') return <PdfViewer url={file.url} name={file.name} size={file.size} page={attrs.page} />
  if (file.kind !== 'image') {
    const size = new Intl.NumberFormat(i18n.language, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 })
    return (
      <div className={styles.card}>
        <a href={file.url} target="_blank" rel="noopener">
          {file.name}
        </a>
        <span className={styles.meta}>{size.format(file.size / (1024 * 1024))}</span>
      </div>
    )
  }
  return <ImageFigure attrs={attrs} file={file} edit={edit} />
}

function ImageFigure({
  attrs,
  file,
  edit
}: {
  attrs: Attrs
  file: WorldFile
  edit: { selected: boolean; update: (attrs: Partial<Attrs>) => void } | null
}) {
  const { t } = useTranslation()
  const loading = useContext(ImageLoading)
  const dialog = useRef<HTMLDialogElement>(null)
  const altId = useId()
  const altHintId = useId()
  const widthId = useId()
  // El pie y el texto alternativo se guardan al salir del campo: no un cambio por letra
  const [caption, setCaption] = useState(attrs.caption ?? '')
  const [alt, setAlt] = useState(attrs.alt ?? '')
  useEffect(() => setCaption(attrs.caption ?? ''), [attrs.caption])
  useEffect(() => setAlt(attrs.alt ?? ''), [attrs.alt])
  const save = (name: 'caption' | 'alt', value: string) => {
    const next = value.trim() || null
    if (next !== attrs[name]) edit?.update({ [name]: next })
  }
  return (
    <>
      <button
        type="button"
        className={styles.enlarge}
        // Su nombre dice lo que se ve (el texto alternativo) o, si no lo hay, el archivo
        aria-label={t('fileEmbed.enlarge', { name: attrs.alt || file.name })}
        onClick={() => dialog.current?.showModal()}
      >
        <img
          src={file.url}
          alt={attrs.alt ?? ''}
          loading={loading}
          className={styles.image}
          style={attrs.width ? { inlineSize: `${attrs.width}px` } : undefined}
        />
      </button>
      {edit ? (
        <input
          className={styles.caption}
          aria-label={t('fileEmbed.caption')}
          placeholder={t('fileEmbed.captionPlaceholder')}
          value={caption}
          onChange={(event) => setCaption(event.currentTarget.value)}
          onBlur={() => save('caption', caption)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
      ) : (
        attrs.caption && <figcaption className={styles.captionText}>{attrs.caption}</figcaption>
      )}
      {edit?.selected && (
        <div className={styles.tools}>
          <label htmlFor={widthId}>{t('fileEmbed.width')}</label>
          <select
            id={widthId}
            value={widthName(attrs.width)}
            onChange={(event) => edit.update({ width: WIDTHS[event.currentTarget.value as WidthName] })}
          >
            {(Object.keys(WIDTHS) as WidthName[]).map((name) => (
              <option key={name} value={name}>
                {t(`fileEmbed.widths.${name}`)}
              </option>
            ))}
          </select>
          <label htmlFor={altId}>{t('fileEmbed.alt')}</label>
          <input
            id={altId}
            aria-describedby={altHintId}
            value={alt}
            onChange={(event) => setAlt(event.currentTarget.value)}
            onBlur={() => save('alt', alt)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
          />
          <span id={altHintId} className={styles.hint}>
            {t('fileEmbed.altHint')}
          </span>
        </div>
      )}
      {/* La caja de luz: la imagen entera; Escape o «Cerrar» la cierran */}
      <dialog ref={dialog} className={styles.lightbox} aria-label={file.name}>
        <img src={file.url} alt={attrs.alt ?? ''} className={styles.full} />
        <button type="button" className={styles.close} onClick={() => dialog.current?.close()}>
          {t('fileEmbed.close')}
        </button>
      </dialog>
    </>
  )
}

/** Un archivo que aún no está: si se puede escribir, se sube aquí mismo con ese nombre (y se resuelve solo) */
function PendingFile({ name, editable }: { name: string; editable: boolean }) {
  const { t } = useTranslation()
  const links = useContext(PageLinksContext)
  const api = useApi()
  const errorText = useErrorText()
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <div className={styles.card}>
      <span className={styles.note}>{t('fileEmbed.pending', { name })}</span>
      {editable && links && (
        <>
          <button
            type="button"
            className={styles.upload}
            aria-disabled={busy || undefined}
            onClick={() => !busy && input.current?.click()}
          >
            {t('fileEmbed.upload')}
          </button>
          <input
            ref={input}
            type="file"
            hidden
            onChange={(event) => {
              const chosen = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (!chosen) return
              setBusy(true)
              setError(null)
              api
                .uploadFile({ worldId: links.worldId, name }, chosen)
                .catch((failure: unknown) => setError(errorText(failure)))
                .finally(() => setBusy(false))
            }}
          />
          {error && (
            <span role="alert" className={styles.error}>
              {error}
            </span>
          )}
        </>
      )}
    </div>
  )
}

export interface FileDropOptions {
  /** Sube un archivo y devuelve el que quedó (con su nombre final) */
  upload: (file: File) => Promise<{ id: string; name: string }>
  announce: (
    message: { kind: 'uploading' | 'uploaded'; name: string } | { kind: 'failed'; name: string; error: unknown }
  ) => void
}

/** Pegar o soltar archivos en el texto: se suben y se ponen donde se pegaron o soltaron */
export const FileDrop = Extension.create<FileDropOptions>({
  name: 'fileDrop',
  addOptions: () => ({ upload: () => Promise.reject(new Error('sin subida')), announce: () => {} }),
  addProseMirrorPlugins() {
    const { upload, announce } = this.options
    const insert = (view: EditorView, files: File[], at: number) => {
      for (const file of files) {
        announce({ kind: 'uploading', name: file.name })
        upload(file).then(
          (stored) => {
            const { state } = view
            const node = state.schema.nodes.fileEmbed?.create({ fileId: stored.id, name: stored.name })
            if (!node) return
            view.dispatch(state.tr.insert(Math.min(at, state.doc.content.size), node))
            announce({ kind: 'uploaded', name: stored.name })
          },
          (error: unknown) => announce({ kind: 'failed', name: file.name, error })
        )
      }
    }
    return [
      new Plugin({
        key: new PluginKey('fileDrop'),
        props: {
          handlePaste: (view, event) => {
            const files = [...(event.clipboardData?.files ?? [])]
            if (files.length === 0) return false
            insert(view, files, view.state.selection.to)
            return true
          },
          handleDrop: (view, event, _slice, moved) => {
            const files = [...(event.dataTransfer?.files ?? [])]
            if (moved || files.length === 0) return false
            event.preventDefault()
            const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.to
            insert(view, files, at)
            return true
          }
        }
      })
    ]
  }
})
