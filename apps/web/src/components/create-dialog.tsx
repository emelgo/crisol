import { useMutation } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from './busy-button.tsx'
import styles from './dialog.module.css'
import { Field, FormError } from './field.tsx'
import form from './form.module.css'

interface Props {
  /** El botón que lo abre */
  trigger: string
  /** Para un botón distinto (el grande de una pantalla vacía) */
  triggerClassName?: string
  title: string
  label: string
  submit: string
  /** Una línea bajo el título, si hace falta */
  description?: ReactNode
  /** Para señalarlo en un recorrido (data-tour) */
  tour?: string
  onCreate: (name: string) => Promise<unknown>
}

/**
 * Crear algo con nombre (un mundo, una campaña) desde un cuadro: el botón lo abre, el foco va al nombre y, al crear,
 * se cierra. Escape o «Cancelar» lo cierran y el foco vuelve al botón
 */
export function CreateDialog({ trigger, triggerClassName, title, label, submit, description, tour, onCreate }: Props) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const create = useMutation({ mutationFn: onCreate })
  useEffect(() => {
    if (open) dialog.current?.showModal()
  }, [open])
  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    create.mutate(String(new FormData(event.currentTarget).get('name')), {
      onSuccess: () => dialog.current?.close()
    })
  }
  return (
    <>
      <button
        ref={button}
        type="button"
        className={triggerClassName ?? form.button}
        data-tour={tour}
        onClick={() => {
          create.reset()
          setOpen(true)
        }}
      >
        <Plus aria-hidden="true" size={18} />
        {trigger}
      </button>
      {open && (
        <dialog
          ref={dialog}
          aria-labelledby={titleId}
          className={styles.dialog}
          onClose={() => {
            setOpen(false)
            button.current?.focus()
          }}
        >
          <form className={styles.body} onSubmit={send}>
            <h2 id={titleId}>{title}</h2>
            {description && <p className={styles.description}>{description}</p>}
            <Field label={label} name="name" autoComplete="off" maxLength={120} required autoFocus />
            <FormError message={create.error ? errorText(create.error) : null} />
            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={() => dialog.current?.close()}>
                {t('list.cancel')}
              </button>
              <BusyButton type="submit" className={form.button} busy={create.isPending}>
                {submit}
              </BusyButton>
            </div>
          </form>
        </dialog>
      )}
    </>
  )
}
