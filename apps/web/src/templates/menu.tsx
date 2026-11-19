/**
 * El menú de una plantilla o de una carpeta de plantillas, con el botón derecho (o la tecla de menú, o Mayús+F10, o su
 * «⋯»), como el del árbol de páginas y con su aspecto (Enrique, 2026-11-19: «ponlos con botón secundario sobre la
 * plantilla como en páginas»). De una plantilla: renombrar, duplicar, moverla a una carpeta y borrarla (su icono, en su
 * título). De una carpeta: crear dentro, sus ajustes y borrarla. En el hueco: crear. Flota junto al ratón
 */
import type { TemplateView as Listed, TemplateFolder } from '@crisol/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ChevronRight, Copy, FilePlus, FolderInput, FolderPlus, Pencil, Settings, Trash2 } from 'lucide-react'
import { type KeyboardEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { plain } from '../wiki/file-tree.ts'
import styles from '../wiki/tree-menu.module.css'
import { useNewTemplate } from './new-template.ts'
import { treeOf } from './tree.ts'

export type MenuTarget =
  | { kind: 'template'; template: Listed }
  | { kind: 'folder'; folder: TemplateFolder }
  | { kind: 'empty' }

/** Lo que se abre desde el menú: un cuadro cada vez */
export type MenuDialog =
  | { kind: 'new-template'; folderId: string | null }
  | { kind: 'new-folder'; parentId: string | null; label: string }
  | { kind: 'folder'; folder: TemplateFolder }

type View = 'menu' | 'rename' | 'delete'

/** Las carpetas con su camino («Campaña › Frentes»), en el orden del árbol */
function folderPaths(folders: readonly TemplateFolder[]) {
  const tree = treeOf(folders, [])
  const paths: { id: string; name: string; path: string }[] = []
  const walk = (parentId: string | null, above: string[]) => {
    for (const folder of tree.get(parentId)?.folders ?? []) {
      paths.push({ id: folder.id, name: folder.name, path: above.join(' › ') })
      walk(folder.id, [...above, folder.name])
    }
  }
  walk(null, [])
  return paths
}

export function TemplateMenu({
  at,
  target,
  folders,
  holdsCurrent = false,
  onDialog,
  onMove,
  onClose
}: {
  at: { x: number; y: number }
  target: MenuTarget
  folders: readonly TemplateFolder[]
  /** Lo que se borraría es (o lleva dentro) la plantilla abierta: borrado, a la lista */
  holdsCurrent?: boolean
  onDialog: (dialog: MenuDialog) => void
  /** Mover la plantilla a una carpeta (null: fuera de las carpetas) */
  onMove: (template: Listed, folderId: string | null) => void
  onClose: (returnFocus?: boolean) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const copy = useNewTemplate()
  const box = useRef<HTMLDivElement>(null)
  const flyout = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>('menu')
  const [moving, setMoving] = useState(false)
  const [filter, setFilter] = useState('')
  const [name, setName] = useState(target.kind === 'template' ? target.template.name : '')
  const [place, setPlace] = useState(at)
  const close = useRef(onClose)
  close.current = onClose
  // Que no se salga de la pantalla
  useLayoutEffect(() => {
    const rect = box.current?.getBoundingClientRect()
    if (!rect) return
    setPlace({
      x: Math.max(8, Math.min(at.x, window.innerWidth - rect.width - 8)),
      y: Math.max(8, Math.min(at.y, window.innerHeight - rect.height - 8))
    })
  }, [at, view])
  // El foco dentro al abrirse (y al cambiar de vista); un clic fuera lo cierra
  useEffect(() => {
    box.current?.querySelector<HTMLElement>('input, [role="menuitem"]')?.focus()
  }, [view])
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) close.current()
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [])
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['templates'] })
  // Su nombre es el título de su página: el servidor cambia los dos
  const rename = useMutation({
    mutationFn: async (next: string) => {
      if (target.kind !== 'template') return
      await api.call('updateTemplate', { templateId: target.template.id, name: next })
      await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ['pages'] })])
    },
    onSuccess: () => onClose(true)
  })
  const remove = useMutation({
    mutationFn: async () => {
      if (target.kind === 'template') await api.call('deleteTemplate', { templateId: target.template.id })
      else if (target.kind === 'folder') await api.call('deleteTemplateFolder', { folderId: target.folder.id })
    },
    onSuccess: async () => {
      await refresh()
      const gone =
        target.kind === 'template' ? target.template.name : target.kind === 'folder' ? target.folder.name : ''
      announce(t('templates.deleted', { name: gone }))
      onClose()
      // La abierta ya no está (o estaba en la carpeta borrada): a la lista
      if (holdsCurrent) await navigate({ to: '/plantillas' })
    }
  })
  const dialog = (next: MenuDialog) => () => {
    onClose()
    onDialog(next)
  }
  const openMoving = () => {
    setMoving(true)
    requestAnimationFrame(() => flyout.current?.querySelector<HTMLElement>('input')?.focus())
  }
  const item = (
    icon: ReactNode,
    text: string,
    onClick: () => void,
    extra?: { danger?: boolean; sub?: boolean; path?: string }
  ) => (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      className={styles.item}
      data-danger={extra?.danger || undefined}
      aria-haspopup={extra?.sub ? 'menu' : undefined}
      aria-expanded={extra?.sub ? moving : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (extra?.sub && event.key === 'ArrowRight') {
          event.preventDefault()
          openMoving()
        }
      }}
    >
      {icon}
      <span>{text}</span>
      {extra?.path && <span className={styles.path}>{extra.path}</span>}
      {extra?.sub && <ChevronRight aria-hidden="true" size={14} className={styles.more} />}
    </button>
  )
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (moving) {
        setMoving(false)
        event.currentTarget.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.focus()
      } else if (view === 'menu') onClose(true)
      else setView('menu')
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      onClose(true)
      return
    }
    const inFlyout = (document.activeElement as HTMLElement | null)?.closest('[data-flyout]') ?? null
    if (event.key === 'ArrowLeft' && inFlyout) {
      event.preventDefault()
      setMoving(false)
      event.currentTarget.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.focus()
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    // Las de su nivel: las del desplegable si se está en él; si no, las del menú
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')].filter(
      (element) => element.closest('[data-flyout]') === inFlyout
    )
    const index = items.indexOf(document.activeElement as HTMLElement)
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    event.preventDefault()
    items[next]?.focus()
  }
  const label =
    target.kind === 'template'
      ? t('templates.menuOf', { name: target.template.name })
      : target.kind === 'folder'
        ? t('templates.menuOf', { name: target.folder.name })
        : t('templates.listLabel')
  const wanted = plain(filter.trim())
  const here = target.kind === 'template' ? target.template.folderId : null
  const destinations = folderPaths(folders)
    .filter((folder) => folder.id !== here)
    .filter((folder) => !wanted || plain(folder.name).includes(wanted))
    .slice(0, 30)
  const error = rename.error ?? remove.error
  return createPortal(
    <div
      ref={box}
      role="menu"
      aria-label={label}
      className={styles.menu}
      style={{ left: place.x, top: place.y }}
      onKeyDown={onKeyDown}
    >
      {view === 'menu' && target.kind === 'template' && (
        <>
          {item(<Pencil aria-hidden="true" size={15} />, t('treeMenu.rename'), () => setView('rename'))}
          {item(<Copy aria-hidden="true" size={15} />, t('templates.duplicate'), () =>
            copy.mutate({ copyOf: target.template }, { onSuccess: () => onClose() })
          )}
          {folders.length > 0 && (
            // biome-ignore lint/a11y/noStaticElementInteractions: con el teclado se abre con la flecha derecha
            <div className={styles.subWrap} onMouseEnter={() => setMoving(true)} onMouseLeave={() => setMoving(false)}>
              {item(<FolderInput aria-hidden="true" size={15} />, t('templates.moveTo'), openMoving, { sub: true })}
              {moving && (
                <div
                  ref={flyout}
                  className={styles.flyout}
                  data-flyout=""
                  role="menu"
                  aria-label={t('templates.moveTo')}
                >
                  <input
                    className={styles.search}
                    value={filter}
                    placeholder={t('templates.moveSearch')}
                    aria-label={t('templates.moveSearch')}
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    data-form-type="other"
                    onChange={(event) => setFilter(event.currentTarget.value)}
                  />
                  <div className={styles.list}>
                    {here &&
                      item(<FolderInput aria-hidden="true" size={15} />, t('templates.moveOut'), () => {
                        onClose(true)
                        onMove(target.template, null)
                      })}
                    {destinations.map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        role="menuitem"
                        tabIndex={-1}
                        className={styles.item}
                        onClick={() => {
                          onClose(true)
                          onMove(target.template, folder.id)
                        }}
                      >
                        <span>{folder.name}</span>
                        {folder.path && <span className={styles.path}>{folder.path}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className={styles.separator} />
          {item(<Trash2 aria-hidden="true" size={15} />, t('treeMenu.delete'), () => setView('delete'), {
            danger: true
          })}
        </>
      )}
      {view === 'menu' && target.kind === 'folder' && (
        <>
          {item(
            <FilePlus aria-hidden="true" size={15} />,
            t('templates.newHere'),
            dialog({ kind: 'new-template', folderId: target.folder.id })
          )}
          {item(
            <FolderPlus aria-hidden="true" size={15} />,
            t('templates.newFolderHere'),
            dialog({
              kind: 'new-folder',
              parentId: target.folder.id,
              label: t('templates.newFolderIn', { folder: target.folder.name })
            })
          )}
          {item(
            <Settings aria-hidden="true" size={15} />,
            t('templates.folderSettings'),
            dialog({ kind: 'folder', folder: target.folder })
          )}
          <div className={styles.separator} />
          {item(<Trash2 aria-hidden="true" size={15} />, t('treeMenu.delete'), () => setView('delete'), {
            danger: true
          })}
        </>
      )}
      {target.kind === 'empty' && (
        <>
          {item(
            <FilePlus aria-hidden="true" size={15} />,
            t('templates.new'),
            dialog({ kind: 'new-template', folderId: null })
          )}
          {item(
            <FolderPlus aria-hidden="true" size={15} />,
            t('templates.newFolder'),
            dialog({ kind: 'new-folder', parentId: null, label: t('templates.newFolder') })
          )}
        </>
      )}
      {view === 'rename' && target.kind === 'template' && (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            const next = name.trim()
            if (next && next !== target.template.name) rename.mutate(next)
            else onClose(true)
          }}
        >
          <input
            value={name}
            maxLength={60}
            aria-label={t('templates.newName')}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            onChange={(event) => setName(event.currentTarget.value)}
            onFocus={(event) => event.currentTarget.select()}
          />
        </form>
      )}
      {view === 'delete' && target.kind !== 'empty' && (
        <div className={styles.confirm}>
          <p>
            {target.kind === 'template'
              ? `${t('templates.deleteTitle', { name: target.template.name })} ${t('templates.deleteWarning')}`
              : `${t('templates.deleteFolderTitle', { name: target.folder.name })} ${t('templates.deleteFolderWarning')}`}
          </p>
          {item(
            <Trash2 aria-hidden="true" size={15} />,
            target.kind === 'template' ? t('templates.delete') : t('templates.deleteFolder'),
            () => remove.mutate(),
            { danger: true }
          )}
        </div>
      )}
      {(error || copy.errorText) && <p className={styles.error}>{error ? errorText(error) : copy.errorText}</p>}
    </div>,
    document.body
  )
}
