import type { TFunction } from 'i18next'
import { type ComponentProps, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './form.module.css'

/** Por qué no vale lo escrito, con las palabras de la app (no el globo del navegador) */
function validationText(t: TFunction, input: HTMLInputElement): string {
  const { validity } = input
  if (validity.customError) return input.validationMessage
  if (validity.valueMissing) return t('validation.required')
  if (validity.typeMismatch) return t(input.type === 'email' ? 'validation.email' : 'validation.format')
  if (validity.tooShort) return t('validation.tooShort', { count: input.minLength })
  if (validity.tooLong) return t('validation.tooLong', { count: input.maxLength })
  if (validity.rangeUnderflow) return t('validation.min', { min: input.min })
  if (validity.rangeOverflow) return t('validation.max', { max: input.max })
  return t('validation.format')
}

/**
 * Campo de formulario con su etiqueta, una pista debajo si la hay y, si lo escrito no vale, por qué: el formulario
 * no sale y el mensaje va bajo el campo (en vez del globo del navegador), y el foco, al primero que no vale.
 * `invalid`: un motivo propio (por ejemplo, que dos contraseñas no coinciden)
 */
export function Field({
  label,
  hint,
  invalid,
  children,
  ref,
  ...input
}: ComponentProps<'input'> & { label: string; hint?: string; invalid?: string | null }) {
  const { t } = useTranslation()
  const id = useId()
  const element = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  // El motivo propio, para la validación del navegador; si ya se ve un error, se pone al día
  useEffect(() => {
    const node = element.current
    if (!node) return
    node.setCustomValidity(invalid ?? '')
    setError((shown) => (shown === null ? null : node.validity.valid ? null : validationText(t, node)))
  }, [invalid, t])
  const describedBy = [hint ? `${id}-pista` : null, error ? `${id}-error` : null].filter(Boolean).join(' ')
  // Lo que no es de una cuenta (el nombre de un mundo, de una plantilla…): los gestores de contraseñas no se meten
  const credential =
    input.type === 'password' ||
    input.type === 'email' ||
    ['username', 'email', 'current-password', 'new-password', 'given-name', 'family-name'].includes(
      String(input.autoComplete ?? '')
    )
  const ignored = credential ? {} : { 'data-1p-ignore': true, 'data-lpignore': 'true', 'data-form-type': 'other' }
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {/* Un email no es texto que corregir: sin el corrector, que lo subraya y en el móvil lo cambia */}
      <input
        id={id}
        spellCheck={input.type === 'email' ? false : undefined}
        {...ignored}
        {...input}
        ref={(node) => {
          element.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        onInput={(event) => {
          // Mientras se corrige, el mensaje sigue a lo escrito
          const node = event.currentTarget
          if (error !== null) setError(node.validity.valid ? null : validationText(t, node))
          input.onInput?.(event)
        }}
        onInvalid={(event) => {
          event.preventDefault()
          const node = event.currentTarget
          setError(validationText(t, node))
          // El foco, al primero del formulario que no vale
          if (node.form?.querySelector(':invalid') === node) node.focus()
          input.onInvalid?.(event)
        }}
      />
      {children}
      {hint && (
        <small id={`${id}-pista`} className={styles.hint}>
          {hint}
        </small>
      )}
      {error && (
        <small id={`${id}-error`} className={styles.fieldError}>
          {error}
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
