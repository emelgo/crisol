/**
 * El «?» del editor (lienzo de la tanda 8): un botón pequeño que abre, junto a él, qué es eso en una frase y un ejemplo
 * real y corto. Escape o pulsar fuera lo cierran y el foco vuelve al «?»
 */
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './rules.module.css'

export type HelpTopic = 'help' | 'formula' | 'derived' | 'dice'

export function Help({ topic }: { topic: HelpTopic }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const id = useId()
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!panel.current?.contains(target) && !button.current?.contains(target)) setOpen(false)
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', onEscape, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', onEscape, true)
    }
  }, [open])
  return (
    <span className={styles.helpWrap}>
      <button
        ref={button}
        type="button"
        className={styles.help}
        aria-label={t('rules.help.label', { what: t(`rules.help.${topic}.title`) })}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(event) => {
          // Dentro de una etiqueta: que no lleve el foco a su campo
          event.preventDefault()
          setOpen((now) => !now)
        }}
      >
        ?
      </button>
      {open && (
        <div ref={panel} id={id} role="note" className={styles.helpPanel}>
          <b>{t(`rules.help.${topic}.title`)}</b>
          <p>{t(`rules.help.${topic}.text`)}</p>
          <p className={styles.helpExample}>{t(`rules.help.${topic}.example`)}</p>
        </div>
      )}
    </span>
  )
}
