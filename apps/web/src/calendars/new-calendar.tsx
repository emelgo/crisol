/**
 * «Calendario nuevo» (lienzo, pantalla 1b): su nombre y de dónde se parte: en blanco, como el nuestro (el gregoriano,
 * de ejemplo) o copia de otro del mundo; una línea dice que también se le puede pedir a la IA. Al crearlo se abre su
 * editor. El primero del mundo nace principal (lo decide el servidor)
 */
import type { CalendarView } from '@crisol/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { CalendarDays, Copy, Sparkles, SquareDashed } from 'lucide-react'
import { type ReactNode, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from '../components/busy-button.tsx'
import dialogStyles from '../components/dialog.module.css'
import { Field, FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import { Modal } from '../components/modal.tsx'
import styles from './calendars.module.css'

type Start = 'blank' | 'gregorian' | 'copy'

export function NewCalendarDialog({
  worldId,
  calendars,
  onClose
}: {
  worldId: string
  calendars: readonly CalendarView[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const client = useQueryClient()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const groupId = useId()
  const [start, setStart] = useState<Start>('blank')
  const [copyOf, setCopyOf] = useState(calendars.find((c) => c.primary)?.id ?? calendars[0]?.id ?? '')
  const create = useMutation({
    mutationFn: (name: string) =>
      api.call('createCalendar', {
        worldId,
        name,
        from: start === 'copy' ? { copyOf } : start
      }),
    onSuccess: (created) => {
      void client.invalidateQueries({ queryKey: ['calendars', worldId] })
      void navigate({
        to: '/mundos/$worldId/calendarios/$calendarId',
        params: { worldId, calendarId: created.id }
      })
    }
  })
  const option = (value: Start, icon: ReactNode, title: string, hint: ReactNode, extra?: ReactNode) => (
    <div className={styles.option} data-checked={start === value || undefined}>
      <label className={styles.optionLabel}>
        <input
          type="radio"
          name="start"
          value={value}
          checked={start === value}
          disabled={value === 'copy' && calendars.length === 0}
          onChange={() => setStart(value)}
        />
        <span className={styles.optionIcon} aria-hidden="true">
          {icon}
        </span>
        <span className={styles.optionTitle}>{title}</span>
        {hint}
      </label>
      {extra}
    </div>
  )
  return (
    <Modal
      ref={dialog}
      aria-labelledby={titleId}
      className={`${dialogStyles.dialog} ${styles.newDialog}`}
      onClose={onClose}
    >
      <form
        className={dialogStyles.body}
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate(String(new FormData(event.currentTarget).get('name') ?? '').trim())
        }}
      >
        <h2 id={titleId}>{t('calendars.new')}</h2>
        <Field
          label={t('calendars.dialog.name')}
          name="name"
          required
          maxLength={60}
          autoComplete="off"
          data-autofocus
        />
        <fieldset className={styles.options} aria-labelledby={groupId}>
          <legend id={groupId}>{t('calendars.dialog.from')}</legend>
          {option(
            'blank',
            <SquareDashed size={18} />,
            t('calendars.dialog.blank'),
            <span className={styles.optionHint}>{t('calendars.dialog.blankHint')}</span>
          )}
          {option(
            'gregorian',
            <CalendarDays size={18} />,
            t('calendars.dialog.gregorian'),
            <span className={styles.optionHint}>{t('calendars.dialog.gregorianHint')}</span>
          )}
          {option(
            'copy',
            <Copy size={18} />,
            t('calendars.dialog.copy'),
            null,
            calendars.length > 0 && (
              <select
                className={styles.optionSelect}
                aria-label={t('calendars.dialog.copyOf')}
                value={copyOf}
                onChange={(event) => {
                  setCopyOf(event.target.value)
                  setStart('copy')
                }}
                onFocus={() => setStart('copy')}
              >
                {calendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )
          )}
        </fieldset>
        <p className={styles.ai}>
          <Sparkles size={16} aria-hidden="true" />
          {t('calendars.dialog.ai')}
        </p>
        <FormError message={create.error ? errorText(create.error) : null} />
        <div className={dialogStyles.actions}>
          <BusyButton type="submit" className={form.button} busy={create.isPending}>
            {t('calendars.dialog.create')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('calendars.editor.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
