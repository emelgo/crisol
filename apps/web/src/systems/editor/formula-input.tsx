/**
 * Una fórmula de un sistema, comprobada al escribirla: el error dice qué y dónde, y `@` propone los nombres que existen
 * (un combobox: flechas, Intro y Escape). Lo que se comprueba es lo mismo que comprueba el servidor (@crisol/systems)
 */
import { type Context, checkFormula, type Shape } from '@crisol/systems'
import { Check, TriangleAlert } from 'lucide-react'
import { type KeyboardEvent, type ReactNode, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './editor.module.css'

/** Lo que se escribe tras la última @ antes del cursor, si se está escribiendo un nombre */
function typing(value: string, caret: number) {
  const before = value.slice(0, caret)
  const match = /@([a-z0-9_.]*)$/i.exec(before)
  return match ? { start: before.length - match[0].length, text: match[1] ?? '' } : null
}

/** Los nombres que se pueden escribir: los de primer nivel y, tras un punto, los de dentro */
function namesFor(scope: Context['scope'], text: string): { path: string; label: string }[] {
  const parts = text.split('.')
  const last = (parts.pop() ?? '').toLowerCase()
  let fields: Record<string, Shape> | null = scope
  for (const part of parts) {
    const shape: Shape | undefined = fields?.[part]
    fields =
      shape?.type === 'object'
        ? shape.fields
        : shape?.type === 'list' && shape.of.type === 'object'
          ? shape.of.fields
          : null
    if (!fields) return []
  }
  const prefix = parts.length ? `${parts.join('.')}.` : ''
  return Object.entries(fields ?? {})
    .filter(([key]) => key.toLowerCase().startsWith(last))
    .slice(0, 8)
    .map(([key, shape]) => ({ path: `${prefix}${key}`, label: shape.label }))
}

export function FormulaInput({
  id,
  label,
  value,
  onChange,
  context,
  disabled,
  compact
}: {
  id: string
  label: ReactNode
  value: string
  onChange: (value: string) => void
  context: Context
  disabled?: boolean
  /** En una fila: lo que da se dice solo si falla */
  compact?: boolean
}) {
  const { t } = useTranslation()
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [caret, setCaret] = useState(value.length)
  const [active, setActive] = useState(0)
  // Los nombres se proponen al escribir, no al abrirla
  const [closed, setClosed] = useState(true)
  const checked = useMemo(() => checkFormula(value, context), [value, context])
  const problem = checked.problems[0]
  const writing = typing(value, caret)
  const options = writing && !closed ? namesFor(context.scope, writing.text) : []
  const open = options.length > 0

  const pick = (path: string) => {
    if (!writing) return
    const next = `${value.slice(0, writing.start)}@${path}${value.slice(caret)}`
    onChange(next)
    const at = writing.start + path.length + 1
    setCaret(at)
    setClosed(true)
    requestAnimationFrame(() => input.current?.setSelectionRange(at, at))
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => (i + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length)
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      // Intro elige y se queda; Tab elige y sigue al siguiente campo
      if (event.key === 'Enter') event.preventDefault()
      pick((options[active] ?? options[0])?.path ?? '')
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setClosed(true)
    }
  }

  return (
    <div className={styles.formula}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.formulaBox}>
        <input
          ref={input}
          id={id}
          className={styles.formulaInput}
          value={value}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          aria-invalid={Boolean(problem)}
          aria-describedby={compact && !problem ? undefined : `${id}-explain`}
          onChange={(event) => {
            onChange(event.currentTarget.value)
            setCaret(event.currentTarget.selectionStart ?? event.currentTarget.value.length)
            setActive(0)
            setClosed(false)
          }}
          onSelect={(event) => setCaret(event.currentTarget.selectionStart ?? 0)}
          onKeyDown={onKeyDown}
          onBlur={() => setClosed(true)}
        />
        {open && (
          <div id={listId} role="listbox" aria-label={t('systemEditor.suggestions')} className={styles.suggest}>
            {options.map((option, i) => (
              <div
                key={option.path}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                tabIndex={-1}
                className={i === active ? styles.suggestActive : styles.suggestOption}
                onMouseEnter={() => setActive(i)}
                // Antes de que el campo pierda el foco: el foco se queda en la fórmula
                onMouseDown={(event) => {
                  event.preventDefault()
                  pick(option.path)
                }}
              >
                <code>@{option.path}</code>
                <span>{option.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Solo se anuncia lo que falla: al renombrar un campo cambian muchas a la vez */}
      <p id={`${id}-explain`} className={problem ? styles.explainBad : compact ? styles.hidden : styles.explain}>
        {problem ? <TriangleAlert size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
        <span aria-live="polite">{problem?.message}</span>
        {!problem && t('systemEditor.formulaOk', { type: t(`systemEditor.formulaOkTypes.${checked.type}`) })}
      </p>
    </div>
  )
}
