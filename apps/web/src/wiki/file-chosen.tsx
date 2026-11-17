/** Lo elegido en la lista de archivos: su barra y lo que se hace con todo a la vez (mover, etiquetar, borrar) */

import type { FolderView } from '@crisol/contracts'
import { useMutation } from '@tanstack/react-query'
import { FolderInput, Tag, Trash2 } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import dangerStyles from '../components/danger.module.css'
import dialogStyles from '../components/dialog.module.css'
import { FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import { Modal } from '../components/modal.tsx'
import { FolderField } from './file-dialogs.tsx'
import { isRoot } from './file-tree.ts'
import styles from './files.module.css'
import { addTyped, TagsField, useAccountTags } from './tags.tsx'

/**
 * Lo elegido: cuántos y, para todo a la vez, llevarlo a una carpeta, etiquetar los archivos, borrar (con su aviso) o
 * dejar de elegir. Cada cosa, una sola operación (se deshace de una vez)
 */
export function ChosenBar({
  items,
  folders,
  onMoved,
  onDone,
  onClear
}: {
  /** Lo elegido, con su nombre y su ámbito */
  items: { kind: 'file' | 'folder'; id: string; name: string; worldId: string | null }[]
  /** Todas las carpetas (para elegir adónde se lleva) */
  folders: FolderView[]
  /** Llevado a una carpeta (null: lo más alto): para dejarla abierta */
  onMoved: (folderId: string | null) => void
  onDone: () => Promise<unknown>
  onClear: () => void
}) {
  const { t } = useTranslation()
  const announce = useAnnounce()
  const [open, setOpen] = useState<'move' | 'tag' | 'delete' | null>(null)
  const files = items.filter((item) => item.kind === 'file')
  const folderIds = items.filter((item) => item.kind === 'folder').map((item) => item.id)
  // Lo del mundo y lo común no van juntos a ninguna carpeta
  const scope = items[0]?.worldId ?? null
  const oneScope = items.every((item) => item.worldId === scope)
  const close = () => setOpen(null)
  const finish = async (said: string) => {
    announce(said)
    close()
    await onDone()
  }
  return (
    // biome-ignore lint/a11y/useSemanticElements: una barra de acciones sobre lo elegido
    <div className={styles.chosenBar} role="group" aria-label={t('files.chosenLabel')}>
      <span className={styles.chosenCount}>{t('files.chosen', { count: items.length })}</span>
      <button
        type="button"
        className={styles.chosenAction}
        aria-haspopup="dialog"
        disabled={!oneScope}
        title={oneScope ? undefined : t('files.mixedScope')}
        onClick={() => setOpen('move')}
      >
        <FolderInput aria-hidden="true" size={16} />
        {t('files.moveChosen')}
      </button>
      <button
        type="button"
        className={styles.chosenAction}
        aria-haspopup="dialog"
        disabled={files.length === 0}
        title={files.length === 0 ? t('files.onlyFilesTag') : undefined}
        onClick={() => setOpen('tag')}
      >
        <Tag aria-hidden="true" size={16} />
        {t('files.tagChosen')}
      </button>
      <button type="button" className={styles.chosenDelete} aria-haspopup="dialog" onClick={() => setOpen('delete')}>
        <Trash2 aria-hidden="true" size={16} />
        {t('files.deleteChosen')}
      </button>
      <button type="button" className={dialogStyles.cancel} onClick={onClear}>
        {t('files.cancel')}
      </button>
      {open === 'move' && (
        <MoveChosen
          files={files.map((item) => item.id)}
          folderIds={folderIds}
          scope={scope}
          folders={folders}
          onMoved={async (dest) => {
            onMoved(dest)
            await finish(t('files.movedMany', { count: items.length }))
          }}
          onClose={close}
        />
      )}
      {open === 'tag' && (
        <TagChosen
          fileIds={files.map((item) => item.id)}
          onTagged={(count) => finish(t('files.taggedMany', { count }))}
          onClose={close}
        />
      )}
      {open === 'delete' && (
        <DeleteChosen items={items} onDeleted={(count) => finish(t('files.deletedMany', { count }))} onClose={close} />
      )}
    </div>
  )
}

/** Cuántos nombres dice la confirmación de borrar lo elegido */
export const SHOWN_NAMES = 5

/** Borrar lo elegido: dice qué (hasta cinco por su nombre) y, si hay carpetas, que se van con lo que tienen */
export function DeleteChosen({
  items,
  onDeleted,
  onClose
}: {
  items: { kind: 'file' | 'folder'; id: string; name: string }[]
  onDeleted: (files: number) => Promise<unknown>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const folders = items.filter((item) => item.kind === 'folder').length
  const remove = useMutation({
    mutationFn: async () => {
      const ids = (kind: 'file' | 'folder') => items.filter((item) => item.kind === kind).map((item) => item.id)
      const { files } = await api.call('deleteFiles', { fileIds: ids('file'), folderIds: ids('folder') })
      dialog.current?.close()
      await onDeleted(files)
    }
  })
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={dialogStyles.dialog} onClose={onClose}>
      <div className={dialogStyles.body}>
        <h2 id={titleId}>{t('files.deleteChosenTitle', { count: items.length })}</h2>
        {/* Qué se borra: hasta cinco por su nombre y, si hay más, cuántos */}
        <ul className={styles.chosenNames}>
          {items.slice(0, SHOWN_NAMES).map((item) => (
            <li key={item.id}>{item.name}</li>
          ))}
          {items.length > SHOWN_NAMES && <li>{t('files.andMore', { count: items.length - SHOWN_NAMES })}</li>}
        </ul>
        <p className={dialogStyles.description}>
          {folders > 0 ? t('files.deleteChosenFolders') : t('files.deleteChosenWarning')}
        </p>
        <FormError message={remove.error ? errorText(remove.error) : null} />
        <div className={dialogStyles.actions}>
          <BusyButton className={dangerStyles.solid} busy={remove.isPending} onClick={() => remove.mutate()}>
            {t('files.deleteChosen')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('files.cancel')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** Llevar lo elegido a una carpeta de su ámbito (o a ninguna): una sola operación */
export function MoveChosen({
  files,
  folderIds,
  scope,
  folders,
  onMoved,
  onClose
}: {
  files: string[]
  folderIds: string[]
  /** De qué ámbito es lo elegido (null: los comunes) */
  scope: string | null
  folders: FolderView[]
  onMoved: (folderId: string | null) => Promise<unknown>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  // Lo más alto: para lo común en un mundo, «Comunes» (FolderField); al servidor, sin carpeta
  const [dest, setDest] = useState<string | null>(null)
  const move = useMutation({
    mutationFn: async () => {
      const folderId = isRoot(dest) ? null : dest
      await api.call('moveFiles', { fileIds: files, folderIds, folderId })
      dialog.current?.close()
      await onMoved(dest)
    }
  })
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={dialogStyles.dialog} onClose={onClose}>
      <form
        className={dialogStyles.body}
        onSubmit={(event) => {
          event.preventDefault()
          move.mutate()
        }}
      >
        <h2 id={titleId}>{t('files.moveChosenTitle', { count: files.length + folderIds.length })}</h2>
        <FolderField folders={folders} of={{ worldId: scope }} moving={folderIds} value={dest} onChange={setDest} />
        <FormError message={move.error ? errorText(move.error) : null} />
        <div className={dialogStyles.actions}>
          <BusyButton type="submit" className={form.button} busy={move.isPending}>
            {t('files.moveChosenDo')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('files.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Etiquetar los archivos elegidos: se añaden a las que ya llevan, en una sola operación */
export function TagChosen({
  fileIds,
  onTagged,
  onClose
}: {
  fileIds: string[]
  onTagged: (files: number) => Promise<unknown>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const catalog = useAccountTags().data?.tags.map((tag) => tag.name) ?? []
  const [tags, setTags] = useState<string[]>([])
  // Lo que esté a medio escribir también cuenta (así el campo no cambia justo al pulsar «Etiquetar»)
  const [typed, setTyped] = useState('')
  const wanted = addTyped(tags, typed, catalog)
  const tag = useMutation({
    mutationFn: async () => {
      const { files } = await api.call('addFileTags', { fileIds, tags: wanted })
      dialog.current?.close()
      await onTagged(files)
    }
  })
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={dialogStyles.dialog} onClose={onClose}>
      <form
        className={dialogStyles.body}
        onSubmit={(event) => {
          event.preventDefault()
          if (wanted.length > 0) tag.mutate()
        }}
      >
        <h2 id={titleId}>{t('files.tagChosenTitle', { count: fileIds.length })}</h2>
        <TagsField value={tags} onChange={setTags} onPending={setTyped} />
        <FormError message={tag.error ? errorText(tag.error) : null} />
        <div className={dialogStyles.actions}>
          <BusyButton
            type="submit"
            className={form.button}
            busy={tag.isPending}
            aria-disabled={wanted.length === 0 || undefined}
          >
            {t('files.tagChosenDo')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('files.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
