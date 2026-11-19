/**
 * «Tus plantillas», a la izquierda del editor (ADR-0024): el árbol de carpetas y plantillas, como el de las páginas de
 * un mundo. Las carpetas se pliegan; con el botón derecho (o la tecla de menú, o Mayús+F10), lo de cada cosa (menu.tsx):
 * de una plantilla, renombrarla, duplicarla, moverla y borrarla; de una carpeta, crear dentro, sus ajustes y borrarla;
 * en el hueco, crear (Enrique, 2026-11-12: «habilita el botón secundario en el árbol para poder eliminar plantillas»)
 */
import type { TemplateView as Listed, TemplateFolder } from '@crisol/contracts'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { type KeyboardEvent, type MouseEvent, type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { SECTION } from '../components/world-transition.ts'
import { FolderGlyph } from '../wiki/folder-glyph.tsx'
import styles from './editor.module.css'
import { TemplateIcon } from './icons.tsx'
import { type MenuDialog, type MenuTarget, TemplateMenu } from './menu.tsx'
import { NewTemplateDialog } from './new-template-dialog.tsx'
import { NewFolderDialog, TemplateFolderDialog } from './screen.tsx'
import { treeOf } from './tree.ts'

type Target = MenuTarget

/** Lo que se abre desde el árbol (o desde su cabecera): un cuadro cada vez */
export type SideDialog = MenuDialog

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
  const api = useApi()
  const queryClient = useQueryClient()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const [moveError, setMoveError] = useState<string | null>(null)
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
      {moveError && (
        <p role="alert" className={styles.muted}>
          {moveError}
        </p>
      )}
      {menu && (
        <TemplateMenu
          at={menu.at}
          target={menu.target}
          folders={folders}
          holdsCurrent={
            menu.target.kind === 'template'
              ? menu.target.template.id === current
              : menu.target.kind === 'folder' && holdsCurrent(menu.target.folder.id)
          }
          onDialog={onDialog}
          onMove={(template, folderId) => {
            setMoveError(null)
            void api
              .call('moveTemplate', { templateId: template.id, folderId })
              .then(async () => {
                await queryClient.invalidateQueries({ queryKey: ['templates'] })
                const folder = folders.find((each) => each.id === folderId)
                announce(
                  folder
                    ? t('files.moved', { name: template.name, folder: folder.name })
                    : t('files.movedToTop', { name: template.name })
                )
              })
              .catch((error: unknown) => setMoveError(errorText(error)))
          }}
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
  const move = async (body: () => Promise<unknown>) => {
    await body()
    await queryClient.invalidateQueries({ queryKey: ['templates'] })
  }
  if (dialog.kind === 'new-template') return <NewTemplateDialog folderId={dialog.folderId} onClose={onClose} />
  if (dialog.kind === 'new-folder')
    return <NewFolderDialog label={dialog.label} parentId={dialog.parentId} onClose={onClose} />
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
}
