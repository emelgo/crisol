import { type InputHTMLAttributes, useId } from 'react'
import styles from './form.module.css'

/** Campo de formulario con su etiqueta y, si la hay, una pista debajo */
export function Field({
  label,
  hint,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId()
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input id={id} {...input} aria-describedby={hint ? `${id}-pista` : undefined} />
      {hint && (
        <small id={`${id}-pista`} className={styles.hint}>
          {hint}
        </small>
      )}
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className={styles.error}>
      {message}
    </p>
  )
}
