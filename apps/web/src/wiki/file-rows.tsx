/** Las filas de la lista de archivos: un archivo, una carpeta y una subida, con lo de elegirlos */

import type { FolderView } from '@crisol/contracts'
import { ChevronRight, Upload as UploadIcon, X } from 'lucide-react'
import {
  type CSSProperties,
  createContext,
  type FocusEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  useContext
} from 'react'
import { useTranslation } from 'react-i18next'
import type { Zone } from '../components/tree/moves.ts'
import { FileSettings, FolderSettings, NewFolder } from './file-dialogs.tsx'
import { FileName, FileTags, sizeText, Thumb } from './file-parts.tsx'
import type { Target, Upload } from './file-uploads.ts'
import styles from './files.module.css'
import { FolderGlyph } from './folder-glyph.tsx'
import type { WorldFile } from './links-context.ts'

/** Lo elegido para hacer algo de una vez (en la lista de la pantalla); range: con Mayúsculas, el tramo hasta el último */
export interface Selection {
  has: (id: string) => boolean
  active: boolean
  toggle: (id: string, what: 'file' | 'folder', range?: boolean) => void
}

export const SelectionContext = createContext<Selection | null>(null)

/** La casilla para elegir un archivo o una carpeta (sobre su miniatura; se ve al pasar el ratón o al elegir) */
export function Pick({ id, what, name }: { id: string; what: 'file' | 'folder'; name: string }) {
  const { t } = useTranslation()
  const selection = useContext(SelectionContext)
  if (!selection) return null
  // La casilla, en una zona de 24 px que también la marca (el tamaño mínimo que se pulsa, WCAG 2.5.8)
  return (
    <label className={styles.pick}>
      <input
        type="checkbox"
        checked={selection.has(id)}
        aria-label={t('files.choose', { name })}
        onChange={(event) => {
          const native = event.nativeEvent as Partial<MouseEvent>
          selection.toggle(id, what, Boolean(native.shiftKey))
        }}
      />
    </label>
  )
}

/**
 * El teclado de una fila (como en Etiquetas): una sola parada del tabulador en la lista (la fila con el foco), flechas
 * para recorrerla y abrir o cerrar carpetas, Alt + flechas para recolocar, Intro para abrir y Espacio para elegir
 */
export type RowFocus = {
  ref: (element: HTMLDivElement | null) => void
  tabIndex: number
  onFocus: (event: FocusEvent<HTMLDivElement>) => void
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
}

/** Lo de arrastrar de una fila: sus manejadores y cómo se ve (dónde caería lo arrastrado, apagada, a punto de abrirse…) */
export type RowDrag = { attrs: HTMLAttributes<HTMLDivElement> & { 'data-drop'?: Zone | undefined }; className: string }

export const NO_DRAG: RowDrag = { attrs: {}, className: '' }

/** Un archivo en una fila: su miniatura, su nombre (lo abre), dónde está (al buscar), su tamaño y su engranaje */
export function FileRow({
  file,
  depth,
  where,
  folders,
  canWrite,
  fresh,
  drag,
  focus,
  onPreview,
  onMove,
  onChanged
}: {
  file: WorldFile
  /** Lo honda que está en el árbol (0: lo más alto) */
  depth: number
  where: FolderView[]
  folders: FolderView[]
  canWrite: boolean
  fresh: boolean
  drag: RowDrag
  focus: RowFocus
  /** Llevarlo a otra carpeta desde su ventana (null: lo más alto) */
  onMove: (dest: string | null) => void
  /** Al pasar el ratón (true) y al irse (false): para la vista previa */
  onPreview: (shown: boolean) => void
  onChanged: () => Promise<unknown>
}) {
  const { i18n } = useTranslation()
  return (
    <div
      {...drag.attrs}
      {...focus}
      className={[styles.row, styles.treeRow, fresh ? styles.appear : '', drag.className].filter(Boolean).join(' ')}
      style={{ '--depth': depth } as CSSProperties}
      data-file-card={file.id}
      onPointerEnter={() => onPreview(true)}
      onPointerLeave={() => onPreview(false)}
      // Al abrir algo suyo (su engranaje, la imagen en grande), la vista previa se va
      onClickCapture={(event) => {
        if ((event.target as Element).closest('[aria-haspopup="dialog"]')) onPreview(false)
      }}
    >
      {canWrite && <Pick id={file.id} what="file" name={file.name} />}
      <span className={styles.chevron} aria-hidden="true" />
      <span className={styles.rowThumb}>
        <Thumb file={file} small />
      </span>
      <span className={styles.rowText}>
        <FileName file={file} className={styles.rowName} />
        {where.length > 0 && <span className={styles.where}>{where.map((folder) => folder.name).join(' › ')}</span>}
        <FileTags tags={file.tags} />
      </span>
      <span className={styles.rowMeta}>{sizeText(file.size, i18n.language)}</span>
      {canWrite ? <FileSettings file={file} folders={folders} onMove={onMove} onChanged={onChanged} /> : <span />}
    </div>
  )
}

/**
 * Una carpeta en su fila: su flecha (gira al abrirla), su icono, su nombre, cuánto tiene y su engranaje. Pulsarla (toda
 * la fila) la despliega en su sitio y la elige, o la pliega; con el teclado, también la flecha derecha la abre y la
 * izquierda la cierra
 */
