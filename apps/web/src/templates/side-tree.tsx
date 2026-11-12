/**
 * «Tus plantillas», a la izquierda del editor (ADR-0024): el árbol de carpetas y plantillas, como el de las páginas de
 * un mundo. Las carpetas se pliegan; con el botón derecho (o la tecla de menú, o Mayús+F10), lo de cada cosa: de una
 * plantilla, duplicarla, sus ajustes y borrarla; de una carpeta, crear dentro, sus ajustes y borrarla; en el hueco,
 * crear (Enrique, 2026-11-12: «habilita el botón secundario en el árbol para poder eliminar plantillas»)
 */
import type { TemplateView as Listed, TemplateFolder } from '@crisol/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronRight, Copy, FilePlus, FolderPlus, Settings, Trash2 } from 'lucide-react'
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { SECTION } from '../components/world-transition.ts'
import { FolderGlyph } from '../wiki/folder-glyph.tsx'
import menuStyles from '../wiki/tree-menu.module.css'
import styles from './editor.module.css'
import { TemplateIcon } from './icons.tsx'
import { useNewTemplate } from './new-template.ts'
import { NewTemplateDialog } from './new-template-dialog.tsx'
import { NewFolderDialog, TemplateFolderDialog, TemplateSettings } from './screen.tsx'
import { treeOf } from './tree.ts'

type Target = { kind: 'template'; template: Listed } | { kind: 'folder'; folder: TemplateFolder } | { kind: 'empty' }

/** Lo que se abre desde el árbol (o desde su cabecera): un cuadro cada vez */
export type SideDialog =
  | { kind: 'new-template'; folderId: string | null }
  | { kind: 'new-folder'; parentId: string | null; label: string }
  | { kind: 'template'; template: Listed }
  | { kind: 'folder'; folder: TemplateFolder }

export function TemplateSideTree({
  folders,
  templates,
  current,
  onDialog
}: {
  folders: readonly TemplateFolder[]
  templates: readonly Listed[]
  current: string | undefined
  onDialog: (dialog: SideDialog) => void
}) {
  const { t } = useTranslation()
  const tree = treeOf(folders, templates)
  // Las carpetas plegadas (de entrada, todas abiertas)
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set())
  const [menu, setMenu] = useState<{ at: { x: number; y: number }; target: Target; from: HTMLElement | null } | null>(
    null
  )
  const open = (target: Target) => (event: MouseEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ at: { x: event.clientX, y: event.clientY }, target, from: event.currentTarget })
  }
  // Con el teclado: la tecla de menú o Mayús+F10, junto a la fila
  const openByKey = (target: Target) => (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
    event.preventDefault()
    const box = event.currentTarget.getBoundingClientRect()
    setMenu({ at: { x: box.left + 16, y: box.bottom }, target, from: event.currentTarget })
  }
  // ¿La abierta está dentro de esa carpeta (a cualquier hondura)?
  const holdsCurrent = (folderId: string) => {
    const open = templates.find((each) => each.id === current)
    const parentOf = new Map(folders.map((folder) => [folder.id, folder.parentId]))
    for (let id = open?.folderId ?? null; id; id = parentOf.get(id) ?? null) if (id === folderId) return true
    return false
  }
  const level = (parentId: string | null): ReactNode => {
    const here = tree.get(parentId)
    if (!here) return null
    return (
      <>
        {here.folders.map((folder) => {
          const folded = closed.has(folder.id)
          return (
            <li key={folder.id}>
              <button
                type="button"
                className={styles.folderRow}
                aria-expanded={!folded}
                onClick={() =>
                  setClosed((now) => {
                    const next = new Set(now)
                    if (folded) next.delete(folder.id)
                    else next.add(folder.id)
                    return next
                  })
                }
                onContextMenu={open({ kind: 'folder', folder })}
                onKeyDown={openByKey({ kind: 'folder', folder })}
              >
                <ChevronRight aria-hidden="true" size={14} className={styles.chevron} />
                <FolderGlyph folder={folder} open={!folded} size={16} />
                <span>{folder.name}</span>
              </button>
              {!folded && <ul className={styles.links}>{level(folder.id)}</ul>}
            </li>
          )
        })}
        {here.templates.map((each) => (
          <li key={each.id}>
            <Link
              to="/plantillas/$templateId"
              params={{ templateId: each.id }}
              aria-current={each.id === current ? 'page' : undefined}
              // De una a otra, como entre pestañas: rápido
              viewTransition={SECTION}
              onContextMenu={open({ kind: 'template', template: each })}
              onKeyDown={openByKey({ kind: 'template', template: each })}
            >
              <TemplateIcon icon={each.icon} size={15} />
              <span>{each.name}</span>
            </Link>
          </li>
        ))}
      </>
    )
  }
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: el botón derecho en el hueco crea; con el teclado, en la cabecera
    <div className={styles.sideTree} onContextMenu={open({ kind: 'empty' })}>
      <ul className={`${styles.links} ${styles.treeRoot}`}>{level(null)}</ul>
      {menu && (
        <SideMenu
          at={menu.at}
          target={menu.target}
          holdsCurrent={
            menu.target.kind === 'template'
              ? menu.target.template.id === current
              : menu.target.kind === 'folder' && holdsCurrent(menu.target.folder.id)
          }
          onDialog={onDialog}
          label={
            menu.target.kind === 'template'
              ? t('templates.menuOf', { name: menu.target.template.name })
              : menu.target.kind === 'folder'
                ? t('templates.menuOf', { name: menu.target.folder.name })
                : t('templates.listLabel')
          }
          onClose={(returnFocus) => {
            const from = menu.from
            setMenu(null)
            if (returnFocus) from?.focus()
          }}
        />
      )}
    </div>
  )
}

