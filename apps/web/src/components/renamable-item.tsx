import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { type ReactNode, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from './busy-button.tsx'
import { Field, FormError } from './field.tsx'
import { focusAfterRemoving, focusOnMount, useReturnFocus } from './focus.ts'
import form from './form.module.css'
import styles from './list.module.css'

interface Props {
  name: string
  /** El rol de la cuenta en el elemento, ya traducido */
  role: string
  /** Sin onRename, no se ofrece renombrar */
  onRename?: (name: string) => Promise<unknown>
  /** Sin onDelete, no se ofrece borrar (a la papelera, tras confirmar) */
  onDelete?: () => Promise<unknown>
  /** Adónde lleva el nombre, si lleva a algún sitio */
  link?: { to: string; params?: Record<string, string> }
  /** O una dirección fuera de la web (un archivo), que se abre en otra pestaña */
  href?: string
  /** Más acciones, tras el rol */
  children?: ReactNode
  /** Lo más largo que puede ser el nombre */
  maxLength?: number
}

/**
 * Un elemento de una lista (mundo, campaña) con su rol y, si se puede, renombrar en el sitio y borrar. Al abrir una
 * confirmación, el foco va a ella; al cerrarla, vuelve al botón que la abrió
 */
export function RenamableItem({ name, role, onRename, onDelete, link, href, children, maxLength = 120 }: Props) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const item = useRef<HTMLLIElement>(null)
  const warningId = useId()
  const renameButton = useReturnFocus()
  const deleteButton = useReturnFocus()
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const stopEditing = () => {
    renameButton.back()
    setEditing(false)
  }
  const rename = useMutation({ mutationFn: async (next: string) => onRename?.(next), onSuccess: stopEditing })
  const remove = useMutation({ mutationFn: async () => onDelete?.() })

  if (editing) {
    return (
      <li className={styles.item}>
        <form
          className={styles.rename}
          onSubmit={(event) => {
            event.preventDefault()
            rename.mutate(String(new FormData(event.currentTarget).get('name')))
          }}
        >
          <Field
            label={t('list.renameLabel', { name })}
            name="name"
            autoComplete="off"
            defaultValue={name}
            maxLength={maxLength}
            required
            ref={focusOnMount}
          />
          <FormError message={rename.error ? errorText(rename.error) : null} />
          <div className={styles.actions}>
            <BusyButton type="submit" className={form.button} busy={rename.isPending}>
              {t('list.save')}
            </BusyButton>
            <button type="button" className={styles.secondary} onClick={stopEditing}>
              {t('list.cancel')}
            </button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className={styles.item} ref={item}>
      {link ? (
        <Link to={link.to} params={link.params} className={`${styles.name} ${styles.entity}`}>
          {name}
        </Link>
      ) : href ? (
        <a href={href} target="_blank" rel="noopener" className={`${styles.name} ${styles.entity}`}>
          {name}
        </a>
      ) : (
        <span className={`${styles.name} ${styles.entity}`}>{name}</span>
      )}
      <span className={`${styles.role} ${styles.tag}`}>{role}</span>
      {children}
      {onRename && (
        <button
          type="button"
          ref={renameButton.ref}
          className={styles.secondary}
          aria-label={t('list.renameButton', { name })}
          onClick={() => setEditing(true)}
        >
          {t('list.rename')}
        </button>
      )}
      {onDelete && !confirmingDelete && (
        <button
          type="button"
          ref={deleteButton.ref}
          className={styles.secondary}
          aria-label={t('list.deleteButton', { name })}
          onClick={() => setConfirmingDelete(true)}
        >
          {t('list.delete')}
        </button>
      )}
      {confirmingDelete && (
        <div className={styles.confirm}>
          <p id={warningId}>{t('list.deleteWarning', { name })}</p>
          <div className={styles.actions}>
            <BusyButton
              ref={focusOnMount}
              className={form.button}
              aria-describedby={warningId}
              busy={remove.isPending}
              onClick={() => remove.mutate(undefined, { onSuccess: focusAfterRemoving(item.current) })}
            >
              {t('list.delete')}
            </BusyButton>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => {
                deleteButton.back()
                setConfirmingDelete(false)
              }}
            >
              {t('list.cancel')}
            </button>
          </div>
          <FormError message={remove.error ? errorText(remove.error) : null} />
        </div>
      )}
    </li>
  )
}
