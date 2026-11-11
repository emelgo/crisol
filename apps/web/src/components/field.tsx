import type { TFunction } from 'i18next'
import { type ComponentProps, type FormEvent, type InputEvent, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAnnounce } from './announcer.tsx'
import styles from './form.module.css'

type Control = HTMLInputElement | HTMLTextAreaElement

/** Por qué no vale lo escrito, con las palabras de la app (no el globo del navegador) */
function validationText(t: TFunction, input: Control): string {
  const { validity } = input
  if (validity.customError) return input.validationMessage
  if (validity.valueMissing) return t('validation.required')
  if (validity.typeMismatch) return t(input.type === 'email' ? 'validation.email' : 'validation.format')
  if (validity.tooShort) return t('validation.tooShort', { count: input.minLength })
  if (validity.tooLong) return t('validation.tooLong', { count: input.maxLength })
  if (input instanceof HTMLInputElement && validity.rangeUnderflow) return t('validation.min', { min: input.min })
  if (input instanceof HTMLInputElement && validity.rangeOverflow) return t('validation.max', { max: input.max })
  return t('validation.format')
}

/**
 * Campo de formulario con su etiqueta, una pista debajo si la hay y, si lo escrito no vale, por qué: el formulario
 * no sale y el mensaje va bajo el campo (en vez del globo del navegador), y el foco, al primero que no vale.
 * `invalid`: un motivo propio (por ejemplo, que dos contraseñas no coinciden). `rows`: de varias líneas. `counter`:
 * con maxLength, cuánto se lleva escrito («123 / 280»), que sale mientras se escribe
 */
export function Field({
  label,
  hint,
  invalid,
  children,
  ref,
  rows,
  counter = false,
  ...input
}: ComponentProps<'input'> & {
  label: string
  hint?: string
  invalid?: string | null
  rows?: number
  counter?: boolean
}) {
  const { t } = useTranslation()
  const announce = useAnnounce()
  const id = useId()
  const element = useRef<Control | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Lo escrito: el valor, si lo lleva el formulario; si no, lo que se va tecleando
  const [typed, setTyped] = useState(String(input.defaultValue ?? '').length)
  const length = input.value === undefined ? typed : String(input.value).length
  const max = counter ? input.maxLength : undefined
  // El motivo propio, para la validación del navegador; si ya se ve un error, se pone al día
  useEffect(() => {
    const node = element.current
    if (!node) return
    node.setCustomValidity(invalid ?? '')
    setError((shown) => (shown === null ? null : node.validity.valid ? null : validationText(t, node)))
  }, [invalid, t])
  const describedBy = [hint ? `${id}-pista` : null, max ? `${id}-cuenta` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ')
  // Lo que no es de una cuenta (el nombre de un mundo, de una plantilla…): los gestores de contraseñas no se meten
  const credential =
    input.type === 'password' ||
    input.type === 'email' ||
    ['username', 'email', 'current-password', 'new-password', 'given-name', 'family-name'].includes(
      String(input.autoComplete ?? '')
    )
  const ignored = credential ? {} : { 'data-1p-ignore': true, 'data-lpignore': 'true', 'data-form-type': 'other' }
  const control = {
    id,
    ...ignored,
    ...input,
    ref: (node: Control | null) => {
      element.current = node
      if (typeof ref === 'function') ref(node as HTMLInputElement | null)
      else if (ref) ref.current = node as HTMLInputElement | null
    },
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
    onInput: (event: InputEvent<Control>) => {
      // Mientras se corrige, el mensaje sigue a lo escrito
      const node = event.currentTarget
      // Al llegar al límite (también al pegar de más, que se corta), se dice una vez: el navegador no avisa
      if (max && node.value.length >= max && length < max) announce(t('validation.atLimit', { max }))
      setTyped(node.value.length)
      if (error !== null) setError(node.validity.valid ? null : validationText(t, node))
      input.onInput?.(event as InputEvent<HTMLInputElement>)
    },
    onInvalid: (event: FormEvent<Control>) => {
      event.preventDefault()
      const node = event.currentTarget
      setError(validationText(t, node))
      // El foco, al primero del formulario que no vale
      if (node.form?.querySelector(':invalid') === node) node.focus()
      input.onInvalid?.(event as FormEvent<HTMLInputElement>)
    }
  }
  const pista = hint && (
    <small id={`${id}-pista`} className={styles.hint}>
      {hint}
    </small>
  )
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {rows ? (
        // De varias líneas: lo mismo que un campo, salvo lo que solo tiene un input (su tipo)
        <textarea {...(control as unknown as ComponentProps<'textarea'>)} rows={rows} className={styles.grow} />
      ) : (
        // Un email no es texto que corregir: sin el corrector, que lo subraya y en el móvil lo cambia
        <input spellCheck={input.type === 'email' ? false : undefined} {...control} />
      )}
      {children}
      {max ? (
        // La pista a la izquierda y la cuenta a la derecha, en su sitio aunque no se vea: al salir, nada se mueve
        <div className={styles.fieldFoot}>
          {pista}
          <small className={styles.counter} data-full={length >= max || undefined}>
            <span aria-hidden="true">
              {length} / {max}
            </span>
            <span id={`${id}-cuenta`} className={styles.srOnly}>
              {t('validation.count', { count: length, max })}
            </span>
          </small>
        </div>
      ) : (
        pista
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
