/**
 * Lo de abajo de la ficha de dados: los dados rápidos, la ventaja, la tirada (explicada mientras se escribe), quién la
 * ve y «Tirar». La tira el servidor; aquí solo se pide
 */
import { type Campaign, type DiceRoll, visibilitiesFor } from '@crisol/contracts'
import { withAdvantage } from '@crisol/dice'
import { useMutation } from '@tanstack/react-query'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { useDice } from './context.tsx'
import styles from './dice.module.css'
import { addDie, explain } from './formula.ts'

/** Los dados rápidos, con su silueta */
const QUICK: readonly { sides: number; path: string }[] = [
  { sides: 4, path: 'M12 3l9 16H3z' },
  { sides: 6, path: 'M5 5h14v14H5z' },
  { sides: 8, path: 'M12 2l8 10-8 10-8-10z' },
  { sides: 10, path: 'M12 2l9 8-9 12-9-12z' },
  { sides: 12, path: 'M12 2l9.5 7-3.6 11H6.1L2.5 9z' },
  { sides: 20, path: 'M12 2l8.6 5v10L12 22l-8.6-5V7zM12 7l-5 8.5h10z' },
  { sides: 100, path: 'M8 3l6 6-6 9-6-9zM16 6l6 6-6 9-6-9z' }
]

const dieName = (sides: number) => (sides === 100 ? 'd%' : `d${sides}`)

export function Composer({ campaign, onRolled }: { campaign: Campaign; onRolled?: (roll: DiceRoll) => void }) {
  const { t } = useTranslation()
  const api = useApi()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const id = useId()
  // Empieza por la tirada por defecto del sistema de la campaña (sin sistema, 1d20); al cambiar de campaña, la suya, si
  // no se ha escrito otra
  const fallback = campaign.system?.defaultRoll ?? '1d20'
  const [formula, setFormula] = useState(fallback)
  const last = useRef(fallback)
  useEffect(() => {
    setFormula((current) => (current === last.current ? fallback : current))
    last.current = fallback
  }, [fallback])
  const options = visibilitiesFor(campaign.role)
  const dice = useDice()
  // Si la campaña cambia y lo elegido no vale en ella, todos
  const visibility = options.includes(dice.visibility) ? dice.visibility : 'all'
  const explained = explain(formula)
  const advantage = /2d20kh1/i.test(formula) ? 'advantage' : /2d20kl1/i.test(formula) ? 'disadvantage' : null
  const roll = useMutation({
    mutationFn: () => api.call('rollDice', { campaignId: campaign.id, formula, visibility }),
    onSuccess: ({ roll: done }) => {
      announce(t('dice.rolled', { label: done.label ?? done.formula, total: done.total }))
      onRolled?.(done)
    }
  })
  const toggle = (mode: 'advantage' | 'disadvantage') => {
    const next = withAdvantage(formula, advantage === mode ? 'none' : mode)
    setFormula(next ?? `${formula.trim() ? `${formula.trim()}+` : ''}${mode === 'advantage' ? '2d20kh1' : '2d20kl1'}`)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (explained.ok && !roll.isPending) roll.mutate()
  }
  return (
    <form className={styles.composer} onSubmit={submit}>
      <fieldset className={styles.quick}>
        <legend className={styles.hidden}>{t('dice.addDie')}</legend>
        {QUICK.map(({ sides, path }) => (
          <button
            key={sides}
            type="button"
            className={styles.quickDie}
            aria-label={t('dice.add', { die: dieName(sides) })}
            onClick={() => setFormula(addDie(formula, sides))}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={path} />
            </svg>
            {dieName(sides)}
          </button>
        ))}
      </fieldset>
      <div className={styles.pills}>
        <button
          type="button"
          className={styles.pill}
          aria-pressed={advantage === 'advantage'}
          onClick={() => toggle('advantage')}
        >
          {t('dice.advantage')}
        </button>
        <button
          type="button"
          className={styles.pill}
          aria-pressed={advantage === 'disadvantage'}
          onClick={() => toggle('disadvantage')}
        >
          {t('dice.disadvantage')}
        </button>
      </div>
      <label className={styles.hidden} htmlFor={`${id}-formula`}>
        {t('dice.formula')}
      </label>
      <div className={styles.formulaRow}>
        <input
          id={`${id}-formula`}
          className={styles.formula}
          value={formula}
          maxLength={300}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!explained.ok}
          aria-describedby={`${id}-explained`}
          onChange={(event) => setFormula(event.currentTarget.value)}
        />
        <button type="submit" className={styles.roll} disabled={!explained.ok || roll.isPending}>
          {t('dice.roll')}
        </button>
      </div>
      <p id={`${id}-explained`} className={explained.ok ? styles.explained : styles.wrong}>
        {explained.text}
      </p>
      {roll.error && <p className={styles.wrong}>{errorText(roll.error)}</p>}
      <div className={styles.pills} role="radiogroup" aria-label={t('dice.who')}>
        {options.map((option) => (
          <label key={option} className={styles.pill}>
            <input
              type="radio"
              className={styles.hidden}
              name={`${id}-who`}
              value={option}
              checked={visibility === option}
              onChange={() => dice.setVisibility(option)}
            />
            {t(`dice.visibility.${option}`)}
          </label>
        ))}
      </div>
    </form>
  )
}
