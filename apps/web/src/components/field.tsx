import { type ComponentProps, useId } from 'react'
import styles from './form.module.css'

/** Campo de formulario con su etiqueta y, si la hay, una pista debajo */
export function Field({ label, hint, ...input }: ComponentProps<'input'> & { label: string; hint?: string }) {
  const id = useId()
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {/* Un email no es texto que corregir: sin el corrector, que lo subraya y en el móvil lo cambia */}
      <input
        id={id}
        spellCheck={input.type === 'email' ? false : undefined}
        {...input}
        aria-describedby={hint ? `${id}-pista` : undefined}
      />
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
