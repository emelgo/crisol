/**
 * Paso 2 del editor, «¿Cómo se tira?» (lienzo de la tanda 8): primero lo imprescindible, el dado de siempre y cuándo
 * es crítico; después las tiradas que se repiten en la mesa, cada una con su fórmula, leída en palabras debajo, las
 * sugerencias de lo que hay en la ficha y «Tirar una vez» con la ficha de ejemplo (en el servidor, con el borrador)
 */
import {
  CRITICAL_RULES,
  characterType,
  formulaText,
  type Language,
  type Problem,
  type Roll,
  type System,
  textOf
} from '@crisol/systems'
import { useMutation } from '@tanstack/react-query'
import { ChevronDown, Dices, Plus, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../api/context.tsx'
import { useErrorText } from '../../api/errors.ts'
import { useAnnounce } from '../../components/announcer.tsx'
import { focusAfterRemoving, focusOnMount } from '../../components/focus.ts'
import { sampleData } from './example-sheet.tsx'
import { Help } from './help.tsx'
import { keyFor, withText } from './kinds.ts'
import styles from './rules.module.css'
import type { Change } from './rules-editor.tsx'

/** Lo que se puede poner en una fórmula: los campos de número del personaje, con su nombre y su ruta */
function suggestionsOf(system: System, language: Language) {
  const type = characterType(system)
  const fields = type ? (system.types[type]?.fields ?? {}) : {}
  const out: { label: string; ref: string }[] = []
  for (const [key, field] of Object.entries(fields)) {
    const label = textOf(field.label, language)
    if (field.kind === 'number' || field.kind === 'derived') out.push({ label, ref: `@${key}` })
    if (field.kind === 'resource') out.push({ label, ref: `@${key}` })
    if (field.kind === 'set')
      for (const [sub, f] of Object.entries(field.fields))
        if (f.kind === 'number' || f.kind === 'derived')
          out.push({ label: `${textOf(f.label, language)} (${label})`, ref: `@este.${sub}` })
  }
  return out.slice(0, 8)
}

export function RollsStep({
  system,
  language,
  change,
  problems
}: {
  system: System
  language: Language
  change: Change
  problems: Problem[]
}) {
  const { t } = useTranslation()
  const ids = { dice: useId(), critical: useId() }
  const [open, setOpen] = useState<string | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const rolls = Object.entries(system.rolls ?? {})
  const add = () => {
    const label = t('rules.rolls.new')
    const key = keyFor(label, Object.keys(system.rolls ?? {}))
    change((draft) => {
      draft.rolls ??= {}
      draft.rolls[key] = { label, formula: `${draft.dice?.default ?? '1d20'}` }
    })
    setOpen(key)
    setFresh(key)
  }
  return (
    <>
      <div className={styles.formRow}>
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor={ids.dice}>{t('rules.rolls.dice')}</label>
            <Help topic="dice" />
          </div>
          <input
            id={ids.dice}
            value={system.dice?.default ?? ''}
            autoComplete="off"
            spellCheck={false}
            placeholder="1d20"
            onChange={(event) => {
              const value = event.currentTarget.value.trim()
              change((draft) => {
                draft.dice = { critical: draft.dice?.critical ?? 'none', ...(value ? { default: value } : {}) }
              })
            }}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={ids.critical}>{t('rules.rolls.critical')}</label>
          <select
            id={ids.critical}
            value={system.dice?.critical ?? 'none'}
            onChange={(event) => {
              const critical = event.currentTarget.value as (typeof CRITICAL_RULES)[number]
              change((draft) => {
                draft.dice = { ...(draft.dice ?? {}), critical }
              })
            }}
          >
            {CRITICAL_RULES.map((rule) => (
              <option key={rule} value={rule}>
                {t(`rules.rolls.criticalRule.${rule}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <ul className={styles.rows}>
        {rolls.map(([key, roll]) => (
          <li key={key}>
            <RollRow
              rollKey={key}
              roll={roll}
              system={system}
              language={language}
              issues={problems.filter((p) => p.path === `rolls.${key}` || p.path.startsWith(`rolls.${key}.`))}
              focusName={fresh === key}
              open={open === key}
              onToggle={() => setOpen((now) => (now === key ? null : key))}
              onChange={(next) =>
                change((draft) => {
                  draft.rolls ??= {}
                  draft.rolls[key] = next
                })
              }
              onRemove={(item) => {
                const back = focusAfterRemoving(item)
                change(
                  (draft) => {
                    if (draft.rolls) delete draft.rolls[key]
                    if (draft.initiative === key) delete draft.initiative
                  },
                  t('rules.removed', { name: textOf(roll.label, language) })
                )
                requestAnimationFrame(back)
              }}
            />
          </li>
        ))}
      </ul>
      <div className={styles.add}>
        <span className={styles.addLabel}>{t('rules.add')}</span>
        <button type="button" className={styles.addButton} onClick={add}>
          <Plus size={14} aria-hidden="true" />
          {t('rules.rolls.add')}
        </button>
      </div>
    </>
  )
}

function RollRow({
  rollKey,
  roll,
  system,
  language,
  issues,
  focusName,
  open,
  onToggle,
  onChange,
  onRemove
}: {
  rollKey: string
  roll: Roll
  system: System
  language: Language
  issues: Problem[]
  focusName: boolean
  open: boolean
  onToggle: () => void
  onChange: (next: Roll) => void
  onRemove: (item: Element | null) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const announce = useAnnounce()
  const ids = { name: useId(), formula: useId(), body: useId(), error: useId() }
  const type = characterType(system)
  const words = type ? formulaText(roll.formula, { system, type, language }) : roll.formula
  const tryIt = useMutation({
    mutationFn: () => {
      const fields = type ? (system.types[type]?.fields ?? {}) : {}
      const element =
        roll.for && 'set' in roll.for
          ? (() => {
              const set = fields[roll.for.set]
              return set?.kind === 'set' ? set.elements[0]?.key : undefined
            })()
          : undefined
      return api.call('trySystemRoll', {
        draft: system as unknown as Record<string, unknown>,
        roll: rollKey,
        ...(element ? { element } : {}),
        document: { data: sampleData(fields) }
      })
    },
    onSuccess: (out) => announce(`${out.total} · ${out.detail}`),
    onError: (error) => announce(errorText(error))
  })
  // Otra fórmula: el resultado de antes ya no vale
  const write = (next: Roll) => {
    if (next.formula !== roll.formula) tryIt.reset()
    onChange(next)
  }
  return (
    <div className={styles.row} data-open={open || undefined} id={`tirada-${rollKey}`}>
      <button
        type="button"
        className={`${styles.rowHead} ${styles.rollHead}`}
        aria-expanded={open}
        aria-controls={ids.body}
        onClick={onToggle}
      >
        <span className={styles.rowName}>
          {textOf(roll.label, language) || rollKey}
          {roll.for && <small>{t('rules.rolls.forEach')}</small>}
        </span>
        <span className={styles.rowSummary} title={roll.formula}>
          {words}
        </span>
        <ChevronDown size={16} aria-hidden="true" className={styles.chevron} />
      </button>
      {open && (
        <div id={ids.body} className={styles.rowBody}>
          <div className={styles.form}>
            <div className={styles.field}>
              <label htmlFor={ids.name}>{t('rules.field.name')}</label>
              <input
                id={ids.name}
                ref={focusName ? focusOnMount : undefined}
                value={textOf(roll.label, language)}
                autoComplete="off"
                onChange={(event) =>
                  write({ ...roll, label: withText(roll.label, event.currentTarget.value, language) })
                }
              />
            </div>
            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label htmlFor={ids.formula}>{t('rules.rolls.formula')}</label>
                <Help topic="formula" />
              </div>
              <input
                id={ids.formula}
                value={roll.formula}
                aria-invalid={issues.length > 0 || undefined}
                aria-describedby={issues.length > 0 ? ids.error : undefined}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => write({ ...roll, formula: event.currentTarget.value })}
              />
              {issues.length > 0 && (
                <ul id={ids.error} className={styles.fieldErrors}>
                  {issues.map((p) => (
                    <li key={`${p.path}-${p.message}`} className={styles.fieldError}>
                      {p.message}
                    </li>
                  ))}
                </ul>
              )}
              <p className={styles.reads}>
                {t('rules.rolls.reads')} <b>{words}</b>
              </p>
              <div className={styles.suggest}>
                <span>{t('rules.rolls.suggestions')}</span>
                {suggestionsOf(system, language).map((s) => (
                  <button
                    key={s.ref}
                    type="button"
                    onClick={() => write({ ...roll, formula: `${roll.formula.trim()} + ${s.ref}` })}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.rowTools}>
            <button type="button" className={styles.try} onClick={() => tryIt.mutate()} disabled={tryIt.isPending}>
              <Dices size={14} aria-hidden="true" />
              {t('rules.rolls.try')}
            </button>
            <button
              type="button"
              className={styles.danger}
              onClick={(event) => onRemove(event.currentTarget.closest('li'))}
            >
              <Trash2 size={14} aria-hidden="true" />
              {t('rules.remove')}
            </button>
          </div>
          {(tryIt.data || tryIt.error) && (
            <p className={styles.tried}>
              {tryIt.data ? (
                <>
                  <strong>{tryIt.data.total}</strong>
                  <span>
                    {tryIt.data.detail}
                    {tryIt.data.band ? ` · ${tryIt.data.band.label}` : ''}
                  </span>
                </>
              ) : (
                <span>{errorText(tryIt.error)}</span>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
