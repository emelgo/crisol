/**
 * Elegir uno de tus archivos en una ventana: la lista de Archivos (las carpetas se despliegan al pulsarlas), solo con
 * los del tipo pedido y con su buscador por nombre o #etiqueta. En un mundo, los suyos y los comunes dentro de
 * «Comunes»; sin mundo (uno que aún se está creando), los comunes. Pulsar un archivo lo elige y cierra la ventana
 */
import type { FolderView } from '@crisol/contracts'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, File as FileIcon, FileText, Search } from 'lucide-react'
import { type CSSProperties, type ReactNode, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useWorldFiles } from '../wiki/cover-look.ts'
import { foundTree, matches, type Scope, splitScopes, treeOf, withCommon } from '../wiki/file-tree.ts'
import { FolderGlyph } from '../wiki/folder-glyph.tsx'
import type { WorldFile } from '../wiki/links-context.ts'
import { FormError } from './field.tsx'
import styles from './file-picker.module.css'
import { Modal } from './modal.tsx'

export function FilePicker({
  worldId,
  kind,
  title,
  chosenId,
  onPick,
  onClose
}: {
  /** El mundo: sus archivos y los comunes; sin él, solo los comunes */
  worldId?: string | undefined
  /** El tipo que se puede elegir */
  kind: WorldFile['kind']
  title: string
  /** El que ya está elegido: sale marcado y con sus carpetas abiertas */
  chosenId?: string | null | undefined
  onPick: (file: WorldFile) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const world = useWorldFiles(worldId ?? '', Boolean(worldId))
  const common = useQuery({
    queryKey: ['commonFiles'],
    queryFn: () => api.call('listCommonFiles', {}),
    enabled: !worldId
  })
  const listed = worldId ? world : common
  const commonLabel = t('files.common')
  const data = useMemo<Scope | undefined>(() => {
    if (!listed.data) return undefined
    if (!worldId) return listed.data
    const { own, common } = splitScopes(listed.data)
    return withCommon(own, common, { name: commonLabel, organizationId: common.files[0]?.organizationId ?? '' })
  }, [listed.data, worldId, commonLabel])
  const [query, setQuery] = useState('')
  // Las carpetas abiertas: de entrada, las del elegido
  const [expanded, setExpanded] = useState<ReadonlySet<string> | null>(null)
  if (!data) {
    return (
      <Modal ref={dialog} className={styles.picker} aria-labelledby={titleId} onClose={onClose}>
        <div className={styles.body}>
          <h2 id={titleId}>{title}</h2>
          <FormError message={listed.error ? errorText(listed.error) : null} />
        </div>
      </Modal>
    )
  }
  const byId = new Map(data.folders.map((folder) => [folder.id, folder]))
  const pathOf = (folderId: string | null) => {
    const ids = new Set<string>()
    for (let id = folderId; id; id = byId.get(id)?.parentId ?? null) ids.add(id)
    return ids
  }
  const open = expanded ?? pathOf(data.files.find((file) => file.id === chosenId)?.folderId ?? null)
  const ofKind = data.files.filter((file) => file.kind === kind)
  const searching = query.trim() !== ''
  const results = searching ? ofKind.filter((file) => matches(file, query)) : ofKind
  // Solo las carpetas que llevan a algo de su tipo (o a lo encontrado)
  const tree = foundTree(results, treeOf(data), data.folders)
  const isOpen = (id: string) => searching || open.has(id)
  const toggle = (id: string) => {
    const next = new Set(open)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }
  const pick = (file: WorldFile) => {
    onPick(file)
    dialog.current?.close()
  }
  const level = (parentId: string | null, depth: number): ReactNode[] => {
    const entry = tree.get(parentId)
    return [
      ...(entry?.folders ?? []).map((folder) => (
        <FolderItem
          key={folder.id}
          folder={folder}
          depth={depth}
          open={isOpen(folder.id)}
          onToggle={() => toggle(folder.id)}
        >
          {level(folder.id, depth + 1)}
        </FolderItem>
      )),
      ...(entry?.files ?? []).map((file) => (
        <li key={file.id} className={styles.item}>
          <button
            type="button"
            className={styles.row}
            style={{ '--depth': depth } as CSSProperties}
            aria-current={file.id === chosenId || undefined}
            onClick={() => pick(file)}
          >
            <span className={styles.chevron} aria-hidden="true" />
            <span className={styles.thumb}>
              <Thumb file={file} />
            </span>
            <span className={styles.name}>{file.name}</span>
          </button>
        </li>
      ))
    ]
  }
  const rows = level(null, 0)
  return (
    <Modal ref={dialog} className={styles.picker} aria-labelledby={titleId} onClose={onClose}>
      <div className={styles.body}>
        <h2 id={titleId}>{title}</h2>
        <label className={styles.search}>
          <Search aria-hidden="true" size={16} />
          <input
            type="search"
            data-autofocus=""
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            aria-label={t('files.search')}
            placeholder={t('files.search')}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>
        {rows.length > 0 ? (
          <ul className={styles.rows} aria-label={title}>
            {rows}
          </ul>
        ) : (
          <p className={styles.empty} role="status">
            {!searching
              ? t(`filePicker.none.${kind}`)
              : query.trim().startsWith('#')
                ? t('files.noMatch')
                : t('files.noResults')}
          </p>
        )}
      </div>
    </Modal>
  )
}

/** Una carpeta: pulsarla la despliega con lo de dentro sangrado */
function FolderItem({
  folder,
  depth,
  open,
  onToggle,
  children
}: {
  folder: FolderView
  depth: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <li className={styles.item}>
      <button
        type="button"
        className={styles.row}
        style={{ '--depth': depth } as CSSProperties}
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className={styles.chevron} data-open={open} aria-hidden="true">
          <ChevronRight size={14} />
        </span>
        <span className={styles.folderThumb} aria-hidden="true">
          <FolderGlyph folder={folder} open={open} strokeWidth={1.5} />
        </span>
        <span className={styles.name}>{folder.name}</span>
      </button>
      {open && (
        <ul className={styles.kids} style={{ '--depth': depth } as CSSProperties}>
          {children}
        </ul>
      )}
    </li>
  )
}

/** La miniatura: la imagen o, si no lo es, su icono */
function Thumb({ file }: { file: WorldFile }) {
  if (file.kind === 'image') return <img src={file.url} alt="" loading="lazy" />
  return file.kind === 'pdf' ? (
    <FileText aria-hidden="true" size={18} strokeWidth={1.25} />
  ) : (
    <FileIcon aria-hidden="true" size={18} strokeWidth={1.25} />
  )
}