/** El menú del botón derecho: flota junto al ratón, como el del árbol de páginas (y con su aspecto) */
function SideMenu({
  at,
  target,
  holdsCurrent,
  label,
  onDialog,
  onClose
}: {
  at: { x: number; y: number }
  target: Target
  /** Lo que se borraría es (o lleva dentro) la plantilla abierta: borrado, a la lista */
  holdsCurrent: boolean
  label: string
  onDialog: (dialog: SideDialog) => void
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
  const [confirming, setConfirming] = useState(false)
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
  }, [at, confirming])
  // El foco dentro al abrirse (y al pasar a confirmar); un clic fuera lo cierra
  useEffect(() => {
    box.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [confirming])
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) close.current()
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [])
  const remove = useMutation({
    mutationFn: async () => {
      if (target.kind === 'template') await api.call('deleteTemplate', { templateId: target.template.id })
      else if (target.kind === 'folder') await api.call('deleteTemplateFolder', { folderId: target.folder.id })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['templates'] })
      const name =
        target.kind === 'template' ? target.template.name : target.kind === 'folder' ? target.folder.name : ''
      announce(t('templates.deleted', { name }))
      onClose()
      // La abierta ya no está (o estaba en la carpeta borrada): a la lista
      if (holdsCurrent) await navigate({ to: '/plantillas' })
    }
  })
  const dialog = (next: SideDialog) => () => {
    onClose()
    onDialog(next)
  }
  const item = (icon: ReactNode, text: string, onClick: () => void, danger = false) => (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      className={menuStyles.item}
      data-danger={danger || undefined}
      onClick={onClick}
    >
      {icon}
      <span>{text}</span>
    </button>
  )
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (confirming) setConfirming(false)
      else onClose(true)
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      onClose(true)
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    const index = items.indexOf(document.activeElement as HTMLElement)
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
  }
  return createPortal(
    <div
      ref={box}
      role="menu"
      aria-label={label}
      className={menuStyles.menu}
      style={{ left: place.x, top: place.y }}
      onKeyDown={onKeyDown}
    >
      {!confirming && target.kind === 'template' && (
        <>
          {item(<Copy aria-hidden="true" size={15} />, t('templates.duplicate'), () =>
            copy.mutate({ copyOf: target.template }, { onSuccess: () => onClose() })
          )}
          {item(
            <Settings aria-hidden="true" size={15} />,
            t('templates.settings'),
            dialog({ kind: 'template', template: target.template })
          )}
          <div className={menuStyles.separator} />
          {item(<Trash2 aria-hidden="true" size={15} />, t('treeMenu.delete'), () => setConfirming(true), true)}
        </>
      )}
      {!confirming && target.kind === 'folder' && (
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
          <div className={menuStyles.separator} />
          {item(<Trash2 aria-hidden="true" size={15} />, t('treeMenu.delete'), () => setConfirming(true), true)}
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
      {confirming && target.kind !== 'empty' && (
        <div className={menuStyles.confirm}>
          <p>
            {target.kind === 'template'
              ? `${t('templates.deleteTitle', { name: target.template.name })} ${t('templates.deleteWarning')}`
              : `${t('templates.deleteFolderTitle', { name: target.folder.name })} ${t('templates.deleteFolderWarning')}`}
          </p>
          {item(
            <Trash2 aria-hidden="true" size={15} />,
            target.kind === 'template' ? t('templates.delete') : t('templates.deleteFolder'),
            () => remove.mutate(),
            true
          )}
        </div>
      )}
      {(remove.error || copy.errorText) && (
        <p className={menuStyles.error}>{remove.error ? errorText(remove.error) : copy.errorText}</p>
      )}
    </div>,
    document.body
  )
}

/** El cuadro que se pidió desde el árbol o su cabecera */
export function SideDialogView({
  dialog,
  folders,
  onClose
}: {
  dialog: SideDialog
  folders: readonly TemplateFolder[]
  onClose: () => void
}) {
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const move = async (body: () => Promise<unknown>) => {
    await body()
    await queryClient.invalidateQueries({ queryKey: ['templates'] })
  }
  if (dialog.kind === 'new-template') return <NewTemplateDialog folderId={dialog.folderId} onClose={onClose} />
  if (dialog.kind === 'new-folder')
    return <NewFolderDialog label={dialog.label} parentId={dialog.parentId} onClose={onClose} />
  if (dialog.kind === 'folder')
    return (
      <TemplateFolderDialog
        folder={dialog.folder}
        folders={[...folders]}
        onMove={(dest) =>
          void move(() => api.call('updateTemplateFolder', { folderId: dialog.folder.id, parentId: dest }))
        }
        onClose={onClose}
      />
    )
  return (
    <TemplateSettings
      template={dialog.template}
      // Su carpeta, también desde aquí
      folder={{
        folders: [...folders],
        value: dialog.template.folderId,
        onMove: (dest) => void move(() => api.call('moveTemplate', { templateId: dialog.template.id, folderId: dest }))
      }}
      onClose={(gone) => {
        onClose()
        if (gone) void navigate({ to: '/plantillas' })
      }}
    />
  )
}