export function FolderRow({
  folder,
  depth,
  open,
  counts,
  canWrite,
  fresh,
  drag,
  focus,
  onUpload,
  newFolder,
  onToggle,
  onPreview,
  folders,
  onMove,
  onChanged
}: {
  folder: FolderView
  depth: number
  open: boolean
  counts: string
  /** Todas las carpetas, para llevarla a otra desde su ventana (onMove; null: lo más alto) */
  folders: FolderView[]
  onMove: (dest: string | null) => void
  /** Subir a ella y crear una dentro: dos botones que salen al pasar el ratón (si se puede escribir en ella) */
  onUpload?: () => void
  newFolder?: { target: Target; parentId: string | null }
  /** Se puede cambiar (la de «Comunes» en un mundo, no: ni se renombra ni se borra) */
  canWrite: boolean
  fresh: boolean
  drag: RowDrag
  focus: RowFocus
  onToggle: () => void
  /** Al pasar el ratón (true) y al irse (false): para la vista previa */
  onPreview: (shown: boolean) => void
  onChanged: () => Promise<unknown>
}) {
  const { t } = useTranslation()
  const classes = [styles.row, styles.treeRow, fresh ? styles.appear : '', drag.className]
  return (
    <div
      {...drag.attrs}
      {...focus}
      className={classes.filter(Boolean).join(' ')}
      style={{ '--depth': depth } as CSSProperties}
      data-file-card={folder.id}
      onPointerEnter={() => onPreview(true)}
      onPointerLeave={() => onPreview(false)}
      // Al abrir algo suyo (su engranaje), la vista previa se va
      onClickCapture={(event) => {
        if ((event.target as Element).closest('[aria-haspopup="dialog"]')) onPreview(false)
      }}
    >
      {canWrite && <Pick id={folder.id} what="folder" name={folder.name} />}
      <span className={styles.chevron} data-open={open} aria-hidden="true">
        <ChevronRight size={16} />
      </span>
      <span className={`${styles.rowThumb} ${styles.folderThumb}`}>
        <FolderGlyph folder={folder} open={open} />
      </span>
      <span className={styles.rowText}>
        <button
          type="button"
          className={`${styles.rowName} ${styles.open}`}
          aria-expanded={open}
          onClick={onToggle}
          onKeyDown={(event) => {
            if ((event.key === 'ArrowRight' && !open) || (event.key === 'ArrowLeft' && open)) {
              event.preventDefault()
              onToggle()
            }
          }}
        >
          {folder.name}
        </button>
      </span>
      {/* Cuánto tiene; al pasar el ratón (o con el foco), en su sitio, subir a ella y crear una dentro */}
      <span className={styles.folderMeta}>
        <span className={styles.rowMeta}>{counts}</span>
        {(onUpload || newFolder) && (
          <span className={styles.rowActions}>
            {onUpload && (
              <button
                type="button"
                className={styles.smallGear}
                aria-label={t('files.uploadInto', { folder: folder.name })}
                title={t('files.uploadHere')}
                onClick={onUpload}
              >
                <UploadIcon aria-hidden="true" size={15} />
              </button>
            )}
            {newFolder && (
              <NewFolder
                shape="icon"
                target={newFolder.target}
                parentId={newFolder.parentId}
                label={t('files.newFolderIn', { folder: folder.name })}
                onCreated={onChanged}
              />
            )}
          </span>
        )}
      </span>
      {canWrite ? <FolderSettings folder={folder} folders={folders} onMove={onMove} onChanged={onChanged} /> : <span />}
    </div>
  )
}

/** Una subida en una fila: su nombre, su progreso y la X para cancelarla (o el motivo, si falló, y la X para quitarla) */
export function UploadRow({ upload, depth, onCancel }: { upload: Upload; depth: number; onCancel: () => void }) {
  const { t, i18n } = useTranslation()
  const percent = new Intl.NumberFormat(i18n.language, { style: 'percent' }).format(upload.fraction)
  const broken = upload.status === 'failed'
  return (
    <li className={styles.item}>
      <div
        className={`${styles.row} ${styles.treeRow} ${styles.uploadingRow}`}
        style={{ '--depth': depth } as CSSProperties}
      >
        <span className={styles.chevron} aria-hidden="true" />
        <span className={styles.rowThumb}>
          {upload.preview ? <img src={upload.preview} alt="" /> : <UploadIcon aria-hidden="true" size={16} />}
        </span>
        <span className={styles.rowText}>
          <span className={styles.rowName}>{upload.name}</span>
          {broken ? (
            <span className={styles.error}>{t('files.failed', { error: upload.error })}</span>
          ) : (
            <progress
              className={styles.rowProgress}
              value={upload.fraction}
              max={1}
              aria-label={t('files.progress', { name: upload.name })}
            />
          )}
        </span>
        <span className={styles.rowMeta}>{broken ? '' : percent}</span>
        <button
          type="button"
          className={styles.smallGear}
          aria-label={t(broken ? 'files.dismiss' : 'files.cancelUpload', { name: upload.name })}
          title={t(broken ? 'files.dismiss' : 'files.cancelUpload', { name: upload.name })}
          onClick={onCancel}
        >
          <X aria-hidden="true" size={14} />
        </button>
      </div>
    </li>
  )
}
