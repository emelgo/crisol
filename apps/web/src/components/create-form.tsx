import { useMutation } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from './busy-button.tsx'
import { Field, FormError } from './field.tsx'
import form from './form.module.css'

interface Props {
  title: string
  label: string
  submit: string
  onCreate: (name: string) => Promise<unknown>
}

/** Formulario de crear algo con nombre (un mundo, una campaña) */
export function CreateForm({ title, label, submit, onCreate }: Props) {
  const errorText = useErrorText()
  const create = useMutation({ mutationFn: onCreate })

  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const target = event.currentTarget
    create.mutate(String(new FormData(target).get('name')), { onSuccess: () => target.reset() })
  }

  return (
    <form className={form.form} onSubmit={send}>
      <h2>{title}</h2>
      <Field
        label={label}
        name="name"
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        data-form-type="other"
        maxLength={120}
        required
      />
      <FormError message={create.error ? errorText(create.error) : null} />
      <BusyButton type="submit" className={form.button} busy={create.isPending}>
        {submit}
      </BusyButton>
    </form>
  )
}
