import { useMutation } from '@tanstack/react-query'
import { type ReactNode, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from './busy-button.tsx'
import styles from './danger.module.css'
import dialogStyles from './dialog.module.css'
import { Field, FormError } from './field.tsx'
import { Modal } from './modal.tsx'

/** La zona de peligro: aparte, al final, en un recuadro rojizo */
export function DangerZone({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const titleId = useId()
  return (
    <section className={styles.zone} aria-labelledby={titleId}>
      <h3 id={titleId}>{t('danger.zone')}</h3>
      {children}
    </section>
  )
}

interface Props {
  /** Lo que hay que escribir para confirmar, y que sale en el mensaje para poder copiarlo */
  name: string
  /** El botón (y el de confirmar) */
  action: string
  title: string
  warning: string
  label: string
  onConfirm: () => Promise<unknown>
  /** false: basta con confirmar, sin escribir el nombre (para lo que se recupera de la papelera y pesa poco, un archivo) */
  typed?: boolean
}

/**
 * Algo que no conviene hacer sin querer (borrar un mundo): el botón abre una confirmación en la que hay que escribir
 * el nombre. Hasta que coincide, no se puede confirmar
 */
export function ConfirmByName({ name, action, title, warning, label, onConfirm, typed: mustType = true }: Props) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const warningId = useId()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const confirm = useMutation({ mutationFn: onConfirm })
  const matches = !mustType || typed.trim() === name.trim()
  return (
    <>
      <button
        ref={button}
        type="button"
        className={styles.button}
        aria-haspopup="dialog"
        onClick={() => {
          setTyped('')
          confirm.reset()
          setOpen(true)
        }}
      >
        {action}
      </button>
      {open && (
        <Modal
          ref={dialog}
          aria-labelledby={titleId}
          // El aviso se lee al abrirse, con el título
          aria-describedby={warningId}
          className={dialogStyles.dialog}
          onClose={() => {
            setOpen(false)
            button.current?.focus()
          }}
        >
          <form
            className={dialogStyles.body}
            onSubmit={(event) => {
              event.preventDefault()
              if (matches) confirm.mutate()
            }}
          >
            <h2 id={titleId}>{title}</h2>
            <p id={warningId} className={dialogStyles.description}>
              {warning}
            </p>
            {mustType && (
              <>
                <p className={dialogStyles.description}>
                  {t('danger.typeName')} <strong className={styles.name}>{name}</strong>
                </p>
                <Field
                  label={label}
                  value={typed}
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  data-form-type="other"
                  spellCheck={false}
                  // El cursor, en el campo en cuanto se abre (lo pone Modal, ya abierto)
                  data-autofocus=""
                  onChange={(event) => setTyped(event.currentTarget.value)}
                />
              </>
            )}
            <FormError message={confirm.error ? errorText(confirm.error) : null} />
            <div className={dialogStyles.actions}>
              <BusyButton type="submit" className={styles.solid} busy={confirm.isPending} disabled={!matches}>
                {action}
              </BusyButton>
              <button
                type="button"
                className={dialogStyles.cancel}
                // Sin nombre que escribir, el foco empieza en lo que no borra
                data-autofocus={mustType ? undefined : ''}
                onClick={() => dialog.current?.close()}
              >
                {t('list.cancel')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
