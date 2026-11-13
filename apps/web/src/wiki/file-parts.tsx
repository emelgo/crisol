/** Piezas de un archivo: su miniatura, su nombre, sus etiquetas y su vista previa (también la de una carpeta) */

import type { FolderView } from '@crisol/contracts'
import { File as FileIcon, FileText } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CoverViewer } from '../routes/world-cover.tsx'
import styles from './files.module.css'
import { FolderGlyph } from './folder-glyph.tsx'
import type { WorldFile } from './links-context.ts'
import tagStyles from './tags.module.css'
import { TagChip, useTagColor } from './tags.tsx'

/** Las etiquetas de un archivo, en su fila */
export function FileTags({ tags }: { tags: readonly string[] }) {
  const colorOf = useTagColor()
  if (tags.length === 0) return null
  return (
    <span className={tagStyles.rowChips}>
      {tags.map((tag) => (
        <TagChip key={tag} name={tag} color={colorOf(tag)} />
      ))}
    </span>
  )
}

/** De qué tipo es, para decirlo: por su clase y, entre los demás, por su mime */
export const typeOf = (file: WorldFile) =>
  file.kind !== 'other'
    ? file.kind
    : file.mime.startsWith('audio/')
      ? 'audio'
      : file.mime.startsWith('video/')
        ? 'video'
        : file.mime.startsWith('text/') || file.mime === 'application/json'
          ? 'text'
          : 'other'

/**
 * El archivo bajo el ratón, en la vista previa de la izquierda: grande, su nombre, de qué tipo es, sus medidas si es
 * una imagen, cuánto pesa, dónde está y cuándo cambió (abrirlo y lo demás, en su fila)
 */
export function FileDetail({ file, where }: { file: WorldFile; where: FolderView[] }) {
  const { t, i18n } = useTranslation()
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })
  // Las medidas de una imagen, al cargarla en la vista previa
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  useEffect(() => setSize(null), [file.id])
  return (
    <div className={styles.detailBody}>
      <div className={styles.preview}>
        {file.kind === 'image' ? (
          <img
            src={file.url}
            alt=""
            onLoad={(event) =>
              setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
            }
          />
        ) : (
          <Thumb file={file} />
        )}
      </div>
      <h2 className={styles.detailName}>{file.name}</h2>
      <dl className={styles.facts}>
        <dt>{t('files.kindLabel')}</dt>
        <dd>{t(`files.types.${typeOf(file)}`)}</dd>
        {size && (
          <>
            <dt>{t('files.dimensions')}</dt>
            <dd>{t('files.pixels', { width: size.width, height: size.height })}</dd>
          </>
        )}
        <dt>{t('files.sizeLabel')}</dt>
        <dd>{sizeText(file.size, i18n.language)}</dd>
        {where.length > 0 && (
          <>
            <dt>{t('files.folder')}</dt>
            <dd>{where.map((folder) => folder.name).join(' › ')}</dd>
          </>
        )}
        {/* Dónde se usa, antes de pensar en borrarlo */}
        {file.usedBy > 0 && (
          <>
            <dt>{t('files.usedLabel')}</dt>
            <dd>{t('files.usedBy', { count: file.usedBy })}</dd>
          </>
        )}
        <dt>{t('files.updatedLabel')}</dt>
        <dd>{date.format(new Date(file.updatedAt))}</dd>
      </dl>
    </div>
  )
}

/** Todo lo que hay dentro de una carpeta, también en las suyas: archivos y carpetas */
export function contentsOf(folderId: string, files: WorldFile[], folders: FolderView[]) {
  const inside = new Set([folderId])
  for (let grew = true; grew; ) {
    grew = false
    for (const folder of folders) {
      if (folder.parentId && inside.has(folder.parentId) && !inside.has(folder.id)) {
        inside.add(folder.id)
        grew = true
      }
    }
  }
  return {
    files: files.filter((file) => file.folderId && inside.has(file.folderId)),
    subfolders: inside.size - 1
  }
}

/**
 * La carpeta bajo el ratón, en la vista previa de la izquierda: cuántos archivos y carpetas tiene, cuánto ocupa todo,
 * de qué tipos y sus primeras imágenes
 */
