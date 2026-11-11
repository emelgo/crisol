import { type Page, pageIcon } from '@crisol/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CircleOff, SmilePlus } from 'lucide-react'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import list from '../components/list.module.css'
import cards from '../routes/world-card.module.css'
import styles from './icon.module.css'

/** Los de un mundo de rol, para elegir de un clic; cualquier otro se escribe o se pega */
const COMMON = ['📜', '🏰', '🏘️', '⚓', '🌲', '⛰️', '🐉', '⚔️', '🛡️', '🧙', '👑', '💀', '🗝️', '🗺️', '📖', '🎲']

/**
 * El icono de la página: un botón que abre una caja (patrón de despliegue, como el menú de la cuenta) con los más
 * habituales, un campo para cualquier otro y quitarlo. Escape, pulsar fuera o salir con el tabulador la cierran
 */
export function PageIcon({ page, ghost = false }: { page: Page; ghost?: boolean }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const inputId = useId()
  const save = useMutation({
    mutationFn: (icon: string | null) => api.call('updatePage', { pageId: page.id, icon }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pages', page.worldId] })
      setOpen(false)
      trigger.current?.focus()
    }
  })

  useEffect(() => {
    if (!open) return
    const outside = (event: Event) => {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false)
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  return (
    <div ref={wrapper} className={styles.wrapper}>
      <button
        ref={trigger}
        type="button"
        className={ghost ? styles.ghost : styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={page.icon ? t('icon.change', { icon: page.icon }) : t('icon.add')}
        onClick={() => setOpen(!open)}
      >
        {ghost ? (
          <>
            <SmilePlus aria-hidden="true" size={16} />
            {t('icon.short')}
          </>
        ) : (
          (page.icon ?? <span className={styles.placeholder} aria-hidden="true" />)
        )}
      </button>
      {open && (
        <div id={panelId} className={styles.panel}>
          <ul className={styles.grid} aria-label={t('icon.common')}>
            {COMMON.map((icon) => (
              <li key={icon}>
                <button
                  type="button"
                  className={styles.choice}
                  aria-label={t('icon.use', { icon })}
                  aria-pressed={page.icon === icon}
                  onClick={() => save.mutate(icon)}
                >
                  {icon}
                </button>
              </li>
            ))}
          </ul>
          <form
            className={styles.other}
            onSubmit={(event) => {
              event.preventDefault()
              const icon = String(new FormData(event.currentTarget).get('icono')).trim()
              if (icon) save.mutate(icon)
            }}
          >
            <div className={form.field}>
              <label htmlFor={inputId}>{t('icon.other')}</label>
              <input
                id={inputId}
                name="icono"
                maxLength={16}
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
              />
            </div>
            <button type="submit" className={list.secondary}>
              {t('icon.useOther')}
            </button>
          </form>
          <FormError message={save.error ? errorText(save.error) : null} />
          {page.icon && (
            <button type="button" className={list.secondary} onClick={() => save.mutate(null)}>
              {t('icon.remove')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * El icono en un formulario (el de una carpeta), como el color al lado: ninguno, uno de los habituales o cualquier otro
 * emoji, escrito o pegado (lo que no es un emoji no se pone)
 */
export function IconChoices({ value, onChange }: { value: string | null; onChange: (icon: string | null) => void }) {
  const { t } = useTranslation()
  const name = useId()
  const [typed, setTyped] = useState(value && !COMMON.includes(value) ? value : '')
  const choice = (icon: string | null, label: string, content: ReactNode) => (
    <label key={icon ?? ''} className={cards.colorChoice} title={label}>
      <input type="radio" name={name} checked={value === icon} onChange={() => onChange(icon)} />
      {content}
      <span className={cards.hidden}>{label}</span>
    </label>
  )
  return (
    <fieldset className={cards.choices}>
      <legend>{t('icon.short')}</legend>
      {choice(null, t('icon.none'), <CircleOff aria-hidden="true" size={18} strokeWidth={1.5} />)}
      {COMMON.map((icon) =>
        choice(
          icon,
          icon,
          <span className={styles.emojiChoice} aria-hidden="true">
            {icon}
          </span>
        )
      )}
      {/* Cualquier otro: una casilla más, donde se escribe o se pega */}
      <input
        className={styles.otherIcon}
        data-chosen={typed !== '' && value === typed.trim() ? '' : undefined}
        aria-label={t('icon.other')}
        placeholder={t('icon.otherShort')}
        value={typed}
        maxLength={16}
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        data-form-type="other"
        onChange={(event) => {
          const text = event.currentTarget.value
          setTyped(text)
          if (pageIcon.safeParse(text.trim()).success) onChange(text.trim())
        }}
      />
    </fieldset>
  )
}
