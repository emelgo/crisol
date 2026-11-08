import { outsideOptions } from '@crisol/domain'
import { ChevronDown } from 'lucide-react'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './field-controls.module.css'

/**
 * Los controles de los campos de plantilla en el panel (ADR-0009): un desplegable para las opciones y un reloj con sus
 * segmentos. Flotan sin mover nada (docs/diseno.md)
 */

/** Los botones de las opciones de una lista abierta */
const optionsIn = (list: HTMLElement | null) => [
  ...(list?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])
]

/** Uno de una lista: un botón que abre la lista flotante. Un valor que no está en ella se ve marcado y no se pierde */
export function ChoiceSelect({
  id,
  label,
  value,
  options,
  onPick
}: {
  id: string
  label: string
  value: string
  options: readonly string[]
  onPick: (value: string) => void
}) {
  const { t } = useTranslation()
  const box = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  // Vacío para quitar el valor; después, las opciones
  const choices = ['', ...options]
  const outside = outsideOptions({ value, options })
  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    // El foco, a la elegida (o a «Ninguna»)
    const all = optionsIn(list.current)
    ;(all.find((option) => option.getAttribute('aria-selected') === 'true') ?? all[0])?.focus()
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  const pick = (choice: string) => {
    setOpen(false)
    button.current?.focus()
    if (choice !== value) onPick(choice)
  }
  const keys = (event: KeyboardEvent<HTMLElement>) => {
    const all = optionsIn(list.current)
    const at = all.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const by = event.key === 'ArrowDown' ? 1 : -1
      all[(at + by + all.length) % all.length]?.focus()
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      ;(event.key === 'Home' ? all[0] : all.at(-1))?.focus()
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault()
      setOpen(false)
      button.current?.focus()
    }
  }
  return (
    <div ref={box} className={styles.choice}>
      <button
        ref={button}
        id={id}
        type="button"
        className={styles.choiceButton}
        // Con lo que enseña dentro (lo elegido): el nombre accesible contiene el texto visible (WCAG 2.5.3)
        aria-label={`${label}: ${value || t('fields.choose')}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-outside={outside ? '' : undefined}
        title={outside ? t('fields.outside') : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <span className={value ? undefined : styles.placeholder}>{value || t('fields.choose')}</span>
        <ChevronDown size={14} aria-hidden="true" className={styles.chevron} />
      </button>
      {open && (
        <div ref={list} role="listbox" aria-label={label} className={styles.list} onKeyDown={keys}>
          {choices.map((choice) => (
            <button
              key={choice || '·'}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={choice === value}
              className={choice ? styles.option : `${styles.option} ${styles.none}`}
              onMouseEnter={(event) => event.currentTarget.focus()}
              onClick={() => pick(choice)}
            >
              {choice || t('fields.none')}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Un reloj de progreso: cada segmento se marca pulsándolo (y se desmarca pulsando el último lleno) */
export function ClockField({
  label,
  value,
  segments,
  onPick
}: {
  label: string
  value: number
  segments: number
  onPick: (value: number) => void
}) {
  const { t } = useTranslation()
  return (
    <fieldset className={styles.clock}>
      <legend className={styles.legend}>{label}</legend>
      <ClockFace value={value} segments={segments} />
      <div className={styles.segments}>
        {Array.from({ length: segments }, (_, i) => {
          const count = i + 1
          return (
            <button
              key={count}
              type="button"
              aria-pressed={value >= count}
              aria-label={t('fields.segment', { count, max: segments })}
              onClick={() => onPick(value === count ? count - 1 : count)}
            />
          )
        })}
      </div>
      <span className={styles.count}>{t('fields.clockValue', { value, max: segments })}</span>
    </fieldset>
  )
}

/** La esfera del reloj: sus cuñas, llenas las que van marcadas. Solo adorno: lo que cuenta son los botones */
export function ClockFace({ value, segments, size = 28 }: { value: number; segments: number; size?: number }) {
  const r = size / 2 - 1
  const c = size / 2
  const point = (i: number) => {
    const angle = (i / segments) * 2 * Math.PI - Math.PI / 2
    return `${(c + r * Math.cos(angle)).toFixed(2)} ${(c + r * Math.sin(angle)).toFixed(2)}`
  }
  return (
    <svg className={styles.face} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {Array.from({ length: segments }, (_, i) => {
        const count = i + 1
        return (
          <path
            key={count}
            d={`M${c} ${c} L${point(i)} A${r} ${r} 0 0 1 ${point(count)} Z`}
            data-full={count <= value ? '' : undefined}
          />
        )
      })}
    </svg>
  )
}