export function FolderDetail({
  folder,
  files,
  folders
}: {
  folder: FolderView
  files: WorldFile[]
  folders: FolderView[]
}) {
  const { t, i18n } = useTranslation()
  const inside = contentsOf(folder.id, files, folders)
  const total = inside.files.reduce((sum, file) => sum + file.size, 0)
  const byType = Map.groupBy(inside.files, typeOf)
  const images = inside.files.filter((file) => file.kind === 'image').slice(0, 4)
  return (
    <div className={styles.detailBody}>
      <div className={`${styles.preview} ${styles.folderPreview}`}>
        <FolderGlyph folder={folder} open size={56} strokeWidth={1.25} />
      </div>
      <h2 className={styles.detailName}>{folder.name}</h2>
      <dl className={styles.facts}>
        <dt>{t('files.filesLabel')}</dt>
        <dd>
          {inside.files.length > 0 ? t('files.folderFiles', { count: inside.files.length }) : t('files.folderEmpty')}
        </dd>
        {inside.subfolders > 0 && (
          <>
            <dt>{t('files.foldersLabel')}</dt>
            <dd>{t('files.folderFolders', { count: inside.subfolders })}</dd>
          </>
        )}
        {total > 0 && (
          <>
            <dt>{t('files.sizeLabel')}</dt>
            <dd>{sizeText(total, i18n.language)}</dd>
          </>
        )}
        {byType.size > 0 && (
          <>
            <dt>{t('files.kindLabel')}</dt>
            <dd>{[...byType].map(([type, list]) => t(`files.counts.${type}`, { count: list.length })).join(' · ')}</dd>
          </>
        )}
      </dl>
      {images.length > 0 && (
        <div className={styles.minigrid}>
          {images.map((file) => (
            <img key={file.id} src={file.url} alt="" loading="lazy" />
          ))}
        </div>
      )}
    </div>
  )
}

export const sizeText = (bytes: number, locale: string) => {
  const [value, unit] =
    bytes >= 1024 * 1024 ? [bytes / (1024 * 1024), 'megabyte'] : [Math.max(bytes / 1024, 0.1), 'kilobyte']
  return new Intl.NumberFormat(locale, { style: 'unit', unit, maximumFractionDigits: 1 }).format(value)
}

/** La miniatura: la imagen o, si no lo es, su icono */
export function Thumb({ file, small = false }: { file: WorldFile; small?: boolean }) {
  if (file.kind === 'image') return <img src={file.url} alt="" loading="lazy" />
  const size = small ? 18 : 40
  return file.kind === 'pdf' ? (
    <FileText aria-hidden="true" size={size} strokeWidth={1.25} />
  ) : (
    <FileIcon aria-hidden="true" size={size} strokeWidth={1.25} />
  )
}

/** El nombre de un archivo, que lo abre (toda su fila): una imagen, en grande; lo demás, en otra pestaña */
export function FileName({
  file,
  className,
  onOpen,
  current = false
}: {
  file: WorldFile
  className: string | undefined
  /** Abrirlo en el centro del mundo a pantalla completa (ADR-0027) */
  onOpen?: (() => void) | undefined
  current?: boolean
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const [viewing, setViewing] = useState(false)
  if (onOpen) {
    return (
      <button
        type="button"
        className={[className, styles.open].filter(Boolean).join(' ')}
        data-row-open=""
        aria-current={current ? 'page' : undefined}
        onClick={onOpen}
      >
        {file.name}
      </button>
    )
  }
  return (
    <>
      {file.kind === 'image' ? (
        <button
          ref={trigger}
          type="button"
          className={[className, styles.open].filter(Boolean).join(' ')}
          aria-haspopup="dialog"
          data-row-open=""
          onClick={() => setViewing(true)}
        >
          {file.name}
        </button>
      ) : (
        <a
          href={file.url}
          className={className}
          data-row-open=""
          target="_blank"
          rel="noopener"
          {...(file.kind === 'other' ? { download: file.name } : {})}
        >
          {file.name}
        </a>
      )}
      {viewing && (
        <CoverViewer
          url={file.url}
          label={file.name}
          onClose={() => {
            setViewing(false)
            trigger.current?.focus()
          }}
        />
      )}
    </>
  )
}
