import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Field } from '../components/field.tsx'
import styles from '../components/form.module.css'
import { passwordStrength } from './password.ts'

const STRENGTH_NAMES = ['veryWeak', 'weak', 'fair', 'good', 'strong'] as const

/**
 * Los campos para crear una cuenta (el propietario con su enlace, o quien se une a una campaña): nombre, apellido(s),
 * nombre de usuario (el apodo que se ve en la app), email, contraseña con lo segura que es, y repetirla
 */
export function NewAccountFields() {
  const { t } = useTranslation()
  const [values, setValues] = useState({
    firstName: '',
    lastName: '',
    name: '',
    email: ''
  })
  const set = (key: keyof typeof values) => (event: { currentTarget: HTMLInputElement }) => {
    const value = event.currentTarget.value
    setValues((current) => ({ ...current, [key]: value }))
  }
  return (
    <>
      {/* Nombre y apellido(s), uno al lado del otro */}
      <div className={styles.pair}>
        <Field
          label={t('account.firstName')}
          name="firstName"
          autoComplete="given-name"
          maxLength={80}
          required
          onInput={set('firstName')}
        />
        <Field
          label={t('account.lastName')}
          name="lastName"
          autoComplete="family-name"
          maxLength={80}
          required
          onInput={set('lastName')}
        />
      </div>
      <Field
        label={t('account.username')}
        hint={t('account.usernameHint')}
        name="name"
        autoComplete="nickname"
        maxLength={80}
        required
        onInput={set('name')}
      />
      <Field
        label={t('account.email')}
        name="email"
        type="email"
        autoComplete="email"
        required
        onInput={set('email')}
      />
      <PasswordFields personal={[values.name, values.email.split('@')[0] ?? '', values.firstName, values.lastName]} />
    </>
  )
}

/**
 * Una contraseña nueva: el campo con lo segura que es (y sin dejar una que se adivina) y repetirla. `personal`, lo que
 * no debe llevar dentro (el nombre, el email…); `label`, si no es «Contraseña»
 */
export function PasswordFields({ personal, label }: { personal: readonly string[]; label?: string }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const strength = passwordStrength(password, personal)
  return (
    <>
      <Field
        label={label ?? t('account.password')}
        hint={t('account.passwordHint')}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={10}
        maxLength={128}
        required
        // Que no se pueda poner una que se adivina, aunque llegue a los 10 caracteres
        invalid={password.length >= 10 && strength < 2 ? t('account.passwordWeak') : null}
        onInput={(event) => setPassword(event.currentTarget.value)}
      >
        {password && (
          <div className={styles.strength} data-strength={strength}>
            <span aria-hidden="true" className={styles.meter}>
              <span />
              <span />
              <span />
              <span />
            </span>
            <span aria-live="polite">{t(`account.strength.${STRENGTH_NAMES[strength]}`)}</span>
          </div>
        )}
      </Field>
      <Field
        label={t('account.confirmPassword')}
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        invalid={confirm !== '' && confirm !== password ? t('account.passwordMismatch') : null}
        onInput={(event) => setConfirm(event.currentTarget.value)}
      />
    </>
  )
}
