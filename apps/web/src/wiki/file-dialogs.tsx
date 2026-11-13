/** Las ventanas de un archivo y de una carpeta (sus ajustes), «Nueva carpeta» y el campo «Carpeta» */

import type { FolderView } from '@crisol/contracts'
import { TRASH_DAYS } from '@crisol/domain'
import { useMutation } from '@tanstack/react-query'
import { FolderPlus, Settings } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from '../components/busy-button.tsx'
import { ChangesBar } from '../components/changes.tsx'
import { ConfirmByName, DangerZone } from '../components/danger.tsx'
import dialogStyles from '../components/dialog.module.css'
import { Field, FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import { Modal } from '../components/modal.tsx'
import { NewCard } from '../components/new-card.tsx'
import cards from '../routes/world-card.module.css'
import { ColorChoices } from '../routes/world-card.tsx'
import { Thumb } from './file-parts.tsx'
import { folderChoices, isRoot } from './file-tree.ts'
import type { Target } from './file-uploads.ts'
import styles from './files.module.css'
import { FolderGlyph } from './folder-glyph.tsx'
import { IconChoices } from './icon.tsx'
import type { WorldFile } from './links-context.ts'
import { addTyped, TagsField, useAccountTags } from './tags.tsx'

/** «Nueva carpeta» (dentro de parentId): una fila más al final de la lista, y su cuadro con el nombre */
export function NewFolder({
  target,
  parentId,
  label,
  shape = 'row',
  onCreated
}: {
  target: Target
  parentId: string | null
  /** «Nueva carpeta» (al final de la lista, en lo más alto) o «Nueva carpeta en …» (el icono de una carpeta) */
  label: string
  /** row: la fila del final; icon: el botón pequeño de una carpeta */
  shape?: 'row' | 'icon'
  onCreated: () => Promise<unknown>
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const trigger = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const create = useMutation({
    mutationFn: async () => {
      await api.call('createFolder', { ...target, parentId, name: name.trim() })
      await onCreated()
    },
    onSuccess: () => dialog.current?.close()
  })
  return (
    <>
      {shape === 'icon' ? (
        <button
          ref={trigger}
          type="button"
          className={styles.smallGear}
          aria-label={label}
          title={t('files.newFolderHere')}
          aria-haspopup="dialog"
          onClick={() => {
            setName('')
            create.reset()
            setOpen(true)
          }}
        >
          <FolderPlus aria-hidden="true" size={15} />
        </button>
      ) : (
        <NewCard
          ref={trigger}
          shape="row"
          label={label}
          className={styles.newFolder}
          aria-haspopup="dialog"
          onClick={() => {
            setName('')
            create.reset()
            setOpen(true)
          }}
        />
      )}
      {open && (
        <Modal
          ref={dialog}
          aria-labelledby={titleId}
          className={dialogStyles.dialog}
          onClose={() => {
            setOpen(false)
            trigger.current?.focus()
          }}
        >
          <form
            className={dialogStyles.body}
            onSubmit={(event) => {
              event.preventDefault()
              create.mutate()
            }}
          >
            <h2 id={titleId}>{label}</h2>
            <Field
              label={t('files.folderName')}
              value={name}
              required
              maxLength={120}
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
              data-autofocus=""
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <FormError message={create.error ? errorText(create.error) : null} />
            <div className={dialogStyles.actions}>
              <BusyButton type="submit" className={form.button} busy={create.isPending}>
                {t('files.createFolder')}
              </BusyButton>
              <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
                {t('files.cancel')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

/** El engranaje de una carpeta: abre su ventana */
/**
 * «Carpeta»: en cuál está un archivo o una carpeta (las de su ámbito, con su camino) o en ninguna. Los valores son los
 * del árbol de la pantalla: lo común que no está en ninguna, en un mundo, cuelga de «Comunes»
 */
export function FolderField({
  folders,
  of,
  moving,
  value,
  onChange
}: {
  folders: FolderView[]
  /** Lo que se cambia de sitio: su ámbito */
  of: { worldId: string | null }
  /** Las carpetas que se mueven: ellas y las suyas no salen */
  moving?: string | readonly string[]
  value: string | null
  onChange: (folderId: string | null) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  // Lo más alto: para lo de otro ámbito, su raíz («Comunes» en un mundo, el mundo en los comunes)
  const top = folders.find((folder) => isRoot(folder.id) && folder.worldId === of.worldId)?.id ?? null
  return (
    <div className={form.field}>
      <label htmlFor={id}>{t('files.folder')}</label>
      <select
        id={id}
        value={value === top ? '' : (value ?? '')}
        onChange={(event) => onChange(event.currentTarget.value || top)}
      >
        <option value="">{t('files.noFolder')}</option>
        {folderChoices(folders, of.worldId, moving).map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function FolderSettings({
  folder,
  folders,
  onMove,
  onChanged
}: {
  folder: FolderView
  folders: FolderView[]
  onMove: (dest: string | null) => void
  onChanged: () => Promise<unknown>
}) {
  const { t } = useTranslation()
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.smallGear}
        data-settings=""
        aria-label={t('files.folderSettingsOf', { name: folder.name })}
        title={t('files.folderSettingsOf', { name: folder.name })}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Settings aria-hidden="true" size={14} />
      </button>
      {open && (
        <FolderDialog
          folder={folder}
          folders={folders}
          onMove={onMove}
          onChanged={onChanged}
          onClose={(gone) => {
            setOpen(false)
            if (!gone) trigger.current?.focus()
          }}
        />
      )}
    </>
  )
}

/**
 * La ventana de una carpeta: su nombre, en qué carpeta está y, en la zona de peligro, borrarla con lo que tiene.
 * onClose(gone): si se borró
 */
export function FolderDialog({
  folder,
  folders,
  onMove,
  onChanged,
  onClose
}: {
  folder: FolderView
  folders: FolderView[]
  onMove: (dest: string | null) => void
  onChanged: () => Promise<unknown>
  onClose: (gone: boolean) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const gone = useRef(false)
  const [name, setName] = useState(folder.name)
  const [color, setColor] = useState(folder.color)
  const [icon, setIcon] = useState(folder.icon)
  const startParent = folder.parentId ?? null
  const [parent, setParent] = useState(startParent)
  const renamed = name.trim() !== folder.name
  const restyled = color !== folder.color || icon !== folder.icon
  const moved = parent !== startParent
  const rename = useMutation({
    mutationFn: async () => {
      if (renamed || restyled) {
        await api.call('updateFolder', {
          folderId: folder.id,
          ...(renamed ? { name: name.trim() } : {}),
          ...(color !== folder.color ? { color } : {}),
          ...(icon !== folder.icon ? { icon } : {})
        })
        await onChanged()
      }
    },
    // A otra carpeta: la ventana se cierra y se ve ya en su sitio
    onSuccess: () => {
      if (!moved) return
      dialog.current?.close()
      onMove(parent)
    }
  })
  const changed = renamed || restyled || moved
  const remove = async () => {
    await api.call('deleteFolder', { folderId: folder.id })
    gone.current = true
    await vanish(folder.id, dialog.current)
    await onChanged()
  }
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={cards.dialog} onClose={() => onClose(gone.current)}>
      <div className={`${styles.preview} ${styles.iconPreview}`}>
        <FolderGlyph folder={{ color, icon }} size={44} strokeWidth={1.25} />
      </div>
      <form
        className={cards.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (changed) rename.mutate()
        }}
      >
        <h2 id={titleId}>{t('files.folderSettingsOf', { name: folder.name })}</h2>
        <Field
          label={t('files.folderName')}
          value={name}
          required
          maxLength={120}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <FolderField folders={folders} of={folder} moving={folder.id} value={parent} onChange={setParent} />
        <IconChoices value={icon} onChange={setIcon} />
        <ColorChoices value={color} onChange={setColor} />
        <FormError message={rename.error ? errorText(rename.error) : null} />
        <ChangesBar shown={changed}>
          <BusyButton type="submit" className={form.button} busy={rename.isPending}>
            {t('files.save')}
          </BusyButton>
          <button
            type="button"
            className={dialogStyles.cancel}
            onClick={() => {
              setName(folder.name)
              setColor(folder.color)
              setIcon(folder.icon)
              setParent(startParent)
            }}
          >
            {t('files.cancel')}
          </button>
        </ChangesBar>
      </form>
      <div className={cards.dangerArea}>
        <DangerZone>
          <ConfirmByName
            name={folder.name}
            action={t('files.deleteFolder')}
            title={t('files.deleteTitle', { name: folder.name })}
            warning={t('files.deleteFolderWarning')}
            label={t('files.folderName')}
            typed={false}
            onConfirm={remove}
          />
        </DangerZone>
      </div>
    </Modal>
  )
}

/**
 * Lo que se va (un archivo o una carpeta borrados): su ventana se cierra y su fila se desvanece encogiendo un poco;
 * después ya se puede quitar de la lista. Sin animaciones (las pruebas), al momento
 */
export async function vanish(id: string, dialog: HTMLDialogElement | null) {
  if (dialog?.open) {
    dialog.style.transition = 'none'
    dialog.close()
  }
  const card = document.querySelector<HTMLElement>(`[data-file-card="${id}"]`)
  if (!card || typeof card.getAnimations !== 'function') return
  card.classList.add(styles.vanishing ?? '')
  await new Promise((resolve) => setTimeout(resolve, 260))
}

/** El engranaje de un archivo: abre su ventana */
export function FileSettings({
  file,
  folders,
  onMove,
  onChanged
}: {
  file: WorldFile
  folders: FolderView[]
  onMove: (dest: string | null) => void
  onChanged: () => Promise<unknown>
}) {
  const { t } = useTranslation()
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.smallGear}
        data-settings=""
        aria-label={t('files.settingsOf', { name: file.name })}
        title={t('files.settingsOf', { name: file.name })}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Settings aria-hidden="true" size={14} />
      </button>
      {open && (
        <FileDialog
          file={file}
          folders={folders}
          onMove={onMove}
          onChanged={onChanged}
          onClose={(gone) => {
            setOpen(false)
            if (!gone) trigger.current?.focus()
          }}
        />
      )}
    </>
  )
}

/**
 * La ventana de un archivo: su vista previa, el nombre y su carpeta («Guardar» y «Cancelar» solo con cambios), sus
 * etiquetas y, al final, la zona de peligro. onClose(gone): si se ha borrado
 */
export function FileDialog({
  file,
  folders,
  onMove,
  onChanged,
  onClose
}: {
  file: WorldFile
  folders: FolderView[]
  onMove: (dest: string | null) => void
  onChanged: () => Promise<unknown>
  onClose: (gone: boolean) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const gone = useRef(false)
  const [name, setName] = useState(file.name)
  const startFolder = file.folderId ?? null
  const [folderId, setFolderId] = useState(startFolder)
  // Las etiquetas también esperan a «Guardar», como el nombre y la carpeta, con lo que esté a medio escribir (así el
  // campo no cambia justo al pulsar «Guardar»); `round` lo vacía al guardar o cancelar
  const catalog = useAccountTags().data?.tags.map((tag) => tag.name) ?? []
  const [tags, setTags] = useState<string[]>(file.tags)
  const [typed, setTyped] = useState('')
  const [round, setRound] = useState(0)
  const nextTags = addTyped(tags, typed, catalog)
  const renamed = name.trim() !== file.name
  const moved = folderId !== startFolder
  const retagged = nextTags.length !== file.tags.length || nextTags.some((tag, index) => tag !== file.tags[index])
  const resetTags = (to: string[]) => {
    setTags(to)
    setTyped('')
    setRound((n) => n + 1)
  }
  const rename = useMutation({
    mutationFn: async () => {
      if (renamed) await api.call('renameFile', { fileId: file.id, name: name.trim() })
      if (retagged) await api.call('setFileTags', { fileId: file.id, tags: nextTags })
      if (renamed || retagged) await onChanged()
      return nextTags
    },
    // A otra carpeta: la ventana se cierra y se ve ya en su sitio
    onSuccess: (saved) => {
      resetTags(saved)
      if (!moved) return
      dialog.current?.close()
      onMove(folderId)
    }
  })
  // Borrado, su fila se desvanece y la lista se pone al día
  const remove = async () => {
    await api.call('deleteFile', { fileId: file.id })
    gone.current = true
    await vanish(file.id, dialog.current)
    await onChanged()
  }
  const changed = renamed || moved || retagged
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={cards.dialog} onClose={() => onClose(gone.current)}>
      <div className={styles.preview}>
        <Thumb file={file} />
      </div>
      <form
        className={cards.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (changed) rename.mutate()
        }}
      >
        <h2 id={titleId}>{t('files.settingsOf', { name: file.name })}</h2>
        <Field
          label={t('files.name')}
          value={name}
          required
          maxLength={200}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          spellCheck={false}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <FolderField folders={folders} of={file} value={folderId} onChange={setFolderId} />
        <TagsField key={round} value={tags} onChange={setTags} onPending={setTyped} />
        <FormError message={rename.error ? errorText(rename.error) : null} />
        {/* Al final, como en las demás ventanas */}
        <ChangesBar shown={changed}>
          <BusyButton type="submit" className={form.button} busy={rename.isPending}>
            {t('files.save')}
          </BusyButton>
          <button
            type="button"
            className={dialogStyles.cancel}
            onClick={() => {
              setName(file.name)
              setFolderId(startFolder)
              resetTags(file.tags)
            }}
          >
            {t('files.cancel')}
          </button>
        </ChangesBar>
      </form>
      <div className={cards.dangerArea}>
        <DangerZone>
          <ConfirmByName
            name={file.name}
            action={t('files.delete')}
            title={t('files.deleteTitle', { name: file.name })}
            warning={
              file.usedBy > 0
                ? t('files.deleteUsed', { count: file.usedBy, days: TRASH_DAYS })
                : t('files.deleteWarning', { days: TRASH_DAYS })
            }
            label={t('files.name')}
            typed={false}
            onConfirm={remove}
          />
        </DangerZone>
      </div>
    </Modal>
  )
}
