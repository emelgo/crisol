import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useErrorText } from '../api/errors.ts'
import { Field, FormError } from './field.tsx'
import form from './form.module.css'
import styles from './list.module.css'

interface Props {
  name: string
  /** El rol de la cuenta en el elemento, ya traducido */
  role: string
  /** Sin onRename, no se ofrece renombrar */
  onRename?: (name: string) => Promise<unknown>
  /** Adónde lleva el nombre, si lleva a algún sitio */
  link?: { to: string; params?: Record<string, string> }
  children?: ReactNode
}

/** Un elemento de una lista (mundo, campaña) con su rol y, si se puede, renombrar en el sitio */
export function RenamableItem({ name, role, onRename, link }: Props) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const [editing, setEditing] = useState(false)
  const rename = useMutation({
    mutationFn: async (next: string) => onRename?.(next),
    onSuccess: () => setEditing(false)
  })

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
          <Field label={t('list.renameLabel', { name })} name="name" defaultValue={name} maxLength={120} required />
          <FormError message={rename.error ? errorText(rename.error) : null} />
          <div className={styles.actions}>
            <button type="submit" className={form.button} disabled={rename.isPending}>
              {t('list.save')}
            </button>
            <button type="button" className={styles.secondary} onClick={() => setEditing(false)}>
              {t('list.cancel')}
            </button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className={styles.item}>
      {link ? (
        <Link to={link.to} params={link.params} className={styles.name}>
          {name}
        </Link>
      ) : (
        <span className={styles.name}>{name}</span>
      )}
      <span className={styles.role}>{role}</span>
      {onRename && (
        <button
          type="button"
          className={styles.secondary}
          aria-label={t('list.renameButton', { name })}
          onClick={() => setEditing(true)}
        >
          {t('list.rename')}
        </button>
      )}
    </li>
  )
}
